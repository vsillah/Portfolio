# Service catalog evidence audit — 2026-10-23

The [public API snapshot](services-catalog-2026-10-23.json) records 41 active services returned by `https://amadutown.com/api/services?active=true` on 2026-10-23. It preserves each stable ID, title, type, delivery method, price, featured state, and media fields. This is a public catalog snapshot, not a database change or proof that every listed service is currently deliverable.

## Current visual disposition

Human QA rejected the 41-service raster-v3 concepts as off-brand and too generic. Their assets, renderer, manifest entries, contact sheets, and video were removed from this PR. The active gallery is limited to three **unapproved calibration pairs** built from the [AmaduTown service visual system](amadutown-service-visual-system.md): Monthly Advisory Retainer within Management Consulting, AI Inbound Lead Chatbot, and AI Training Course — Self-Paced. Each pair has a distinct offer cover and a finished-looking illustrative deliverable. The six WebPs and a contact sheet are generated locally by `scripts/showcase/render-service-calibration.cjs` with no provider. `lib/service-concept-gallery.json` binds each pair to the exact catalog ID and current image URL.

The other 38 services do not inherit rejected concepts. Four retain their existing public listing image as a single source frame; the remaining 34 show the explicit missing-visual state. All service cards and detail pages retain carousel support, but no broad visual rollout is authorized. The older SVG studies remain in `public/showcases/` for provenance and are not used by the service gallery.

The 41 records include seven featured services. Only Product Innovation Workshop has a `video_url`, and Accelerated Cohort Workshop has a `presentation_url`. The AI Training Course — Self-Paced has no playable video; its preview action remains disabled until script review, render approval, playable file validation, and binding. Three records have `price: null`; their cards request a quote rather than displaying “Free” or adding an unpriced item to cart.

## Source map and limits

| Service or source | Public source | Limit |
|---|---|---|
| AI Customer Support Chatbot | `/Users/vambahsillah/Projects/Portfolio/public/Chatbot_app_img.png` | Existing listing image. It does not prove the separate inbound lead chatbot is live. |
| AI Voice Agent — Inbound | `/Users/vambahsillah/Projects/Portfolio/public/VF_Chatbot_img.png` | Existing listing image; voice flow remains unverified. |
| Mobile App Generation | `/Users/vambahsillah/Projects/Portfolio/public/ReversR_app.png` | Existing listing image; no claim of current release or client outcome. |
| Product Innovation Workshop | `/Users/vambahsillah/Projects/Portfolio/public/ATAS_Innovation_Workshop.png`; catalog `https://youtu.be/ZVzodPVxupc` | Existing image and separate public video link; no extracted video still or new gallery frame. |
| Accelerated Cohort Workshop | Catalog `https://gamma.app/embed/29rmk9hbuod9qmk` | Presentation link only; content and currency require owner review. |
| Calibration image source | `public/prototypes/portfolio-pipeline-hero/amadutown-storefront-pipeline-hero-approved-20260617.png` | Previously approved AmaduTown storefront composition, used only on the inbound lead cover. No client data or outcome claim. |

The source audit covered the Portfolio `docs`, `public`, and `design-files` trees and the AmaduTown Google Drive root, including `Artifacts /Company Materials/`. Its findings and exact paths are in the visual-system document. No client-project image, old pitch-deck statistic, private chat, or generated-image provider output was promoted into the calibration frames.

Process exception from the earlier visual pass: eight image-generation calls were made despite the no-provider instruction. The outputs stayed outside the repository, and none was used in a committed frame. The tool reported no charge or metered amount, so cost is unknown. No image-generation or other provider calls were made for the calibration.

## Validation and review boundary

The calibration is a visual and copy gate. Its [contact sheet](qa/services/service-calibration-contact-sheet.png) shows all six frames. The [privacy-safe MP4](qa/services/service-calibration-walkthrough.mp4) shows six captured states from the live local catalog at a 390px phone viewport: the three offer covers and their corresponding deliverables, with search, gallery controls, price or quote state, and the disabled course preview in context. The video was decoded successfully with FFmpeg; it is a captured-state walkthrough, not a continuous interaction recording. The three pairs may expand to other services only after Captain review and Human QA pass. Until then, the PR stays draft and the visuals remain unaccepted.

The local catalog loaded 41 fixture services through the no-outbound QA proxy. Search narrowed each calibration to one of 41; carousel controls advanced all three pairs; the three detail routes loaded the matching hero and course detail advanced to its second frame. The advisory card was visually inspected at 390px, 768px, and 1280px. The lead and course cards were visually inspected at 390px, including the disabled course preview reason. `npx vitest run lib/service-gallery.test.ts`, `node --check scripts/showcase/render-service-calibration.cjs`, `git diff --check`, and `MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build` passed. The local route will be reloaded with the final commit-bound query for handoff. No production deployment or customer-data smoke is claimed here.
