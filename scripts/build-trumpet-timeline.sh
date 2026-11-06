#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
render_dir="${1:-/tmp/trumpet-render}"
asset_dir=public/work/trumpet-trainer/design
/opt/homebrew/bin/blender -b --python scripts/render_trumpet_timeline.py -- --output "$render_dir"
cp "$render_dir/trumpet-timeline.blend" "$asset_dir/trumpet-timeline-source/trumpet-timeline.blend"
cp "$render_dir/frame_0168.png" "$asset_dir/trumpet-timeline-poster.png"
ffmpeg -y -hide_banner -loglevel error -framerate 24 -i "$render_dir/frame_%04d.png" -c:v libvpx-vp9 -b:v 0 -crf 34 -pix_fmt yuva420p -auto-alt-ref 0 -metadata:s:v:0 alpha_mode=1 "$asset_dir/trumpet-timeline.webm"
img2webp -d 42 -loop 0 -lossy -q 78 "$render_dir"/frame_*.png -o "$asset_dir/trumpet-timeline.webp"
ffmpeg -y -hide_banner -loglevel error -f lavfi -i 'color=c=0x121e31:s=960x540:r=24' -framerate 24 -i "$render_dir/frame_%04d.png" -filter_complex '[0:v][1:v]overlay=shortest=1:format=auto,format=yuv420p' -frames:v 168 -c:v libx264 -crf 24 -preset medium -movflags +faststart "$asset_dir/trumpet-timeline.mp4"
