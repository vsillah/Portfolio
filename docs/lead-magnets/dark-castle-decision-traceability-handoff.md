# Dark Castle decision traceability lead magnet — review only

## Proposed destination

Canonical page: `https://amadutown.com/decision-traceability-scorecard`

Proposed LinkedIn link: `https://amadutown.com/decision-traceability-scorecard?utm_source=linkedin&utm_medium=organic_social&utm_campaign=dark_castle_decision_traceability`

The proposed post edit is to add this exact line after the final question and before the hashtags:

> Score one decision in three minutes and take the worksheet into your next review: https://amadutown.com/decision-traceability-scorecard?utm_source=linkedin&utm_medium=organic_social&utm_campaign=dark_castle_decision_traceability

This is a later copy change proposal. The approved post copy, visual, Social Content record, calendar item, and provider state are untouched. Recalculate the copy/version receipt and repeat the required review and current JIT gate before any link or publication action.

## Product boundary and source map

- The Dark Castle image is the owned public `public/review-assets/social-content/storyboard-review/explore-computer.jpg`. Its approved-use and claim boundary is recorded in `docs/social-content/dark-castle-linkedin-jit-review-2026-10-22.md`. The page describes visible Explore, notation, move guidance, and candidate move states. It claims no measured learning result.
- AmaduTown brand mark: `public/amadutown-logo-upscaled.png` (portrait ratio preserved).
- The four-part assessment and one-page PDF are new derived tools. They use no private gameplay records, player identifiers, chat exports, or production Social Content data.
- The user sees a result before entering an email. The PDF is available without email. A separate checkbox records consent to an email follow-up; submission itself sends no email or provider call.
- Storage requires `20261031120000_decision_traceability_leads.sql`. The new table stores normalized email, score, weakest dimension, consent version/time, fixed source path, bounded UTM values, and a submission UUID. It stores no individual answers, IP, or free text. Unique campaign/email and submission keys prevent repeat insertions. Service-role writes are server only. The client sees an error if persistence is unavailable.

## Gates

1. Captain validates migration against local or staging, including RLS and duplicate behavior; this lane does not apply it to production.
2. Captain reviews the route, form states, PDF, mobile layout, and privacy language. Then Human QA reviews the exact revision and walkthrough.
3. Production migration requires current authorization under the Portfolio migration rule because it introduces a new permission boundary. Verify persistence and rollback before enabling the LinkedIn link.
4. Rebind and review the exact post copy/link version with a current JIT receipt. Publication, scheduling, upload, and provider calls remain separate gates.
