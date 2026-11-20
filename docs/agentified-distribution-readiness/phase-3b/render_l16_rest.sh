#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
source_video="$root/public/agentified/lessons/l16/illustrated-4283c8d8/agentified-l16-illustrated-composite.mp4"
source_card="$root/agentified/workshop/presentation-illustration-audit/frames/illustrated/L16-08.png"
target="$root/agentified/workshop/phase-3b-review/L16/agentified-l16-resting-composite.mp4"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT

test "$(shasum -a 256 "$source_video" | cut -d' ' -f1)" = '4283c8d8fb7eca85b9b0493aa07ac22901f0155d0742ebc61c0a0744698846fc'
test "$(shasum -a 256 "$source_card" | cut -d' ' -f1)" = 'de03f55bf5c6472d53b540ba3c0de023fb9dda4ccba83008c89b0ed85982f015'

# The approved L16 closing card overlays the final presenter passage. Its clean
# source frame replaces the picture only after the existing video ends at 266.680.
ffmpeg -y -hide_banner -loglevel error -loop 1 -framerate 25 -i "$source_card" -t 8.64 -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 25 "$scratch/card.mp4"
printf "file '%s'\nduration 266.680\nfile '%s'\n" "$source_video" "$scratch/card.mp4" > "$scratch/concat.txt"
ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i "$scratch/concat.txt" -map 0:v:0 -c:v copy "$scratch/video.mp4"
mkdir -p "$(dirname "$target")"
ffmpeg -y -hide_banner -loglevel error -i "$scratch/video.mp4" -i "$source_video" -map 0:v:0 -map 1:a:0 -map 1:s:0 -c copy -metadata:s:s:0 language=eng -disposition:s:0 default -movflags +faststart "$target"
test "$(shasum -a 256 "$target" | cut -d' ' -f1)" = '5e5159a626a3cc3c5ef43ce679fcd451140895b0717db572b01fb1ed01496a3c'
printf 'L16 resting composite reproduced: %s\n' "$target"
