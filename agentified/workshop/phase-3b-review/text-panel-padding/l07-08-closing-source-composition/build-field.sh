#!/usr/bin/env bash
# Prepare the continuous closing field and mark the native presenter-safe zone.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"

# The last teaching object ends left of x=880 in the 1672px source. Match the
# empty right field to the native studio color without a hard vertical edge.
ffmpeg -y -hide_banner -loglevel error \
  -i "$here/teaching-field-v2.png" \
  -f lavfi -i 'color=c=0x0b2838:s=1672x941:r=1' \
  -filter_complex "[0:v]format=gbrp[a];[1:v]format=gbrp[b];[a][b]blend=all_expr='if(lte(X,880),A,if(gte(X,904),B,(A*(904-X)+B*(X-880))/24))',format=rgb24" \
  -frames:v 1 "$here/studio-field.png"

ffmpeg -y -hide_banner -loglevel error -i "$here/studio-field.png" \
  -vf 'scale=1920:1080,drawbox=x=1038:y=316:w=788:h=452:color=0xffcc66@0.95:t=5,scale=1280:720' \
  -frames:v 1 "$here/desktop-presenter-safe-zone.png"

ffmpeg -y -hide_banner -loglevel error -i "$here/studio-field.png" \
  -vf 'scale=1920:1080,drawbox=x=1038:y=316:w=788:h=452:color=0xffcc66@0.95:t=7,scale=390:219' \
  -frames:v 1 "$here/mobile-presenter-safe-zone.png"
