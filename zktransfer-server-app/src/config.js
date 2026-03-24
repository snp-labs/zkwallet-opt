import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function parseBooleanEnv(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function parsePositiveBigIntEnv(value, defaultValue = false) {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  const normalized = String(value).trim();
  if (normalized.length === 0) {
    return defaultValue;
  }

  try {
    return BigInt(normalized) > 0n;
  } catch {
    return defaultValue;
  }
}

const DEFAULT_JWT_SECRET = "dev-jwt-secret-change-me";
const JWT_SECRET_PLACEHOLDERS = new Set([
  "",
  DEFAULT_JWT_SECRET,
  "replace-with-a-real-secret"
]);

function analyzeJwtSecret(secret) {
  const normalized = (secret || "").trim();
  const jwtSecretConfigured = !JWT_SECRET_PLACEHOLDERS.has(normalized);
  return {
    jwtSecretConfigured,
    usingDefaultJwtSecret: normalized === DEFAULT_JWT_SECRET,
    usingPlaceholderJwtSecret:
      normalized === "replace-with-a-real-secret" || normalized.length === 0
  };
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const fileContent = fs.readFileSync(filePath, "utf8");
  const parsed = {};
  for (const rawLine of fileContent.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }

  return parsed;
}

function createEnvReader(options = {}) {
  const baseEnv = options.env || process.env;
  const envFilePath = options.envFilePath || path.join(rootDir, ".env");
  const fileEnv = parseEnvFile(envFilePath);

  return (key) => {
    if (baseEnv[key] !== undefined) {
      return baseEnv[key];
    }
    return fileEnv[key];
  };
}

export function loadConfig(options = {}) {
  const readEnv = createEnvReader(options);
  const jwtSecret = readEnv("JWT_SECRET") || DEFAULT_JWT_SECRET;
  const jwtSecretStatus = analyzeJwtSecret(jwtSecret);
  const circuitsRoot =
    readEnv("CIRCUITS_ROOT") ||
    path.resolve(rootDir, "..", "zk-wallet-circuits");
  const mobileAppRoot =
    readEnv("MOBILE_APP_ROOT") ||
    path.resolve(rootDir, "..", "zk-wallet-mobile-app");
  const allowLegacyProofInputs = parseBooleanEnv(
    readEnv("ALLOW_LEGACY_PROOF_INPUTS"),
    true
  );
  const proofInputPolicyPinned = !allowLegacyProofInputs;
  const zkpasskeyRpcUrl = readEnv("ZKPASSKEY_RPC_URL") || "";
  const zkpasskeyEntryPointAddress =
    readEnv("ZKPASSKEY_ENTRY_POINT_ADDRESS") || "";
  const zkpasskeyRelayerPrivateKey =
    readEnv("ZKPASSKEY_RELAYER_PRIVATE_KEY") || "";
  const zkpasskeyBeneficiaryAddress =
    readEnv("ZKPASSKEY_BENEFICIARY_ADDRESS") || "";
  const zkpasskeyRecoveryFundingWei =
    readEnv("ZKPASSKEY_RECOVERY_FUNDING_WEI") || "0";
  return {
    appName: "zktransfer-server-app",
    port: Number(readEnv("PORT") || 4010),
    host: readEnv("HOST") || "127.0.0.1",
    jwtSecret,
    jwtSecretConfigured: jwtSecretStatus.jwtSecretConfigured,
    usingDefaultJwtSecret: jwtSecretStatus.usingDefaultJwtSecret,
    usingPlaceholderJwtSecret: jwtSecretStatus.usingPlaceholderJwtSecret,
    dataFile:
      readEnv("DATA_FILE") ||
      path.join(rootDir, "data", "job-store.json"),
    custodyMode: readEnv("CUSTODY_MODE") || "hot-wallet",
    executionMode: readEnv("EXECUTION_MODE") || "mock-chain",
    allowLegacyProofInputs,
    proofInputPolicyPinned,
    circuitsRoot,
    mobileAppRoot,
    proofBinaryPath:
      readEnv("PROOF_BINARY_PATH") ||
      path.join(circuitsRoot, "target", "release", "prove_zkwallet_from_input"),
    proofInputBuilderPath:
      readEnv("PROOF_INPUT_BUILDER_PATH") ||
      path.join(circuitsRoot, "target", "release", "build_zkwallet_demo_input"),
    proofSetupMode: readEnv("PROOF_SETUP_MODE") || "fresh",
    proofCrsPath:
      readEnv("PROOF_CRS_PATH") ||
      path.join(mobileAppRoot, "crs", "CRS_pvk.dat"),
    proofTreeHeight: Number(readEnv("PROOF_TREE_HEIGHT") || 11),
    proofTimeoutMs: Number(readEnv("PROOF_TIMEOUT_MS") || 120000),
    supportedNetworks: (readEnv("SUPPORTED_NETWORKS") || "hardhat-local,kaia-testnet")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    supportedTokenTypes: ["ERC20", "ERC721", "ERC1155"],
    hotWalletAddress:
      readEnv("HOT_WALLET_ADDRESS") ||
      "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
    // ─── zkpasskey settings ─────────────────────────────
    zkpasskeyPkPath:
      readEnv("ZKPASSKEY_PK_PATH") ||
      path.resolve(rootDir, "..", "zk-wallet-mobile-app", "crs", "zkpasskey_pk.key"),
    zkpasskeyRpcUrl,
    zkpasskeyEntryPointAddress,
    zkpasskeyRelayerPrivateKey,
    zkpasskeyBeneficiaryAddress,
    zkpasskeyMerkleTreeAddress:
      readEnv("ZKPASSKEY_MERKLE_TREE_ADDRESS") || "",
    zkpasskeyFactoryAddress:
      readEnv("ZKPASSKEY_FACTORY_ADDRESS") || "",
    zkpasskeyVerifierAddress:
      readEnv("ZKPASSKEY_VERIFIER_ADDRESS") || "",
    zkpasskeyCreateAccountFundingWei:
      readEnv("ZKPASSKEY_CREATE_ACCOUNT_FUNDING_WEI") || "0",
    zkpasskeyRecoveryFundingWei,
    zkpasskeyRecoveryFundingConfigured: parsePositiveBigIntEnv(
      zkpasskeyRecoveryFundingWei,
      false
    ),
    zkpasskeyVerificationGasLimit: Number(
      readEnv("ZKPASSKEY_VERIFICATION_GAS_LIMIT") || 1500000
    ),
    zkpasskeyCallGasLimit: Number(
      readEnv("ZKPASSKEY_CALL_GAS_LIMIT") || 1500000
    ),
    zkpasskeyPreVerificationGas: Number(
      readEnv("ZKPASSKEY_PRE_VERIFICATION_GAS") || 100000
    ),
    zkpasskeyMaxFeePerGas: readEnv("ZKPASSKEY_MAX_FEE_PER_GAS") || "1000000000",
    zkpasskeyMaxPriorityFeePerGas:
      readEnv("ZKPASSKEY_MAX_PRIORITY_FEE_PER_GAS") || "1000000000",
    zkpasskeyRelayerConfigured: Boolean(
      zkpasskeyRpcUrl &&
        zkpasskeyEntryPointAddress &&
        zkpasskeyRelayerPrivateKey &&
        (readEnv("ZKPASSKEY_MERKLE_TREE_ADDRESS") || "") &&
        (readEnv("ZKPASSKEY_FACTORY_ADDRESS") || "") &&
        (readEnv("ZKPASSKEY_VERIFIER_ADDRESS") || "")
    ),
    zkpasskeyPkExists: fs.existsSync(
      readEnv("ZKPASSKEY_PK_PATH") ||
        path.resolve(rootDir, "..", "zk-wallet-mobile-app", "crs", "zkpasskey_pk.key")
    ),
    proofBinaryExists: fs.existsSync(
      readEnv("PROOF_BINARY_PATH") ||
        path.join(circuitsRoot, "target", "release", "prove_zkwallet_from_input")
    ),
    proofInputBuilderExists: fs.existsSync(
      readEnv("PROOF_INPUT_BUILDER_PATH") ||
        path.join(circuitsRoot, "target", "release", "build_zkwallet_demo_input")
    )
  };
}
