# Digital service concept review

Date: 2026-10-23. This is a **review batch**, not a service-gallery change. The approved three-pair gallery at `e8d17852` remains active in PR #1128.

The requested list names seven distinct catalog titles when Custom Reporting and Shared Analytics are counted separately. Website Development is outside this review batch.

## Source and status

- Exact active titles and IDs: `docs/showcase-audit/services-catalog-2026-10-23.json`.
- Offer scope and constraints: `docs/pricing-model.md`, `lib/pricing-model.ts`, and the existing AmaduTown visual system in `docs/showcase-audit/amadutown-service-visual-system.md`.
- Brand: `public/amadutown-logo-upscaled.png`, local Inter font, and the navy/gold palette already documented in the visual system.
- All seven pairs were rendered locally by `scripts/showcase/render-digital-review.cjs`. No image provider, customer record, integration, or analytics source was contacted. The Website UX Refresh pair uses a screenshot of the public Julie's homepage captured on 2026-10-23. The other six pairs are illustrative and synthetic.

### Website UX Refresh evidence and boundary

- Public current-state URL: `https://www.juliesfamily.org/`. The screenshot in `public/showcases/service-digital-review/julies-public-home-evidence.webp` captures only the public header, mission statement, and donation notice. The crop excludes the page's people, testimonials, and contact details. The screenshot was taken in the integrated Codex browser and is stored only in this local preview package.
- Observed at capture: the header offered **Donate Now** while the page stated its donation form was being updated; **Register** linked to a Google Form; **Menu Cart** was visible in the main navigation. Those observations support the review notes. They do not establish conversion performance or accessibility outcomes.
- Public reference inspected: `https://cwaybright.wixstudio.com/julies/`. It appears to be a newer public Wix surface with learner and supporter paths. Its relationship to the live domain or launch status was not established; its photos and participant stories were not copied into this batch.
- Local project material inspected: `/Users/vambahsillah/Library/CloudStorage/GoogleDrive-vsillah@gmail.com/My Drive/2. AmaduTown Advisory Solutions/Client Projects /Julie's Family Learning Program/Assets/Website Priorities (1).docx` (2025-10-23). It informed the focus on learner paths, donation clarity, and easier navigation. The private source is not quoted in the public-facing frames.
- The AmaduTown refinement panel is a proposal for review only. It is not presented as a shipped Julie's page, a client-approved deliverable, or a measured outcome.

The frames are deliberately service-specific: Julie's public-site assessment, phone flow, attributed answer workspace, reconciliation board, event trace, metric drill-down, and a distinct team scorecard. Apart from the labeled public-site screenshot, they do not claim a live app, verified result, production dashboard, or completed migration.

## Review gate

Inspect each full-size pair at `public/showcases/service-digital-review/review.html` or the individual WebPs, then the contact sheet. Check readability and clipping at desktop, tablet, and phone widths. Captain review must pass before these frames are bound into `lib/service-concept-gallery.json`; PR #1128 remains draft and unmerged.
