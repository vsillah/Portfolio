#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT
frames=(01-guest-l01 02-transcript 03-direct-l02 04-worksheet 05-progress 06-operating-file 07-mobile-l06 08-mobile-worksheet)
for frame in "${frames[@]}"; do
  if [[ "$frame" == 07* || "$frame" == 08* ]]; then
    filter='crop=390:840:0:0,scale=501:1080,pad=1920:1080:709:0:color=0x101c31'
  else
    filter='crop=1500:900:535:0,scale=1800:1080,pad=1920:1080:60:0:color=0x101c31'
  fi
  ffmpeg -loglevel error -y -i "$frame.png" -vf "$filter" -frames:v 1 "$workdir/$frame.png"
  printf "file '%s.png'\nduration 2.5\n" "$frame" >> "$workdir/frames.txt"
done
printf "file '%s.png'\n" "08-mobile-worksheet" >> "$workdir/frames.txt"
ffmpeg -loglevel error -y -f concat -safe 0 -i "$workdir/frames.txt" -vf 'fps=24,format=yuv420p' -c:v libx264 -preset medium -crf 21 -movflags +faststart agentified-guest-walkthrough-599df64c.mp4
