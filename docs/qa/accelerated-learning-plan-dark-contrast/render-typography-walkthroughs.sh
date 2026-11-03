#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
frames_dir=$(mktemp -d)
trap 'rm -rf "$frames_dir"' EXIT

render() {
  local size=$1 height=$2 name=$3
  shift 3
  local list="$frames_dir/$name.txt"
  local index=0 last=
  : > "$list"
  while (($#)); do
    local source=$1 top=$2
    shift 2
    local frame="$frames_dir/$name-$index.png"
    ffmpeg -y -loglevel error -i "$source" -vf "crop=${size}:${height}:0:${top},scale=iw*2:ih*2:flags=lanczos" -frames:v 1 "$frame"
    printf "file '%s'\nduration 2\n" "$frame" >> "$list"
    last=$frame
    ((index+=1))
  done
  printf "file '%s'\n" "$last" >> "$list"
  ffmpeg -y -loglevel error -f concat -safe 0 -i "$list" -r 25 -vf format=yuv420p \
    -c:v libx264 -crf 22 -preset medium -movflags +faststart "$name.mp4"
}

render 380 844 typography-mobile-walkthrough \
  typography-mobile-light.jpg 450 typography-mobile-light.jpg 900 \
  typography-mobile-light.jpg 1880 typography-mobile-light.jpg 2850 \
  typography-mobile-dark.jpg 450 typography-mobile-dark.jpg 900 \
  typography-mobile-dark.jpg 1880 typography-mobile-dark.jpg 2850

render 758 900 typography-tablet-walkthrough \
  typography-tablet-light.jpg 270 typography-tablet-light.jpg 740 \
  typography-tablet-light.jpg 1300 typography-tablet-light.jpg 2215 \
  typography-tablet-dark.jpg 270 typography-tablet-dark.jpg 740 \
  typography-tablet-dark.jpg 1300 typography-tablet-dark.jpg 2215
