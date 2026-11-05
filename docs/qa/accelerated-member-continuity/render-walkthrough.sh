#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p rendered
for image in 01-guest 02-guest-complete 03-member 04-assessed 05-paid 06-paid-mobile; do
  ffmpeg -hide_banner -loglevel error -y -i "$image.png" -vf 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x101a30' "rendered/$image.png"
done
cat > rendered/frames.txt <<'EOF'
file '01-guest.png'
duration 3
file '02-guest-complete.png'
duration 3
file '03-member.png'
duration 3
file '04-assessed.png'
duration 3
file '05-paid.png'
duration 3
file '06-paid-mobile.png'
duration 3
file '06-paid-mobile.png'
EOF
ffmpeg -hide_banner -loglevel error -y -safe 0 -f concat -i rendered/frames.txt -vf 'fps=24,format=yuv420p' -c:v libx264 -preset slow -crf 13 -movflags +faststart accelerated-member-continuity-walkthrough.mp4
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 accelerated-member-continuity-walkthrough.mp4
