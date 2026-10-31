# Dark Castle Chess scorecard — customer-facing local review

Product commit: `51a8dca1efaa5fa5ac41d1799785b85b12074d22` on `codex/amina-dark-castle-lead-magnet`.

Exact route loaded in the Codex in-app browser from a production-style build of that commit:

`http://localhost:3127/decision-traceability-scorecard?utm_source=linkedin&utm_medium=organic_social&utm_campaign=dark_castle_decision_traceability&rev=51a8dca1efaa5fa5ac41d1799785b85b12074d22`

Build: `NEXT_PUBLIC_APP_ENV='' MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build`. Serve: `NEXT_PUBLIC_APP_ENV='' MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm start -- -p 3127`. The local build omitted the development banner; no production environment or provider was activated.

## What changed

The customer page now speaks directly to the visitor. It asks them to choose a real decision, answer four questions, act on their score, take the worksheet, and optionally request follow-up. Game captions describe the visible moves. Internal layout, estimate, provenance, and storage details are kept out of page copy; necessary source and claim-boundary notes remain in `docs/lead-magnets/dark-castle-decision-traceability-handoff.md`. The form explains its customer-facing privacy outcome in plain language. The email input has a visible label and no placeholder.

The consolidated page structure, logo, three owned gameplay images, four scoring dimensions, PDF, explicit consent, API, migration, and external-action gates remain.

## Browser evidence

- `desktop-hero.png`: first 1440 × 900 viewport with logo, offer, and game start.
- `desktop-proof-position.png` and `desktop-proof-response.png`: paired gameplay and question groups at desktop width.
- `desktop-result.png`: full desktop page with 5/8 result and an empty email field.
- `tablet-result.png`: full page at 768-pixel viewport with the same scored state and empty email field.
- `mobile-result.png`: full page at 390-pixel viewport after four answers, with an empty email field.
- `mobile-01-hero.png` through `mobile-08-follow-up.png`: eight mobile viewport crops from the same in-app browser scored path. They show each gameplay screen beside its relevant checks, the 5/8 result, free PDF, and a clean empty form. No failure-state frame is in this customer-facing sequence.
- `mobile-walkthrough.mp4`: playable H.264, 760 × 1688, 30 fps, 809 frames, 26.97 seconds. It is a sequence of real browser states rather than a continuous screen recording. FFmpeg decoded the final MP4 without errors; the final empty-form frame and full-page mobile capture were visually inspected.

The browser reported document heights of 2,999 pixels at desktop, 4,526 at tablet, and 4,778 at mobile. Document width stayed within 1440, 768, and 390-pixel viewports. All five images, including the two brand marks and three game states, loaded at each width. The DOM inspection confirmed that the email value was empty and the placeholder absent in all three scored captures. The full visible-text scan found no prompt, QA, fixture, implementation, estimate, or storage language in the customer page. No real lead was submitted.

Focused validation: `npx vitest run app/decision-traceability-scorecard/scorecard.test.tsx lib/decision-traceability.test.ts app/api/decision-traceability/route.test.ts` — 16 tests passed, including copy, empty field, invalid email, persistence failure, duplicate, offline, and consent behavior. `git diff --check` passed. `npm run build` completed from the product commit; it reported existing unrelated lint warnings. No live database, customer-data, provider, or hosted deployment smoke ran. Staging migration and production permission gates remain open.

## Sources and privacy

The castle logo is an exact copy of `/Users/vambahsillah/Documents/ChatGPT/Dark Castle Chess/assets/logo.png`, staged at `public/lead-magnets/dark-castle-chess-logo.png`. The public gameplay captures `explore-start.jpg`, `explore-position.jpg`, and `explore-computer.jpg` are in `public/review-assets/social-content/storyboard-review/`; approved-use lineage and hashes are in `docs/lead-magnets/dark-castle-decision-traceability-handoff.md`. The AmaduTown portrait logo is the publisher mark. No credential, real contact, private player data, provider state, or production Social Content record was exposed or changed.
