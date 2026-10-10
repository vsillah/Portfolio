# Source Protocol theme and contrast QA

## Binding

- Runtime commit: `3419e75e3fd60a44b2d97c2762c249e1a54da38b`
- Exact route: `https://portfolio-staging-lc9hy9iyy-vsillahs-projects.vercel.app/admin/source-protocol`
- `Vercel – portfolio`: `dpl_GYEtUjNkhFBXVdnrYUjkYn8SSrNz` (`Ready`)
- `Vercel – portfolio-staging`: `dpl_GWPBFMw69AhVAknSjP7DdDo6nFAK` (`Ready`)

## Result

The protected staging audit passed across 1440 px desktop, 768 px tablet, and 390 px mobile in explicit Light, explicit Dark, and System preferences.

- Nine viewport/theme scenarios passed.
- All nine Source Protocol tabs were exercised in every scenario.
- Selected, focus, hover, disabled, active, pending, revoked, empty, and error states were checked.
- Minimum measured non-disabled text contrast: `4.70:1`.
- Contrast failures: `0`.
- Horizontal overflow failures: `0`.
- Page errors: `0`.
- Account or API writes: `0`.
- Screenshots: `31` privacy-safe PNGs in this directory.
- Walkthrough: `source-protocol-theme-contrast-walkthrough.mp4` (H.264, 1440×1000, 25 fps, 25.04 seconds).

The test uses synthetic creator, portal-account, rights, payout, and review data. Non-GET application and Supabase requests are blocked by the harness. No production data or portal account was changed.

## Commands

```bash
npx vitest run app/admin/source-protocol/page.test.tsx app/admin/layout.test.tsx components/ThemeToggle.test.tsx components/admin/AdminSidebar.test.tsx
npm run build
npx vercel env run --cwd <temporary-portfolio-staging-link> -- sh -c 'QA_BASE_URL="$1" node scripts/qa/source-protocol-theme-contrast.cjs' sh https://portfolio-staging-lc9hy9iyy-vsillahs-projects.vercel.app
```

The temporary project link supplied a short-lived staging OIDC token. Deployment Protection and Trusted Sources were not changed.
