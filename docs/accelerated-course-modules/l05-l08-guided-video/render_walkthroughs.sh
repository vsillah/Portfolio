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
render walkthrough-desktop.mp4 frame-l05-intro.png frame-l05-ledger.png frame-l06-prd.png frame-l07-checkpoint.png frame-l08-plan.png frame-desktop-locked.png
render walkthrough-mobile.mp4 frame-mobile-l05-intro.png frame-mobile-l05.png frame-mobile-l06.png frame-mobile-l07.png frame-mobile-l08.png frame-mobile-locked.png
