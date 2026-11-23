#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
source_video="$root/public/agentified/lessons/l10/illustrated-65936cf3/agentified-l10-illustrated-composite.mp4"
source_vtt="$root/public/agentified/lessons/l10/approved-a2dfdec5/agentified-l10-native-captions.vtt"
target_dir="$root/agentified/workshop/phase-3b-review/L10"
target_vtt="$target_dir/agentified-l10-caption-timed.vtt"
target_video="$target_dir/agentified-l10-caption-timed-composite.mp4"

test "$(shasum -a 256 "$source_video" | cut -d' ' -f1)" = '65936cf362e2299d70f9fea807102cbc3813dec491b4805d51d0ddaecd59a762'
test "$(shasum -a 256 "$source_vtt" | cut -d' ' -f1)" = 'e54bdfb260e186474ec496a72e2031716a8ddab89594eff6fdc940f1e35df1b8'

# Native word timing and local acoustic alignment place "condition" through
# 03:05.000 and the next utterance at 03:05.520. Keep all words and other cues.
mkdir -p "$target_dir"
python3 - "$source_vtt" "$target_vtt" <<'PY'
from pathlib import Path
import sys
source = Path(sys.argv[1]).read_text()
old = '00:03:04.360 --> 00:03:06.300'
assert source.count(old) == 1
Path(sys.argv[2]).write_text(source.replace(old, '00:03:05.520 --> 00:03:06.300'))
PY
test "$(shasum -a 256 "$target_vtt" | cut -d' ' -f1)" = '0650d923e75357b672a493b40f633953b97c014efdd96767413f3679c2123ed3'
ffmpeg -y -hide_banner -loglevel error -i "$source_video" -i "$target_vtt" -map 0:v:0 -map 0:a:0 -map 1:0 -c:v copy -c:a copy -c:s mov_text -metadata:s:s:0 language=eng -disposition:s:0 default -movflags +faststart "$target_video"
test "$(shasum -a 256 "$target_video" | cut -d' ' -f1)" = 'a2fa26021004d42136f43d96eb700115a0cf51aaa9ee28c81a77cc03c7f127a4'
printf 'L10 caption-only remux reproduced: %s\n' "$target_video"
