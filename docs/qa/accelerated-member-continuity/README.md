# Accelerated member continuity review

Synthetic localhost routes from `codex/accelerated-member-continuity`:

- Guest learning plan: `http://localhost:3087/service-prototypes/accelerated-cohort?view=3&rev=local`
- Member: `http://localhost:3087/member/dashboard?qa=member&rev=local`
- Assessed member: `http://localhost:3087/member/dashboard?qa=assessed&rev=local`
- Verified paid client: `http://localhost:3087/member/dashboard?qa=paid&rev=local`

The `qa` states render only in a development build. They use synthetic content and do not write learner or client records. The MP4 shows guest lesson completion, the basic member dashboard, the assessed state, the paid-client state, and a narrow mobile view. `render-walkthrough.sh` reproduces the encoded video from the captured PNGs.

Staging migration `20261105154239_accelerated_member_continuity` was applied to the staging Supabase project only. It created six empty tables. RLS is enabled on each. Anonymous table access and direct authenticated writes are revoked; authenticated reads require an owner predicate. Production was not migrated.

The token-based client dashboard route was not changed. Member projection uses the existing dashboard service on the server after either `diagnostic_audits.user_id` or a verified project membership identifies the member. It never returns the dashboard token.

Human QA remains pending. The synthetic fixture shows presentation and state progression; it does not prove a real cross-device authenticated session or a paid conversion end to end.
