# Campaign package preparation Human QA

- Application commit: `b9fcbac3`
- Exact route: `http://127.0.0.1:3098/admin/social-content?campaignQa=campaign-package-preparation-v1&rev=b9fcbac3`
- Desktop viewport: 1440 × 1000
- Mobile viewport: 390 × 844
- Fixture: synthetic, privacy-safe, development-only

The walkthrough covers a ready candidate with sealed deliverables, a stale-evidence blocker with an in-context recovery link, idempotent preparation of LinkedIn and YouTube review assets, receipt history, the comparison trace, the zero-weight playlist boundary, the thumbnail v6 checklist, and the closed external-action gates.

The recorder observed no provider, paid-generation, upload, platform-draft, scheduling, publishing, external-send, credential, migration, spending, or production-release actions. The development-only Vercel Speed Insights script was blocked during capture. No customer data is present.

## Files

- `social-campaign-package-preparation-walkthrough.mp4` — combined desktop and mobile interaction walkthrough
- `desktop-1440-ready-sealed.png` — eligible candidate before preparation
- `desktop-1440-reversr-blocked.png` — stale-evidence fail-closed state
- `desktop-1440-prepared-receipt.png` — prepared package and durable receipt projection
- `mobile-390-ready-sealed.png` — responsive eligible state
- `mobile-390-reversr-blocked.png` — responsive blocked state
- `mobile-390-prepared-receipt.png` — responsive prepared state
- `results.json` — machine-readable capture manifest

Regenerate with:

```bash
QA_REVISION=b9fcbac3 node scripts/qa/record-social-campaign-package-preparation.mjs
```
