# Artifact video review source map

This package is a provider-free local review render for the approved Phase 4 artifact-to-video packets. It does not upload media, create a platform draft, schedule, publish, send, change credentials, or spend money.

`index.html` is the Human QA surface. Each clean **Customer-facing video** is visually separated from an expandable **QA evidence** panel. Input versions, receipt identities, provenance, traceability, provider-off state, and validation details remain in those panels and the sibling receipt JSON files; they are not burned into the video pixels.

## Jev

- Packet: `inputs/jev.json`
- Required input-version prefix: `sha256:e6fc9ae4`
- Approved visual subject: `inputs/jev-operator-field-guide.png`
- Source location: `artifacts/human-qa/youtube-packet-review-2026-10-14/jev.json` and `jev-operator-field-guide.png` in the primary Portfolio checkout
- Review target: `youtube_shorts`
- Required evidence path: worked typed-probability return, policy bands, system ownership, and the live-provider hold boundary
- Motion repair: `jev_decision_flow_v2`, a 22-second, 1080 × 1920 provider-none composition with 660 encoded frames at 30 fps.
- Temporal structure: score hook, animated probability routing, policy-band reveal, ownership handoffs, exception routing, and the closing operating principle.
- Avatar audit: Portfolio and AmaduTown owned-media folders contain presenter footage, but no clip-level consent and rights receipt binds a specific clip to this Jev packet. No presenter footage was reused, and the avatar-source gate remains closed.
- HeyGen recovery evidence: the authenticated Studio pairs Red V-Neck with the Mad Hadda default voice and plays its preview. The single authorized v2 attempt used a different exact voice ID (`Young Black CEO Voice`), failed `VOICE_CONFIG_ERROR`, changed no quota, and produced no output. Its idempotency key remains consumed and cannot be retried.
- HeyGen v3 contract evidence: read-only `/v3/avatars/looks/{look_id}` checks report all seven approved looks as completed with `avatar_v`, `avatar_iv`, and `avatar_iii` support. The private v3 voice catalog reports `elevenlabs` support for both the consumed packet voice and the distinct Red V-Neck default `Vambah Sillah (Mad Hadda)` voice. The bound evidence is in `inputs/heygen-v3-avatar-voice-compatibility-v1.json`.
- Migration boundary: future generation must use an explicitly approved `/v3/videos` contract, exact look and voice IDs, bound engines, catalog receipt, fresh provider authorization, and a new idempotency key. The adapter never infers a switch to the look's default voice. No provider job, upload, credential change, or cost was incurred while validating this path.
- Human QA state: pending after the original static-image timeline was rejected.

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
