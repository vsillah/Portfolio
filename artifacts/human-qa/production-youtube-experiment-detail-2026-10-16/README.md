# Persisted YouTube experiment detail — Human QA evidence

This packet exercises the three authorized production `social_content_queue` rows through the production-equivalent localhost build at app commit `da78d3f0`.

## Exact routes

- `http://127.0.0.1:3107/admin/social-content/1f3cec8c-afcb-4551-90fa-b8d4f9dabe2f?step=copy&rev=da78d3f0`
- `http://127.0.0.1:3107/admin/social-content/e06ab168-56aa-45f5-9672-619215df3ce7?step=copy&rev=da78d3f0`
- `http://127.0.0.1:3107/admin/social-content/2d96e662-5e7e-4761-8a87-85128e20a559?step=copy&rev=da78d3f0`

No route includes `qa_fixture`.

## Production-equivalent data path

The ordinary localhost app is authenticated against the development Supabase project, while these three rows exist only in production. For this bounded QA run, `serve-production-youtube-experiment-proxy.mjs` sits on port 3107 in front of the app on port 3109. It reads only the three exact production UUIDs, returns their persisted row shapes to the unmodified detail URL, and rejects mutation methods. All other application requests are forwarded to the committed localhost build.

The application API projection and direct-write rejection are separately covered by `production-channel-experiment.route.test.ts` for all three UUIDs.

## Reviewed behavior

- Desktop: 1440 × 900
- Mobile: 390 × 844
- Three persisted YouTube rows at both widths (six route/viewport checks)
- Specialized YouTube title, description, hypothesis, opening hook, outline, thumbnail brief, evidence lineage, product-proof requirements, score inputs, and execution boundaries
- `Review only` and `Unscored` states
- No LinkedIn preview guidance
- No Save Draft, Approve Copy, or Reject action
- No `qa_fixture` query parameter

## Safety receipt

- Production Social Content reads: three authorized UUIDs only
- Production writes: 0
- Provider calls: 0
- Rendering or upload actions: 0
- Platform draft, schedule, publish, or external send actions: 0
- Unexpected browser egress: 0

See `qa-receipt.json` for the exact routes, screenshots, assertions, media probe, and MP4 checksum.
