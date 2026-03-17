import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

export function loadConfig() {
  const circuitsRoot =
    process.env.CIRCUITS_ROOT ||
    path.resolve(rootDir, "..", "zk-wallet-circuits");
  const mobileAppRoot =
    process.env.MOBILE_APP_ROOT ||
    path.resolve(rootDir, "..", "zk-wallet-mobile-app");
  return {
    appName: "zktransfer-custody-server",
    port: Number(process.env.PORT || 4010),
    host: process.env.HOST || "127.0.0.1",
    jwtSecret: process.env.JWT_SECRET || "dev-jwt-secret-change-me",
    dataFile:
      process.env.DATA_FILE ||
      path.join(rootDir, "data", "job-store.json"),
    custodyMode: process.env.CUSTODY_MODE || "hot-wallet",
    executionMode: process.env.EXECUTION_MODE || "mock-chain",
    circuitsRoot,
    mobileAppRoot,
    proofBinaryPath:
      process.env.PROOF_BINARY_PATH ||
      path.join(circuitsRoot, "target", "release", "prove_zkwallet_from_input"),
    proofInputBuilderPath:
      process.env.PROOF_INPUT_BUILDER_PATH ||
      path.join(circuitsRoot, "target", "release", "build_zkwallet_demo_input"),
    proofSetupMode: process.env.PROOF_SETUP_MODE || "fresh",
    proofCrsPath:
      process.env.PROOF_CRS_PATH ||
      path.join(mobileAppRoot, "crs", "CRS_pvk.dat"),
    proofTreeHeight: Number(process.env.PROOF_TREE_HEIGHT || 11),
    proofTimeoutMs: Number(process.env.PROOF_TIMEOUT_MS || 120000),
    supportedNetworks: (process.env.SUPPORTED_NETWORKS || "hardhat-local,kaia-testnet")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    supportedTokenTypes: ["ERC20", "ERC721", "ERC1155"],
    hotWalletAddress:
      process.env.HOT_WALLET_ADDRESS ||
      "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
    // ─── zkpasskey settings ─────────────────────────────
    zkpasskeyPkPath:
      process.env.ZKPASSKEY_PK_PATH ||
      path.resolve(rootDir, "..", "zk-wallet-mobile-app", "crs", "zkpasskey_pk.key"),
    zkpasskeyMerkleTreeAddress:
      process.env.ZKPASSKEY_MERKLE_TREE_ADDRESS || "",
    zkpasskeyFactoryAddress:
      process.env.ZKPASSKEY_FACTORY_ADDRESS || "",
    zkpasskeyVerifierAddress:
      process.env.ZKPASSKEY_VERIFIER_ADDRESS || "",
  };
}
