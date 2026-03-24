import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appDir, "..");
const contractDir = path.join(repoRoot, "vendor", "zkpasskey", "contract");
const envExamplePath = path.join(appDir, ".env.example");
const envPath = path.join(appDir, ".env");
const writeEnv =
  process.argv.includes("--write-env") ||
  process.env.ZKPASSKEY_BOOTSTRAP_WRITE_ENV === "1";
const jsonOnly = process.argv.includes("--json");

function findExecutable(candidates) {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (path.isAbsolute(candidate) && fs.existsSync(candidate)) {
      return candidate;
    }
    const result = spawnSync("bash", ["-lc", `command -v "${candidate}"`], {
      encoding: "utf8",
      env: process.env
    });
    if (result.status === 0) {
      const resolved = result.stdout.trim();
      if (resolved) {
        return resolved;
      }
    }
  }
  return null;
}

function extractJsonPayload(rawOutput) {
  const start = rawOutput.indexOf("{");
  const end = rawOutput.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("Could not find JSON deployment payload in script output.");
  }
  return JSON.parse(rawOutput.slice(start, end + 1));
}

function parseEnvFile(contents) {
  const lines = contents.split(/\r?\n/u);
  const entries = new Map();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    entries.set(key, trimmed.slice(separatorIndex + 1));
  }
  return entries;
}

function upsertEnvValues(originalContents, values) {
  const lines = originalContents.split(/\r?\n/u);
  const nextLines = [...lines];
  const touchedKeys = new Set();

  for (let index = 0; index < nextLines.length; index += 1) {
    const trimmed = nextLines[index].trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = nextLines[index].indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }
    const key = nextLines[index].slice(0, separatorIndex).trim();
    if (Object.hasOwn(values, key)) {
      nextLines[index] = `${key}=${values[key]}`;
      touchedKeys.add(key);
    }
  }

  for (const [key, value] of Object.entries(values)) {
    if (!touchedKeys.has(key)) {
      nextLines.push(`${key}=${value}`);
    }
  }

  return `${nextLines.join("\n").replace(/\n+$/u, "")}\n`;
}

const npmExecutable = findExecutable(["npm", "/opt/homebrew/bin/npm"]);
if (!npmExecutable) {
  console.error("[bootstrap-zkpasskey-localnet] npm is required but was not found.");
  process.exit(1);
}

const deployResult = spawnSync(
  npmExecutable,
  ["run", "deploy:localnet", "--silent"],
  {
    cwd: contractDir,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `/opt/homebrew/bin:${process.env.PATH || ""}`
    }
  }
);

if (deployResult.status !== 0) {
  process.stderr.write(deployResult.stderr || deployResult.stdout || "");
  process.exit(deployResult.status || 1);
}

const payload = extractJsonPayload(deployResult.stdout);
const envValues = {
  ...payload.env,
  ZKPASSKEY_CREATE_ACCOUNT_FUNDING_WEI:
    payload.env.ZKPASSKEY_CREATE_ACCOUNT_FUNDING_WEI || "0",
  ZKPASSKEY_RECOVERY_FUNDING_WEI:
    payload.env.ZKPASSKEY_RECOVERY_FUNDING_WEI || "0"
};

let wroteEnv = false;
if (writeEnv) {
  let originalContents = "";
  if (fs.existsSync(envPath)) {
    originalContents = fs.readFileSync(envPath, "utf8");
  } else if (fs.existsSync(envExamplePath)) {
    originalContents = fs.readFileSync(envExamplePath, "utf8");
  }
  fs.writeFileSync(envPath, upsertEnvValues(originalContents, envValues));
  wroteEnv = true;
}

const result = {
  network: payload.network,
  deployer: payload.deployer,
  entryPointAddress: payload.entryPointAddress,
  merkleTreeAddress: payload.merkleTreeAddress,
  factoryAddress: payload.factoryAddress,
  verifierLogicAddress: payload.verifierLogicAddress,
  beneficiaryAddress: payload.beneficiaryAddress,
  envPath,
  wroteEnv,
  env: envValues
};

if (jsonOnly) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

const envBlock = Object.entries(envValues)
  .map(([key, value]) => `${key}=${value}`)
  .join("\n");

console.log("[bootstrap-zkpasskey-localnet] deployed local zkpasskey contracts");
console.log(`network: ${result.network.name} (${result.network.chainId})`);
console.log(`entryPoint: ${result.entryPointAddress}`);
console.log(`merkleTree: ${result.merkleTreeAddress}`);
console.log(`factory: ${result.factoryAddress}`);
console.log(`verifierLogic: ${result.verifierLogicAddress}`);
console.log("");
console.log(envBlock);
if (wroteEnv) {
  console.log("");
  console.log(`[bootstrap-zkpasskey-localnet] wrote zkpasskey env values to ${envPath}`);
}
