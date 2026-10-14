# Artifact video review source map

This package preserves local review renders plus one completed, receipt-bound Jev presenter job. It does not upload media, create a platform draft, schedule, publish, send, change credentials, or mutate unrelated/shared production data.

`index.html` is the evidence surface. Dark Castle remains a customer-facing review video. Jev Human QA is withheld; its completed 22-second composite is retained only as superseded draft evidence until a template-bound presenter revision exists. Input versions, receipt identities, provenance, traceability, execution state, and validation details remain in the panels and sibling receipt JSON files; they are not burned into the video pixels.

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
- Authorized v3 result: exactly one job (`23ae7d28cc31ed24c93424cd568e0e09`) completed using Red V-Neck look `3feb738b9af64f7b8f91cc8e4ffcdc45`, Mad Hadda voice `3bed25c167534fd6ac5becdec4516ec7`, `avatar_iv`, and `elevenlabs`. The 9.2-second native source contains 230 video frames at 25 fps and stereo AAC audio; its SHA-256 is `eca8e916fc3ce60790f683e53575569128229dc6b8be64f1d9b548afa07ed414`.
- Native composite: `jev-avatar-motion-v3-mad-hadda-v1/jev-avatar-motion-review.mp4` uses the original provider frames and audio in three bounded windows over the 22-second motion master. FFmpeg removes the bright green provider background and thin blank edge pixels while preserving the face, microphone, clothing, native 25 fps source, and sequential native audio. The presenter is immediately visible and 760–900 pixels wide during presenter-led sections, alternating with motion-only sections without covering essential text. The final remains 1080 × 1920, 30 fps, 660 frames with stereo AAC audio.
- Cost evidence: provider quota moved from 367 to 323 (44-credit delta). The conservative approved-rate estimate is US$0.6133 at US$4/minute for 9.2 generated seconds; no direct cash invoice was returned. The authorization cap was US$9.
- Template selection: the existing seeded **Killer script** template is selected because it directly requires pain, hook, open loop, operating frame, proof, teaching progression, and a bounded next action. **Problem, proof, offer** would force an unapproved sales offer; **Accelerated lesson** is course-specific and would misstate the Jev campaign context.
- Template-run receipt: `inputs/jev-killer-script-template-run-v1.json` binds the revised 150-word script to `video_script_template_v1`, the current Jev input version, both approved claim IDs, the operator field-guide evidence asset, and approved source copy. It records the exact prior/revised script diff, an expected 68-second duration, an estimated US$4.53 cost at the conservative US$4/minute rate, a US$9 ceiling, one-job/no-retry constraints, and exact future approval wording.
- Killer-script provider attempt: the one authorized job (`59486d96b12ed3613ff8090324b08184`) used idempotency key `social-avatar-motion:5086cf2b506cd0c893e5c46aca70daafba7c3f55f48183d987d803f90881cc32` and failed with `Insufficient credit. This operation requires 'api' credits.` Quota remained 323 before and after, so the observed delta and conservative generated-duration cost are zero. The attempt cannot be retried. The full failure record is `jev-avatar-motion-v3-mad-hadda-v2-template/provider-failure.receipt.json`.
- Human QA state: withheld. The completed short-script composite and screenshot remain available at `#jev` only as superseded draft evidence. The revised script still lacks a successful native presenter source, so no replacement composite or Human-QA walkthrough exists. No retry, upload, platform draft, schedule, publish, external send, credential change, migration, or unrelated/shared production-data mutation occurred.

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
