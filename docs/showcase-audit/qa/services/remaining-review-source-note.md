# Remaining service concept review

Date: 2026-10-23. These are **review-only** batches. The three approved calibration pairs remain the only active gallery assets in PR #1128. The seven digital and thirteen learning pairs also remain preview-only.

## Catalog coverage

The active service catalog at `docs/showcase-audit/services-catalog-2026-10-23.json` has 41 titles. The approved three, digital seven, and learning thirteen cover 23. These batches cover the remaining 18 exact active titles:

- Continuity/support: Implementation Warranty; Enterprise SLA; Priority Support Channel; Pre-Built Chatbot Template — Self-Install; Community Forum Access; 30-Day Email Support; 60-Day Email Support.
- Engagement/communications: AI Customer Support Chatbot; AI Voice Agent — Inbound; Lead Generation Workflow Agent; Social Media Content Agent; Client Onboarding Automation; Inbound Lead Tracking System; Website Development; AI Email Sequence Builder; Lead Tracking Templates; Content Automation Templates; AI Email Sequence Templates.

Website Development was held outside the earlier digital batch and is included here so all active titles have a review pair. The existing active AI Inbound Lead Chatbot calibration is a separate service from the unreviewed AI Customer Support Chatbot.

## Source and claim boundary

- Offer names and active status: `docs/showcase-audit/services-catalog-2026-10-23.json`.
- Scope cues: `docs/pricing-model.md` and `lib/pricing-model.ts`; labels and visuals do not promise a specific live implementation or contracted response time.
- Visual system: `docs/showcase-audit/amadutown-service-visual-system.md`, `public/amadutown-logo-upscaled.png`, and local Inter font.
- Frames, examples, messages, times, queues, and records were rendered locally by `scripts/showcase/render-remaining-review.cjs`. They are synthetic. No image/media provider, customer data, live call, email send, post, calendar, production system, or private source was used.

The continuity frames distinguish a warranty coverage record, severity and clock rules, a priority support thread, an installation test kit, forum moderation, a 30-day answer ledger, and a 60-day adoption follow-through. The engagement frames distinguish answer escalation, inbound call routing, lead qualification, editorial review, onboarding readiness, lead queue, website acceptance, email sequence design, and three different template kits. All proposed deliverables remain illustrative until scoped with a buyer.

## Review gate

Inspect each full-size 1200×720 frame and both contact sheets, then exercise `review.html` for each family at desktop, tablet, and phone widths. `scripts/showcase/verify-remaining-review.cjs` checks exact-title coverage against the 41 active catalog rows, all 36 distinct frames, gallery inactivity, responsive review controls, and sheet geometry. Captain review must pass before any pair is considered for active gallery binding. PR #1128 remains draft and unmerged.
