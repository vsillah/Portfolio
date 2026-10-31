# Dark Castle decision traceability lead magnet — review only

## Proposed destination

Canonical page: `https://amadutown.com/decision-traceability-scorecard`

Proposed LinkedIn link: `https://amadutown.com/decision-traceability-scorecard?utm_source=linkedin&utm_medium=organic_social&utm_campaign=dark_castle_decision_traceability`

The proposed post edit is to add this exact line after the final question and before the hashtags:

> Score one decision in three minutes and take the worksheet into your next review: https://amadutown.com/decision-traceability-scorecard?utm_source=linkedin&utm_medium=organic_social&utm_campaign=dark_castle_decision_traceability

This is a later copy change proposal. The approved post copy, visual, Social Content record, calendar item, and provider state are untouched. Recalculate the copy/version receipt and repeat the required review and current JIT gate before any link or publication action.

## Product boundary and source map

- The page and PDF use the owned Dark Castle Chess icon copied from `/Users/vambahsillah/Documents/ChatGPT/Dark Castle Chess/assets/logo.png` to `public/lead-magnets/dark-castle-chess-logo.png` (SHA-256 `366fb036bcb4ad2dd3cf2c949af584a8c2bc3e86b4d0e7121a3a842c6719417e`). Dark Castle is the lead identity; AmaduTown is named as creator.
- The product-proof sequence uses three distinct owned public gameplay captures: `explore-start.jpg` (SHA-256 `c794cc0b96ecde2be8b99fa930b45ac2a2e055d7ec92dc45654ac592082af3ae`), `explore-position.jpg` (`896dce9162e815c1138dfbecacd24e0a63d05e99901f98b89022ddeee225f9df`), and `explore-computer.jpg` (`27d79426c04fa984569dc337623d1eb4a514392bf2e067563d9982d43d77dcdf`), all in `public/review-assets/social-content/storyboard-review/`. Their approved-use and claim boundary is recorded in `docs/social-content/dark-castle-linkedin-jit-review-2026-10-22.md`. The page describes only visible board, Explore, notation, move guidance, and candidate-move states. Percentages are identified as in-product estimates. It claims no measured learning result.
- AmaduTown brand mark: `public/amadutown-logo-upscaled.png` (portrait ratio preserved).
- The four-part assessment and one-page PDF are new derived tools. They use no private gameplay records, player identifiers, chat exports, or production Social Content data.
- The user sees a result before entering an email. The PDF is available without email. A separate checkbox records consent to an email follow-up; submission itself sends no email or provider call.
- Storage requires `20261031120000_decision_traceability_leads.sql`. The new table stores normalized email, score, weakest dimension, consent version/time, fixed source path, bounded UTM values, and a submission UUID. It stores no individual answers, IP, or free text. Unique campaign/email and submission keys prevent repeat insertions. Service-role writes are server only. The client sees an error if persistence is unavailable.

## Gates

1. Captain validates migration against local or staging, including RLS and duplicate behavior; this lane does not apply it to production.
2. Captain reviews the route, form states, PDF, mobile layout, and privacy language. Then Human QA reviews the exact revision and walkthrough.
3. Production migration requires current authorization under the Portfolio migration rule because it introduces a new permission boundary. Verify persistence and rollback before enabling the LinkedIn link.
4. Rebind and review the exact post copy/link version with a current JIT receipt. Publication, scheduling, upload, and provider calls remain separate gates.
