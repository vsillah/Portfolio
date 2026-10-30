#!/bin/zsh
set -euo pipefail

PACKAGE_DIR=${0:a:h}
REMOTION_BIN=/Users/vambahsillah/Projects/Portfolio.worktrees/stop-counting-ai-licenses-media/node_modules/.bin/remotion
PUBLIC_DIR="$PACKAGE_DIR/render-public"

mkdir -p "$PUBLIC_DIR"
cp "$PACKAGE_DIR/source/amadutown-logo-upscaled.png" "$PUBLIC_DIR/amadutown-logo-upscaled.png"
cp "$PACKAGE_DIR/source/dark-castle-live-gameplay.webm" "$PUBLIC_DIR/dark-castle-live-gameplay.webm"
cp "$PACKAGE_DIR/source/gameplay-stills/01-explore-start.png" "$PUBLIC_DIR/01-explore-start.png"
cp "$PACKAGE_DIR/source/gameplay-stills/02-explore-e4.png" "$PUBLIC_DIR/02-explore-e4.png"
cp "$PACKAGE_DIR/source/gameplay-stills/03-handoff.png" "$PUBLIC_DIR/03-handoff.png"
cp "$PACKAGE_DIR/source/gameplay-stills/04-computer-response.png" "$PUBLIC_DIR/04-computer-response.png"

"$REMOTION_BIN" render "$PACKAGE_DIR/remotion/index.ts" DarkCastleBase "$PACKAGE_DIR/dark-castle-base.mp4" \
  --public-dir="$PUBLIC_DIR" --codec=h264 --crf=18 --pixel-format=yuv420p --log=verbose
