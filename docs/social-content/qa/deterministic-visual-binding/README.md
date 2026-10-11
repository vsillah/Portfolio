# Deterministic visual binding QA

This packet exercises the Social Content visual-render binding without touching the live target row or calling a media provider.

## Scope

- Production target inspected read-only: `52a4baec-ad2d-415d-a6fa-4436dbfd6360`.
- Synthetic route: `/admin/social-content/deterministic-visual-binding-qa?step=visuals&qa=deterministic-visual-binding&qa_state=ready`.
- States covered: ready, current/idempotent, missing candidate, and storage unavailable.
- Viewports covered: 390×844, 768×1000, and 1440×1000.
- Provider receipt: `provider=none`, `model=null`, `status=not_called`, `external_call=false`.
- Shared database writes, shared storage writes, platform drafts, scheduling, publishing, and external sends: zero.

The synthetic fixture is enabled only for development, test, or Vercel preview contexts and is explicitly disabled when `VERCEL_ENV=production`.

## Evidence

- `390-walkthrough.mp4` — narrow mobile interaction and recovery states.
- `768-walkthrough.mp4` — tablet interaction and recovery states.
- `1440-walkthrough.mp4` — desktop interaction and recovery states.
- `results.json` — request/state receipts, overflow result, page errors, and no-egress counters.
- `*-current-asset.png` — the stored review PNG inside the rendered Social Content surface.
- `*-missing-candidate.png` and `*-storage-blocked.png` — fail-closed recovery states.

All MP4 files are H.264 with `yuv420p` pixel format and fast-start metadata.

## Reproduce

```bash
./node_modules/.bin/tsx scripts/generate-deterministic-visual-qa-asset.ts
npm run build
SOCIAL_DETERMINISTIC_VISUAL_QA_FIXTURE=true MOCK_N8N=true N8N_DISABLE_OUTBOUND=true \
  ./node_modules/.bin/next start --hostname 127.0.0.1 --port 4033
QA_BASE_URL=http://127.0.0.1:4033 node scripts/qa/deterministic-visual-binding.cjs
```

The QA runner blocks external browser requests, permits only the synthetic render POST, asserts zero unexpected mutations, and fails on horizontal overflow or browser page errors.
