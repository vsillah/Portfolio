#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Inputs are screenshots captured from the exact localhost review route at
# 1440x1000 and 390x844. This script never opens a provider or synthesizes speech.
desktop=(frame-l02-intro.png frame-l02-options.png frame-l02-priority.png frame-l03-intro.png frame-l03-evidence.png frame-l04-intro.png frame-l04-persona.png frame-l04-close.png)
args=()
filters=()
for i in "${!desktop[@]}"; do
  args+=(-loop 1 -framerate 24 -t 2.5 -i "${desktop[$i]}")
  filters+=("[$i:v]format=yuv420p[v$i]")
done
joined=$(printf '[v%s]' "${!desktop[@]}")
filter=$(IFS=';'; echo "${filters[*]};${joined}concat=n=${#desktop[@]}:v=1:a=0[out]")
ffmpeg -hide_banner -loglevel error -y "${args[@]}" -filter_complex "$filter" -map '[out]' -r 24 -c:v libx264 -pix_fmt yuv420p -crf 21 -movflags +faststart walkthrough-desktop.mp4

mobile=(frame-mobile-l02.png frame-mobile-l03.png frame-mobile-l04.png)
args=()
filters=()
for i in "${!mobile[@]}"; do
  args+=(-loop 1 -framerate 24 -t 3 -i "${mobile[$i]}")
  filters+=("[$i:v]format=yuv420p[v$i]")
done
joined=$(printf '[v%s]' "${!mobile[@]}")
filter=$(IFS=';'; echo "${filters[*]};${joined}concat=n=${#mobile[@]}:v=1:a=0[out]")
ffmpeg -hide_banner -loglevel error -y "${args[@]}" -filter_complex "$filter" -map '[out]' -r 24 -c:v libx264 -pix_fmt yuv420p -crf 21 -movflags +faststart walkthrough-mobile.mp4

ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of default=noprint_wrappers=1 walkthrough-desktop.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of default=noprint_wrappers=1 walkthrough-mobile.mp4
