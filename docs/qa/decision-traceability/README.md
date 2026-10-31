# Decision Traceability Scorecard — local review evidence

Product source commit: `fddfd3bab8b6bd64d84c58837d4c577454816e61` on `codex/amina-dark-castle-lead-magnet` in `/Users/vambahsillah/.codex/worktrees/a617/Portfolio`.

Exact loaded route: `http://localhost:3127/decision-traceability-scorecard?utm_source=linkedin&utm_medium=organic_social&utm_campaign=dark_castle_decision_traceability&rev=fddfd3bab8b6bd64d84c58837d4c577454816e61`

The localhost server was restarted from that commit with `MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run dev -- -p 3127`. The in-app browser displayed the current hero, Dark Castle public gameplay image, four-choice result, PDF link, consent form, and validation error. The mobile screenshots are from one actual browser interaction sequence: page entry, primary CTA, four answers, result/worksheet, and invalid-email response. The MP4 encodes those captured states in order; it is a state-sequence walkthrough rather than a continuous screen recording. No real lead was submitted.

## Evidence

- `desktop-hero.png`: 1440 × 900 offer and Dark Castle proof.
- `desktop-result.png`: full desktop route after the assessment and validation check.
- `tablet-result.png`: full route at 768 pixels.
- `mobile-result.png`: full route at 390 pixels after the four answers.
- `mobile-01-hero.png` through `mobile-05-validation.png`: viewport states in the MP4.
- `mobile-walkthrough.mp4`: 13.2-second H.264, 760 × 1644, 30 fps. FFmpeg decoded it without errors and the final validation frame was visually inspected.

The in-app browser reported document width below viewport width at 390, 768, and 1440 pixels. The PDF link downloaded a one-page A4 PDF and the invalid-email path returned a visible 400 response. Unit tests cover saved, duplicate, offline, validation, consent, attribution, privacy, and persistence failure states. They do not claim a live database smoke. The staging migration and production permission gate remain open.

## Sources and privacy

The page uses the public owned `explore-computer.jpg` gameplay capture and `amadutown-logo-upscaled.png` brand mark. The only form value shown in evidence is the invalid string `invalid`. No credential, real contact, private player data, provider state, or production Social Content record was exposed or changed.
