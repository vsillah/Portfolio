# Trend-to-work relevance QA

This packet validates the existing `/admin/social-content?workflow=evidence` surface with synthetic, privacy-safe receipts. It is local preview evidence only; it does not prove production data, deployment, publishing, provider activation, or platform draft creation.

Acceptance fixtures:

- Jev: approved public momentum + approved Jev capability analysis + approved Portfolio product evidence.
- Dark Castle Chess: approved public momentum + canonical Portfolio product identity + privacy-safe GitHub development receipt.

Run:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://qa.invalid \
NEXT_PUBLIC_SUPABASE_ANON_KEY=qa-anon-key \
MOCK_N8N=true \
N8N_DISABLE_OUTBOUND=true \
npm run dev -- --hostname 127.0.0.1 --port 4042

node scripts/qa/social-trend-work-relevance.cjs
```

Evidence:

- `results.json` records desktop, tablet, and mobile viewport checks.
- `*-trend-work-relevance-panel.png` isolates the reviewed panel.
- `*-trend-work-relevance.png` preserves the full route context.
- `*-walkthrough.mp4` is the playable capture for each viewport.

The harness intercepts all API reads with fixtures and fails if the page makes an API mutation, external request, emits a page error, or overflows horizontally.
