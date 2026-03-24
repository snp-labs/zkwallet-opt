#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="zktransfer-server-app"
SCRIPT_SOURCE="${BASH_SOURCE[0]}"
if [[ "${SCRIPT_SOURCE}" != */* ]]; then
  SCRIPT_SOURCE="./${SCRIPT_SOURCE}"
fi
SCRIPT_DIR="$(cd -- "${SCRIPT_SOURCE%/*}" >/dev/null 2>&1 && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
UNIT_SOURCE="${APP_DIR}/deploy/systemd/${SERVICE_NAME}.service"
UNIT_TARGET="/etc/systemd/system/${SERVICE_NAME}.service"
DRY_RUN="${INSTALL_SYSTEMD_DRY_RUN:-0}"

if [[ ! -f "${UNIT_SOURCE}" ]]; then
  echo "[install-systemd-service] missing unit file: ${UNIT_SOURCE}" >&2
  exit 1
fi

echo "[install-systemd-service] checking runtime dependencies"
if [[ "${DRY_RUN}" == "1" ]]; then
  OPTIONAL_RUNTIME_COMMANDS="curl,sudo,systemctl" bash "${APP_DIR}/scripts/check-runtime-deps.sh"
else
  bash "${APP_DIR}/scripts/check-runtime-deps.sh"
fi

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "[install-systemd-service] dry-run enabled; not modifying ${APP_DIR}/.env"
  if [[ -f "${APP_DIR}/.env" ]]; then
    echo "[install-systemd-service] using existing .env for readiness precheck"
    npm run check:ready
  else
    echo "[install-systemd-service] dry-run: .env is missing; run npm run setup:env for a full readiness precheck"
  fi
  echo "[install-systemd-service] dry-run enabled; skipping unit installation and deployment verification"
  echo "[install-systemd-service] would copy ${UNIT_SOURCE} to ${UNIT_TARGET}"
  echo "[install-systemd-service] would run: systemctl daemon-reload/enable/restart/status and verify:deployment"
  exit 0
fi

echo "[install-systemd-service] ensuring environment file and JWT secret"
bash "${APP_DIR}/scripts/ensure-jwt-secret.sh"

echo "[install-systemd-service] running readiness precheck"
npm run check:ready

echo "[install-systemd-service] installing ${SERVICE_NAME}"
sudo cp "${UNIT_SOURCE}" "${UNIT_TARGET}"
sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}"
sudo systemctl restart "${SERVICE_NAME}"
sudo systemctl status "${SERVICE_NAME}" --no-pager
bash "${APP_DIR}/scripts/verify-deployment.sh"
