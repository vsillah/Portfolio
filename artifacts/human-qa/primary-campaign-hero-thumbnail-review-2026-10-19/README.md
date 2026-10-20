# Primary campaign hero thumbnail Human QA

## Exact review build

- Feature commit: `ad0d0c5a0499c895b126539b26e69510fca57064`
- Localhost route: `http://127.0.0.1:3218/admin/social-content?campaignQa=campaign-package-preparation-review-v1&rev=ad0d0c5a0499c895b126539b26e69510fca57064`
- Review surface: existing Social Content campaign-package preparation QA route
- Data boundary: local fixture projection plus first-party review assets; production reads and writes stayed at zero

## Campaign decisions pending

Dark Castle Chess:

- Candidate A: `REMEMBER THE WHY` / The Decision Table
- Candidate B: `SEE THE CONSEQUENCE` / The Rook Reveal

AI Audit Calculator:

- Candidate A: `WHO OWNS THE CLEANUP?` / The Receipt Pull
- Candidate B: `THE BILL HIDES HERE` / The Hidden Ledger

Every candidate remains `pending_human_qa` and `final_use_eligible: false`. Human QA must select exactly one candidate per campaign and record a concise rejection reason for each alternative before downstream packaging.

## Evidence captured

- Playable H.264 MP4: `primary-campaign-hero-thumbnail-review-walkthrough.mp4`
- Desktop: 1440×1000, dark mode
- Tablet: 768×1024, light mode
- Mobile: 390×844, dark mode
- Candidate A, Candidate B, evidence-expanded, decision-gate, and closed-gate screenshots are included for every campaign and viewport.
- Both campaign-scoped recovery links were clicked and returned to the exact review route.
- Horizontal overflow check passed at all three widths.
- Unexpected external requests: 0
- Protected actions exercised: 0

## Generation and cost receipt

- Provider calls: 4
- Successful jobs: 4
- Retries: 0
- Uncertain results: 0
- Observed separate charge: US$0
- Combined hard ceiling: strictly below US$9

The integrated browser reached the local Portfolio login gate, but the locked Mac prevented 1Password from unlocking the established QA session. Automated same-route capture used the existing encrypted Playwright admin storage state. Integrated-browser Human QA remains pending until the Mac is unlocked and the exact route is reloaded.

Upload, platform draft, scheduling, publishing, deployment, merge, credentials, migrations, and external sends remained closed.
