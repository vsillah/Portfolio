# Agentified L01–L16 presentation illustration audit

This package is a **review candidate** based on `f0931f3860e042507ee5aba83f220eb57cfd3eb5`. It leaves the learner media bindings and original composites untouched. The exact bound videos and approved plates are listed in `audit-boundaries.json`; each of the 128 scene positions has a boundary sample, midpoint sample, defect row in `defect-matrix.md`, and a new hashed 1920×1080 visual in `visual-receipts.json`.

The L01 00:37 repair uses an original project-local editorial illustration (`assets/l01-paper-source-table-v1.png`). The image prompt and source hash travel with the package. The other unbound visuals are project-local vector diagrams and paper artifacts. Existing approved publication plates are reused only at their bound scene positions. The local AmaduTown Drive and Accelerated media were consulted as visual references; no Drive asset or Accelerated media was copied into these composites.

## Rebuild and check

From the Portfolio root:

```bash
node agentified/workshop/presentation-illustration-audit/extract-boundary-frames.mjs
node agentified/workshop/presentation-illustration-audit/make-defect-matrix.mjs
node agentified/workshop/presentation-illustration-audit/render-l01-proposal.mjs
node agentified/workshop/presentation-illustration-audit/render-visuals.mjs
node agentified/workshop/presentation-illustration-audit/build-contact-sheets.mjs
node agentified/workshop/presentation-illustration-audit/render-composites.mjs
node agentified/workshop/presentation-illustration-audit/finalize-receipts.mjs
node agentified/workshop/presentation-illustration-audit/validate.mjs
node agentified/workshop/presentation-illustration-audit/validate-protected-windows.mjs
node agentified/workshop/presentation-illustration-audit/build-walkthroughs.mjs
```

The composite builder uses each exact learner-bound source as the protected media input. It copies the source audio and embedded subtitle streams, keeps the source duration and frame rate, and overlays the source video during the native presenter, guided countdown, and original closing-card windows. L05–L08 use the final continuous-narration receipts for those windows because their earlier native timelines precede the shortened learner-bound composites. The renderer replaces the instructional still sequence between protected windows. `validate.mjs` checks all 128 visual receipts, approved source hashes, durations, rates, and copied audio/subtitle stream hashes. `validate-protected-windows.mjs` compares a source and output frame inside each protected window. Review the MP4s themselves for actual presentation quality; the validators cannot certify pedagogy or visual taste.

The desktop and portrait MP4s under `walkthroughs/` provide a fast visual sweep of the review composites. The portrait clip pairs each full frame with a magnified artwork detail; it is a review treatment, not a separate learner video. The learner video remains 16:9 and is best inspected fullscreen in landscape at phone width.

For local playback with HTTP byte ranges and direct time seeking, run `node agentified/workshop/presentation-illustration-audit/serve-review.mjs`, then open `http://127.0.0.1:8738/review.html?lesson=l01&time=37`. The static page is a review surface; it does not change the learner route or media binding.

## Review boundary

The `composites/` outputs are unbound review artifacts. They are provider-free and incur no provider usage. They contain no customer or learner data and do not trigger publication, scheduling, or an external action. They require captain review and client-facing Human QA before any learner binding or release decision.
