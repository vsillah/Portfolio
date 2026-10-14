# Artifact video review source map

This package is a provider-free local review render for the approved Phase 4 artifact-to-video packets. It does not upload media, create a platform draft, schedule, publish, send, change credentials, or spend money.

## Jev

- Packet: `inputs/jev.json`
- Required input-version prefix: `sha256:e6fc9ae4`
- Approved visual subject: `inputs/jev-operator-field-guide.png`
- Source location: `artifacts/human-qa/youtube-packet-review-2026-10-14/jev.json` and `jev-operator-field-guide.png` in the primary Portfolio checkout
- Review target: `youtube_shorts`
- Required evidence path: worked typed-probability return, policy bands, system ownership, and the live-provider hold boundary

## Dark Castle Chess

- Packet: `inputs/dark_castle_chess.json`
- Required input-version prefix: `sha256:4d3bc63e`
- Approved visual subjects: `inputs/explore-position.jpg`, `inputs/explore-start.jpg`, and `inputs/explore-computer.jpg`
- Source location: the matching public gameplay captures from the Dark Castle Chess repository, corresponding to the three public URLs recorded in the packet
- Review target: `youtube_shorts`
- Required product-learning sequence: Explore, Transfer, Meet the response

## Local render command

```bash
node scripts/render-social-video-adaptation-review.mjs \
  --packet <packet-json> \
  --asset-map <asset-map-json> \
  --output <review-mp4> \
  --expected-prefix <approved-input-version-prefix> \
  --target youtube_shorts
```

The renderer validates all eight packet receipts, current input-version bindings, the provider-off boundary, every target scene, and every scene-to-shot binding before FFmpeg runs. Each MP4 has a sibling receipt JSON containing the rendered scene IDs, shot IDs, asset IDs, receipt IDs, FFprobe result, SHA-256 digest, and zero-external-call declaration.
