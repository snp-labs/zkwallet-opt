#!/usr/bin/env bash
set -euo pipefail

required_commands=(
  node
  npm
  curl
  sudo
  systemctl
)

optional_runtime_commands_csv="${OPTIONAL_RUNTIME_COMMANDS:-}"
optional_runtime_commands=()
if [[ -n "${optional_runtime_commands_csv}" ]]; then
  IFS=',' read -r -a optional_runtime_commands <<< "${optional_runtime_commands_csv}"
fi

is_optional_command() {
  local candidate="$1"
  for optional in "${optional_runtime_commands[@]-}"; do
    if [[ -n "${optional}" && "${optional}" == "${candidate}" ]]; then
      return 0
    fi
  done
  return 1
}

missing=()
missing_optional=()
for cmd in "${required_commands[@]}"; do
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    if is_optional_command "${cmd}"; then
      missing_optional+=("${cmd}")
    else
      missing+=("${cmd}")
    fi
  fi
done

if [[ "${#missing[@]}" -gt 0 ]]; then
  echo "[check-runtime-deps] missing required commands: ${missing[*]}" >&2
  exit 1
fi

if [[ "${#missing_optional[@]}" -gt 0 ]]; then
  echo "[check-runtime-deps] optional commands not available: ${missing_optional[*]}"
fi

echo "[check-runtime-deps] all required commands are available"
