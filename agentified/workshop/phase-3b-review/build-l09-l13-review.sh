#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$root"
review=agentified/workshop/phase-3b-review
l09=$review/L09
l13=$review/L13
source_map=docs/agentified-distribution-readiness/phase-3b/source-map-v1.json
l01_source=public/agentified/lessons/l01/illustrated-1eeaa68b/agentified-l01-illustrated-composite.mp4
l09_source=public/agentified/lessons/l09/illustrated-998a5ccc/agentified-l09-illustrated-composite.mp4
l09_vtt=public/agentified/lessons/l09/approved-277c85aa/agentified-l09-native-captions.vtt
l13_source=public/agentified/lessons/l13/illustrated-4ae75aa1/agentified-l13-illustrated-composite.mp4

check_hash() { test "$(shasum -a 256 "$1" | cut -d' ' -f1)" = "$2"; }
check_hash "$source_map" 6316aa15a232e99019f938ccbaae397e5314f5d4035a626346caad5f6b8aebad
check_hash "$l01_source" 1eeaa68bde9529da7e2aeb8ccbd36b4dd41c56f408e191792765230b9c861775
check_hash "$l09_source" 998a5ccc01d9a599025e27f035a72fe9b5104d98b69ce17bd12de5f6436a4dd6
check_hash "$l09_vtt" 68371ffd0a983e3f599be63acb57851bd96dd9bceebc574516db86680c093f3d
check_hash "$l13_source" 4ae75aa1afeef376820edf3390313c5a4239fa70e94abf7e0b558bbca093a18f
mkdir -p "$l09" "$l13"
python3 - "$l09_vtt" "$l09/agentified-l09-approved-word-candidate.vtt" <<'PY'
from pathlib import Path
import sys
source=Path(sys.argv[1]).read_text()
old='Make reject and request-revision as visible as approve.'
assert source.count(old)==1
Path(sys.argv[2]).write_text(source.replace(old,'Make reject and request-revision as visible as approved.'))
PY
ffmpeg -y -hide_banner -loglevel error -i "$l09_source" -i "$l09/agentified-l09-approved-word-candidate.vtt" \
  -map 0:v:0 -map 0:a:0 -map 1:0 -c:v copy -c:a copy -c:s mov_text \
  -metadata:s:s:0 language=eng -disposition:s:0 default -movflags +faststart \
  "$l09/agentified-l09-approved-word-candidate.mp4"

scratch="$(mktemp -d)"
trap 'rm -f "$scratch"/source.wav "$scratch"/shifted.wav "$scratch"/l13-original.wav "$scratch"/l13-patched.wav "$scratch"/l13-audio-only.mp4; rmdir "$scratch"' EXIT
ffmpeg -y -hide_banner -loglevel error -ss 223.06 -i "$l01_source" -t 0.48 -vn \
  -c:a pcm_s16le -ar 48000 -ac 2 "$scratch/source.wav"
cmp "$scratch/source.wav" "$l13/l01-unknown-source-sample.wav"
ffmpeg -y -hide_banner -loglevel error -i "$scratch/source.wav" \
  -af 'asetrate=40800,aresample=48000,atempo=1.176470588' -t 0.48 -c:a pcm_s16le "$scratch/shifted.wav"
cmp "$scratch/shifted.wav" "$l13/l01-unknown-pitch-matched-sample.wav"
ffmpeg -y -hide_banner -loglevel error -i "$l13_source" -vn -c:a pcm_s16le -ar 48000 -ac 2 "$scratch/l13-original.wav"
audio_python="${AGENTIFIED_AUDIO_PYTHON:-python3}"
"$audio_python" "$l13/splice_unknown.py" "$scratch/l13-original.wav" "$scratch/shifted.wav" "$scratch/l13-patched.wav"
ffmpeg -y -hide_banner -loglevel error -i "$l13_source" -i "$scratch/l13-patched.wav" \
  -map 0:v:0 -map 1:a:0 -map 0:s:0 -c:v copy \
  -af 'atrim=duration=255.243,asetpts=N/SR/TB' -c:a aac -b:a 320k -c:s copy \
  -movflags +faststart "$scratch/l13-audio-only.mp4"
node "$l13/render-content-aware-frame.mjs"
ffmpeg -y -hide_banner -loglevel error -i "$scratch/l13-audio-only.mp4" -loop 1 -framerate 25 \
  -i "$l13/L13-03-content-aware.png" \
  -filter_complex "[0:v][1:v]overlay=0:0:enable='between(t,56.587,90.371)':shortest=1:format=auto,format=yuv420p[v]" \
  -map '[v]' -map 0:a:0 -map 0:s:0 -c:v libx264 -preset veryfast -crf 20 -r 25 -pix_fmt yuv420p \
  -c:a copy -c:s copy -movflags +faststart "$l13/agentified-l13-unknown-content-aware-candidate.mp4"
bash "$review/render-l09-l13-context.sh"
python3 "$review/burn-review-captions.py"
python3 "$review/verify-review-candidates.py"
