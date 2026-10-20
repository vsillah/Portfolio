#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
packet_dir="$repo_root/artifacts/review/approved-youtube-campaign-production-2026-10-19"
list_file="$(mktemp)"
trap 'rm -f "$list_file"' EXIT

for image in \
  public/review-assets/social-content/dark-castle-hero-thumbnail-review/dark-castle-remember-the-why-hero-v1.png \
  public/review-assets/social-content/dark-castle-customer-facing-poster.png \
  public/review-assets/social-content/storyboard-review/dark-castle-remember-the-why-provider-none.png \
  public/review-assets/social-content/ai-audit-hero-thumbnail-review/ai-audit-who-owns-cleanup-hero-v1.png \
  public/audit_calculator_img.png \
  public/review-assets/social-content/source-proof/ai-audit-calculator.png; do
  printf "file '%s/%s'\nduration 3\n" "$repo_root" "$image" >> "$list_file"
done
printf "file '%s/%s'\n" "$repo_root" public/review-assets/social-content/source-proof/ai-audit-calculator.png >> "$list_file"

ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$list_file" \
  -vf 'fps=24,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x0c172b,format=yuv420p' \
  -c:v libx264 -preset veryfast -crf 22 -movflags +faststart "$packet_dir/storyboard-preview.mp4"
