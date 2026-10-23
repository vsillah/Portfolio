# Service catalog evidence audit — 2026-10-23

The [public API snapshot](services-catalog-2026-10-23.json) records all 41 active services returned by `https://amadutown.com/api/services?active=true` on 2026-10-23. It preserves stable ID, title, type, delivery, price, active and featured state, and the four media fields. The standalone `/services` route uses this API. This is a public catalog snapshot, not a database change or a claim that every listed service is currently deliverable.

## Gallery disposition

| State | Count | Treatment |
|---|---:|---|
| Two distinct reviewed concept frames | 6 | Existing exact-ID, exact-image-URL bound hero and workflow/outcome/poster frames in `lib/showcase-preview.ts`; every concept is labeled. |
| One current listing image | 4 | Existing repo image in the shared gallery frame; a visible evidence gap asks for a separate reviewed service-in-action or deliverable image. |
| No defensible public image | 31 | A text evidence gap and details action. No duplicate, crop, generic stock visual, or fabricated result. |

The 41 records include seven featured services. Only one has a `video_url` (Product Innovation Workshop) and one has a `presentation_url` (Accelerated Cohort Workshop). The AI Training Course — Self-Paced has an illustrative poster and no playable video; its preview action stays disabled until script review, render approval, playable file validation, and binding. Three records have `price: null`; the card requests a quote instead of displaying “Free” or adding an unpriced item to cart.

## Source map and recovery

| Service | Current public source | Use and limit |
|---|---|---|
| AI Customer Support Chatbot | `/Users/vambahsillah/Projects/Portfolio/public/Chatbot_app_img.png` | Existing listing image; current workflow and client outcome remain unverified. |
| AI Voice Agent — Inbound | `/Users/vambahsillah/Projects/Portfolio/public/VF_Chatbot_img.png` | Existing listing image; current voice flow remains unverified. |
| Mobile App Generation | `/Users/vambahsillah/Projects/Portfolio/public/ReversR_app.png` | Existing listing image; no claim of current app release or customer result. |
| Product Innovation Workshop | `/Users/vambahsillah/Projects/Portfolio/public/ATAS_Innovation_Workshop.png`; public catalog `https://youtu.be/ZVzodPVxupc` | Existing image plus a separate video link. No extracted video still or invented second gallery frame. |
| AI Inbound Lead Chatbot, Lead Generation Workflow Agent, Website UX Refresh, Accelerated Cohort Workshop, AI Training Course — Self-Paced, Premium AI Masterclass | `/Users/vambahsillah/Projects/Portfolio/public/showcases/service-*-concept.svg` and matching `/showcases/gallery-*.svg`; detailed provenance in `docs/showcase-audit/public-offerings-2026-10-22.json` | Six already-reviewed illustrative gallery pairs, bound to exact service IDs and null image fields. They depict possible workflows or course structure, not shipped usage or measured outcomes. |
| Accelerated Cohort Workshop | Public catalog `https://gamma.app/embed/29rmk9hbuod9qmk` | Link to the listed presentation. Its content and currency need owner review. |

Search covered `/Users/vambahsillah/Projects/Portfolio` (`docs`, `public`, `design-files`, and `n8n-exports`) and `/Users/vambahsillah/Library/CloudStorage/GoogleDrive-vsillah@gmail.com/My Drive/2. AmaduTown Advisory Solutions/`, including `Artifacts /Company Materials/`. The Drive company materials include pitch decks and a strategy image, but no inspected, rights-cleared, service-specific image that warrants another public frame. Client project materials were not promoted into public service proof. Keep the original source paths above; no Drive file was copied into this branch.

For the 31 image gaps, collect an owner-approved public image, workflow capture, deliverable sample, or playable media per service. Review rights, privacy, offer accuracy, and distinction from the current frame through `/admin/content/visual-assets` before adding it to the gallery. Do not turn a workshop deck, client record, or conceptual prototype into a testimonial or outcome claim.

## Local review evidence

The local review used a GET-only proxy at `127.0.0.1:3212` to serve this public catalog snapshot to the branch build at `127.0.0.1:3211`. It changed no production record. The Codex browser rendered 41 cards. Captures at 390, 768, and 1280 px are in `qa/services/`; `qa/services/all-cards/` contains one complete card capture for every active service. The 63.8-second `qa/services/service-gallery-walkthrough.mp4` is an encoded sequence of these browser captures. It shows all 41 cards, both frames of the six galleries, the disabled course preview, a missing-evidence state, and empty search. It is a captured-state walkthrough, not continuous interaction footage.

Observed interactions: search narrowed to one card, an unmatched search showed zero of 41 and a working Clear filters action, Featured showed seven of 41, Training showed six of 41, and Training plus Hybrid showed one of 41. Carousel next controls changed image, role, and count. An Add to Cart click initially exposed a React runtime error from duplicate button-text mutation; that code was removed and the retest showed `Added!` without an error. A quote request navigated to the contact route with the service ID. A card details link opened the local detail page; the null-price Accelerated Cohort detail showed “Price on request” and Request Quote (capture: `qa/services/cohort-detail-quote.png`). The public workshop video URL returned HTTP 200; the Gamma presentation loaded in the Codex browser even though a command-line HEAD request received 403.

Validation: six focused Vitest files, 17 tests passed; focused ESLint passed; `npm run build` passed. Standalone `npx tsc --noEmit` still reports unrelated existing test typing errors. No production deployment or customer-data smoke was run.
