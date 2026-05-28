#!/usr/bin/env bash
set -euo pipefail

endpoint_file="${PIXEL_ADB_ENDPOINT_FILE:-$HOME/.codex/pixel-adb-endpoint}"

usage() {
  cat <<'USAGE'
Control the paired Google Pixel through ADB for mobile validation.

Usage:
  scripts/pixel-control.sh status
  scripts/pixel-control.sh connect PHONE_IP:CONNECT_PORT
  scripts/pixel-control.sh mirror [scrcpy args...]
  scripts/pixel-control.sh screenshot [output.png]
  scripts/pixel-control.sh open-slack
  scripts/pixel-control.sh tap X Y
  scripts/pixel-control.sh text "message"

Notes:
  - mirror launches scrcpy through scripts/mirror-pixel.sh.
  - screenshot/open-slack/tap/text use ADB directly and do not require Computer Use.
  - connect stores the latest endpoint in ~/.codex/pixel-adb-endpoint.
USAGE
}

require_adb() {
  if ! command -v adb >/dev/null 2>&1; then
    echo "Missing required command: adb" >&2
    echo "Install with: brew install android-platform-tools" >&2
    exit 1
  fi
}

require_scrcpy() {
  if ! command -v scrcpy >/dev/null 2>&1; then
    echo "Missing required command: scrcpy" >&2
    echo "Install with: brew install scrcpy" >&2
    exit 1
  fi
}

read_cached_endpoint() {
  if [[ -f "$endpoint_file" ]]; then
    tr -d '[:space:]' < "$endpoint_file"
  fi
  return 0
}

cache_endpoint() {
  local endpoint="$1"
  mkdir -p "$(dirname "$endpoint_file")"
  printf '%s\n' "$endpoint" > "$endpoint_file"
}

connect_endpoint() {
  local endpoint="$1"
  if [[ -z "$endpoint" ]]; then
    return 0
  fi
  adb connect "$endpoint" >/dev/null || true
}

connected_devices() {
  adb devices | awk 'NR > 1 && $2 == "device" { print $1 }'
}

select_device() {
  local serial="${PIXEL_ADB_SERIAL:-}"
  if [[ -n "$serial" ]]; then
    printf '%s\n' "$serial"
    return 0
  fi

  local devices=()
  while IFS= read -r device; do
    [[ -n "$device" ]] && devices+=("$device")
  done < <(connected_devices)

  if [[ "${#devices[@]}" -eq 0 ]]; then
    return 1
  fi

  for device in "${devices[@]}"; do
    if [[ "$device" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:[0-9]+$ ]]; then
      printf '%s\n' "$device"
      return 0
    fi
  done

  printf '%s\n' "${devices[0]}"
}

ensure_device() {
  require_adb
  adb start-server >/dev/null

  if [[ -n "${PIXEL_ADB_ENDPOINT:-}" ]]; then
    connect_endpoint "$PIXEL_ADB_ENDPOINT"
  else
    connect_endpoint "$(read_cached_endpoint)"
  fi

  local serial
  if ! serial="$(select_device)"; then
    cat >&2 <<'ERROR'
No paired Pixel is currently visible to ADB.

On the Pixel:
  1. Open Settings -> System -> Developer options -> Wireless debugging.
  2. Make sure Wireless debugging is on.
  3. Copy the current IP address & Port.

Then run:
  scripts/pixel-control.sh connect PHONE_IP:CONNECT_PORT
  scripts/pixel-control.sh mirror

Use the normal Wi-Fi IP. Avoid Tailscale/VPN 100.x.x.x addresses.
ERROR
    exit 1
  fi

  if [[ "$serial" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:[0-9]+$ ]]; then
    cache_endpoint "$serial"
  fi

  printf '%s\n' "$serial"
}

status() {
  require_adb
  adb start-server >/dev/null

  local cached
  cached="$(read_cached_endpoint || true)"
  if [[ -n "$cached" ]]; then
    connect_endpoint "$cached"
  fi

  echo "ADB: $(command -v adb)"
  if command -v scrcpy >/dev/null 2>&1; then
    echo "scrcpy: $(command -v scrcpy)"
  else
    echo "scrcpy: missing"
  fi

  if [[ -n "$cached" ]]; then
    echo "cached endpoint: $cached"
  else
    echo "cached endpoint: none"
  fi

  echo
  echo "Connected devices:"
  adb devices -l

  echo
  echo "Discovered wireless ADB services:"
  adb mdns services || true
}

case "${1:-status}" in
  -h|--help|help)
    usage
    ;;
  status)
    status
    ;;
  connect)
    require_adb
    endpoint="${2:-}"
    if [[ -z "$endpoint" ]]; then
      echo "Missing endpoint. Usage: scripts/pixel-control.sh connect PHONE_IP:CONNECT_PORT" >&2
      exit 1
    fi
    adb start-server >/dev/null
    adb connect "$endpoint"
    cache_endpoint "$endpoint"
    echo "Cached Pixel endpoint: $endpoint"
    ;;
  mirror)
    require_scrcpy
    shift
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    exec "$script_dir/mirror-pixel.sh" "$@"
    ;;
  screenshot)
    serial="$(ensure_device)"
    output="${2:-/tmp/pixel-screen.png}"
    adb -s "$serial" exec-out screencap -p > "$output"
    echo "Saved Pixel screenshot: $output"
    ;;
  open-slack)
    serial="$(ensure_device)"
    adb -s "$serial" shell monkey -p com.Slack 1 >/dev/null
    echo "Opened Slack on Pixel target: $serial"
    ;;
  tap)
    serial="$(ensure_device)"
    x="${2:-}"
    y="${3:-}"
    if [[ -z "$x" || -z "$y" ]]; then
      echo "Missing coordinates. Usage: scripts/pixel-control.sh tap X Y" >&2
      exit 1
    fi
    adb -s "$serial" shell input tap "$x" "$y"
    ;;
  text)
    serial="$(ensure_device)"
    shift
    text="${*:-}"
    if [[ -z "$text" ]]; then
      echo "Missing text. Usage: scripts/pixel-control.sh text \"message\"" >&2
      exit 1
    fi
    escaped="${text// /%s}"
    adb -s "$serial" shell input text "$escaped"
    ;;
  *)
    echo "Unknown command: $1" >&2
    usage >&2
    exit 1
    ;;
esac
