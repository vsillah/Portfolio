#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

for name in 01-overview 02-media 03-carousel 04-plan 05-copy 09-educator-desktop 10-educator-signature-desktop 06-gate 07-mobile-audiences 08-mobile-drafts 11-educator-mobile 12-educator-signature-mobile; do
  ffmpeg -hide_banner -loglevel error -y -i "${name}.png" \
    -vf 'scale=1280:850:force_original_aspect_ratio=decrease,pad=1280:850:(ow-iw)/2:(oh-ih)/2:color=0x111827' \
    -frames:v 1 "${name}-frame.png"
done

cat > frames.txt <<'EOF'
file '01-overview-frame.png'
duration 2.5
file '02-media-frame.png'
duration 2.5
file '03-carousel-frame.png'
duration 2.5
file '04-plan-frame.png'
duration 2.5
file '05-copy-frame.png'
duration 2.5
file '09-educator-desktop-frame.png'
duration 2.5
file '10-educator-signature-desktop-frame.png'
duration 2.5
file '06-gate-frame.png'
duration 2.5
file '07-mobile-audiences-frame.png'
duration 2.5
file '08-mobile-drafts-frame.png'
duration 2.5
file '11-educator-mobile-frame.png'
duration 2.5
file '12-educator-signature-mobile-frame.png'
duration 2.5
file '12-educator-signature-mobile-frame.png'
EOF

ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i frames.txt \
  -vf 'fps=24,format=yuv420p' -c:v libx264 -crf 21 -movflags +faststart \
  trumpet-recruitment-review-285db941.mp4
