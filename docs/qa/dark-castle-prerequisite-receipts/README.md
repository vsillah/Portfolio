# Dark Castle prerequisite receipt recorder QA

Scope: canonical Social Content record `c12378f2-36de-4bf7-8c5d-0ce754e727eb`, content version `sha256:4b4126fe2388687c899530cdb9ee973e744d9e0ebfd2b6378ac6b3702000342a`, source record timestamp `2026-10-27T20:14:59.293829Z`.

The recorder creates six immutable review receipts and projects them atomically to `copy_review_evidence_receipts`. It does not invoke or change `20261101145513_bind_dark_castle_youtube_copy_review.sql`, prepare a copy-review packet, or perform an external action. No production migration or receipt recording was run for this QA.

## Local operator review

The captured route is `/admin/social-content/dark-castle-youtube-receipt-review?qa_fixture=dark_castle_receipt_packets_v1` on the exact implementation worktree. The fixture is public-safe and disables recording. The `desktop-01.jpg` through `desktop-06.jpg` and matching `mobile` files show each packet selected by the actual UI control. `tablet-visual.jpg` shows the 768 px state. The 18-second [walkthrough](walkthrough.mp4) combines the desktop and mobile interactions; `render-walkthrough.sh` reproduces it from the captured frames.

Viewport checks: desktop 1280 px, tablet 768 px, mobile 390 px. All six packet controls changed the visible packet. The fixture record control and reviewer checkbox remained disabled. Tablet and mobile `document.documentElement.scrollWidth` matched their viewport widths. The actual authenticated recording path is covered by unit, route, and PostgreSQL tests; it was not invoked against customer or production data.

## Validation

```bash
./node_modules/.bin/vitest run lib/dark-castle-prerequisite-recorder.postgres.test.ts lib/dark-castle-prerequisite-recorder.test.ts lib/dark-castle-receipt-review-packets.test.ts app/api/admin/social-content/'[id]'/dark-castle-receipt-review/route.test.ts app/admin/social-content/dark-castle-youtube-receipt-review/page.test.tsx
./node_modules/.bin/eslint app/admin/social-content/dark-castle-youtube-receipt-review/page.tsx app/api/admin/social-content/'[id]'/dark-castle-receipt-review/route.ts lib/dark-castle-prerequisite-recorder.ts lib/dark-castle-prerequisite-recorder.test.ts lib/dark-castle-prerequisite-recorder.postgres.test.ts
git diff --check
ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height,nb_frames,r_frame_rate -of json docs/qa/dark-castle-prerequisite-receipts/walkthrough.mp4
```

The full repository `tsc --noEmit` check reports unrelated pre-existing errors in campaign/social tests and generated chatbot knowledge imports. No error was reported in files from this lane.
