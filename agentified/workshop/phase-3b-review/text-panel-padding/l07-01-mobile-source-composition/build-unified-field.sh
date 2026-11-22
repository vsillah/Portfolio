#!/usr/bin/env bash
# Prepare the continuous studio field and presenter-safe geometry stills.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"

# Convert both inputs to full-resolution RGB planes before blending. The
# generated art ends at x=850-904 (1672px source scale); the rest matches the
# native source's frame-zero studio color without a hard split or inset.
ffmpeg -y -hide_banner -loglevel error \
  -i "$here/unified-teaching-field.png" \
  -f lavfi -i 'color=c=0x0b2838:s=1672x941:r=1' \
  -filter_complex "[0:v]format=gbrp[a];[1:v]format=gbrp[b];[a][b]blend=all_expr='if(lte(X,850),A,if(gte(X,904),B,(A*(904-X)+B*(X-850))/54))',format=rgb24" \
  -frames:v 1 "$here/unified-studio-field.png"

ffmpeg -y -hide_banner -loglevel error -i "$here/unified-studio-field.png" \
  -vf 'scale=1920:1080,drawbox=x=1038:y=316:w=788:h=452:color=0xffcc66@0.95:t=5,scale=1280:720' \
  -frames:v 1 "$here/desktop-presenter-safe-zone.png"

ffmpeg -y -hide_banner -loglevel error -i "$here/unified-studio-field.png" \
  -vf 'scale=1920:1080,drawbox=x=1038:y=316:w=788:h=452:color=0xffcc66@0.95:t=7,scale=390:219' \
  -frames:v 1 "$here/mobile-presenter-safe-zone.png"
