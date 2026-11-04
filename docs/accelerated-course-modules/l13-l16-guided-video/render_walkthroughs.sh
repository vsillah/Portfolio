#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Frames are captured from the localhost review route with the in-app browser.
# This local render has no voice, presenter generation, provider request, or upload.
render () {
  local output="$1"; shift
  local args=() filters=() i=0 joined=''
  for frame in "$@"; do
    args+=(-loop 1 -framerate 24 -t 3 -i "$frame")
    filters+=("[$i:v]format=yuv420p[v$i]")
    joined+="[v$i]"
    ((i+=1))
  done
  local filter
  filter=$(IFS=';'; echo "${filters[*]};${joined}concat=n=$i:v=1:a=0[out]")
  ffmpeg -hide_banner -loglevel error -y "${args[@]}" -filter_complex "$filter" -map '[out]' -r 24 -c:v libx264 -pix_fmt yuv420p -crf 21 -movflags +faststart "$output"
  ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of default=noprint_wrappers=1 "$output"
}
render walkthrough-desktop.mp4 frame-l13-intro.png frame-l13-test.png frame-l14-simulation.png frame-l15-governance.png frame-l16-boundary.png frame-l16-close.png frame-l16-cover.png frame-desktop-locked.png
render walkthrough-mobile.mp4 frame-mobile-l13.png frame-mobile-l14.png frame-mobile-l15.png frame-mobile-l16-boundary.png frame-mobile-l16-close.png frame-mobile-l16-cover.png frame-mobile-locked.png
