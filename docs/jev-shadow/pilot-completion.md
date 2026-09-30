# JEV shadow pilot completion receipt

Date: 2026-09-30. Branch: `codex/jev-engagement-shadow-pilot`.

The requested pilot was already partly delivered by merged [PR #994](https://github.com/vsillah/Portfolio/pull/994). This follow-up completes shared-fixture replay, input minimization, distinct schema-failure evidence, and an explicit promotion gate. The five-question adapter, pinned `jev-1.13.0` model, offline CLI, and Portfolio-owned policy remain the foundation.

## Pre-development inventory

- Initial checkout: clean, detached at `b8df8914`.
- Base after fetch: `a4a66fd5cdbf050cb53cbc882a2ea98e61f7e540` (`origin/main`, merged #994).
- Worktree: `/Users/vambahsillah/.codex/worktrees/d265/Portfolio`.
- Intended files: `lib/engagement-shadow/**`, shared classification fixtures and their existing policy test, and `docs/jev-shadow/**`.
- Open PR overlap: none in 27 open PRs, inspected with file lists.
- High-conflict surface: `lib/**`, specifically the just-merged #994 implementation.
- Classification: **Dependent**, proceeding from the merged owner commit.
- Recommendation: extend #994 in this worktree; preserve the captain checkout and stop at draft PR.

Preflight ran `git fetch origin --prune`, `git status --short --branch`, `git log --oneline --decorate --max-count=5`, `git diff --name-only origin/main...HEAD`, and `gh pr list --state open --json number,title,headRefName,baseRefName,isDraft,mergeStateStatus,url`. All open-PR files were retrieved with `gh pr list --state open --limit 100 --json number,title,headRefName,files` and compared with the intended paths. The capability matrix was read at `/Users/vambahsillah/Projects/Portfolio/docs/jev-vs-n8n-capability-matrix-2026-09-29.md`; it was absent from the fetched main tree.

Inspected the current classifier/policy and tests, the #994 adapter/fixtures/report, `lib/llm/provider-fetch.ts` retries and logging, and `lib/model-ops-research.ts` governance gates. No LLM registry, production caller, cost-event writer, schema, or API route was changed.

## Review evidence

The [compact report](comparison.json) records 254 cases in 44 families:

- Ten original policy classification cases, now shared by the policy tests and replay. Original confidence/manual-provider context is preserved.
- 240 synthetic formatting/context variants from 30 semantic seeds.
- Four synthetic cases with redaction placeholders.

All ten baseline regression classifications match their original expected labels. Labels for the new dimensions still require independent human review. The mock sees minimized text only; local source confidence/provider ambiguity can require review but do not rewrite its labels. This makes context-dependent disagreements visible.

| Metric | Portfolio baseline | JEV-shaped mock |
| --- | ---: | ---: |
| Intent accuracy | 73.62% | 95.28% |
| High-risk recall | 64.58% | 99.31% |
| False-safe rate | 28.17% | 0% |
| High-risk containment | 69.44% | 100% |
| Escalation rate | 62.99% | 87.01% |
| Schema failures | 0 | 0 |

High-risk denominator: 144; unsafe denominator: 213. The mock misses one high-risk label but contains it through review, illustrating why recall and containment are separate. These are fixture/plumbing measurements, not live JEV results or a finding about production send permissions. The report also records each judgment's accuracy and agreement with baseline, stable failure codes, local latency, tokens, and cost. Mock usage and expense are zero; provider latency/quality are unmeasured.

The adapter accepts only allowlisted text and optional local confidence/ambiguity fields. It minimizes common contact identifiers, rejects credential-like text and oversize input before transport, and emits no raw text, provider error body, prose, actions, or executable workflow proposals. Redaction is a limited defense for reviewed synthetic/redacted inputs, not permission to process private records.

## Validation

Passed 196 tests across 11 files:

```sh
node_modules/.bin/vitest run lib/engagement-shadow/benchmark.test.ts lib/engagement-shadow/privacy.test.ts lib/comment-inbox-policy.test.ts lib/social-comment-attention.test.ts lib/social-comment-attention-refresh.test.ts lib/social-comment-reply-safety.test.ts lib/social-comment-inbox-ui.test.ts lib/social-comment-inbox.test.ts lib/social-comment-reply-submission.test.ts 'app/api/admin/social-content/[id]/engagement/comments/route.test.ts' app/api/admin/social-content/engagement/comments/route.test.ts
node_modules/.bin/eslint lib/engagement-shadow/*.ts lib/comment-inbox-policy.fixtures.ts lib/comment-inbox-policy.test.ts scripts/jev-engagement-shadow.ts
node --import tsx scripts/jev-engagement-shadow.ts > /private/tmp/jev-shadow-pilot-report.json
git diff --check
```

Typecheck commands:

- `node_modules/.bin/tsc --noEmit --incremental false > /private/tmp/jev-pilot-typecheck.log 2>&1` reports four existing diagnostics: missing generated chatbot knowledge imports in `lib/chatbot-knowledge.ts:69` and `lib/video-ideas-context.ts:8`, plus duplicate properties in `lib/social-comment-inbox-ui.test.ts:51-52`. `git diff origin/main --` for those three files is empty. They are the same diagnostics recorded by #994.
- `node /private/tmp/jev-pilot-scoped-typecheck.cjs` uses the repository TypeScript config and compiler API for options, syntax, and semantic diagnostics across all eight `lib/engagement-shadow/*.ts` files, the shared fixture, existing policy test, and CLI: **zero diagnostics**. The driver is a temporary local validation helper; it does not change compiler configuration or suppress repository errors.

Tests cover valid outputs, extra/missing/malformed fields, model aliases, out-of-range scores/probabilities, provider status/errors, ignored-abort timeout, low confidence, high risk, local review overrides, privacy gates, redaction stability/expansion, no-fetch replay, and absence of executable proposals. Existing mocked provider failure tests intentionally log their synthetic errors. No live customer-data/workflow smoke or full application build was run.

## Boundaries and next gate

This session checked only whether `TYPESAFE_API_KEY`/`JEV_API_KEY` were present in its process environment: both absent. No secret values, env files, or secret stores were read. No credentials were requested or created. No HTTP transport or live switch was added.

The shadow benchmark performs no production-row writes, routing changes, approval mutations, Slack/Gmail/SMS/provider dispatch, publishing, or scheduling. No migration, merge, or deployment was performed by this implementation lane. Neither `Vercel – portfolio` nor `Vercel – portfolio-staging` was verified; those remain captain integration checks. No UI changed, so no Human QA or MP4 is needed.

The backend/offline implementation is ready for captain review. Live evaluation remains **HOLD**. The [promotion gate](README.md#configuration-and-promotion-gate) requires independently reviewed cases, held-out family splits, a reviewed bounded transport/cost proposal, actual provider evidence, zero schema/false-safe failures with no high-risk recall regression, two weeks of shadow observation, and a separate internal-routing promotion decision. The original orchestration and external-action boundaries remain in force.
