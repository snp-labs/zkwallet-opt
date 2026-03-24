#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF' >&2
Usage: bash scripts/zktransfer-ops-run.sh <command>

Allowed commands:
  setup:env
  check:ready
  deployment:status
  install:systemd:dry-run
  verify:deployment
EOF
  exit 1
}

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

if [[ $# -ne 1 ]]; then
  usage
fi

command_name="$1"
case "${command_name}" in
  setup:env|check:ready|deployment:status|install:systemd:dry-run|verify:deployment)
    ;;
  *)
    usage
    ;;
esac

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
if [[ "${SCRIPT_SOURCE}" != */* ]]; then
  SCRIPT_SOURCE="./${SCRIPT_SOURCE}"
fi
SCRIPT_DIR="$(cd -- "${SCRIPT_SOURCE%/*}" >/dev/null 2>&1 && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." >/dev/null 2>&1 && pwd)"

if [[ ":${PATH}:" != *":/opt/homebrew/bin:"* ]]; then
  PATH="${PATH:+${PATH}:}/opt/homebrew/bin"
  export PATH
fi

server_app_dir="${ZKTRANSFER_SERVER_APP_DIR:-${ROOT_DIR}/zktransfer-server-app}"
platform_server_app_dir="${ZKTRANSFER_PLATFORM_SERVER_APP_DIR:-${ROOT_DIR}/zktransfer-custody-platform/apps/server}"

service_names=(
  "zktransfer-server-app"
  "zktransfer-custody-platform-server"
)
service_dirs=(
  "${server_app_dir}"
  "${platform_server_app_dir}"
)

if ! npm_bin="$(resolve_command npm /opt/homebrew/bin/npm)"; then
  echo "[zktransfer-ops-run] unable to find npm in PATH or /opt/homebrew/bin" >&2
  exit 1
fi

failures=0

for index in "${!service_names[@]}"; do
  service_name="${service_names[${index}]}"
  service_dir="${service_dirs[${index}]}"

  if [[ ! -d "${service_dir}" ]]; then
    echo "[zktransfer-ops-run] missing service directory for ${service_name}: ${service_dir}" >&2
    failures=1
    continue
  fi

  echo "[zktransfer-ops-run] ${service_name}: npm run ${command_name}"
  if ! (
    cd -- "${service_dir}"
    "${npm_bin}" run "${command_name}"
  ); then
    echo "[zktransfer-ops-run] ${service_name}: command failed" >&2
    failures=1
  fi
done

exit "${failures}"
