# Final service gallery integration QA — 2026-10-23

## Binding

- Code commit: `3277ca5f` on `codex/service-showcase-audit`.
- Exact local review: `http://127.0.0.1:3212/services?rev=3277ca5f`.
- The GET-only QA proxy serves the captured 41-service public catalog to the branch at port 3211. It does not write provider or production data.
- All 41 active catalog IDs resolve to two distinct local frames. Each binding checks the current listing image URL. Unmatched sources fall back to the current listing image.
- The three prior calibration pairs are unchanged. The other 38 pairs are the Captain-approved review frames.
- Superseded by the correction below: Julie's first frame now shows the local KinFlo-built page, labeled `Example: Julie's Family Learning` and `built example`; its second remains an `illustrative proposal`. The self-paced course poster remains separate from playable video.

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

### Continuous browser capture correction

- The screenshot-state walkthrough above is superseded as Human-QA evidence. Three new MP4s capture successive frames from the live integrated browser while the actual controls are operated. They contain no unrelated browser content or private data.
- `final-gallery-live-desktop-70e8a170.mp4` records the `rev=70e8a170` catalog load, carousel next and provenance change, Website UX search, Featured filter, no-match state, Clear filters, and the disabled course preview with its reason.
- `final-gallery-live-tablet-70e8a170.mp4` records the same integrated route at 768×1024, with carousel and search. `final-gallery-live-phone-70e8a170.mp4` records the route at 390×844, with card actions, carousel, search, and blocked course preview.
- Still evidence: `final-gallery-tablet-70e8a170.jpg`, `final-gallery-phone-top-70e8a170.jpg`, and `final-gallery-phone-card-70e8a170.jpg`. The phone card's price, detail link, Add to Cart action, image controls and status label were all legible. The tablet's two-column cards and actions were legible. Neither viewport had horizontal document overflow (`scrollWidth <= innerWidth`). No clipping or button collision was observed.
- The phone swipe gesture did not advance in the desktop-controlled browser, so touch handling is supported by the existing component test rather than a physical touch-device observation. The visible arrow controls worked.
- All three new H.264 MP4s decoded end to end with FFmpeg: desktop 1270×714, 155 frames, 11.92 seconds; tablet 758×1012, 61 frames, 4.69 seconds; phone 380×822, 103 frames, 7.63 seconds. The viewport overrides were 768×1024 and 390×844; browser chrome and scrollbar account for capture dimensions. The main desktop clip is continuous live frame capture, not a slideshow of selected states.
- Focused gallery tests were rerun after the captures (10 passed), and `MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build` passed again. No product code changed during this correction.

## Gate

Draft PR #1128 remains unmerged. Captain review of the new live captures and latest Vercel previews remains pending before requesting Vambah's Human QA.

## KinFlo source and hero correction

- The first Website UX Refresh frame now uses `public/showcases/service-digital-review/website-ux-refresh-kinflo-built-example-r1.jpg`, captured from the rendered KinFlo fixture at `http://127.0.0.1:5320/kinflo-sites/julies-family?source=portfolio-service-showcase`. The page heading is “Learning support that meets families where they are.” The screenshot was cropped by 70 pixels at the top to exclude the local admin preview controls. SHA-256: `a199fe1597b3bc6589fc217ed6b897757b660599ce4ce45150de5a8c8d85e5fe`.
- Source repository: `/Users/vambahsillah/Documents/KinFlo CRM`, branch `codex/kinflo-admin-foundation`, source HEAD `d0d2484d72df76a72207d393b0eefdcda148c362`. The source checkout was dirty at capture, including `client/src/lib/kinfloPublicSitePreview.ts` and `client/src/pages/KinfloPublicSitePreview.tsx`, so the frame is evidence of this local build state, not a clean commit or public deployment. No KinFlo file was edited for this correction.
- `Speaking Engagement` now uses a service-specific stage illustration, and `Group AI Coaching` uses a question-and-peer-review work-product view. The Vambah roundtable image remains with the self-paced AI course calibration. A gallery regression test checks unique hero assignments and rendered file hashes, and prevents the learning renderer from assigning its photo hero again.
- The second Website UX frame now uses the same KinFlo-built local capture as its inset and labels the right-side recommendations as an illustrative proposal. The legacy public screenshot remains only in archived review material and is not bound to either gallery frame.
- The proposal frame uses a new `r2` asset URL so Next.js image optimization cannot serve the earlier cached legacy screenshot at the old `r1` URL.
- Final local review route: `http://127.0.0.1:3212/services?rev=bd51e5f5`, backed by the safe GET-only 41-service fixture proxy and the `bd51e5f5` code commit. Searching `Julie` returned exactly one result. The first carousel frame showed the KinFlo heading and example label; the second showed the KinFlo inset and illustrative proposal. Desktop and 390×844 phone views were inspected.
- Privacy-safe walkthroughs: `kinflo-julie-live-desktop-bd51e5f5.mp4` and `kinflo-julie-live-phone-bd51e5f5.mp4`. They were captured frame by frame from the live integrated browser at the commit-bound route, encoded H.264/yuv420p/fast-start, and decoded end to end with FFmpeg. `kinflo-julie-example-bd51e5f5.jpg` and `kinflo-julie-proposal-bd51e5f5.jpg` show the exact reviewed states. The local fixture contains no contact submissions, private records, or credentials.
