#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT

for number in 01 02 03 04 05 06; do
  case "$number" in
    01) name=desktop-l01; filter='crop=1220:920:0:0,scale=1432:1080,pad=1920:1080:244:0:color=0x101c2d' ;;
    02) name=desktop-transcript; filter='crop=1220:920:0:0,scale=1432:1080,pad=1920:1080:244:0:color=0x101c2d' ;;
    03) name=desktop-l02-locked; filter='crop=1220:920:0:0,scale=1432:1080,pad=1920:1080:244:0:color=0x101c2d' ;;
    04) name=operating-file; filter='crop=1220:920:0:0,scale=1432:1080,pad=1920:1080:244:0:color=0x101c2d' ;;
    05) name=mobile-l01; filter='crop=390:760:0:500,scale=554:1080,pad=1920:1080:683:0:color=0x101c2d' ;;
    06) name=mobile-transcript; filter='crop=390:505:0:0,scale=834:1080,pad=1920:1080:543:0:color=0x101c2d' ;;
  esac
  ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 25 -i "$here/$number-$name.png" -t 3 -vf "$filter" -c:v libx264 -crf 20 -pix_fmt yuv420p -an "$scratch/$number.mp4"
  printf "file '%s/%s.mp4'\n" "$scratch" "$number" >> "$scratch/list.txt"
done

ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$scratch/list.txt" -c copy -movflags +faststart "$here/agentified-l01-learning-plan-walkthrough.mp4"
