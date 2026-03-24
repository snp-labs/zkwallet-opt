import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..", "..", "..");
const buildInfoPath = path.join(
  workspaceRoot,
  "vendor",
  "zkpasskey",
  "contract",
  "artifacts",
  "build-info",
  "765b6916c62182d2b1ce3d6ffb110568.json"
);

const FACTORY_ABI = [
  "function createAccount(uint256 salt, address masterKeyVerifier, address initialTxKey) returns (address)",
  "function calcAccountAddress(uint256 salt, address masterKeyVerifier, address initialTxKey) view returns (address)",
];

const ACCOUNT_ABI = [
  "function getNonce() view returns (uint256)",
  "function txKey() view returns (address)",
  "function masterKey() view returns (address)",
  "function recoveryCnt() view returns (uint256)",
];

const ENTRY_POINT_ABI = [
  "function getUserOpHash((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature) userOp) view returns (bytes32)",
  "function handleOps((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature)[] ops, address beneficiary)",
  "function depositTo(address account) payable",
  "function balanceOf(address account) view returns (uint256)",
];

const VERIFIER_ABI = [
  "function initialize(bytes encoded, address merkleTree)",
  "function transferOwnership(address newOwner)",
  "function getAnchor() view returns (uint256[])",
];

const MERKLE_TREE_ABI = [
  "function insertCm(bytes32 cm, bytes32 pubkeyHash) returns (uint256 index, bytes32 root)",
  "function getMerklePath(uint256 idx) view returns (bytes32[])",
  "function getLeafIndexByPubkeyHash(bytes32 pubkeyHash) view returns (uint256)",
  "function getRoot() view returns (bytes32)",
  "function getNumLeaves() view returns (uint256)",
  "function indexToCm(uint256 idx) view returns (bytes32)",
];

const ERC1967_PROXY_ABI = [
  "constructor(address _logic, bytes memory _data)",
];

let cachedBuildInfo = null;

function loadBuildInfo() {
  if (cachedBuildInfo) {
    return cachedBuildInfo;
  }
  cachedBuildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"));
  return cachedBuildInfo;
}

function getContractBuildOutput(contractName) {
  const buildInfo = loadBuildInfo();
  for (const contracts of Object.values(buildInfo.output.contracts || {})) {
    if (contracts[contractName]) {
      return contracts[contractName];
    }
  }
  throw new Error(`Unable to find build output for ${contractName}`);
}

function getContractBytecode(contractName) {
  const contract = getContractBuildOutput(contractName);
  const bytecode = contract?.evm?.bytecode?.object;
  if (!bytecode) {
    throw new Error(`Missing bytecode for ${contractName}`);
  }
  return bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`;
}

function normalizeHexValue(value) {
  if (typeof value === "bigint") {
    return `0x${value.toString(16)}`;
  }
  return value;
}

function toDecimalString(value) {
  return BigInt(value).toString();
}

function toBytes32(value) {
  if (typeof value === "bigint") {
    return ethers.toBeHex(value, 32);
  }
  if (typeof value === "string") {
    return ethers.toBeHex(BigInt(value), 32);
  }
  return ethers.zeroPadValue(value, 32);
}

function createPackedUserOp({
  sender,
  nonce,
  initCode = "0x",
  callData = "0x",
  verificationGasLimit,
  callGasLimit,
  preVerificationGas,
  maxFeePerGas,
  maxPriorityFeePerGas,
}) {
  return {
    sender,
    nonce: BigInt(nonce),
    initCode,
    callData,
    accountGasLimits: ethers.solidityPacked(
      ["uint128", "uint128"],
      [BigInt(verificationGasLimit), BigInt(callGasLimit)]
    ),
    preVerificationGas: BigInt(preVerificationGas),
    gasFees: ethers.solidityPacked(
      ["uint128", "uint128"],
      [BigInt(maxFeePerGas), BigInt(maxPriorityFeePerGas)]
    ),
    paymasterAndData: "0x",
    signature: "0x",
  };
}

function encodeProofSignature(proofResult) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256[6]", "uint256[]", "uint256[8][]"],
    [proofResult.sharedInputs, proofResult.partialRhsList, proofResult.proofs]
  );
}

export class ZkPasskeyRelayerService {
  constructor({ config }) {
    this.config = config;
    this.provider =
      config.zkpasskeyRpcUrl && config.zkpasskeyRelayerPrivateKey
        ? new ethers.JsonRpcProvider(config.zkpasskeyRpcUrl)
        : null;
    this.wallet =
      this.provider && config.zkpasskeyRelayerPrivateKey
        ? new ethers.Wallet(config.zkpasskeyRelayerPrivateKey, this.provider)
        : null;
    this.signer = this.wallet;
    this.nextNonce = null;
  }

  isConfigured() {
    return Boolean(
      this.provider &&
        this.signer &&
        this.config.zkpasskeyEntryPointAddress &&
        this.config.zkpasskeyFactoryAddress &&
        this.config.zkpasskeyVerifierAddress &&
        this.config.zkpasskeyMerkleTreeAddress
    );
  }

  getStatus() {
    return {
      relayerConfigured: this.isConfigured(),
      rpcUrlConfigured: Boolean(this.config.zkpasskeyRpcUrl),
      entryPointConfigured: Boolean(this.config.zkpasskeyEntryPointAddress),
      factoryConfigured: Boolean(this.config.zkpasskeyFactoryAddress),
      verifierConfigured: Boolean(this.config.zkpasskeyVerifierAddress),
      merkleTreeConfigured: Boolean(this.config.zkpasskeyMerkleTreeAddress),
      relayerKeyConfigured: Boolean(this.config.zkpasskeyRelayerPrivateKey),
    };
  }

  _requireConfigured() {
    if (!this.isConfigured()) {
      throw new Error(
        "zkpasskey relayer is not configured. Set RPC URL, relayer key, entry point, factory, verifier logic, and merkle tree addresses."
      );
    }
  }

  _getEntryPoint() {
    this._requireConfigured();
    return new ethers.Contract(
      this.config.zkpasskeyEntryPointAddress,
      ENTRY_POINT_ABI,
      this.signer
    );
  }

  _getFactory() {
    this._requireConfigured();
    return new ethers.Contract(
      this.config.zkpasskeyFactoryAddress,
      FACTORY_ABI,
      this.signer
    );
  }

  _getAccount(accountAddress) {
    this._requireConfigured();
    return new ethers.Contract(accountAddress, ACCOUNT_ABI, this.signer);
  }

  _getVerifier(verifierAddress) {
    this._requireConfigured();
    return new ethers.Contract(verifierAddress, VERIFIER_ABI, this.signer);
  }

  _getMerkleTree() {
    this._requireConfigured();
    return new ethers.Contract(
      this.config.zkpasskeyMerkleTreeAddress,
      MERKLE_TREE_ABI,
      this.signer
    );
  }

  _getBeneficiaryAddress() {
    return this.config.zkpasskeyBeneficiaryAddress || this.wallet.address;
  }

  async _consumeNonce() {
    this._requireConfigured();
    if (this.nextNonce === null) {
      this.nextNonce = await this.provider.getTransactionCount(
        this.wallet.address,
        "pending"
      );
    }
    const nonce = this.nextNonce;
    this.nextNonce += 1;
    return nonce;
  }

  async _withNonce(sendTx) {
    const nonce = await this._consumeNonce();
    try {
      return await sendTx({ nonce });
    } catch (error) {
      this.nextNonce = null;
      throw error;
    }
  }

  async _maybeFundAccount(accountAddress, amountWei) {
    const amount = BigInt(amountWei || 0);
    if (amount <= 0n) {
      return null;
    }

    const entryPoint = this._getEntryPoint();
    const balance = BigInt(await entryPoint.balanceOf(accountAddress));
    if (balance >= amount) {
      return null;
    }

    const tx = await this._withNonce((overrides) =>
      entryPoint.depositTo(accountAddress, {
        value: amount - balance,
        ...overrides,
      })
    );
    const receipt = await tx.wait();
    return {
      txHash: receipt?.hash || tx.hash,
      fundedToWei: amount.toString(),
      mode: "entrypoint-deposit",
    };
  }

  createSaltFromAccountId(accountId) {
    return BigInt(`0x${accountId}`);
  }

  async deploySocialAccount({ accountId, txKeyAddress, anchorParts, threshold }) {
    this._requireConfigured();

    const proxyFactory = new ethers.ContractFactory(
      ERC1967_PROXY_ABI,
      getContractBytecode("ERC1967Proxy"),
      this.signer
    );
    const verifierInterface = new ethers.Interface(VERIFIER_ABI);
    const encodedAnchor = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "uint256", "uint256[]"],
      [BigInt(threshold.n), BigInt(threshold.k), anchorParts.map((part) => BigInt(part))]
    );
    const verifierInitData = verifierInterface.encodeFunctionData("initialize", [
      encodedAnchor,
      this.config.zkpasskeyMerkleTreeAddress,
    ]);

    const verifierProxy = await this._withNonce((overrides) =>
      proxyFactory.deploy(this.config.zkpasskeyVerifierAddress, verifierInitData, overrides)
    );
    await verifierProxy.waitForDeployment();

    const masterKeyVerifierAddress = await verifierProxy.getAddress();
    const factory = this._getFactory();
    const salt = this.createSaltFromAccountId(accountId);
    const zkAccountAddress = await factory.calcAccountAddress(
      salt,
      masterKeyVerifierAddress,
      txKeyAddress
    );

    const verifier = this._getVerifier(masterKeyVerifierAddress);
    const ownershipTx = await this._withNonce((overrides) =>
      verifier.transferOwnership(zkAccountAddress, overrides)
    );
    const ownershipReceipt = await ownershipTx.wait();

    const createAccountTx = await this._withNonce((overrides) =>
      factory.createAccount(salt, masterKeyVerifierAddress, txKeyAddress, overrides)
    );
    const createAccountReceipt = await createAccountTx.wait();

    const funding = await this._maybeFundAccount(
      zkAccountAddress,
      this.config.zkpasskeyCreateAccountFundingWei
    );
    const network = await this.provider.getNetwork();

    return {
      mode: "onchain",
      chainId: network.chainId.toString(),
      salt: salt.toString(),
      entryPointAddress: this.config.zkpasskeyEntryPointAddress,
      masterKeyVerifierAddress,
      zkAccountAddress,
      verifierDeploymentTxHash: verifierProxy.deploymentTransaction()?.hash || null,
      ownershipTransferTxHash: ownershipReceipt?.hash || ownershipTx.hash,
      accountCreationTxHash: createAccountReceipt?.hash || createAccountTx.hash,
      funding,
    };
  }

  async getRecoveryAccountState({ zkAccountAddress }) {
    this._requireConfigured();
    if (!zkAccountAddress) {
      throw new Error("zkAccountAddress is required for on-chain recovery");
    }

    const account = this._getAccount(zkAccountAddress);
    const [nonce, txKeyAddress, masterKeyVerifierAddress, recoveryCounter] =
      await Promise.all([
        account.getNonce(),
        account.txKey(),
        account.masterKey(),
        account.recoveryCnt(),
      ]);

    return {
      zkAccountAddress,
      nonce: nonce.toString(),
      txKeyAddress,
      masterKeyVerifierAddress,
      recoveryCounter: recoveryCounter.toString(),
    };
  }

  async ensureMerkleLeaf({ leaf, pubkeyHash }) {
    const merkleTree = this._getMerkleTree();
    const normalizedLeaf = toBytes32(leaf);
    const normalizedPubkeyHash = toBytes32(pubkeyHash);
    const [numLeaves, mappedIndex] = await Promise.all([
      merkleTree.getNumLeaves(),
      merkleTree.getLeafIndexByPubkeyHash(normalizedPubkeyHash),
    ]);

    if (BigInt(numLeaves) > 0n && BigInt(mappedIndex) < BigInt(numLeaves)) {
      const existingLeaf = await merkleTree.indexToCm(mappedIndex);
      if (existingLeaf.toLowerCase() === normalizedLeaf.toLowerCase()) {
        return {
          leafIndex: Number(mappedIndex),
          inserted: false,
          root: await merkleTree.getRoot(),
        };
      }
    }

    const tx = await this._withNonce((overrides) =>
      merkleTree.insertCm(normalizedLeaf, normalizedPubkeyHash, overrides)
    );
    const receipt = await tx.wait();
    const root = await merkleTree.getRoot();
    const leafIndex = Number(
      await merkleTree.getLeafIndexByPubkeyHash(normalizedPubkeyHash)
    );

    return {
      leafIndex,
      inserted: true,
      txHash: receipt?.hash || tx.hash,
      root,
    };
  }

  async getMerkleProofByPubkeyHash(pubkeyHash) {
    const merkleTree = this._getMerkleTree();
    const normalizedPubkeyHash = toBytes32(pubkeyHash);
    const leafIndex = Number(
      await merkleTree.getLeafIndexByPubkeyHash(normalizedPubkeyHash)
    );
    const [path, root] = await Promise.all([
      merkleTree.getMerklePath(leafIndex),
      merkleTree.getRoot(),
    ]);

    return {
      leafIndex,
      path,
      root,
    };
  }

  async prepareRecoveryOperation({ zkAccountAddress, newTxKeyAddress, expectedCounter }) {
    const accountState = await this.getRecoveryAccountState({ zkAccountAddress });
    const counter =
      expectedCounter !== undefined
        ? BigInt(expectedCounter)
        : BigInt(accountState.recoveryCounter);
    const accountNonce = BigInt(accountState.nonce);

    const accountInterface = new ethers.Interface([
      "function updateTxKey(uint256 expectedCnt, address newTxKey)",
    ]);
    const callData = accountInterface.encodeFunctionData("updateTxKey", [
      counter,
      newTxKeyAddress,
    ]);
    const userOp = createPackedUserOp({
      sender: zkAccountAddress,
      nonce: accountNonce,
      callData,
      verificationGasLimit: this.config.zkpasskeyVerificationGasLimit,
      callGasLimit: this.config.zkpasskeyCallGasLimit,
      preVerificationGas: this.config.zkpasskeyPreVerificationGas,
      maxFeePerGas: this.config.zkpasskeyMaxFeePerGas,
      maxPriorityFeePerGas: this.config.zkpasskeyMaxPriorityFeePerGas,
    });

    const entryPoint = this._getEntryPoint();
    const userOpHash = await entryPoint.getUserOpHash(userOp);
    const signedUserOpHash = ethers.hashMessage(ethers.getBytes(userOpHash));

    return {
      accountState,
      userOp,
      userOpHash,
      signedUserOpHash,
    };
  }

  async submitRecoveryOperation({
    zkAccountAddress,
    newTxKeyAddress,
    proofResult,
    expectedCounter,
  }) {
    const prepared = await this.prepareRecoveryOperation({
      zkAccountAddress,
      newTxKeyAddress,
      expectedCounter,
    });
    prepared.userOp.signature = encodeProofSignature(proofResult);

    const funding = await this._maybeFundAccount(
      zkAccountAddress,
      this.config.zkpasskeyRecoveryFundingWei
    );

    const entryPoint = this._getEntryPoint();
    const tx = await this._withNonce((overrides) =>
      entryPoint.handleOps([prepared.userOp], this._getBeneficiaryAddress(), overrides)
    );
    const receipt = await tx.wait();

    return {
      txHash: receipt?.hash || tx.hash,
      beneficiaryAddress: this._getBeneficiaryAddress(),
      funding,
      account: {
        zkAccountAddress,
        previousTxKeyAddress: prepared.accountState.txKeyAddress,
        newTxKeyAddress,
        recoveryCounter: prepared.accountState.recoveryCounter,
        nonce: prepared.accountState.nonce,
        masterKeyVerifierAddress: prepared.accountState.masterKeyVerifierAddress,
      },
      userOperation: {
        sender: prepared.userOp.sender,
        nonce: prepared.userOp.nonce.toString(),
        callData: prepared.userOp.callData,
        userOpHash: prepared.userOpHash,
        signedUserOpHash: prepared.signedUserOpHash,
        accountGasLimits: normalizeHexValue(prepared.userOp.accountGasLimits),
        gasFees: normalizeHexValue(prepared.userOp.gasFees),
        preVerificationGas: toDecimalString(prepared.userOp.preVerificationGas),
      },
    };
  }
}
