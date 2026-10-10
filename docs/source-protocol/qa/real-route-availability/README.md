# Source Protocol real-route availability QA

## Binding

- Runtime commit: `98524f42`
- Exact route: `https://portfolio-staging-qwjh329zu-vsillahs-projects.vercel.app/admin/source-protocol`
- `Vercel – portfolio`: `dpl_Fk7weP8V5t1aLxHWNpAUc1K49fGv` (`Ready`)
- `Vercel – portfolio-staging`: `dpl_CgJFZ7tYpLvh1RNQCkzDoQxHTFdP` (`Ready`)

## Result

This evidence uses the real protected staging route, an approved gitignored admin validation session, and the actual `/api/admin/source-protocol/overview` response. The overview request was not intercepted or replaced with a synthetic payload.

- Nine authenticated scenarios passed: 1440, 768, and 390 px in Light, Dark, and System modes.
- Real overview responses: `9/9` returned HTTP `200` with `available: true` and live summary data.
- Optional Evidence-QA projection: available in all nine scenarios. The Vercel function successfully loaded both packaged fixture inputs.
- Minimum measured non-disabled text contrast: `4.70:1`.
- Contrast failures, horizontal overflow, page errors, HTTP failures, and same-origin writes: `0`.
- The recorder stayed on the initial Banned Books view and did not open or expose portal-account identities.
- Walkthrough: `source-protocol-real-route-walkthrough.mp4` (H.264, 1440×1000, 25 fps, 37.92 seconds).

## Validation

```bash
npx vitest run app/api/admin/source-protocol/overview/route.test.ts app/admin/source-protocol/page.test.tsx app/admin/layout.test.tsx components/ThemeToggle.test.tsx components/admin/AdminSidebar.test.tsx
npm run build
node scripts/qa/source-protocol-real-route-evidence.cjs
```

The regression suite also exercises a Vercel-like `/var/task` `ENOENT` path and verifies that the optional Evidence-QA subsection fails closed without converting the entire Source Protocol overview into an HTTP 500 response.
