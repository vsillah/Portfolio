# Dark Castle Chess Decision Traceability Scorecard — local review evidence

Product source commit: `ce4e0ba732af12eddb3127b16c1644eaefad4f80` on `codex/amina-dark-castle-lead-magnet` in `/Users/vambahsillah/.codex/worktrees/a617/Portfolio`.

Exact loaded route: `http://localhost:3127/decision-traceability-scorecard?utm_source=linkedin&utm_medium=organic_social&utm_campaign=dark_castle_decision_traceability&rev=ce4e0ba732af12eddb3127b16c1644eaefad4f80`

Desktop hero refresh route: `http://localhost:3127/decision-traceability-scorecard?utm_source=linkedin&utm_medium=organic_social&utm_campaign=dark_castle_decision_traceability&rev=2e550ba7c6c2dab02553137cc33dbd6085874dea`. The server was restarted from that evidence head before the recapture.

The localhost server was restarted from that commit with `MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run dev -- -p 3127`. The in-app browser showed the owned Dark Castle Chess logo and wordmark in the first viewport, AmaduTown as creator, three distinct owned gameplay screenshots, the four-check assessment, score, optional email consent, and the one-page PDF. The gameplay sequence is game start, Explore after e4, then the board and candidate moves after Black plays e5. Image captions distinguish visible product states from the scorecard's organizational questions. Full-size links allow closer inspection of small gameplay UI text on narrow screens; the computer-response link was opened and resolved to the 1248 × 969 source image.

## Evidence

- `desktop-hero.png`: first viewport at 1440 × 900 with the Dark Castle logo, offer, and decoded gameplay image. The recapture waited for network idle and confirmed the hero image was complete, visible, and 411 × 319 natural pixels before saving. The saved PNG was visually inspected; SHA-256 `647804de4fb52b7e77dc6a74bff63975857c3e9564e8f4804446d957d489f63b`.
- `desktop-proof-position.png` and `desktop-proof-response.png`: the two later gameplay states at desktop width.
- `desktop-result.png`: full desktop page with a 5/8 score and invalid-email recovery state.
- `tablet-result.png`: full page at 768 pixels.
- `mobile-result.png`: full page at 390 pixels after four answers, before email entry.
- `mobile-01-hero.png` through `mobile-08-validation.png`: viewport captures from one in-app browser interaction path, showing brand, three gameplay states, assessment, result, worksheet, and invalid-email response.
- `mobile-walkthrough.mp4`: 22-second H.264 state-sequence walkthrough, 760 × 1644, 30 fps, 660 frames. FFmpeg decoded the final MP4 without errors. The first, gameplay-response, and final validation frames were visually inspected. It is a sequence of real browser states, not a continuous screen recording.

The in-app browser reported document width below viewport width at 390, 768, and 1440 pixels. All four Dark Castle images loaded at desktop and mobile widths. The browser downloaded the revised one-page A4 PDF. The invalid-email path displayed a 400 response, so no real lead was submitted. The 14 focused tests passed, including the new accessible-logo, distinct-image, and full-size-link assertions. No live database/customer-data smoke ran. The staging migration and production permission gates remain open.

## Sources and privacy

The castle logo is an exact copy of `/Users/vambahsillah/Documents/ChatGPT/Dark Castle Chess/assets/logo.png`, staged at `public/lead-magnets/dark-castle-chess-logo.png`. The three public gameplay captures are `explore-start.jpg`, `explore-position.jpg`, and `explore-computer.jpg` in `public/review-assets/social-content/storyboard-review/`; their approved-use lineage and hashes are recorded in `docs/lead-magnets/dark-castle-decision-traceability-handoff.md`. The AmaduTown portrait logo remains the publisher mark. The only form value shown is the invalid string `invalid`. No credential, real contact, private player data, provider state, or production Social Content record was exposed or changed.
