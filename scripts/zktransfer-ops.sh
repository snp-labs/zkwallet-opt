#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF' >&2
Usage: bash scripts/zktransfer-ops.sh <command>

Commands:
  doctor
  changes
  compare
  export
  history
  history:paths
  latest
  next
  next:root
  plan
  previous
  prune
  report
  snapshot
  overview
  summary
  summary:markdown
  check
  status
  setup-env
  check-ready
  install:dry-run
  verify
  test
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
  doctor|changes|compare|export|history|history:paths|latest|next|next:root|plan|previous|prune|report|snapshot|overview|summary|summary:markdown|check|status|setup-env|check-ready|install:dry-run|verify|test)
    ;;
  *)
    usage
    ;;
esac

if ! npm_bin="$(resolve_command npm /opt/homebrew/bin/npm)"; then
  echo "[zktransfer-ops] unable to find npm in PATH or /opt/homebrew/bin" >&2
  exit 1
fi

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

exec "${npm_bin}" run "ops:${command_name}" --prefix "${ROOT_DIR}"
