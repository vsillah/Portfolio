# Premium service splash review — 2026-10-23

## Scope

Five new two-frame concepts replace prototype-style pairs for AI Inbound Lead Chatbot, Lead Generation Workflow Agent, Accelerated Cohort Workshop, Premium AI Masterclass, and AI Training Course — Self-Paced. Website UX Refresh keeps its approved KinFlo/JFLP built-example and illustrative proposal frames unchanged. The gallery still binds 41 active services by exact ID and current listing-image URL.

## Source and production boundary

- `scripts/showcase/render-premium-service-splashes.cjs` renders all ten new frames locally with Playwright and Sharp. It makes no media-provider or customer-data call.
- The chatbot receptionist and course presenter are existing reviewed local illustration sources in `public/showcases/service-calibration/sources/`. The lead hero uses `public/prototypes/portfolio-pipeline-hero/amadutown-storefront-pipeline-hero-approved-20260617.png`. The cohort and masterclass visuals are local HTML/CSS compositions.
- The self-paced course uses the source-grounded title *Accelerated: Building Smarter Products with AI* and proposed module labels from `docs/accelerated-course-modules/`. The player, progress, and workbook are illustrative. No playable video is bound.
- AmaduTown Drive company and lead-generation material was searched for offer context. Targeted Claude/local-project-history searches found no suitable product-specific source. No private client content or old deck statistic was placed in a public frame.
- `service-premium-splash-contact-sheet-r1.png` shows all ten frames. Each full-size frame is under `public/showcases/service-premium-review/`.

## Browser review

The GET-only catalog fixture at port 3212 supplies the 41 active service records to this branch at port 3211. Search returned one matching card for each target service. Both carousel states were clicked and inspected at desktop and 390×844 phone widths. Primary image crop, service title, price or quote action, image controls, and provenance status remained visible. The self-paced course preview remained disabled with its reason. The approved Julie/KinFlo pair was not changed.

- Code commit: `bf82a90b`; exact browser route: `http://127.0.0.1:3212/services?rev=bf82a90b-v4`. The safe local server was restarted after the production build; its generated `.next` output was moved aside when a stale module cache caused a localhost error.
- `premium-splash-live-desktop-bf82a90b.mp4` and `premium-splash-live-phone-bf82a90b.mp4` capture the five service pairs plus the preserved Julie pair from the live integrated browser. Both are H.264/yuv420p, 8 seconds, 48 frames, and decoded end to end with FFmpeg.
- `premium-course-card-desktop-bf82a90b.jpg` and `premium-course-player-phone-bf82a90b.jpg` are stills from the exact route. The course title, lesson poster, module path, illustrative progress, workbook and output are visible; the preview action remains disabled.
- `npx vitest run lib/service-gallery.test.ts components/ShowcaseCarousel.test.tsx components/Services.showcase.test.tsx components/CatalogCard.test.tsx` — 11 passed. `MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build` — passed with existing image warnings.

## Gate

The ten new frames are illustrative concepts for Captain review. PR #1128 remains draft and unmerged. Captain must inspect the latest commit-bound localhost route and both Vercel preview checks before any Human QA request. No production mutation, provider activation, publishing, outreach, upload, scheduling, or spending is part of this review.
