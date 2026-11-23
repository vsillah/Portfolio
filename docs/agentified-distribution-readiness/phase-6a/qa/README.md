# Agentified Phase 6A landing QA

Code commit: `eed643a7e` on `codex/agentified-phase6a-distribution-readiness`, based on production `aef8c3ec2a3415f0c84f21cfbd3f143c1a299f85`. The later evidence-only commit does not change the reviewed page or assets.

Exact local review route: `http://127.0.0.1:3129/agentified?revision=eed643a7e`. The local production build used inert Supabase placeholders and disabled outbound n8n calls. No authenticated or live-data flow was exercised.

Both videos show the landing message, workshop action, and guest Learning Plan confirmation. The desktop viewport is 1440×900; the mobile viewport is 390×844. Both were recorded from the same local build, decoded fully with FFmpeg, and sampled visually for legibility. Automated browser checks found zero horizontal overflow and confirmed that the workshop action reaches the guest route.

| MP4 | SHA-256 |
| --- | --- |
| `agentified-phase6a-desktop.mp4` | `471bf78378232a7404a2f2b99a1a5058808ced32efc3f5e70f5c2db46d0a1d18` |
| `agentified-phase6a-mobile-390x844.mp4` | `a23e50bbbefdc6678b9a73fad946fe6c44925ea6684d0621e82ce7a5e6bc9fc0` |

Focused tests: `./node_modules/.bin/vitest run app/agentified/page.test.tsx lib/agentified-rights-addendum.test.ts lib/agentified-publication.test.ts lib/agentified-workshop.test.ts` (12 passed). Typecheck: `./node_modules/.bin/tsc --noEmit` (passed). Production build: `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=local-build-placeholder MOCK_N8N=true N8N_DISABLE_OUTBOUND=true NODE_OPTIONS=--max-old-space-size=8192 npm run build` (passed, with existing unrelated lint warnings). The first build attempt hit Node's default 4 GB heap limit; the next reached page-data collection but lacked isolated-worktree Supabase variables. The final run passed with inert values.

Scope check: the changed files are the landing page, its test, the exact L02–L04 owner-rights addendum, this receipt, and these two MP4s. Qualified video, VTT, timing, player, workshop state, and learner-data code and bytes were not changed. This is local review evidence, not deployment, publication, or release approval.
