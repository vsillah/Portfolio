# Engagement Inbox shadow benchmark

This offline pilot compares the current `evaluateCommentInboxPolicy` classifier, a Jev-shaped mock adapter, and hand-authored expected labels. It does not measure Jev model quality. The live-shadow recommendation is **HOLD** until an approved credential reference, provider-call authority, and independently reviewed labels exist.

## Run and review

With the repository's existing dependencies installed:

```sh
node --import tsx scripts/jev-engagement-shadow.ts > /tmp/jev-shadow-report.json
node -e 'const r=require("/tmp/jev-shadow-report.json"); console.log(r.verdict, r.baseline, r.mock)'
npx --no-install vitest run lib/engagement-shadow/benchmark.test.ts lib/comment-inbox-policy.test.ts
npx --no-install eslint lib/engagement-shadow/*.ts scripts/jev-engagement-shadow.ts
git diff --check
```

The CLI accepts no arguments, file input, live switch, credentials, database connection, or URL. It runs all 240 bundled synthetic cases without network access. Its full JSON report contains per-case predictions, expected labels, safe case IDs, failure codes, family summaries, usage, and local latency. Decisions and aggregate quality metrics are deterministic; CPU latency varies. `comparison.json` is the compact review artifact from the validated run.

CLI walkthrough:

1. Run the command above. Confirm `mode=offline-mock`, `fixtureFamilies=30`, and both case counts are 240.
2. Compare `baseline.accuracy` and `mock.accuracy` across the five dimensions. Inspect `rows` by case ID to find disagreements.
3. Inspect `perFamily.negation`: the mock misreads negated advice language. Formatting variants also expose baseline sensitivity.
4. Check `failureCount`, false-safe rate, high-risk recall, containment, and escalation rate together. A provider failure blocks routing but does not count as a correct prediction.
5. Read the HOLD verdict. The mock's favorable numbers do not justify provider activation or production use.

There is no operator UI change; this CLI/report walkthrough is the review artifact.

## Boundary and policy

`policy.ts` defines a provider-neutral `DecisionAdapter`, strict text-only input and normalized judgments, and Portfolio-owned thresholds. `jev.ts` builds five independent questions: intent (Choice), urgency (Score), spam risk (Noul), public reply risk (Noul), and human-review need (Noul). It validates model identity, exact answer keys, distributions, winning choice, score/legend consistency, finite ranges, and usage before accepting a response.

The version is pinned to `jev-1.13.0`. No moving alias is accepted. Timeout, transport exception, non-200 status (including 401/422/429/529), or malformed response blocks the result. Choice/Score confidence below 0.85 or Noul values above the negative threshold of 0.15 require review; spam/reply risk at 0.85 blocks. Noul has no confidence field. Its probability ambiguity is handled directly. A deadline aborts the transport and returns even if it ignores cancellation. There are no retries and no provider error-body logging.

`createJevAdapter()` without an injected transport returns `provider_gate`. This patch includes only an in-memory mock transport. It has no HTTP implementation, reads no credentials, and cannot activate live calls from its CLI. The mock uses simple text heuristics and never receives fixture labels. Those heuristics were authored alongside the fixture set, so this is a harness test, not a held-out evaluation.

`shadow_safe` is a classifier analysis label, **not permission to send**. Every adapter decision has `externalActionsAllowed=false`. Current production routing, n8n, approval policy, deterministic leakage/suppression/authorization/date/arithmetic/permission checks, and provider capabilities are untouched. This module has no production caller. Baseline reply proposals are evaluated in memory and are never persisted or executed.

## Corpus and metrics

All text was authored for this pilot. No production records, private exports, messages, contact details, credentials, or account identifiers were read or copied. Thirty semantic seeds each have eight formatting/context variants: 240 cases, not 240 statistically independent samples. Families include negation, irrelevant context, injection, contradictory instructions, invalid dates, arithmetic claims, unauthorized actions, suppression, urgency, and ordinary inbox intent classes. Human reviewers should adjudicate labels before using them for model selection.

Baseline uses the actual pure classifier with a fixed 0.95 input confidence and fixed synthetic timestamps. No signals, private sources, or provider context are supplied. Its urgency is projected from workflow priority (urgent=2, low=0, other=1); spam is the spam classification; reply risk is a documented proxy from spam, criticism, misinformation, or sensitive classifications. Human-review need uses `humanQaRequired`. The baseline does not expose independent risk scores. Its synthetic classification false-safe rate is not a production-send vulnerability finding; downstream execution gates are outside this benchmark.

- Accuracy: correct labels divided by all cases, separately for all five judgments. Failed predictions are incorrect.
- False-safe rate: shadow-safe routes among expected human-review, spam, reply-risk, or urgency-2 cases, divided by that expected unsafe subset.
- High-risk recall: predicted spam, reply risk, or urgency-2 among cases expected to have any of those labels. Abstentions are misses.
- High-risk containment: non-safe routes among expected high-risk cases. This is separate from prediction recall.
- Escalation rate: review or block routes divided by all cases.
- Latency: local adapter wall time, mean and nearest-rank p95. This excludes provider/network latency because none ran.
- Usage/cost: actual local mock input/output tokens and cost are zero. Unavailable usage is null, never zero. Cost arithmetic is Portfolio-owned: input tokens × $0.042 / million; output tokens are free at the referenced price. This is not a live cost forecast.

Empty denominators return null. Per-family results expose correlated errors instead of hiding them behind the aggregate.

## Credential/provider gate

The implementation session found no `TYPESAFE_API_KEY` in its environment and no approved TypeSafe reference in tracked repo content. No secret store was searched and no secret was printed. Supabase callable tools were exposed; CLI servers were enabled, with auth shown as Unknown/Unsupported. No database read or auth probe was needed or performed.

To propose a future live shadow test:

1. In the captain task, identify an already-approved local TypeSafe credential reference by reference name/path only. Never paste its value into chat or commit it.
2. Review the synthetic request corpus, expected labels, pinned model, provider data terms, and bounded call/cost proposal.
3. Authorize that specific provider-call scope. A separate reviewed patch must supply the transport, enforce the agreed budget, and record usage/receipts.
4. Re-run comparison on actual responses and review false-safe errors and subgroup recall before considering any production integration.

No account, key, secret-store item, Vercel variable, purchase, or production secret was created. Expenses incurred: $0.

## Sources and preflight

Official references checked September 30, 2026:

- [TypeSafe API contract](https://docs.typesafe.ai/api)
- [Versioned models and input-token pricing](https://docs.typesafe.ai/models)
- [Score semantics](https://docs.typesafe.ai/primitives/score)

Preflight fetched refs, inventoried 27 open PRs and their files, inspected status/log and `origin/main...HEAD`, and verified Supabase tool exposure plus `codex mcp list`. The initial detached checkout was clean but stale; the new branch starts at `90e5ffe2` on current `origin/main`. New files under `lib/engagement-shadow`, the CLI, and this documentation have no open-PR overlap. Classification: Independent. Existing classifier source last changed in PR #761 and is imported unchanged. Worktree: `/Users/vambahsillah/.codex/worktrees/3aad/Portfolio`; branch: `codex/jev-engagement-shadow-benchmark`.

No UI, migration, env, deployment, or production smoke is required for this offline tool. Both `Vercel – portfolio` and `Vercel – portfolio-staging` are left for captain integration review; neither deployment is claimed as verified by this lane.

## Validation receipt

- `node_modules/.bin/vitest run lib/engagement-shadow/benchmark.test.ts lib/comment-inbox-policy.test.ts`: 52 tests passed.
- `node --import tsx scripts/jev-engagement-shadow.ts > /tmp/jev-shadow-report.json`: 240 cases completed; no provider requests; compact output checked in as `comparison.json`.
- `node_modules/.bin/eslint lib/engagement-shadow/*.ts scripts/jev-engagement-shadow.ts`: passed.
- `git diff --check`: passed.
- `node_modules/.bin/tsc --noEmit --incremental false`: blocked by four existing diagnostics: missing `chatbot-knowledge-content.generated` in `lib/chatbot-knowledge.ts:69` and `lib/video-ideas-context.ts:8`; duplicate properties in `lib/social-comment-inbox-ui.test.ts:51-52`. No diagnostic references a changed file. Those source files are unchanged by this patch.
- Scoped TypeScript compiler-API validation using repository compiler options: options, syntactic, and semantic diagnostics for all seven new TypeScript files passed. The full application build was not run for this isolated tooling change.
- No live workflow/customer-data smoke, Supabase query, production routing change, or Vercel deployment verification was performed.
