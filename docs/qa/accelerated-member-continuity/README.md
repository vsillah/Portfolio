# Accelerated member continuity review

Synthetic localhost routes from `codex/accelerated-member-continuity`:

- Guest learning plan: `http://localhost:3087/service-prototypes/accelerated-cohort?view=3&rev=local`
- Member: `http://localhost:3087/member/dashboard?qa=member&rev=local`
- Assessed member: `http://localhost:3087/member/dashboard?qa=assessed&rev=local`
- Verified paid client: `http://localhost:3087/member/dashboard?qa=paid&rev=local`

The `qa` states render only in a development build. They use synthetic content and do not write learner or client records. The MP4 shows guest lesson completion, member and assessed states, the paid-client tasks, milestones and meeting details, a narrow mobile view, and the synthetic operator recommendation path from blocked to approved. `render-walkthrough.sh` reproduces the encoded video from the captured PNGs.

Staging migrations `20261105154239`, `20261105162607`, `20261105162841`, `20261105163155`, and `20261105163217` were applied to the staging Supabase project only. The initial migration created six empty tables; follow-up migrations add an enrollment revision, atomic progress/review/recommendation commands, and SQL qualification repairs. RLS is enabled on each. Anonymous table access and direct authenticated writes are revoked; authenticated reads require an owner predicate. Production was not migrated.

The token-based client dashboard route remains available. The paid-member projection reuses its complete data builder after a verified project membership identifies the member, without requiring or returning a dashboard token. Assessment projection still uses a verified audit and active token server-side.

Human QA remains pending. The synthetic fixture shows presentation and state progression; it does not prove a real cross-device authenticated session or a paid conversion end to end.

Synthetic staging SQL checks in `supabase/tests/accelerated_member_atomic_review.sql` covered claim replay, stale revision, worksheet identity, owner/audit mismatch, recommendation source, and rollback. The whole batch ended with `ROLLBACK`; a read-only check found zero remaining synthetic users, enrollments, intakes, owners, or recommendations. Focused Vitest: 23 passed. The production build passed. Live authenticated cross-device and paid conversion remain outside this fixture.
