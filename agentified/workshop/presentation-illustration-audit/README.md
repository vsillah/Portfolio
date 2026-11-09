# Agentified L01–L16 presentation illustration audit

This package is a **review candidate** based on `f0931f3860e042507ee5aba83f220eb57cfd3eb5`. It leaves the learner media bindings and original composites untouched. The exact bound videos and approved plates are listed in `audit-boundaries.json`; each of the 128 scene positions has a boundary sample, midpoint sample, defect row in `defect-matrix.md`, and a new hashed 1920×1080 visual in `visual-receipts.json`.

The L01 00:37 repair uses an original project-local editorial illustration (`assets/l01-paper-source-table-v1.png`). The other 15 lessons use original project-local master illustrations under `assets/lesson-masters/`. The 128 manually authored scene briefs in `semantic-briefs.mjs` and their compiled receipt in `semantic-briefs.json` bind each scene to a one-second read, a concrete visual artifact, a text budget, accessibility copy, and an intended treatment. Repeated views of each lesson's physical work surface have an explicit continuity reason. Existing approved publication plates are cropped and enlarged only at their exact bound scene positions. The local AmaduTown Drive and Accelerated media were consulted as visual references; no Drive asset or Accelerated media was copied into these composites.

`crop-safety.json` records a scene-specific focus, edge risk, and four masked insets for every one of the 19 approved-plate crops. The renderer feathers those crop edges into the existing dark canvas and places each scene label in an opaque, content-sized box. This keeps neighboring plate glyphs, banners, and borders out of the instructional frame while preserving each approved source crop and its semantic copy. For a crop-only repair, run `render-semantic-visuals.mjs --plate-only`; it rebuilds those 19 frames and leaves the other 109 frame files untouched. `validate.mjs --frames-only` fails if an approved plate lacks a safety receipt, its source/crop/brief changes, the mask metadata drifts, or sampled masked edges expose source pixels. The full-size visual review is still required because edge samples cannot recognize every glyph or composition defect.

## Rebuild and check

From the Portfolio root:

```bash
node agentified/workshop/presentation-illustration-audit/extract-boundary-frames.mjs
node agentified/workshop/presentation-illustration-audit/make-defect-matrix.mjs
node agentified/workshop/presentation-illustration-audit/render-l01-proposal.mjs
node agentified/workshop/presentation-illustration-audit/compile-semantic-briefs.mjs
node agentified/workshop/presentation-illustration-audit/render-semantic-visuals.mjs
node agentified/workshop/presentation-illustration-audit/build-contact-sheets.mjs
node agentified/workshop/presentation-illustration-audit/render-composites.mjs
node agentified/workshop/presentation-illustration-audit/finalize-receipts.mjs
node agentified/workshop/presentation-illustration-audit/validate.mjs
node agentified/workshop/presentation-illustration-audit/validate-protected-windows.mjs
node agentified/workshop/presentation-illustration-audit/build-walkthroughs.mjs
```

The composite builder uses each exact learner-bound source as the protected media input. It copies the source audio and embedded subtitle streams, keeps the source duration and frame rate, and overlays the source video during the native presenter, guided countdown, and original closing-card windows. L05–L08 use the final continuous-narration receipts for those windows because their earlier native timelines precede the shortened learner-bound composites. The renderer replaces the instructional still sequence between protected windows. `validate.mjs` checks all 128 scene briefs and visual receipts, copy and source bindings, approved-plate display size, durations, rates, and copied audio/subtitle stream hashes. `validate-protected-windows.mjs` compares a source and output frame inside each protected window. Review the MP4s themselves for actual presentation quality; the validators cannot certify pedagogy or visual taste.

The desktop and portrait MP4s under `walkthroughs/` provide a fast visual sweep of the review composites. The portrait clip pairs each full frame with a magnified artwork detail; it is a review treatment, not a separate learner video. The learner video remains 16:9 and is best inspected fullscreen in landscape at phone width.

For local playback with HTTP byte ranges and direct time seeking, run `node agentified/workshop/presentation-illustration-audit/serve-review.mjs`, then open `http://127.0.0.1:8738/review.html?lesson=l01&time=37`. The static page is a review surface; it does not change the learner route or media binding.

## Review boundary

The `composites/` outputs are unbound review artifacts. They are provider-free and incur no provider usage. They contain no customer or learner data and do not trigger publication, scheduling, or an external action. They require captain review and client-facing Human QA before any learner binding or release decision.
