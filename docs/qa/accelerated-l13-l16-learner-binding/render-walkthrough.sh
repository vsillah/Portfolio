#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
cat > walkthrough.ffconcat <<'LIST'
ffconcat version 1.0
file '01-l13-player-dark.png'
duration 2.5
file '02-l13-transcript-dark.png'
duration 2.5
file '03-l13-progress-dark.png'
duration 2
file 'l14-player-dark.png'
duration 2.5
file 'l14-transcript-dark.png'
duration 2.5
file 'l14-progress-dark.png'
duration 2
file 'l15-player-dark.png'
duration 2.5
file 'l15-transcript-dark.png'
duration 2.5
file 'l15-progress-dark.png'
duration 2
file 'l16-player-dark.png'
duration 2.5
file 'l16-transcript-dark.png'
duration 2.5
file 'l16-progress-dark.png'
duration 2.5
file 'l16-progress-dark.png'
LIST
ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i walkthrough.ffconcat -vf 'fps=12,format=yuv420p' -c:v libx264 -crf 21 -preset medium -movflags +faststart accelerated-l13-l16-learner-walkthrough.mp4
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 accelerated-l13-l16-learner-walkthrough.mp4
