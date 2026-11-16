# Accelerated Up Next composition review

The first full-stage repair removed the video-frame bleed, but the next-lesson card retained its compact-overlay proportions. The second pass enlarges the poster, lesson title, and action together while keeping the completion summary distinct.

| Viewport | Rendered player | Up Next card | Preview image | Space below card |
| --- | ---: | ---: | ---: | ---: |
| 1440 × 900 | 1086 × 611 | 523 × 393 | 489 × 275 | 109 px |
| 768 × 900 | 656 × 390 | 616 × 181 | 262 × 147 | 57 px |
| 390 × 844 | 306 × 560 | 280 × 229 | 258 × 145 | 111 px |

The 390-pixel viewport has a 306-pixel player because the surrounding page consumes width; the image is measured against that actual content lane. Before/after L13 screenshots are `l13-up-next-before-*` and `l13-up-next-after-*`. The full 48-state geometry and interaction sweep is in `layout-sweep.json`.

Validation:

```bash
N8N_DISABLE_OUTBOUND=true npx next dev -p 3107
node scripts/qa/verify-accelerated-end-screen-layout.mjs
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key npx vitest run 'app/service-prototypes/[slug]/AcceleratedEndScreen.test.tsx' 'app/service-prototypes/[slug]/AcceleratedContextualBinding.test.tsx'
```

The sweep checks full opaque coverage, native control reachability, preview size, action size, bottom-control clearance, overflow, caption track/control, transcript, and L13-to-L14 navigation for all three viewports. It uses the local synthetic service preview; no customer data or live workflow was used.
