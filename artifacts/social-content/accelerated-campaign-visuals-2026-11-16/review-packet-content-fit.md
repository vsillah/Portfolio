# Accelerated campaign content-fit review

Prepared: 2026-11-18
Status: Review only
Base: `origin/main` at `ee6530875`
Campaign: `b160eab6-1a5a-478d-954a-ca59a3a10e34`

## Change

The raster generator now measures the approved text in its rendered fonts. It wraps within each placement lane, gives each bordered plate 28px internal padding, and sets width and height from the resulting lines. Square, vertical, and wide compositions place the compact plate beside or below the full source image. The thumbnail's small label border now fits its measured text.

The original `review-assets/` package and `render-receipt.json` are retained. The corrected package is under `review-assets-content-fit/` with its own `render-receipt-content-fit.json`. The copied public product captures are reused without network access. No file under `public/campaigns/accelerated/2026-11/` was changed. The source manifest's SHA-256 was checked at intake; its local private Drive path is omitted from this public repository.

## Review artifacts

- Walkthrough: `review-assets-content-fit/accelerated-campaign-visual-review-walkthrough.mp4` — 1920×1080, 25 fps, 56 seconds, silent; SHA-256 `9d3579eade2be63eb5de7f5da274699ce3aca239aa3b77efa06aae713362765a`.
- Comparison stills: `comparison-square-plate.png`, `comparison-vertical-plate.png`, `comparison-wide-plate.png`.
- Target-size board: `review-mobile-390x844.png`; all 24 individual 390×844 compositions are in `mobile-390x844/`.
- Contact sheets: three square carousels, two vertical sequences, and the seven-frame wide sequence.
- Corrected raster set: 24 square slides, 9 vertical frames, 7 wide frames, and one 1280×720 thumbnail. The four review MP4s are visual animatics or walkthroughs only.
- New render receipt: `render-receipt-content-fit.json` — SHA-256 `b2d115c2ed0cf3f651fadfcabd2664c479408aebe3232d38b76f5643549d2ea6`; 79 output hashes and 11 verified source bindings.

## Checks

- `node --test artifacts/social-content/accelerated-campaign-visuals-2026-11-16/panel-layout.test.mjs` — 3 passed. These cover content-aware dimensions, exact approved title/body copy, frozen source hashes, original asset receipt hashes, and separate output paths.
- `npm run lint -- --file ...` for the three revised `.mjs` modules — no warnings or errors.
- `node --check` for the three revised `.mjs` modules — passed.
- All 79 new output hashes and all 64 target-size frame geometries matched the receipt. Source bindings matched the approved manifest and original receipt.
- FFmpeg decoded the 56-second walkthrough without errors. FFprobe reported 1920×1080, 25 fps, and 1,400 frames. The other three MP4s report 25 fps with expected durations.
- Visual inspection covered the six contact sheets, the three comparison stills, representative 390×844 slides, a full vertical frame, a full wide frame, the thumbnail, and the target-size board. No clipping, covered diagram geometry, covered face or control, or large empty plate interior was found.
- `git diff --exit-code origin/main -- public/campaigns/accelerated/2026-11` — passed. The original receipt remains at SHA-256 `1f2ac83fc5fd53e86249b92db3006c9f5a8c5ee576f38afc9e373abb1a8f5b8a`.

No TypeScript, web application, or deployment code changed, so app typecheck and build were outside this review package's validation scope. The captain still needs first-pass review and any client-facing Human QA before production use. Nothing here authorizes upload, scheduling, publishing, posting, provider calls, outreach, or spend.
