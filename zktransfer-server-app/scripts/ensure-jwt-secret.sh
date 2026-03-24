#!/usr/bin/env bash
set -euo pipefail

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
if [[ "${SCRIPT_SOURCE}" != */* ]]; then
  SCRIPT_SOURCE="./${SCRIPT_SOURCE}"
fi
SCRIPT_DIR="$(cd -- "${SCRIPT_SOURCE%/*}" >/dev/null 2>&1 && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_EXAMPLE_PATH="${APP_DIR}/.env.example"
ENV_PATH="${APP_DIR}/.env"
REQUIRED_DEFAULT_KEYS=(
  CIRCUITS_ROOT
  ALLOW_LEGACY_PROOF_INPUTS
)

if [[ ! -f "${ENV_EXAMPLE_PATH}" ]]; then
  echo "[ensure-jwt-secret] missing ${ENV_EXAMPLE_PATH}" >&2
  exit 1
fi

if [[ ! -f "${ENV_PATH}" ]]; then
  cp "${ENV_EXAMPLE_PATH}" "${ENV_PATH}"
  echo "[ensure-jwt-secret] created ${ENV_PATH} from .env.example"
fi

required_default_keys_csv="$(IFS=,; echo "${REQUIRED_DEFAULT_KEYS[*]}")"

node - "${ENV_PATH}" "${ENV_EXAMPLE_PATH}" "${required_default_keys_csv}" <<'EOF'
const fs = require("node:fs");

const envPath = process.argv[2];
const envExamplePath = process.argv[3];
const requiredKeys = process.argv[4].split(",").filter(Boolean);

function parseEnv(content) {
  const parsed = new Map();
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }
    parsed.set(line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim());
  }
  return parsed;
}

const envContent = fs.readFileSync(envPath, "utf8");
const exampleContent = fs.readFileSync(envExamplePath, "utf8");
const envMap = parseEnv(envContent);
const exampleMap = parseEnv(exampleContent);

const missingLines = [];
for (const key of requiredKeys) {
  if (!envMap.has(key) && exampleMap.has(key)) {
    missingLines.push(`${key}=${exampleMap.get(key)}`);
  }
}

if (missingLines.length > 0) {
  const prefix = envContent.endsWith("\n") || envContent.length === 0 ? "" : "\n";
  fs.writeFileSync(envPath, `${envContent}${prefix}${missingLines.join("\n")}\n`);
  console.log(`[ensure-jwt-secret] appended missing defaults: ${missingLines.join(", ")}`);
}
EOF

current_secret="$(sed -n 's/^JWT_SECRET=//p' "${ENV_PATH}" | head -n 1)"

if [[ -n "${current_secret}" && "${current_secret}" != "dev-jwt-secret-change-me" && "${current_secret}" != "replace-with-a-real-secret" ]]; then
  echo "[ensure-jwt-secret] JWT_SECRET already configured"
  exit 0
fi

generated_secret="$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))')"

node - "${ENV_PATH}" "${generated_secret}" <<'EOF'
const fs = require("node:fs");

const envPath = process.argv[2];
const generatedSecret = process.argv[3];
const content = fs.readFileSync(envPath, "utf8");

let replaced = false;
const updated = content
  .split(/\r?\n/u)
  .map((line) => {
    if (line.startsWith("JWT_SECRET=")) {
      replaced = true;
      return `JWT_SECRET=${generatedSecret}`;
    }
    return line;
  })
  .join("\n");

fs.writeFileSync(
  envPath,
  replaced ? updated : `${updated}\nJWT_SECRET=${generatedSecret}\n`
);
EOF

echo "[ensure-jwt-secret] wrote a fresh JWT_SECRET to ${ENV_PATH}"
