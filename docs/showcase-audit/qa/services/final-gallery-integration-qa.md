# Final service gallery integration QA — 2026-10-23

## Binding

- Code commit: `3277ca5f` on `codex/service-showcase-audit`.
- Exact local review: `http://127.0.0.1:3212/services?rev=3277ca5f`.
- The GET-only QA proxy serves the captured 41-service public catalog to the branch at port 3211. It does not write provider or production data.
- All 41 active catalog IDs resolve to two distinct local frames. Each binding checks the current listing image URL. Unmatched sources fall back to the current listing image.
- The three prior calibration pairs are unchanged. The other 38 pairs are the Captain-approved review frames.
- Julie's first frame is labeled `public source review`; its second is labeled `illustrative proposal`. The self-paced course poster remains separate from playable video.

## Local checks

- `npx vitest run lib/service-gallery.test.ts components/ShowcaseCarousel.test.tsx components/Services.showcase.test.tsx components/CatalogCard.test.tsx` — 10 tests passed.
- `MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build` — passed, with existing `<img>` warnings.
- `npx tsc --noEmit` — fails in unrelated existing test files under `app/admin/campaigns`, `components/admin`, and `lib/social-*`, `lib/jev-*`, and `lib/video-media-archive.test.ts`. No gallery file was named.
- In the integrated browser at the exact review route: 41/41 count; carousel next control and status update; search 1/41; no-match 0/41 and Clear filters recovery; coaching type 2/41; hybrid plus coaching 0/41; featured 7/41; self-paced preview disabled with reason; Website UX detail navigation and preserved $1,200 price; Add to Cart changed to Added to Cart in the local session.
- Existing carousel component tests cover keyboard and touch event handling. This final integration round inspected the desktop rendered surface; phone/tablet interaction and reduced-motion visual QA remain for Captain review.

## Visual evidence

- `final-gallery-walkthrough.mp4` is an 18-second playable sequence of screenshots captured from the exact commit-bound localhost route. It shows catalog, Julie public source and proposal states, blocked course preview, and empty state. It is a state walkthrough, not a continuous pointer recording.
- `final-gallery-01-catalog.png` through `final-gallery-05-empty-clear.png` are the source screenshots. `final-gallery-walkthrough.ffconcat` records their sequence and dwell times.
- Video encoding: H.264, 24 fps, `yuv420p`, fast start; `ffprobe` reports 18 seconds and 351165 bytes.

## Gate

Draft PR #1128 remains unmerged. Captain review, responsive visual QA, both Vercel contexts, and a qualifying Human-QA MP4 are pending before requesting Vambah's Human QA.
