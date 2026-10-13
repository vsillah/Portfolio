# Mobile Content Validation Inbox QA

This packet validates the review-only decision inbox added to the existing Social Content Launch Evidence surface.

## Route

`/admin/social-content?candidateQa=durable-candidates&workflow=evidence`

The route uses the repository's synthetic, preview-only candidate fixture. It reads no production content and exposes no candidate approval, generation, provider, render, upload, scheduling, publishing, posting, Slack, or external-send action.

## Coverage

- 1440 × 900, light theme
- 768 × 900, system theme resolving dark
- 390 × 844, dark theme
- compact Candidates, Run history, and Blockers tabs with hash deep links and browser back/forward continuity
- candidate search, reset, and four-record pagination across five synthetic exact-lineage candidates
- actionable Collectors, Receipts, Products, and Priority gaps metrics that activate the relevant tab
- keyboard-focusable tabs and metric links with clear active, hover, focus, and theme states
- exact receipt-lineage drill-down and attributable source links
- candidate freshness and explicit review-only state
- twice-weekly review-history framing over persisted source scan timestamps
- candidate-policy blocker and Source Protocol recovery deep link
- disabled Slack integration specification
- horizontal-overflow, page-error, and API-mutation checks

## Evidence

- `mobile-content-validation-inbox-walkthrough.mp4` — playable H.264 MP4 walkthrough of candidate paging/search, metric navigation, tab switching, and blocker recovery across the three responsive scenarios
- `1440-light-decision-inbox.png`
- `768-system-decision-inbox.png`
- `390-dark-decision-inbox.png`
- `results.json` — route, viewport, mutation, Slack, and pass/fail record

Run locally or against a preview deployment:

```bash
QA_BASE_URL=http://127.0.0.1:4038 node scripts/qa/mobile-content-validation-inbox.cjs
QA_BASE_URL=https://preview.example node scripts/qa/mobile-content-validation-inbox.cjs
```

The run is read-only and records `external_writes: 0` and `api_mutations: 0` when it passes.
