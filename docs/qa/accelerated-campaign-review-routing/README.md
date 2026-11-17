# Accelerated campaign review routing QA

This package records the four November 18–20 Accelerated campaign drafts on the exact local Social Content routes at `e800c0d7668d77101bcf15d062410e3499ef3cc8`.

The localhost server uses staging data, so the recorder projects the exact persisted production Social Content and linked calendar rows into read-only GET responses. It blocks non-GET mutations, records attempted product writes, and keeps provider generation, upload, scheduling, publishing, posting, spending, and outreach locked.

## Review artifacts

- `desktop-1440x900.mp4` — four-record desktop walkthrough.
- `mobile-390x844.mp4` — four-record 390 x 844 walkthrough.
- `receipt.json` — routes, record bindings, frame counts, overflow checks, external-action checks, and data-source boundary.
- `*-overview.png` and `*-asset.png` — route and approved-asset stills.

## Validation

- Four campaign-specific checks replace the unrelated practitioner-evidence gate.
- Approved visual bindings resolve to one raster frame, intentional text-only, or eight raster frames as configured.
- CTA, JIT packet, copy version, Draft state, and external-action boundary are visible.
- Both viewports have no horizontal overflow and no enabled external-action buttons.
- The capture observed zero product writes.
- Both walkthroughs decode as H.264 MP4.

Reproduce with:

```bash
QA_BASE_URL=http://localhost:4271 ./node_modules/.bin/tsx scripts/qa/record-accelerated-campaign-review-routing.mjs
```

The command requires the gitignored localhost admin storage state and read-only production connection already configured in the Portfolio environment. It does not authorize or perform any external campaign action.
