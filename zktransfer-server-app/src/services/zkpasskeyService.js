/**
 * ZkPasskey Service
 *
 * Wraps the NAPI-RS bindings for zkpasskey operations:
 * - Anchor generation from OIDC secrets
 * - Poseidon hashing
 * - ZK proof generation (server-side fallback for mobile)
 * - ZK parameter queries
 *
 * Also orchestrates the full account creation and recovery flows
 * by combining OIDC validation with NAPI crypto operations.
 */

import { createRequire } from "node:module";
import crypto from "node:crypto";
import {
  verifyOidcJwt,
  extractOidcSecret,
  getProviderRsaPublicKeyFromJwt,
} from "../lib/oidc.js";

// NAPI bindings use CommonJS require()
const require = createRequire(import.meta.url);

let napi = null;
let napiLoadError = null;

try {
  napi = require("../lib/napi/index.js");
} catch (err) {
  napiLoadError = err;
  console.warn(
    "[zkpasskeyService] NAPI binding not available, running in mock mode:",
    err.message
  );
}

export class ZkPasskeyService {
  constructor({ config, store, relayerService = null }) {
    this.config = config;
    this.store = store;
    this.relayerService = relayerService;
    this.napiAvailable = napi !== null;
    // In-memory Merkle tree (leaves are Poseidon hashes of OIDC provider RSA pubkeys)
    this._merkleLeaves = [];
    this._treeHeight = this.getZkParameters().treeHeight;
    this._providerLeafIndices = new Map();
  }

  // ─── Status ─────────────────────────────────────────────

  /**
   * Check if the native NAPI module is loaded and operational.
   */
  getStatus() {
    return {
      napiAvailable: this.napiAvailable,
      napiLoadError: napiLoadError ? napiLoadError.message : null,
      relayer: this.relayerService?.getStatus?.() || {
        relayerConfigured: false,
      },
    };
  }

  // ─── ZK Parameters ─────────────────────────────────────

  /**
   * Get the ZK circuit parameters (max lengths, n, k, tree height, etc.)
   */
  getZkParameters() {
    if (!this.napiAvailable) {
      // Return default parameters when NAPI is unavailable
      return {
        maxJwtB64Len: 1024,
        maxPayloadB64Len: 512,
        maxAudLen: 128,
        maxExpLen: 16,
        maxIssLen: 64,
        maxNonceLen: 64,
        maxSubLen: 64,
        n: 3,
        k: 2,
        treeHeight: 4,
        claims: ["iss", "sub", "aud", "exp", "nonce"],
      };
    }
    return napi.napiGetZkParameters();
  }

  // ─── Anchor Generation ──────────────────────────────────

  /**
   * Generate a Poseidon anchor from OIDC secrets.
   *
   * @param {Array<{iss: string, sub: string, aud?: string}>} secrets
   * @returns {{ anchor: string[] }} Array of anchor hash parts
   */
  generateAnchor(secrets) {
    if (!this.napiAvailable) {
      throw new Error("NAPI binding not available for anchor generation");
    }
    return napi.napiGenerateAnchor({ secrets });
  }

  /**
   * Compute a Poseidon hash of the given inputs.
   *
   * @param {string[]} inputs - Hex-encoded field elements
   * @returns {{ hash: string }} Poseidon hash result
   */
  poseidonHash(inputs) {
    if (!this.napiAvailable) {
      throw new Error("NAPI binding not available for Poseidon hash");
    }
    return napi.napiGeneratePoseidonHash({ inputs });
  }

  // ─── Account Creation Flow ──────────────────────────────

  /**
   * Validate JWTs from social providers, generate anchor, and return
   * the data needed for on-chain ZkKeyAccount deployment.
   *
   * @param {Object} params
   * @param {string[]} params.jwts - Raw JWT strings from OIDC providers
   * @param {string[]} params.providers - Provider names matching each JWT
   * @param {string} params.txKeyAddress - Initial ECDSA transaction key address
   * @returns {Promise<Object>} Account creation data
   */
  async createAccount({ jwts, providers, txKeyAddress }) {
    if (jwts.length !== providers.length) {
      throw new Error("jwts and providers arrays must have the same length");
    }

    const params = this.getZkParameters();
    if (jwts.length < params.n) {
      throw new Error(
        `Need ${params.n} provider JWTs, got ${jwts.length}`
      );
    }

    // 1. Verify each JWT against its provider's JWKS
    const verifiedPayloads = [];
    for (let i = 0; i < jwts.length; i++) {
      const verified = await verifyOidcJwt(jwts[i], providers[i]);
      verifiedPayloads.push(verified);
    }

    // 2. Extract OIDC secrets for anchor generation
    const secrets = verifiedPayloads.map(extractOidcSecret);
    // The proving path reconstructs anchor secrets from the raw JWT claim parser:
    // `iss`/`sub` are string literals including JSON quotes, while `aud` is absent.
    const anchorSecrets = secrets.map(normalizeSecretForAnchorGeneration);

    // 3. Generate Poseidon anchor via NAPI
    const anchorResult = this.generateAnchor(anchorSecrets);
    const anchorHash = chainPoseidonHash(
      (inputs) => this.poseidonHash(inputs).hash,
      anchorResult.anchor
    );

    const accountId = createSocialRecoveryAccountId(secrets, providers);
    const existingAccount = this.store?.getSocialRecoveryAccount
      ? await this.store.getSocialRecoveryAccount(accountId)
      : null;

    let chainAccount = existingAccount?.chainAccount || null;
    if (!chainAccount && this.relayerService?.isConfigured?.()) {
      chainAccount = await this.relayerService.deploySocialAccount({
        accountId,
        txKeyAddress,
        anchorParts: anchorResult.anchor,
        threshold: { n: params.n, k: params.k },
      });
    }

    // 4. Store account metadata for future recovery
    const accountData = {
      accountId,
      txKeyAddress,
      providers,
      anchorParts: anchorResult.anchor,
      anchorHash,
      secrets: secrets.map((s) => ({ iss: s.iss, sub: s.sub })), // Strip aud for privacy
      createdAt: new Date().toISOString(),
      chainAccount,
    };

    if (this.store?.upsertSocialRecoveryAccount) {
      await this.store.upsertSocialRecoveryAccount({
        ...accountData,
        threshold: { n: params.n, k: params.k },
        updatedAt: accountData.createdAt,
      });
    }

    return {
      anchor: anchorResult.anchor,
      anchorHash,
      txKeyAddress,
      providers,
      accountData,
      chainAccount,
    };
  }

  async findRecoveryAccount({ jwts, providers }) {
    if (jwts.length !== providers.length) {
      throw new Error("jwts and providers arrays must have the same length");
    }

    const params = this.getZkParameters();
    if (jwts.length < params.k) {
      throw new Error(
        `Need at least ${params.k} provider JWTs for recovery lookup, got ${jwts.length}`
      );
    }

    const verifiedPayloads = [];
    for (let i = 0; i < jwts.length; i++) {
      const verified = await verifyOidcJwt(jwts[i], providers[i]);
      verifiedPayloads.push(verified);
    }

    const secrets = verifiedPayloads.map(extractOidcSecret);
    const requestedKeys = new Set(
      secrets.map((secret, index) =>
        createSecretMatchKey({
          iss: secret.iss,
          sub: secret.sub,
          provider: providers[index],
        })
      )
    );

    const accounts = this.store?.listSocialRecoveryAccounts
      ? await this.store.listSocialRecoveryAccounts()
      : [];

    const matches = accounts.filter((account) => {
      const accountKeys = new Set(
        (account.secrets || []).map((secret, index) =>
          createSecretMatchKey({
            iss: secret.iss,
            sub: secret.sub,
            provider: account.providers?.[index],
          })
        )
      );

      for (const key of requestedKeys) {
        if (!accountKeys.has(key)) {
          return false;
        }
      }

      return true;
    });

    if (matches.length === 0) {
      throw new Error("No social recovery account matched the authenticated providers");
    }

    if (matches.length > 1) {
      throw new Error("Multiple social recovery accounts matched the authenticated providers");
    }

    return matches[0];
  }

  async buildRecoveryContext({ jwts, providers }) {
    const account = await this.findRecoveryAccount({ jwts, providers });
    const pkOps = [];
    const merklePaths = [];
    const leafIndices = [];
    let root = BigInt(this._computeRoot()).toString();

    for (let i = 0; i < jwts.length; i++) {
      const verified = await verifyOidcJwt(jwts[i], providers[i]);
      const secret = extractOidcSecret(verified);
      const providerPublicKey = await getProviderRsaPublicKeyFromJwt(
        jwts[i],
        providers[i]
      );
      const publicKey = providerPublicKey.n;
      let leafIndex;
      let merklePathNodes;

      if (this.relayerService?.isConfigured?.()) {
        const leaf = createProviderLeaf({
          iss: secret.iss,
          publicKey,
          maxIssLen: this.getZkParameters().maxIssLen,
          poseidonHash: (inputs) => this.poseidonHash(inputs).hash,
        });
        const pubkeyHash = createProviderKeyHash(publicKey);
        await this.relayerService.ensureMerkleLeaf({
          leaf,
          pubkeyHash,
        });
        const chainProof = await this.relayerService.getMerkleProofByPubkeyHash(pubkeyHash);
        leafIndex = chainProof.leafIndex;
        merklePathNodes = chainProof.path;
        root = BigInt(chainProof.root).toString();
      } else {
        leafIndex = this.ensureProviderLeaf(publicKey);
        merklePathNodes = this.getMerklePath(leafIndex).path;
      }

      pkOps.push(publicKey);
      merklePaths.push(merklePathNodes.map((node) => BigInt(node).toString()));
      leafIndices.push(leafIndex);
    }

    let counter = "0";
    if (
      account.chainAccount?.zkAccountAddress &&
      this.relayerService?.isConfigured?.()
    ) {
      const chainState = await this.relayerService.getRecoveryAccountState({
        zkAccountAddress: account.chainAccount.zkAccountAddress,
      });
      counter = chainState.recoveryCounter;
    }

    return {
      account,
      proofContext: {
        pkOps,
        merklePaths,
        leafIndices,
        root,
        anchor: buildProofAnchor({
          anchorParts: account.anchorParts || [],
          anchorHash:
            account.anchorHash ||
            (account.anchorParts?.length
              ? chainPoseidonHash(
                  (inputs) => this.poseidonHash(inputs).hash,
                  account.anchorParts
                )
              : null),
        }),
        counter,
      },
    };
  }

  async prepareRecoveryChallenge({ jwts, providers, newTxKeyAddress }) {
    const context = await this.buildRecoveryContext({ jwts, providers });
    if (!context.account.chainAccount?.zkAccountAddress) {
      throw new Error(
        "The matched social account does not have an on-chain zk account yet"
      );
    }
    if (!this.relayerService?.isConfigured?.()) {
      throw new Error("zkpasskey relayer is not configured for recovery");
    }

    const prepared = await this.relayerService.prepareRecoveryOperation({
      zkAccountAddress: context.account.chainAccount.zkAccountAddress,
      newTxKeyAddress,
      expectedCounter: context.proofContext.counter,
    });
    const random = ethersHexRandom(31);
    const nonce = this.poseidonHash([
      prepared.signedUserOpHash,
      context.proofContext.counter,
      random,
    ]).hash;

    return {
      account: context.account,
      proofContext: {
        ...context.proofContext,
        counter: prepared.accountState.recoveryCounter,
      },
      challenge: {
        zkAccountAddress: context.account.chainAccount.zkAccountAddress,
        masterKeyVerifierAddress: prepared.accountState.masterKeyVerifierAddress,
        newTxKeyAddress,
        random,
        nonce,
        userOpHash: prepared.userOpHash,
        signedUserOpHash: prepared.signedUserOpHash,
        userOperation: {
          sender: prepared.userOp.sender,
          nonce: prepared.userOp.nonce.toString(),
          callData: prepared.userOp.callData,
        },
      },
    };
  }

  async submitRecovery({
    jwts,
    providers,
    newTxKeyAddress,
    random,
  }) {
    const context = await this.buildRecoveryContext({ jwts, providers });
    if (!context.account.chainAccount?.zkAccountAddress) {
      throw new Error(
        "The matched social account does not have an on-chain zk account yet"
      );
    }
    if (!this.relayerService?.isConfigured?.()) {
      throw new Error("zkpasskey relayer is not configured for recovery");
    }

    const preparedOperation = await this.relayerService.prepareRecoveryOperation({
      zkAccountAddress: context.account.chainAccount.zkAccountAddress,
      newTxKeyAddress,
      expectedCounter: context.proofContext.counter,
    });

    const proofResult = await this.generateRecoveryProof({
      jwts,
      providers,
      pkOps: context.proofContext.pkOps,
      merklePaths: context.proofContext.merklePaths,
      leafIndices: context.proofContext.leafIndices,
      root: context.proofContext.root,
      anchor: context.proofContext.anchor,
      hSignUserOp: preparedOperation.signedUserOpHash,
      counter: context.proofContext.counter,
      random,
    });

    const submission = await this.relayerService.submitRecoveryOperation({
      zkAccountAddress: context.account.chainAccount.zkAccountAddress,
      newTxKeyAddress,
      proofResult,
      expectedCounter: context.proofContext.counter,
    });

    return {
      account: context.account,
      challenge: {
        zkAccountAddress: context.account.chainAccount.zkAccountAddress,
        masterKeyVerifierAddress: preparedOperation.accountState.masterKeyVerifierAddress,
        newTxKeyAddress,
        random,
        userOpHash: preparedOperation.userOpHash,
        signedUserOpHash: preparedOperation.signedUserOpHash,
      },
      proof: proofResult,
      submission,
    };
  }

  // ─── Recovery Flow (Server-side proof generation) ───────

  /**
   * Generate a ZK recovery proof on the server.
   * This is a fallback for when the mobile client cannot generate
   * the proof locally (e.g., insufficient device resources).
   *
   * @param {Object} params
   * @param {string[]} params.jwts - k JWT tokens from social logins
   * @param {string[]} params.providers - Provider names for each JWT
   * @param {string[]} params.pkOps - RSA public keys (JSON-encoded)
   * @param {string[][]} params.merklePaths - Merkle proof paths
   * @param {number[]} params.leafIndices - Leaf indices in the Merkle tree
   * @param {string} params.root - Current Merkle root
   * @param {string[]} params.anchor - Registered anchor hash parts
   * @param {string} params.hSignUserOp - Hash of the UserOp being authorized
   * @param {string} params.counter - Current counter value
   * @param {string} params.random - Random nonce
   * @returns {Promise<Object>} Generated proof result
   */
  async generateRecoveryProof({
    jwts,
    providers,
    pkOps,
    merklePaths,
    leafIndices,
    root,
    anchor,
    hSignUserOp,
    counter,
    random,
  }) {
    if (!this.napiAvailable) {
      throw new Error("NAPI binding not available for proof generation");
    }

    const params = this.getZkParameters();
    if (jwts.length < params.k) {
      throw new Error(
        `Need at least ${params.k} JWTs for recovery, got ${jwts.length}`
      );
    }

    // Verify JWTs first
    for (let i = 0; i < jwts.length; i++) {
      await verifyOidcJwt(jwts[i], providers[i]);
    }

    // Determine proving key path
    const pkPath =
      this.config.zkpasskeyPkPath || "./crs/zkpasskey_pk.key";

    // Generate proof via NAPI
    const proofResult = napi.napiGenerateSeparatedProof({
      pkPath,
      jwts,
      pkOps,
      merklePaths,
      leafIndices,
      root,
      anchor,
      hSignUserOp,
      counter,
      random,
    });

    return {
      proofs: proofResult.proofs,
      sharedInputs: proofResult.sharedInputs,
      partialRhsList: proofResult.partialRhsList,
    };
  }

  // ─── Merkle Tree Operations ─────────────────────────────

  /**
   * Insert a commitment (Poseidon hash of an OIDC provider RSA public key)
   * into the in-memory Merkle tree.
   *
   * @param {string} commitment - Hex-encoded Poseidon hash
   * @returns {{ leafIndex: number }} The index where it was inserted
   */
  insertLeaf(commitment) {
    const maxLeaves = 1 << this._treeHeight;
    if (this._merkleLeaves.length >= maxLeaves) {
      throw new Error(`Merkle tree is full (max ${maxLeaves} leaves)`);
    }
    const leafIndex = this._merkleLeaves.length;
    this._merkleLeaves.push(commitment);
    return { leafIndex };
  }

  ensureProviderLeaf(publicKey) {
    const keyHash = createProviderKeyHash(publicKey);
    const existing = this._providerLeafIndices.get(keyHash);
    if (existing !== undefined) {
      return existing;
    }
    const { leafIndex } = this.insertLeaf(keyHash);
    this._providerLeafIndices.set(keyHash, leafIndex);
    return leafIndex;
  }

  /**
   * Compute the Merkle root from current leaves.
   * Uses Poseidon hash via NAPI when available, otherwise SHA-256 approximation.
   */
  _computeLayer(nodes) {
    const result = [];
    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = i + 1 < nodes.length ? nodes[i + 1] : "0x" + "0".repeat(64);
      if (this.napiAvailable) {
        const hashResult = this.poseidonHash([left, right]);
        result.push(hashResult.hash);
      } else {
        // Deterministic mock: concatenate and take first 64 hex chars
        const combined = left.replace("0x", "") + right.replace("0x", "");
        let hash = 0n;
        for (let j = 0; j < Math.min(combined.length, 32); j++) {
          hash = (hash * 31n + BigInt(combined.charCodeAt(j))) % (2n ** 256n);
        }
        result.push("0x" + hash.toString(16).padStart(64, "0"));
      }
    }
    return result;
  }

  _computeRoot() {
    if (this._merkleLeaves.length === 0) {
      return "0x" + "0".repeat(64);
    }

    const maxLeaves = 1 << this._treeHeight;
    // Pad leaves to next power of 2
    const paddedLeaves = [...this._merkleLeaves];
    while (paddedLeaves.length < maxLeaves) {
      paddedLeaves.push("0x" + "0".repeat(64));
    }

    let currentLayer = paddedLeaves;
    while (currentLayer.length > 1) {
      currentLayer = this._computeLayer(currentLayer);
    }
    return currentLayer[0];
  }

  /**
   * Get the current Merkle tree state.
   */
  getMerkleRoot() {
    return {
      root: this._computeRoot(),
      numLeaves: this._merkleLeaves.length,
      treeHeight: this._treeHeight,
    };
  }

  /**
   * Get a Merkle proof for a specific leaf index.
   */
  getMerklePath(leafIndex) {
    if (leafIndex < 0 || leafIndex >= (1 << this._treeHeight)) {
      throw new Error(`Invalid leaf index: ${leafIndex}`);
    }

    const maxLeaves = 1 << this._treeHeight;
    const paddedLeaves = [...this._merkleLeaves];
    while (paddedLeaves.length < maxLeaves) {
      paddedLeaves.push("0x" + "0".repeat(64));
    }

    const path = [];
    const indices = [];
    let currentLayer = paddedLeaves;
    let currentIndex = leafIndex;

    for (let level = 0; level < this._treeHeight; level++) {
      const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
      path.push(siblingIndex < currentLayer.length ? currentLayer[siblingIndex] : "0x" + "0".repeat(64));
      indices.push(currentIndex % 2);
      currentLayer = this._computeLayer(currentLayer);
      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      root: this._computeRoot(),
      path,
      indices,
    };
  }
}

function createSecretMatchKey({ iss, sub, provider }) {
  return `${provider || ""}::${iss || ""}::${sub || ""}`;
}

function createSocialRecoveryAccountId(secrets, providers) {
  const normalized = secrets
    .map((secret, index) => createSecretMatchKey({
      iss: secret.iss,
      sub: secret.sub,
      provider: providers[index],
    }))
    .sort()
    .join("|");

  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function createProviderKeyHash(publicKey) {
  return `0x${crypto
    .createHash("sha256")
    .update(publicKey, "utf8")
    .digest("hex")}`;
}

function buildProofAnchor({ anchorParts, anchorHash }) {
  if (!Array.isArray(anchorParts) || anchorParts.length === 0) {
    return [];
  }
  if (!anchorHash) {
    return [...anchorParts];
  }
  return [...anchorParts, anchorHash];
}

export function normalizeSecretForAnchorGeneration(secret) {
  return {
    aud: "",
    iss: normalizeJwtStringClaimValue(secret?.iss),
    sub: normalizeJwtStringClaimValue(secret?.sub),
  };
}

export function normalizeJwtStringClaimValue(value) {
  return JSON.stringify(String(value || ""));
}

export function chainPoseidonHash(poseidonHash, values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("chainPoseidonHash requires at least one value");
  }
  let hash = poseidonHash([values[0]]);
  for (const value of values.slice(1)) {
    hash = poseidonHash([hash, value]);
  }
  return hash;
}

function ethersHexRandom(length) {
  return `0x${crypto.randomBytes(length).toString("hex")}`;
}

export function createProviderLeaf({ iss, publicKey, maxIssLen, poseidonHash }) {
  const issLimbs = stringToFieldLimbs(normalizeJwtStringClaimValue(iss), maxIssLen);
  const modulusLimbs = rsaModulusToFieldLimbs(publicKey);
  return poseidonHash([...issLimbs, ...modulusLimbs]);
}

export function stringToFieldLimbs(value, targetLength) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > targetLength) {
    throw new Error(`issuer length ${bytes.length} exceeds max ${targetLength}`);
  }
  const padded = Buffer.alloc(targetLength, 0);
  bytes.copy(padded);
  const limbWidth = 31;
  if (padded.length % limbWidth !== 0) {
    throw new Error(`issuer padded length ${padded.length} is not a multiple of ${limbWidth}`);
  }

  const limbs = [];
  for (let offset = 0; offset < padded.length; offset += limbWidth) {
    const chunk = padded.subarray(offset, offset + limbWidth);
    limbs.push(bufferToBigInt(chunk).toString());
  }
  return limbs;
}

export function rsaModulusToFieldLimbs(publicKey) {
  const decoded = decodeBase64Url(publicKey);
  let value = bufferToBigInt(decoded);
  const mask = (1n << 64n) - 1n;
  const limbs = [];
  for (let i = 0; i < 32; i++) {
    limbs.push((value & mask).toString());
    value >>= 64n;
  }
  return limbs;
}

function decodeBase64Url(value) {
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4 !== 0) {
    normalized += "=";
  }
  return Buffer.from(normalized, "base64");
}

function bufferToBigInt(buffer) {
  const hex = buffer.toString("hex");
  return BigInt(`0x${hex || "0"}`);
}
