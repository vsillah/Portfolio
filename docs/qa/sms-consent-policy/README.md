# SMS consent candidate: development handoff

The existing Contact > Send Message form now offers optional SMS consent and records unverified evidence. Normal inquiries work without a number or SMS selection. A number entered without selection is discarded. This candidate does not enroll a contact, verify phone ownership, clear an opt-out, or enable sending.

## Stack and scope

- Branch: `codex/sms-consent-policy`.
- Worktree: `/Users/vambahsillah/.codex/worktrees/ea6d/Portfolio`.
- Dependency/base: `codex/api-guest-auth-remediation`, PR #955, commit `f09024bba05a6f9646ddf5937d7c80d5eb68675c`.
- Classification: Dependent, explicitly stacked by the integration captain. The draft PR targets #955's branch. No newer main commits are replayed as feature work.
- #955's admin-only contact GET and shared `route.test.ts` are preserved. #954's anonymous-listing test is not adopted.
- Captain must update/merge the dependency, retarget this PR, and rerun current-main regressions before integration. This base predates current main.

## Data handling and migration gate

Migration: `supabase/migrations/20260909154521_capture_contact_sms_consent.sql`.

The new table stores submitted/normalized phone, affirmative selection, server-owned program/scope/disclosure/version and source/policy paths, a database timestamp, and an inquiry provenance link. The inquiry link is based on existing email deduplication and is explicitly not identity or ownership verification. No phone or consent is copied into contact fields, analytics, webhook payloads, logs, or public responses.

The evidence key deterministically deduplicates normalized email + phone + program + disclosure version, including concurrent retries. `ON CONFLICT DO NOTHING` retains the original disclosure and timestamp. The application role has insert/select only; public and authenticated clients have no grants or RLS policies. Pending state and `send_eligible=false` are database constraints. Unchecked inquiries perform no evidence write. Existing suppression and re-opt-in requirements remain authoritative; a future verified re-opt-in process must be separately reviewed.

Inquiry persistence precedes evidence capture. If evidence storage fails, the API reports that the inquiry was saved and lets the visitor retry or continue without SMS. Consent fields are retained for retry, failure/success feedback is next to Send Message and receives focus, and a subsequent invalid submission clears any stale success message.

No migration was applied to staging or production. Validate the migration against the actual target schema and review grants/RLS before deployment. Missing migration fails checked consent with an explicit retry response; ordinary inquiries continue. There is no provider callback, confirmation sender, Telnyx activation, Gmail/Slack addition, credential change, or campaign/payment action. Hosted policy publication, migration deployment, and human QA remain captain gates.

## Synthetic validation

- 58 tests pass across component, contact API, new SMS model/API tests, and existing SMS suppression/provider-readiness tests.
- Changed-file ESLint and `git diff --check` pass.
- Production `npm run build` passes with synthetic environment and the loopback fetch guard (122 static pages generated). Existing image lint warnings and missing optional provider configuration warnings remain. No deployment is performed.
- `tsc --noEmit` reports four existing errors in untouched test files. A temporary source snapshot at exact #955 base reproduces identical diagnostics after generating the knowledge artifact; see `typecheck-receipt.json`.
- Isolated PGlite PostgreSQL validates actual migration SQL, public-role denial, application append-only grants, duplicate retention, database timestamp, unchanged suppressed inquiry, and non-sendable constraints. See `migration-receipt.json`. This is not a live Supabase/PostgREST migration qualification.
- Actual local `/#contact` > Send Message, `/legal/privacy`, and `/legal/terms#sms` are exercised at 360/390/768/1440. Action flows run at 360/390/1440; tablet receives layout/link checks. No horizontal overflow. Checked/unchecked, absent/malformed phone, keyboard checkbox, database failure/retry, repeat submission, retained suppression boundary, policy links, and visible feedback are covered.
- The recording drives the real Next contact API against a loopback-only synthetic PostgREST mock. Unrelated homepage APIs return synthetic empty data. Browser external requests are blocked; the server runs a loopback-only fetch guard. `browser-receipt.json` records attempted blocked hosts separately from `externalRequests: []`.
- Native screen-reader audio, real phone ownership, provider keywords/auto-responses, carrier delivery, hosted routes and production/customer-data smoke are intentionally not tested. Labels, focus, native checkbox keyboard operation and live-region semantics are tested locally.

## Review media

- Both MP4s fully decode with FFmpeg; extracted mobile frames were visually inspected. H.264/yuv420p, desktop 24.32 seconds and mobile 27.76 seconds.
- `walkthrough-1440.mp4`: desktop normal inquiry, consent validation, failure/retry, pending capture, and policy navigation.
- `walkthrough-390.mp4`: readable mobile operator path.
- `contact-*.png`, `phone-error-*.png`, `retry-*.png`, `success-*.png`, `privacy-*.png`, `terms-*.png`: viewport evidence.

## Reproduction

Use synthetic values only. Do not copy production environment files into this QA environment.

```sh
npm run build:knowledge
npm exec -- vitest run components/Contact.sms.test.tsx components/Contact.test.tsx app/api/contact/sms-consent.test.ts app/api/contact/route.test.ts lib/contact-sms-consent.test.ts lib/warm-outreach-sms-readiness.test.ts lib/warm-outreach-sms-provider-readiness.test.ts
npm exec -- eslint components/Contact.tsx components/Contact.sms.test.tsx lib/contact-sms-consent.ts lib/contact-sms-evidence.ts lib/contact-sms-consent.test.ts app/api/contact/route.ts app/api/contact/sms-consent.test.ts app/legal/privacy/page.tsx app/legal/terms/page.tsx scripts/record-contact-sms-qa.mjs scripts/validate-contact-sms-migration.mjs scripts/contact-sms-qa-fetch-guard.cjs
npm exec -- tsc --noEmit
# Build uses the same synthetic env/fetch guard shown below, with npm run build.
git diff --check
npm install --prefix /tmp/portfolio-sms-db-qa --no-audit --no-fund @electric-sql/pglite
SMS_QA_PGLITE_MODULE=/tmp/portfolio-sms-db-qa/node_modules/@electric-sql/pglite/dist/index.js node scripts/validate-contact-sms-migration.mjs
```

Start the server in one terminal, then run the recorder in another. The recorder owns the temporary synthetic persistence server on port 54991 and closes it on exit.

```sh
env -i PATH="$PATH" HOME="$HOME" NODE_OPTIONS="--require=$PWD/scripts/contact-sms-qa-fetch-guard.cjs" SMS_QA_BLOCKED_FETCH_LOG=/tmp/sms-server-blocked.jsonl NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54991 NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-anon-key SUPABASE_SERVICE_ROLE_KEY=synthetic-service-key N8N_DISABLE_OUTBOUND=true npm run dev -- --hostname 127.0.0.1 --port 3199
node scripts/record-contact-sms-qa.mjs
```

The user-facing disclosure is the approved copy. Policy additions were reviewed against actual pending-only handling and received the humanizer style pass; existing social-publishing provisions remain. Database access design follows the [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) and [upsert API](https://supabase.com/docs/reference/javascript/upsert).
