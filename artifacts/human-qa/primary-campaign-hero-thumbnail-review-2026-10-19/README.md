# Primary campaign hero thumbnail Human QA decision evidence

## Exact review build

- Decision commit: `852ffa3379b849aa018a92b30b04adb0b9da7e79`
- Localhost route: `http://127.0.0.1:3218/admin/social-content?campaignQa=campaign-package-preparation-review-v1&rev=852ffa3379b849aa018a92b30b04adb0b9da7e79`
- Review surface: existing Social Content campaign-package preparation QA route
- Data boundary: local fixture projection plus first-party review assets; production reads and writes stayed at zero

## Recorded campaign decisions

Dark Castle Chess:

- Selected Candidate A: `REMEMBER THE WHY` / The Decision Table — sole final-use-eligible output
- Rejected Candidate B: `SEE THE CONSEQUENCE` / The Rook Reveal — ineligible because the rook piece is visibly disfigured

AI Audit Calculator:

- Selected Candidate A: `WHO OWNS THE CLEANUP?` / The Receipt Pull — sole final-use-eligible output
- Rejected Candidate B: `THE BILL HIDES HERE` / The Hidden Ledger — ineligible because Candidate A presents the clearer integrated receipt-pull concept

Both B candidates remain preserved as rejected evidence. No generated pixels were changed or regenerated.

## Evidence captured

- Playable H.264 MP4: `primary-campaign-hero-thumbnail-review-walkthrough.mp4`
- Desktop: 1440×1000, dark mode
- Tablet: 768×1024, light mode
- Mobile: 390×844, dark mode
- Candidate A, Candidate B, evidence-expanded, decision-receipt, and closed-gate screenshots are included for every campaign and viewport.
- Pending-selection recovery controls are absent after the exact version-bound decisions were recorded.
- Horizontal overflow check passed at all three widths.
- Unexpected external requests: 0
- Protected actions exercised: 0
- QA provider calls: 0
- Production reads: 0
- Production writes: 0
- MP4: H.264, yuv420p, 1440×1000, 25 fps, 20.92 seconds
- MP4 SHA-256: `8f3c7d4932829c4b5245c74976eb23fc730a689a913ad5195109104ed78a3c93`

## Generation and cost receipt

- Provider calls: 4
- Successful jobs: 4
- Retries: 0
- Uncertain results: 0
- Observed separate charge: US$0
- Combined hard ceiling: strictly below US$9

Upload, platform draft, scheduling, publishing, deployment, merge, credentials, migrations, and external sends remained closed.
