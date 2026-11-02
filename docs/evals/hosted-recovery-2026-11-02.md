# Hosted evaluation recovery review — 2026-11-02

This is a review-only intake packet. It does not authorize or record a new hosted evaluation. The canonical registry and monthly runner are at `c2d76ac59add75434fa98b6f91c32a5d381b01ba` (PR #1172). The approved local `monthly-report.json` was generated at `2026-11-02T10:49:50.857Z`; its snapshot SHA-256 is `5cfa70848ef119c305669b66b329ec79f9537f81dd99a5f64e4871acdfc2610b`. The redacted `freshness-snapshot.json` at `/Users/vambahsillah/Projects/Portfolio/local-private/evals/2026-11-02/` matched that digest during review. These files remain private and are not copied into the repo.

| Canonical family | Persisted observation | Existing pass rule | Owner / route | Binding still needed |
| --- | --- | --- | --- | --- |
| `chatbot-hosted-evidence` | 6 human evaluations; latest 2026-02-27 17:27:15 UTC; 6 bad | Per-record human `good`/`bad`; no aggregate pass threshold | Model Ops; Integration Captain review | Current chatbot prompt revision and approved source/evidence identity |
| `llm-judge-hosted-evidence` | 7 judge evaluations; latest 2026-02-27 17:27:25 UTC; 5 bad, 2 good; 5 aligned, 2 misaligned with human ratings | Per-record `good`/`bad`; alignment is tracked separately; no aggregate pass threshold | Model Ops; Integration Captain review | Current judge prompt revision, model/source approval, and evidence identity |
| `agent-hosted-evidence` | 5 runs; latest 2026-08-30 01:34:47 UTC; average 76.8; 2 passed, 3 failed | `chief-of-staff-synthesis-quality` rubric threshold **82**, sourced from `public.agent_eval_rubrics.threshold` | Model Ops; Integration Captain review | Current persisted rubric revision and approved run/source identity |
| `video-script-hosted-evidence` | 0 persisted evaluations; no latest timestamp | Existing `evaluateVideoScript` and template readiness: zero blockers | Video content owner; Integration Captain review | One existing approved script, template, and evidence candidate with matching versions; otherwise blocked |

All four hosted families are stale or absent under the registry's 31-day freshness rule. The counts and scores above are historical evidence, not new run results. The local files establish count and recency; the detailed rating and rubric breakdowns are approved intake facts supplied for this review and must be tied to their owning source before marking a packet review-ready.

## Operator packet completion

1. Confirm the current prompt, rubric, or template version and its owning approved source record for each family. Do not infer the version from a default in code. For video script, select one already approved candidate; leave the packet blocked if none exists.
2. Prepare a private `approved-bindings.json` using the schema in [the monthly eval instructions](../portfolio-eval-monthly.md). Bind each source approval, evidence digest, observed breakdown, and expiring attempt/retry cap. No provider or production execution is enabled by this step.
3. Run the read-only packet command. Review all four `state` values, blockers, source identities, owner routes, and zero side-effect flags. Retain the output in a private review location.
4. Any hosted run, provider use, production write, or spending requires a separate authorized execution plan. The packet's `review-ready` state is only input readiness.
