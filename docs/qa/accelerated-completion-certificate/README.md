# Accelerated completion certificate visual QA

Draft PR: #1220, branch `codex/accelerated-completion-workspace`.

Review fixture: `http://localhost:3100/member/dashboard?qa=completion-ready`. The `qa` route uses a fictional learner and does not create a database credential. Browser captures use the name **Amina Cole**.

## What changed

- The certificate title, learner name, and body use formal Roman serif type. The existing Cormorant Garamond project font is used in the page; title and name are embedded as rasterized text in the downloadable SVG so the export renders consistently in other applications. No script font or cursive body text is used.
- Four mirrored corners contain recognizable leaves, a five-petal flower, and stems inside a connected double-line frame. The lower corners are smaller to keep the issuer and signature area unobstructed. The same botanical SVG drawing is used by the page and download.
- The AmaduTown shield retains its portrait ratio. The lower-right line remains unsigned, with a typed owner/author attribution below it. No signature asset was added.
- Light and dark certificates use separate paper, ink, muted-text, and engraving colors.

## Evidence

- `certificate-botanical-walkthrough.mp4`: 32-second H.264 sequence assembled from browser captures. It shows blocked eligibility, unclaimed preview, a synthetic claim, light and dark desktop and 390px mobile layouts, and both exported SVG renders. This is a still-capture walkthrough rather than a live screen recording. `render-walkthrough.py` reproduces it from the PNGs here.
- `desktop-dark-blocked.png`, `desktop-light-preclaim.png`, `desktop-light-claimed.png`, `desktop-dark-claimed.png`, `mobile-light-claimed.png`, `mobile-dark-claimed.png`: browser captures from the local fixture.
- `downloaded-light-botanical.png`, `downloaded-dark-botanical.png`: actual downloaded SVGs rendered by macOS Sips, then visually inspected. Both XML files passed `xmllint --noout`. The SVGs contain embedded crest and title/name images; no external font or image request is needed to display them.

## Validation and boundaries

- `npx vitest run components/member/CompletionCredential.test.tsx`: 3/3 passed after the final frame adjustment.
- `git diff --check`: passed.
- `NODE_OPTIONS=--max-old-space-size=8192 npm run build`: passed before the final corner-scale and straight-rule styling adjustments. The default 4GB build hit Node's heap limit during page-data collection; the larger heap completed successfully. Focused Vitest and browser/export QA were repeated after those styling adjustments.
- The browser was inspected at 1280px desktop and 390px mobile in light and dark themes. The synthetic claim and both download actions were exercised. No authenticated customer data, production database, social composer, or external send was used.
- No approved public signature was found in the Portfolio repo or AmaduTown Drive materials. Unrelated personal signature documents were excluded. The certificate stays unsigned pending an approved signature asset.
- Human QA and captain integration remain pending. Production migrations remain subject to their separate authorization gate.
