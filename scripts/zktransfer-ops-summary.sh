#!/usr/bin/env bash
set -euo pipefail

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
if [[ "${SCRIPT_SOURCE}" != */* ]]; then
  SCRIPT_SOURCE="./${SCRIPT_SOURCE}"
fi
SCRIPT_DIR="$(cd -- "${SCRIPT_SOURCE%/*}" >/dev/null 2>&1 && pwd)"
NODE_SCRIPT="${SCRIPT_DIR}/zktransfer-ops-summary.mjs"

resolve_command() {
  local primary="$1"
  local fallback="$2"
  if command -v "${primary}" >/dev/null 2>&1; then
    command -v "${primary}"
    return 0
  fi
  if [[ -x "${fallback}" ]]; then
    printf '%s\n' "${fallback}"
    return 0
  fi
  return 1
}

if node_path="$(resolve_command node /opt/homebrew/bin/node)"; then
  exec "${node_path}" "${NODE_SCRIPT}" "$@"
fi

if npm_path="$(resolve_command npm /opt/homebrew/bin/npm)"; then
  exec "${npm_path}" exec --yes node -- "${NODE_SCRIPT}" "$@"
fi

echo "[zktransfer-ops-summary] unable to find node or npm in PATH or /opt/homebrew/bin" >&2
exit 1
