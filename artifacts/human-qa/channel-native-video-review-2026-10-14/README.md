# Channel-native video review QA

Privacy-safe rendered evidence for the Social Content detail repair.

## Exact routes

- Jev motion v2: `/admin/social-content/f966123f-05eb-48ec-a7c2-970afce642ef?step=copy&qa_fixture=channel_native_video_v2`
- Dark Castle Chess: `/admin/social-content/21c492c2-9279-4e08-afc9-49207935a681?step=copy`

## Coverage

- Desktop: 1440 × 900
- Mobile: 390 × 844
- Both repository-bound MP4s and poster frames loaded.
- Title, description, full spoken script, source lineage, privacy boundaries, version-bound receipt status, and provider-none state were inspected.
- Source-lineage and receipt disclosures were expanded.
- Provider generation, upload, platform draft, scheduling, publishing, and external send actions remained disabled.
- The bound link for each item opened the canonical Decision Queue route.
- No production/shared row was changed. No provider call, upload, platform draft, schedule, publication, credential change, privacy-boundary change, external send, or migration occurred.

`channel-native-video-review.mp4` and the sibling PNGs document the original channel-native review-surface pass. Vambah rejected the Jev media shown in that recording because it remained a static image on a timeline.

The replacement Jev evidence belongs in `jev-motion-v2/`. Its MP4 must show the new 22-second vertical motion piece playing inside the exact deployed Social Content route, followed by the receipt and disabled-action boundary. Dark Castle remains bound to its previously approved packet and is outside this repair.

Reproduce with:

```bash
QA_BASE_URL=http://localhost:3000 \
PLAYWRIGHT_AUTH_STATE=/path/to/portfolio-admin-storage-state.json \
node scripts/qa/record-channel-native-video-review.mjs
```

Record the repaired Jev route with:

```bash
QA_BASE_URL=https://<exact-pr-preview> \
PLAYWRIGHT_AUTH_STATE=/path/to/portfolio-admin-storage-state.json \
node scripts/qa/record-jev-motion-video-review.mjs
```
