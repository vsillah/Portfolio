#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$root"
out=agentified/workshop/phase-3b-review/text-panel-padding/checks
mkdir -p "$out"
render() {
  local lesson="$1" scene="$2" start="$3" source="$4" source_sha="$5" vtt="$6" vtt_sha="$7" layout="$8"
  test "$(shasum -a 256 "$source" | cut -d' ' -f1)" = "$source_sha"
  test "$(shasum -a 256 "$vtt" | cut -d' ' -f1)" = "$vtt_sha"
  local frame="agentified/workshop/phase-3b-review/text-panel-padding/frames/illustrated/$scene.png"
  local stem="$out/$scene-$layout"
  python3 docs/agentified-distribution-readiness/phase-3b/trim_vtt.py "$vtt" "$stem.vtt" "$start" 8
  local filter
  if [[ "$layout" == desktop ]]; then filter='scale=1280:720'; else filter='scale=390:219,pad=390:844:0:312:color=0x071b2a'; fi
  ffmpeg -y -hide_banner -loglevel error -ss "$start" -i "$source" -loop 1 -framerate 25 -i "$frame" -i "$stem.vtt" -t 8 \
    -filter_complex "[1:v]$filter,format=yuv420p[v]" -map '[v]' -map 0:a:0 -map 2:0 \
    -c:v libx264 -preset veryfast -crf 20 -r 25 -c:a aac -b:a 192k -c:s mov_text \
    -metadata:s:s:0 language=eng -disposition:s:0 default -movflags +faststart "$stem.mp4"
  ffmpeg -v error -i "$stem.mp4" -f null -
}
for layout in desktop mobile; do
  render L06 L06-03 75 \
    public/agentified/lessons/l06/illustrated-163e01e6/agentified-l06-illustrated-composite.mp4 \
    163e01e6eb8f1a014b7155b40063bc2b6fa3546fc6bc4329579775581e6f9ef3 \
    public/agentified/lessons/l06/continuous-991cb8b6/agentified-l06-continuous-narration-captions.vtt \
    018418cc1d4bf2333ed6525f1926b8b052f57677a136976e42c80c8f703c69ba "$layout"
  render L10 L10-03 75 \
    public/agentified/lessons/l10/illustrated-65936cf3/agentified-l10-illustrated-composite.mp4 \
    65936cf362e2299d70f9fea807102cbc3813dec491b4805d51d0ddaecd59a762 \
    public/agentified/lessons/l10/approved-a2dfdec5/agentified-l10-native-captions.vtt \
    e54bdfb260e186474ec496a72e2031716a8ddab89594eff6fdc940f1e35df1b8 "$layout"
done
