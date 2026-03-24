#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="zktransfer-server-app"
SCRIPT_SOURCE="${BASH_SOURCE[0]}"
if [[ "${SCRIPT_SOURCE}" != */* ]]; then
  SCRIPT_SOURCE="./${SCRIPT_SOURCE}"
fi
SCRIPT_DIR="$(cd -- "${SCRIPT_SOURCE%/*}" >/dev/null 2>&1 && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ ! -f "${APP_DIR}/.env" ]]; then
  echo "[verify-deployment] missing ${APP_DIR}/.env" >&2
  exit 1
fi

bash "${APP_DIR}/scripts/check-runtime-deps.sh"

set -a
# shellcheck disable=SC1091
source "${APP_DIR}/.env"
set +a

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-4010}"
HEALTH_URL="http://${HOST}:${PORT}/health"
HEALTH_RETRY_COUNT="${HEALTH_RETRY_COUNT:-15}"
HEALTH_RETRY_DELAY_SECONDS="${HEALTH_RETRY_DELAY_SECONDS:-2}"

echo "[verify-deployment] checking systemd state for ${SERVICE_NAME}"
sudo systemctl is-active --quiet "${SERVICE_NAME}"

echo "[verify-deployment] checking ${HEALTH_URL}"
last_error=""
for attempt in $(seq 1 "${HEALTH_RETRY_COUNT}"); do
  if HEALTH_JSON="$(curl --fail --silent --show-error --max-time 5 "${HEALTH_URL}" 2>&1)"; then
    if VERIFY_OUTPUT="$(printf '%s' "${HEALTH_JSON}" | node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(0, "utf8"));
if (!body.ready) {
  throw new Error("health.ready=false");
}
if (!body.checks?.proofBinaryExists || !body.checks?.proofInputBuilderExists) {
  throw new Error("proof binary readiness failed");
}
if (!body.checks?.proofInputPolicyPinned) {
  throw new Error("ALLOW_LEGACY_PROOF_INPUTS must be pinned to 0");
}
if (!body.checks?.jwtSecretConfigured) {
  throw new Error("JWT secret is still using the default development value");
}
console.log(JSON.stringify({
  ready: body.ready,
  jwtSecretConfigured: body.jwtSecretConfigured,
  usingDefaultJwtSecret: body.usingDefaultJwtSecret,
  usingPlaceholderJwtSecret: body.usingPlaceholderJwtSecret,
  allowLegacyProofInputs: body.allowLegacyProofInputs,
  proofInputPolicyPinned: body.proofInputPolicyPinned,
  checks: body.checks
}, null, 2));
')" ; then
      printf '%s\n' "${VERIFY_OUTPUT}"
      exit 0
    fi
    last_error="${VERIFY_OUTPUT}"
  else
    last_error="${HEALTH_JSON}"
  fi

  if [[ "${attempt}" -lt "${HEALTH_RETRY_COUNT}" ]]; then
    sleep "${HEALTH_RETRY_DELAY_SECONDS}"
  fi
done

echo "[verify-deployment] health verification failed after ${HEALTH_RETRY_COUNT} attempts" >&2
echo "${last_error}" >&2
exit 1
