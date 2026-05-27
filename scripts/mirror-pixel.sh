#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Mirror a paired Google Pixel on this Mac with scrcpy.

Usage:
  scripts/mirror-pixel.sh [scrcpy args...]

Optional environment:
  PIXEL_ADB_ENDPOINT=192.168.4.26:43343
  PIXEL_ADB_SERIAL=adb-..._adb-tls-connect._tcp

If no endpoint or serial is provided, the script selects a connected ADB device,
preferring a normal IP:port serial when duplicate mDNS entries exist.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

for command in adb scrcpy; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    echo "Install with: brew install scrcpy android-platform-tools" >&2
    exit 1
  fi
done

scrcpy_bin="$(command -v scrcpy)"

adb start-server >/dev/null

if [[ -n "${PIXEL_ADB_ENDPOINT:-}" ]]; then
  adb connect "$PIXEL_ADB_ENDPOINT" >/dev/null || true
fi

devices=()
while IFS= read -r serial; do
  [[ -n "$serial" ]] && devices+=("$serial")
done < <(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')

target="${PIXEL_ADB_SERIAL:-}"

if [[ -z "$target" && -n "${PIXEL_ADB_ENDPOINT:-}" ]]; then
  target="$PIXEL_ADB_ENDPOINT"
fi

if [[ -z "$target" && "${#devices[@]}" -eq 1 ]]; then
  target="${devices[0]}"
fi

if [[ -z "$target" && "${#devices[@]}" -gt 1 ]]; then
  for serial in "${devices[@]}"; do
    if [[ "$serial" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:[0-9]+$ ]]; then
      target="$serial"
      break
    fi
  done
fi

if [[ -z "$target" && "${#devices[@]}" -gt 0 ]]; then
  target="${devices[0]}"
fi

if [[ -z "$target" ]]; then
  cat >&2 <<'ERROR'
No paired Pixel is currently visible to ADB.

On the Pixel:
  1. Open Settings -> System -> Developer options -> Wireless debugging.
  2. Make sure Wireless debugging is on.
  3. If already paired, copy the current IP address & Port.

Then run:
  adb connect PHONE_IP:CONNECT_PORT
  scripts/mirror-pixel.sh

Avoid Tailscale/VPN 100.x.x.x addresses for pairing. Use the normal Wi-Fi IP.
ERROR
  exit 1
fi

echo "Starting Pixel mirror with ADB target: $target"
exec "$scrcpy_bin" -s "$target" "$@"
