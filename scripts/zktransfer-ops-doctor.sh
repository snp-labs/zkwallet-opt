#!/usr/bin/env bash
set -euo pipefail

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
if [[ "${SCRIPT_SOURCE}" != */* ]]; then
  SCRIPT_SOURCE="./${SCRIPT_SOURCE}"
fi
SCRIPT_DIR="$(cd -- "${SCRIPT_SOURCE%/*}" >/dev/null 2>&1 && pwd)"

ops_run_script="${OPS_RUN_SCRIPT:-${SCRIPT_DIR}/zktransfer-ops-run.sh}"
ops_summary_script="${OPS_SUMMARY_SCRIPT:-${SCRIPT_DIR}/zktransfer-ops-summary.sh}"

echo "[zktransfer-ops-doctor] deployment status"
bash "${ops_run_script}" deployment:status

echo
echo "[zktransfer-ops-doctor] summary"
bash "${ops_summary_script}" --markdown

echo
echo "[zktransfer-ops-doctor] readiness gate"
if bash "${ops_summary_script}" --check >/dev/null; then
  echo "[zktransfer-ops-doctor] ready"
  exit 0
fi

echo "[zktransfer-ops-doctor] blocked" >&2
exit 1
