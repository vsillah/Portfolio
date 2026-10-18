# YouTube thumbnail v3 Human QA

## Review binding

- Implementation commit: `54bf542b4859c0befc0576da88a50f98d565986f`
- Branch: `codex/youtube-thumbnail-receipt-route`
- Pull request: `#1104` (draft)
- Localhost: `http://127.0.0.1:5319`
- Desktop viewport: `1440 x 1000`
- Mobile viewport: `390 x 1200`

Exact review routes:

- AI Audit Calculator: `http://127.0.0.1:5319/admin/social-content/3dad4cca-72b7-4705-8fb6-273bf7500ce6?step=copy&qa_fixture=social_campaign_review_assets_v1&rev=54bf542b`
- Dark Castle Chess: `http://127.0.0.1:5319/admin/social-content/c12378f2-36de-4bf7-8c5d-0ce754e727eb?step=copy&qa_fixture=social_campaign_review_assets_v1&rev=54bf542b`

## Selected thumbnails

- Dark Castle Chess: `dark-castle-remember-the-why-v3.png`
  - Hook: `REMEMBER THE WHY`
  - Layout: `teacher-board-proof-split`
  - SHA-256: `c8f0054e97474804664150e9429221207b9e37910fb571237767fcff7492de74`
- AI Audit Calculator: `ai-audit-who-owns-the-cleanup-v3.png`
  - Hook: `WHO OWNS THE CLEANUP?`
  - Layout: `human-anchor-simplified-score-proof`
  - SHA-256: `58e637ecce3597ec142c2573a850aad004b9ea3a298b53c6c86226a1951400df`

Each thumbnail uses a fresh campaign-specific HeyGen Pro identity remix plus owned product proof. The former shared profile-photo fallback is not used. A distinct alternate look is retained in the source-proof directory for each campaign, while the receipt names the selected primary look and environment.

## Evidence controls

- Public examples were recaptured on `2026-10-18T19:22:39.000Z`.
- Dark Castle: 8 included examples, 2 threshold-qualified outliers (`88.75`, `83.75`).
- AI Audit: 6 included examples, 3 excluded examples, 1 threshold-qualified outlier (`85`).
- The user-curated playlist is attached to both decisions as taste calibration only: performance weight `0`, unscored.
- First-party product proof controls the selected composition.
- Description evidence remains `Unscored` at `0 / 3`; final video generation and every external execution gate remain closed.
- HeyGen usage: two generation submissions, one included credit for each campaign. No payment or other external transaction was made in this lane.

## Captures

- `dark-castle-thumbnail-desktop.png`: desktop thumbnail card.
- `dark-castle-desktop.png`: desktop composition and receipt-backed decision route.
- `dark-castle-mobile.png`: 390-pixel responsive thumbnail card.
- `ai-audit-desktop.png`: desktop thumbnail card.
- `ai-audit-receipt-desktop.png`: desktop composition and receipt-backed decision route.
- `ai-audit-mobile.png`: 390-pixel responsive thumbnail card.
- `youtube-thumbnail-v3-walkthrough.mp4`: 24-second H.264 walkthrough, 1280 x 720, 30 fps, 720 frames.
- `walkthrough-contact-sheet.png`: six-frame visual check of the encoded walkthrough.

## Validation

```text
npx vitest run scripts/qa/youtube-thumbnail-v3-generation.test.ts lib/deterministic-sha256.test.ts lib/artifact-evidence-manifest.test.ts lib/social-campaign-review-assets.test.ts components/admin/SocialCampaignReviewPacket.test.tsx lib/youtube-packaging-evidence.test.ts
62 passed

npx vitest run components/admin/SocialCampaignReviewPacket.test.tsx lib/social-campaign-review-assets.test.ts lib/youtube-packaging-evidence.test.ts 'app/admin/social-content/[id]/page.test.tsx'
132 passed

git diff --check
passed
```

The integrated browser visibly confirmed both exact routes at desktop and mobile widths. Each route showed the v3 thumbnail, `Receipt-backed Ready`, its distinct layout family, the fresh identity-remix description, live comparison decisions, zero-weight playlist language, and the unscored description gate.

## Boundaries

- Review-only fixture; no production record was read or changed.
- No approval, rejection, publishing, upload, provider activation, scheduling, outreach, merge, or deployment occurred.
- Human QA is required before the captain advances this client-facing change.
