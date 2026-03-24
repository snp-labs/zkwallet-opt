#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="zktransfer-server-app"
SCRIPT_SOURCE="${BASH_SOURCE[0]}"
if [[ "${SCRIPT_SOURCE}" != */* ]]; then
  SCRIPT_SOURCE="./${SCRIPT_SOURCE}"
fi
SCRIPT_DIR="$(cd -- "${SCRIPT_SOURCE%/*}" >/dev/null 2>&1 && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_PATH="${APP_DIR}/.env"
UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}.service"

if [[ -f "${ENV_PATH}" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ENV_PATH}"
  set +a
fi

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-4010}"
HEALTH_URL="http://${HOST}:${PORT}/health"

has_command() {
  command -v "$1" >/dev/null 2>&1
}

get_systemctl_state() {
  local mode="$1"
  if ! has_command systemctl; then
    echo "unavailable"
    return
  fi

  if output="$(systemctl "${mode}" "${SERVICE_NAME}" 2>/dev/null)"; then
    printf '%s' "${output}" | tr -d '\n'
  else
    echo "unknown"
  fi
}

HEALTH_JSON=""
if has_command curl; then
  HEALTH_JSON="$(curl --silent --show-error --max-time 5 "${HEALTH_URL}" 2>/dev/null || true)"
fi

CONFIG_JSON="$(node --input-type=module -e '
import { loadConfig } from "./src/config.js";
import { buildSocialRecoveryStatus } from "./src/lib/socialRecoveryStatus.js";
import { ZkPasskeyService } from "./src/services/zkpasskeyService.js";

const config = loadConfig();
const zkpasskeyService = new ZkPasskeyService({ config, store: {} });
const checks = {
  proofBinaryExists: config.proofBinaryExists,
  proofInputBuilderExists: config.proofInputBuilderExists,
  jwtSecretConfigured: config.jwtSecretConfigured,
  proofInputPolicyPinned: config.proofInputPolicyPinned
};
const socialRecoveryStatus = buildSocialRecoveryStatus({
  config,
  zkpasskeyStatus: zkpasskeyService.getStatus(),
  zkParams: zkpasskeyService.getZkParameters()
});
const ready = Object.values(checks).every(Boolean);

console.log(JSON.stringify({
  app: config.appName,
  ready,
  jwtSecretConfigured: config.jwtSecretConfigured,
  usingDefaultJwtSecret: config.usingDefaultJwtSecret,
  usingPlaceholderJwtSecret: config.usingPlaceholderJwtSecret,
  allowLegacyProofInputs: config.allowLegacyProofInputs,
  proofInputPolicyPinned: config.proofInputPolicyPinned,
  zkpasskeyRelayerConfigured: config.zkpasskeyRelayerConfigured,
  zkpasskeyPkExists: config.zkpasskeyPkExists,
  socialRecoveryReady: socialRecoveryStatus.socialRecoveryReady,
  socialRecoveryChecks: socialRecoveryStatus.socialRecoveryChecks,
  socialRecoveryThreshold: socialRecoveryStatus.socialRecoveryThreshold,
  zkpasskeyRecoveryFundingConfigured: config.zkpasskeyRecoveryFundingConfigured,
  proofBinaryPath: config.proofBinaryPath,
  proofInputBuilderPath: config.proofInputBuilderPath,
  checks
}));
' 2>/dev/null || true)"

DEP_STATUS_NODE="$(has_command node && echo true || echo false)"
DEP_STATUS_NPM="$(has_command npm && echo true || echo false)"
DEP_STATUS_CURL="$(has_command curl && echo true || echo false)"
DEP_STATUS_SUDO="$(has_command sudo && echo true || echo false)"
DEP_STATUS_SYSTEMCTL="$(has_command systemctl && echo true || echo false)"
SERVICE_ENABLED="$(get_systemctl_state is-enabled)"
SERVICE_ACTIVE="$(get_systemctl_state is-active)"
UNIT_EXISTS="$([[ -f "${UNIT_PATH}" ]] && echo true || echo false)"
ENV_EXISTS="$([[ -f "${ENV_PATH}" ]] && echo true || echo false)"

ENV_PATH="${ENV_PATH}" \
UNIT_PATH="${UNIT_PATH}" \
UNIT_EXISTS="${UNIT_EXISTS}" \
ENV_EXISTS="${ENV_EXISTS}" \
HEALTH_URL="${HEALTH_URL}" \
SERVICE_ENABLED="${SERVICE_ENABLED}" \
SERVICE_ACTIVE="${SERVICE_ACTIVE}" \
DEP_STATUS_NODE="${DEP_STATUS_NODE}" \
DEP_STATUS_NPM="${DEP_STATUS_NPM}" \
DEP_STATUS_CURL="${DEP_STATUS_CURL}" \
DEP_STATUS_SUDO="${DEP_STATUS_SUDO}" \
DEP_STATUS_SYSTEMCTL="${DEP_STATUS_SYSTEMCTL}" \
HEALTH_JSON="${HEALTH_JSON}" \
CONFIG_JSON="${CONFIG_JSON}" \
node -e '
const parseBool = (value) => value === "true";
const deps = {
  node: parseBool(process.env.DEP_STATUS_NODE),
  npm: parseBool(process.env.DEP_STATUS_NPM),
  curl: parseBool(process.env.DEP_STATUS_CURL),
  sudo: parseBool(process.env.DEP_STATUS_SUDO),
  systemctl: parseBool(process.env.DEP_STATUS_SYSTEMCTL)
};
const missingDeps = Object.entries(deps)
  .filter(([, available]) => !available)
  .map(([name]) => name);

let health = null;
if (process.env.HEALTH_JSON) {
  try {
    const body = JSON.parse(process.env.HEALTH_JSON);
    health = {
      ok: body.ok,
      ready: body.ready,
      jwtSecretConfigured: body.jwtSecretConfigured,
      usingDefaultJwtSecret: body.usingDefaultJwtSecret,
      usingPlaceholderJwtSecret: body.usingPlaceholderJwtSecret,
      allowLegacyProofInputs: body.allowLegacyProofInputs,
      checks: body.checks,
      socialRecoveryReady: body.socialRecoveryReady,
      socialRecoveryChecks: body.socialRecoveryChecks,
      zkpasskeyRecoveryFundingConfigured: body.zkpasskeyRecoveryFundingConfigured,
      proofInputTelemetry: body.proofInputTelemetry
    };
  } catch (error) {
    health = {
      parseError: error.message,
      rawBody: process.env.HEALTH_JSON
    };
  }
}

let config = null;
if (process.env.CONFIG_JSON) {
  try {
    config = JSON.parse(process.env.CONFIG_JSON);
  } catch (error) {
    config = {
      parseError: error.message,
      rawBody: process.env.CONFIG_JSON
    };
  }
}

const recommendations = [];
if (missingDeps.length > 0) {
  recommendations.push(`Install missing runtime commands: ${missingDeps.join(", ")}.`);
  if (missingDeps.includes("systemctl") || missingDeps.includes("sudo")) {
    recommendations.push(
      "Use npm run install:systemd:dry-run to validate prechecks before moving to a systemd host."
    );
  }
}
if (!parseBool(process.env.ENV_EXISTS)) {
  recommendations.push("Create .env from .env.example or run npm run setup:env.");
}
if (!parseBool(process.env.UNIT_EXISTS)) {
  recommendations.push("Install the systemd unit with npm run install:systemd when ready.");
}
if (config && !config.ready) {
  if (!config.jwtSecretConfigured) {
    recommendations.push("Set JWT_SECRET to a non-placeholder value and rerun npm run check:ready.");
  }
  if (!config.checks?.proofBinaryExists || !config.checks?.proofInputBuilderExists) {
    recommendations.push("Build the proving binaries under /Users/hyunokoh/Documents/zkWallet/zk-wallet-circuits.");
  }
  if (config.allowLegacyProofInputs) {
    recommendations.push("Pin ALLOW_LEGACY_PROOF_INPUTS=0 in .env for fail-closed proof-input policy.");
  }
}
if (config && !config.socialRecoveryReady) {
  if (!config.zkpasskeyRelayerConfigured) {
    recommendations.push(
      "Set ZKPASSKEY_RPC_URL, ZKPASSKEY_ENTRY_POINT_ADDRESS, ZKPASSKEY_RELAYER_PRIVATE_KEY, ZKPASSKEY_MERKLE_TREE_ADDRESS, ZKPASSKEY_FACTORY_ADDRESS, and ZKPASSKEY_VERIFIER_ADDRESS to enable on-chain social recovery."
    );
  }
  if (!config.zkpasskeyPkExists) {
    recommendations.push("Provide a valid ZKPASSKEY_PK_PATH for server-side social recovery proving.");
  }
  if (!config.zkpasskeyRecoveryFundingConfigured) {
    recommendations.push(
      "Set ZKPASSKEY_RECOVERY_FUNDING_WEI to a positive value before running fresh social recovery submit flows."
    );
  }
}
if (!health) {
  recommendations.push("Start the server before expecting /health output.");
}

const blockingIssues = [];
if (missingDeps.length > 0) {
  blockingIssues.push(`missing runtime commands: ${missingDeps.join(", ")}`);
}
if (!parseBool(process.env.ENV_EXISTS)) {
  blockingIssues.push("missing .env");
}
if (config && !config.jwtSecretConfigured) {
  blockingIssues.push("JWT secret is not configured");
}
if (config && !config.checks?.proofInputPolicyPinned) {
  blockingIssues.push("legacy proof-input policy is not pinned");
}
if (config && (!config.checks?.proofBinaryExists || !config.checks?.proofInputBuilderExists)) {
  blockingIssues.push("proving binaries are missing");
}
if (config && !config.socialRecoveryReady) {
  blockingIssues.push("social recovery is not fully configured");
}
if (!health) {
  blockingIssues.push("health endpoint is unavailable");
}

let suggestedCommand = "npm run install:systemd";
if (!parseBool(process.env.ENV_EXISTS)) {
  suggestedCommand = "npm run setup:env";
} else if (config && !config.ready) {
  suggestedCommand = "npm run check:ready";
} else if (missingDeps.includes("systemctl") || missingDeps.includes("sudo")) {
  suggestedCommand = "npm run install:systemd:dry-run";
} else if (!health) {
  suggestedCommand = "npm run install:systemd:dry-run";
}

console.log(JSON.stringify({
  serviceName: "zktransfer-server-app",
  envPath: process.env.ENV_PATH,
  envExists: parseBool(process.env.ENV_EXISTS),
  unitPath: process.env.UNIT_PATH,
  unitExists: parseBool(process.env.UNIT_EXISTS),
  deps,
  missingDeps,
  serviceEnabled: process.env.SERVICE_ENABLED,
  serviceActive: process.env.SERVICE_ACTIVE,
  config,
  healthUrl: process.env.HEALTH_URL,
  health,
  blockingIssues,
  suggestedCommand,
  recommendations
}, null, 2));
'
