# Deterministic visual binding QA

This packet exercises the Social Content visual-render binding without touching the live target row or calling a media provider.

## Scope

- Production target inspected read-only: `52a4baec-ad2d-415d-a6fa-4436dbfd6360`.
- Synthetic route: `/admin/social-content/deterministic-visual-binding-qa?step=visuals&qa=deterministic-visual-binding&qa_state=ready`.
- States covered: ready, current/idempotent, missing candidate, architecture-structure mismatch, and storage unavailable.
- Themes covered: persisted `System` resolved against a light OS preference, plus explicit `Dark`.
- Viewports covered in both themes: 390×844, 768×1000, and 1440×1000.
- Workflow order verified in the rendered DOM: choose format → configure and validate → render → review preview → approve or reject.
- The effective-input summary verifies selected and candidate visual type, headline, nodes, connectors, candidate hash, copy version, and renderer version. The deterministic path exposes no active image-prompt control.
- The runner records the rendered content-lane and usable inner widths, audits representative text contrast, and fails if light mode contains dark review-panel chrome or dark mode contains light review-panel chrome.
- Provider receipt: `provider=none`, `model=null`, `status=not_called`, `external_call=false`.
- Shared database writes, shared storage writes, platform drafts, scheduling, publishing, and external sends: zero.

The synthetic fixture is enabled only for development, test, or Vercel preview contexts and is explicitly disabled when `VERCEL_ENV=production`.

## Evidence

- `390-system-light-walkthrough.mp4`, `768-system-light-walkthrough.mp4`, and `1440-system-light-walkthrough.mp4` — inherited System (light) interaction and recovery states.
- `390-dark-walkthrough.mp4`, `768-dark-walkthrough.mp4`, and `1440-dark-walkthrough.mp4` — explicit Dark interaction and recovery states.
- `results.json` — persisted/resolved theme evidence, workflow order, deterministic image-prompt control count, content-lane widths, contrast ratios, review-surface luminance, request/state receipts, overflow result, page errors, and no-egress counters.
- `*-current-asset.png` — the stored review PNG inside the rendered Social Content surface.
- `*-architecture-mismatch.png` — fail-closed proof that an Architecture selection requires labeled nodes and explicit connectors.
- `*-missing-candidate.png` and `*-storage-blocked.png` — other fail-closed recovery states.

The publication asset itself contains only public-facing content and the AmaduTown Advisory Solutions brand footer. Provider, deterministic-render, internal-review, and Human-QA metadata remain in the review UI and receipt rather than the PNG.

All MP4 files are H.264 with `yuv420p` pixel format and fast-start metadata.

## Reproduce

```bash
./node_modules/.bin/tsx scripts/generate-deterministic-visual-qa-asset.ts
npm run build
SOCIAL_DETERMINISTIC_VISUAL_QA_FIXTURE=true MOCK_N8N=true N8N_DISABLE_OUTBOUND=true \
  ./node_modules/.bin/next start --hostname 127.0.0.1 --port 4033
QA_BASE_URL=http://127.0.0.1:4033 node scripts/qa/deterministic-visual-binding.cjs
```

The QA runner blocks external browser requests, permits only the synthetic render POST, asserts the five-step workflow order and zero active deterministic image-prompt controls, asserts zero unexpected mutations, and fails on theme-resolution drift, contrast failure, review-panel theme leakage, horizontal overflow, or browser page errors.
