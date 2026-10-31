# Dark Castle Chess scorecard — consolidated local review

Product commit: `b033cd4b648758779599bfabd89cd5df0f992cae` on `codex/amina-dark-castle-lead-magnet`.

Exact route loaded in the Codex in-app browser after restarting localhost from that commit:

`http://localhost:3127/decision-traceability-scorecard?utm_source=linkedin&utm_medium=organic_social&utm_campaign=dark_castle_decision_traceability&rev=b033cd4b648758779599bfabd89cd5df0f992cae`

Server command: `MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run dev -- -p 3127`.

## What changed

The separate proof gallery, essay bridge, scorecard, result, worksheet, and consent sections became a shorter sequence: branded hero and game start; Explore after e4 beside checks 1–2; Black's e5 response beside checks 3–4; one score, worksheet, and optional follow-up area. The same three owned gameplay images, logo, four scoring dimensions, PDF, consent, privacy text, API, and migration remain. Captions identify the game states and avoid presenting the organizational checks as game features.

## Browser evidence

- `desktop-hero.png`: first 1440 × 900 viewport with logo, offer, and game start.
- `desktop-proof-position.png` and `desktop-proof-response.png`: paired gameplay and question groups at desktop width.
- `desktop-result.png`: full desktop page with 5/8 result and invalid-email recovery state.
- `tablet-result.png`: full page at 768-pixel viewport, with the same scored state.
- `mobile-result.png`: full page at 390-pixel viewport after four answers, before email entry.
- `mobile-01-hero.png` through `mobile-08-validation.png`: eight mobile viewport crops from in-app browser full-page captures of the same interaction path. They show each gameplay screen beside the relevant checks, the result, free PDF, and invalid-email recovery.
- `mobile-walkthrough.mp4`: playable H.264, 760 × 1688, 30 fps, 809 frames, 26.97 seconds. It is a sequence of real browser states rather than a continuous screen recording. FFmpeg decoded the final file without errors; the final validation frame was visually inspected.

The browser reported document heights of 2,999 pixels at desktop, 4,546 at tablet, and 4,659 at mobile before form submission. Document width stayed within 1440, 768, and 390-pixel viewports. All five images, including the two brand marks and three game states, loaded at each width. The mobile full-page image and desktop full-page image were visually inspected. The invalid-email request returned `Enter a valid email address.` and saved no lead.

Focused validation: `npx vitest run app/decision-traceability-scorecard/scorecard.test.tsx lib/decision-traceability.test.ts app/api/decision-traceability/route.test.ts` — 15 tests passed. `git diff --check` passed. TypeScript reported no scorecard or lead-magnet errors; repo-wide typecheck still has unrelated baseline errors. No live database, customer-data, provider, or hosted deployment smoke ran. Staging migration and production permission gates remain open.

## Sources and privacy

The castle logo is an exact copy of `/Users/vambahsillah/Documents/ChatGPT/Dark Castle Chess/assets/logo.png`, staged at `public/lead-magnets/dark-castle-chess-logo.png`. The public gameplay captures `explore-start.jpg`, `explore-position.jpg`, and `explore-computer.jpg` are in `public/review-assets/social-content/storyboard-review/`; approved-use lineage and hashes are in `docs/lead-magnets/dark-castle-decision-traceability-handoff.md`. The AmaduTown portrait logo is the publisher mark. The only form value shown is the invalid string `invalid`. No credential, real contact, private player data, provider state, or production Social Content record was exposed or changed.
