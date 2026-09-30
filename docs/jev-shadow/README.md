# Engagement Inbox shadow benchmark

This offline pilot compares the current `evaluateCommentInboxPolicy` classifier, a Jev-shaped mock adapter, and existing policy regression labels plus hand-authored shadow labels. It does not measure Jev model quality. The live-shadow recommendation is **HOLD** until an approved credential reference, provider-call authority, and independently reviewed labels exist. The [completion receipt](pilot-completion.md) records the follow-up to merged PR #994.

## Run and review

With the repository's existing dependencies installed:

```sh
node --import tsx scripts/jev-engagement-shadow.ts > /tmp/jev-shadow-report.json
node -e 'const r=require("/tmp/jev-shadow-report.json"); console.log(r.verdict, r.baseline, r.mock)'
npx --no-install vitest run lib/engagement-shadow/benchmark.test.ts lib/engagement-shadow/privacy.test.ts lib/comment-inbox-policy.test.ts
npx --no-install eslint lib/engagement-shadow/*.ts lib/comment-inbox-policy.fixtures.ts lib/comment-inbox-policy.test.ts scripts/jev-engagement-shadow.ts
git diff --check
```

The CLI accepts no arguments, file input, live switch, credentials, database connection, or URL. It runs all 254 bundled cases without network access: ten existing labeled policy cases, 240 synthetic variants, and four redacted synthetic cases. Its version-2 JSON report contains per-case predictions, expected labels, source groups, safe case IDs, failure codes, local review reasons, family summaries, usage, and local latency. Decisions and aggregate quality metrics are deterministic; CPU latency varies. `comparison.json` is the compact review artifact from the validated run.

CLI walkthrough:

1. Run the command above. Confirm `mode=offline-mock`, `fixtureFamilies=44`, and both case counts are 254. Check the source counts in `corpus`.
2. Compare `baseline.accuracy` and `mock.accuracy` across the five dimensions. Inspect `rows` by case ID to find disagreements.
3. Inspect `perFamily.negation`: the mock misreads negated advice language. Formatting variants also expose baseline sensitivity.
4. Check `schemaFailureCount`, `failuresByReason`, false-safe rate, high-risk recall, containment, and escalation rate together. A provider failure blocks the observation but does not count as a correct prediction. `agreementWithBaseline` measures agreement between the two classifiers; `accuracy` compares each with the expected labels.
5. Read the HOLD verdict. The mock's favorable numbers do not justify provider activation or production use.

There is no operator UI change; this CLI/report walkthrough is the review artifact.

## Boundary and policy

`policy.ts` defines a provider-neutral `DecisionAdapter`, a strict input allowlist, normalized judgments, and Portfolio-owned thresholds. `jev.ts` builds five independent questions: intent (Choice), urgency (Score), spam risk (Noul), public reply risk (Noul), and human-review need (Noul). Each question treats comment text as untrusted data. It validates model identity, exact answer keys, distributions, winning choice, score/legend consistency, finite ranges, and usage before accepting a response.

Only minimized `text` crosses the injected transport boundary. Common email, phone/number, identifier, URL, and handle patterns become placeholders; suspected credential assignments/tokens are rejected before transport. Oversized input or redaction expansion is rejected without truncation. Optional `sourceConfidence` and `providerAmbiguity` remain local. Redaction, low source confidence, or provider ambiguity can require review even when model judgments would otherwise be `shadow_safe`; model predictions remain unchanged for honest scoring. Known redaction placeholders retain that review requirement on replay. No raw text or request/error body is returned in observations.

These patterns are defense in depth for synthetic or independently reviewed redacted input. They cannot identify every name, address, secret format, or indirect personal reference. They provide no authorization to ingest or send private/production records.

The version is pinned to `jev-1.13.0`. No moving alias is accepted. Timeout, transport exception, non-200 status (including 401/422/429/529), or malformed response blocks the result. Choice/Score confidence below 0.85 or Noul values above the negative threshold of 0.15 require review; spam/reply risk at 0.85 blocks. Noul has no confidence field. Its probability ambiguity is handled directly. A deadline aborts the transport and returns even if it ignores cancellation. There are no retries and no provider error-body logging.

`createJevAdapter()` without an injected transport returns `provider_gate`. This patch includes only an in-memory mock transport. It has no HTTP implementation, reads no credentials, and cannot activate live calls from its CLI. The mock uses simple text heuristics and never receives fixture labels. Those heuristics were authored alongside the fixture set, so this is a harness test, not a held-out evaluation.

`shadow_safe` is a classifier analysis label, **not permission to send**. Every adapter decision has `externalActionsAllowed=false`. Current production routing, n8n, approval policy, deterministic leakage/suppression/authorization/date/arithmetic/permission checks, and provider capabilities are untouched. This module has no production caller. Baseline reply proposals are evaluated in memory and are never persisted or executed.

## Corpus and metrics

The corpus shares the ten original classification fixtures with `lib/comment-inbox-policy.test.ts` through `lib/comment-inbox-policy.fixtures.ts`. Their text, expected classifications, confidence, and manual-provider context are preserved. Four additional synthetic cases use redaction placeholders. Thirty semantic seeds each have eight formatting/context variants: another 240 cases, not 240 statistically independent samples. No production records, private exports, messages, contact details, credentials, or account identifiers were read or copied. Families include negation, irrelevant context, injection, contradictory instructions, invalid dates, arithmetic claims, unauthorized actions, suppression, urgency, and ordinary inbox intent classes. Original regression classifications have existing test expectations; new risk/urgency/review labels are hand-authored and still require independent human adjudication.

Baseline uses the actual pure classifier with fixed synthetic timestamps. Shared policy cases retain their original confidence and manual-provider context; remaining cases use confidence 0.95. No signals or private sources are supplied. Its urgency is projected from workflow priority (urgent=2, low=0, other=1); spam is the spam classification; reply risk is a documented proxy from spam, criticism, misinformation, or sensitive classifications. Human-review need uses `humanQaRequired`. The model sees text only, so context-dependent baseline labels can disagree with model judgments while local gates still require review. The baseline does not expose independent risk scores. Its synthetic classification false-safe rate is not a production-send vulnerability finding; downstream execution gates are outside this benchmark.

- Accuracy: correct labels divided by all cases, separately for all five judgments. Failed predictions are incorrect.
- False-safe rate: shadow-safe routes among expected human-review, spam, reply-risk, or urgency-2 cases, divided by that expected unsafe subset.
- High-risk recall: predicted spam, reply risk, or urgency-2 among cases expected to have any of those labels. Abstentions are misses.
- High-risk containment: non-safe routes among expected high-risk cases. This is separate from prediction recall.
- Escalation rate: review or block routes divided by all cases.
- Schema failures: `malformed_response` count, separate from timeout, input, privacy, provider, and transport failures; all failures also appear in `failuresByReason`.
- Latency: local adapter wall time, mean and nearest-rank p95. This excludes provider/network latency because none ran.
- Usage/cost: actual local mock input/output tokens and cost are zero. Unavailable usage is null, never zero. Cost arithmetic is Portfolio-owned: input tokens × $0.042 / million; output tokens are free at the referenced price. This is not a live cost forecast.

Empty denominators and empty-corpus usage/cost return null. Per-family results expose correlated errors instead of hiding them behind the aggregate.

## Configuration and promotion gate

There are no runtime env switches for this pilot. The CLI does not load dotenv, credentials, endpoints, or a live transport. `JEV_MODEL` is pinned in `jev.ts`; thresholds, the 1,000 ms deadline, and the price reference are in `POLICY`. Any model/question/threshold change requires a reviewed code change and fresh calibration. The existing general LLM wrapper retries and logs error summaries; it is deliberately not used by this offline boundary, which returns stable failure codes without retrying or logging provider payloads.

Promotion remains blocked until all of these are evidenced:

1. Independently review at least 200 distinct synthetic or approved redacted cases. Split by semantic family before tuning; formatting variants cannot inflate the independent sample count. The current 254-case harness does not satisfy this gate.
2. With separately approved provider scope, add a reviewed transport with a hard call/cost cap and verify the exact pinned model and provider contract. Record actual token usage, latency, failure rates, and cost without private inputs or credential values.
3. On the held-out set, require zero schema failures, zero observed false-safe high-risk cases, and no high-risk recall regression against the Portfolio baseline, including each risk subgroup. Review every disagreement and report denominators and uncertainty; missing labels or usage are blockers, not zeros.
4. Run two weeks of approved observational shadow evaluation. Portfolio/n8n retain all policy and orchestration. Review escalation load and latency/cost before proposing changes.
5. Obtain a separate captain-reviewed promotion decision for any low-risk internal routing patch, including rollback and kill switch. Production writes, approval changes, publishing, Slack/Gmail/SMS/payment/provider dispatch remain outside this pilot.

## Credential/provider gate

The implementation session found no `TYPESAFE_API_KEY` in its environment and no approved TypeSafe reference in tracked repo content. No secret store was searched and no secret was printed. Supabase callable tools were exposed; CLI servers were enabled, with auth shown as Unknown/Unsupported. No database read or auth probe was needed or performed.

To propose a future live shadow test:

1. In the captain task, identify an already-approved local TypeSafe credential reference by reference name/path only. Never paste its value into chat or commit it.
2. Review the synthetic request corpus, expected labels, pinned model, provider data terms, and bounded call/cost proposal.
3. Authorize that specific provider-call scope. A separate reviewed patch must supply the transport, enforce the agreed budget, and record usage/receipts.
4. Re-run comparison on actual responses and review false-safe errors and subgroup recall before considering any production integration.

No account, key, secret-store item, Vercel variable, purchase, or production secret was created. Expenses incurred: $0.

## Sources and original PR #994 preflight

Official references checked September 30, 2026:

- [TypeSafe API contract](https://docs.typesafe.ai/api)
- [Versioned models and input-token pricing](https://docs.typesafe.ai/models)
- [Score semantics](https://docs.typesafe.ai/primitives/score)

Preflight fetched refs, inventoried 27 open PRs and their files, inspected status/log and `origin/main...HEAD`, and verified Supabase tool exposure plus `codex mcp list`. The initial detached checkout was clean but stale; the new branch starts at `90e5ffe2` on current `origin/main`. New files under `lib/engagement-shadow`, the CLI, and this documentation have no open-PR overlap. Classification: Independent. Existing classifier source last changed in PR #761 and is imported unchanged. Worktree: `/Users/vambahsillah/.codex/worktrees/3aad/Portfolio`; branch: `codex/jev-engagement-shadow-benchmark`.

No UI, migration, env, deployment, or production smoke is required for this offline tool. Both `Vercel – portfolio` and `Vercel – portfolio-staging` are left for captain integration review; neither deployment is claimed as verified by this lane.

## Original PR #994 validation receipt

- `node_modules/.bin/vitest run lib/engagement-shadow/benchmark.test.ts lib/comment-inbox-policy.test.ts`: 52 tests passed.
- `node --import tsx scripts/jev-engagement-shadow.ts > /tmp/jev-shadow-report.json`: 240 cases completed; no provider requests; compact output checked in as `comparison.json`.
- `node_modules/.bin/eslint lib/engagement-shadow/*.ts scripts/jev-engagement-shadow.ts`: passed.
- `git diff --check`: passed.
- `node_modules/.bin/tsc --noEmit --incremental false`: blocked by four existing diagnostics: missing `chatbot-knowledge-content.generated` in `lib/chatbot-knowledge.ts:69` and `lib/video-ideas-context.ts:8`; duplicate properties in `lib/social-comment-inbox-ui.test.ts:51-52`. No diagnostic references a changed file. Those source files are unchanged by this patch.
- Scoped TypeScript compiler-API validation using repository compiler options: options, syntactic, and semantic diagnostics for all seven new TypeScript files passed. The full application build was not run for this isolated tooling change.
- No live workflow/customer-data smoke, Supabase query, production routing change, or Vercel deployment verification was performed.
