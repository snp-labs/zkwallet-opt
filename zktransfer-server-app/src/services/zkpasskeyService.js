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
import { verifyOidcJwt, extractOidcSecret } from "../lib/oidc.js";

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
  constructor({ config, store }) {
    this.config = config;
    this.store = store;
    this.napiAvailable = napi !== null;
    // In-memory Merkle tree (leaves are Poseidon hashes of OIDC provider RSA pubkeys)
    this._merkleLeaves = [];
    this._treeHeight = this.getZkParameters().treeHeight;
  }

  // ─── Status ─────────────────────────────────────────────

  /**
   * Check if the native NAPI module is loaded and operational.
   */
  getStatus() {
    return {
      napiAvailable: this.napiAvailable,
      napiLoadError: napiLoadError ? napiLoadError.message : null,
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

    // 3. Generate Poseidon anchor via NAPI
    const anchorResult = this.generateAnchor(secrets);

    // 4. Store account metadata for future recovery
    const accountData = {
      txKeyAddress,
      providers,
      anchorParts: anchorResult.anchor,
      secrets: secrets.map((s) => ({ iss: s.iss, sub: s.sub })), // Strip aud for privacy
      createdAt: new Date().toISOString(),
    };

    return {
      anchor: anchorResult.anchor,
      txKeyAddress,
      providers,
      accountData,
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
