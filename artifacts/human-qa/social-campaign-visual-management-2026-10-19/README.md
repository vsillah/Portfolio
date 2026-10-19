# Evidence-backed social visual management QA

- Reviewed commit: `aac82753eea4ea33d95fc92b0cf67e38e9657e67`
- Exact localhost route: `http://127.0.0.1:3210/admin/social-content?campaignQa=campaign-package-preparation-v1&rev=aac82753eea4ea33d95fc92b0cf67e38e9657e67`
- Data: synthetic development-only fixture
- Viewports: 1440×1000 desktop and 390×844 mobile
- Batch result: 12 total, 12 scanned, 1 prepared, 11 blocked, 0 remaining
- External requests: 0 (development Speed Insights was blocked)
- Protected actions exercised: 0
- Provider, paid rendering, uploads, platform drafts, scheduling, publishing, credentials, migrations, spending, production writes, and external sends: closed

## Review path

The walkthrough shows:

1. The existing Campaign Preparation surface and bounded `Prepare eligible visual plans` action.
2. The clean LinkedIn 4:5 and YouTube 16:9 KickLab asset views using synthetic owned-product evidence.
3. Ten visual-evaluation dimensions whose scores are derived from visible observed/required values and formulas.
4. The progressive-disclosure source trace, the Unscored playlist-similarity boundary with no attributable receipt, the attributable live-topic receipt and threshold, rejected alternatives, and script-to-visual storyboard timing.
5. The compact blocked backlog: search, four results per page, blocker grouping, collapsed exact details, page reset after search, and ReversR's primary recovery link.
6. The closed external-action gates.

## Evidence

- `social-campaign-visual-management-walkthrough.mp4` — playable H.264 MP4, 1440×1000, 25 fps, 16.60 seconds.
- `desktop-1440-clean-assets.png`
- `desktop-1440-trace-and-evaluation.png`
- `desktop-1440-benchmark-receipt.png`
- `desktop-1440-blocked-recovery.png`
- `mobile-390-clean-assets.png`
- `mobile-390-trace-and-evaluation.png`
- `mobile-390-benchmark-receipt.png`
- `mobile-390-blocked-recovery.png`
- `results.json`

## Validation

- `npm test -- --run lib/social-campaign-package-preparation.test.ts lib/social-campaign-long-form-batch.test.ts lib/social-campaign-preparation-producer.test.ts lib/social-campaign-visual-plan.test.ts app/api/admin/social-content/campaign-packages/route.test.ts components/admin/SocialCampaignPackagePreparation.test.tsx` — 49 passed.
- Scoped lint for the changed component, route, and visual contract — passed.
- Desktop and mobile walkthrough assertions covered search, three-page pagination, page reset after search, grouped results, collapsed exact details, the primary recovery link, and zero horizontal overflow.
- SVG validation with `xmllint --noout` — passed.
- The broader Next.js build compiled the application and reached the repository-wide type stage, then stopped because the shared workspace has no installed `remotion` module. A later full `tsc --noEmit` also exposed unrelated pre-existing test errors outside this change. These repository-wide blockers are not treated as passing evidence.
