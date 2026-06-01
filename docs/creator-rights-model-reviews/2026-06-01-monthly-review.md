# Creator-Rights Model Review Packet - 2026-06-01

Automation: `creator-rights-model-review-monitor`  
Reviewed at: `2026-06-01T08:32:52Z`  
Standing controls: `docs/creator-rights-model-review-monitor.md`, `docs/source-respecting-llm-protocol.md`, `lib/source-respecting-llm-protocol.ts`

## Recommendation

Keep the incumbent: `allenai/Olmo-3-7B-Instruct`.

No production model routing, hosted settings, paid cloud providers, n8n production flows, secrets, or app defaults were changed.

## Setup Gap

The fixed creator-rights golden set was not found in the repo. This run is therefore a primary-source pre-screening review only. The deterministic helper was used to score the candidate table, but the production promotion quality gate is not considered passed until the fixed golden set exists and runs against the same retrieval prompts.

## Incumbent

| Model | License | Governance fit | Current role |
| --- | --- | --- | --- |
| `allenai/Olmo-3-7B-Instruct` | Apache-2.0 | Best current fit. Ai2 publishes OLMo as an open-science family with code, checkpoints, training details, and Apache terms. | Trust-first default for a creator-rights research assistant. |

Primary source checked: https://huggingface.co/allenai/Olmo-3-7B-Instruct

## Candidates Considered

| Candidate | Source status checked | License notes | Pre-screen result |
| --- | --- | --- | --- |
| `Qwen/Qwen3-4B-Instruct-2507` | HF metadata last modified `2025-09-17`; model card claims stronger instruction following, knowledge coverage, tool use, and 256K context. | Apache-2.0. Clean license, but governance/provenance posture is not cleaner than Ai2 for creator-rights accountability. | Strong cost/latency and source-coverage candidate. Needs golden-set citation/refusal proof before any promotion. |
| `microsoft/Phi-4-mini-instruct` | HF metadata last modified `2025-12-10`; Microsoft release notes describe Phi-4-mini as a 3.8B efficient instruction model with multilingual, reasoning, math, and function-calling improvements. | MIT. Permissive and commercially usable, but less creator-rights-specific provenance transparency than OLMo. | Good low-cost fallback candidate. Not enough citation/quote evidence to replace incumbent. |
| `mistralai/Ministral-3-8B-Instruct-2512` | HF metadata last modified `2026-01-15`; model card positions Ministral 3 as an edge-capable family fitting 24GB VRAM BF16 and less than 12GB when quantized. | Apache-2.0 with explicit third-party-rights warning. | Promising efficient 8B candidate. Needs golden-set proof and deployment latency data. |
| `allenai/Olmo-3.1-32B-Instruct` | HF metadata last modified `2026-01-05`; same OLMo 3 family, 32B instruct. | Apache-2.0; governance fit equal to incumbent. | Possible quality lift, but likely cost/latency regression for default v1 text RAG. Keep as offline/high-accuracy experiment candidate. |
| `google/gemma-4-31B-it` | HF metadata last modified `2026-05-27`; new Gemma generation, Apache-2.0, image-text-to-text model card. | Apache-2.0. Cleaner than earlier Gemma custom terms. | Newly notable, but 31B multimodal footprint is not justified for the text-first v1 assistant without golden-set wins. |
| `mistralai/Mistral-7B-Instruct-v0.3` | HF model card says v0.3 adds extended vocabulary, v3 tokenizer, and function calling over v0.2. | Apache-2.0. | Better fallback than v0.2, but no evidence it beats OLMo on citation/refusal discipline. |
| `Qwen/Qwen2.5-7B-Instruct` | Mature HF fallback, metadata last modified `2025-01-12`. | Apache-2.0. | Stable fallback only. Superseded by Qwen3 for this review. |
| `meta-llama/Llama-3.1-8B-Instruct` | HF model card and license checked; gated/custom Llama 3.1 license. | Custom Llama 3.1 Community License, gated access. | Not cleaner than Apache incumbent for open-source compatibility or creator-rights governance. |
| `CohereLabs/c4ai-command-r7b-12-2024` | HF model card checked; retrieval-style comparison model. | CC-BY-NC-4.0 plus Cohere Labs acceptable use policy. | Noncommercial terms conflict with payout/commercial compatibility. Comparison only. |

Additional discovery source checked through Hugging Face metadata on `2026-06-01`: official org model listings for `Qwen`, `allenai`, `microsoft`, `google`, and `mistralai`, sorted by recent modification.

## Source Links Checked

- https://huggingface.co/allenai/Olmo-3-7B-Instruct
- https://docs.allenai.org/latest-releases
- https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507
- https://huggingface.co/microsoft/Phi-4-mini-instruct
- https://techcommunity.microsoft.com/blog/educatordeveloperblog/welcome-to-the-new-phi-4-models---microsoft-phi-4-mini--phi-4-multimodal/4386037
- https://huggingface.co/mistralai/Ministral-3-8B-Instruct-2512
- https://huggingface.co/allenai/Olmo-3.1-32B-Instruct
- https://huggingface.co/google/gemma-4-31B-it
- https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.3
- https://huggingface.co/Qwen/Qwen2.5-7B-Instruct
- https://huggingface.co/meta-llama/Meta-Llama-3.1-8B-Instruct
- https://huggingface.co/CohereLabs/c4ai-command-r7b-12-2024

## Deterministic Pre-Screen

Scores are 1-5 evidence-derived pre-screen ratings, not golden-set benchmark results.

| Rank | Model | Quality score | License/governance score | Total score | Gate note |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 | `Qwen/Qwen3-4B-Instruct-2507` | 4.220 | 4.8 | 4.394 | Pre-screen leader, but not governance-cleaner than OLMo and missing golden-set proof. |
| 2 | `allenai/Olmo-3-7B-Instruct` | 3.988 | 5.0 | 4.292 | Incumbent remains best trust-first default. |
| 3 | `allenai/Olmo-3.1-32B-Instruct` | 3.900 | 5.0 | 4.230 | Governance clean, cost/latency regression risk. |
| 4 | `mistralai/Ministral-3-8B-Instruct-2512` | 3.952 | 4.8 | 4.206 | Promising efficient candidate; needs golden-set run. |
| 5 | `microsoft/Phi-4-mini-instruct` | 3.996 | 4.5 | 4.147 | Efficient MIT candidate; not enough citation evidence. |
| 6 | `google/gemma-4-31B-it` | 3.826 | 4.8 | 4.118 | Newly notable, but over-sized for default text RAG. |
| 7 | `Qwen/Qwen2.5-7B-Instruct` | 3.794 | 4.8 | 4.096 | Stable fallback only. |
| 8 | `mistralai/Mistral-7B-Instruct-v0.3` | 3.668 | 4.8 | 4.008 | Updated fallback; no citation/refusal advantage shown. |
| 9 | `meta-llama/Llama-3.1-8B-Instruct` | 3.922 | 3.1 | 3.675 | Custom/gated license blocks equal-cleaner gate. |
| 10 | `CohereLabs/c4ai-command-r7b-12-2024` | 4.092 | 2.2 | 3.524 | Noncommercial terms block payout/commercial compatibility. |

The helper returned `keep_incumbent` because the pre-screen leader did not have an equal-or-cleaner governance score than the incumbent. Separately, the missing fixed golden set prevents treating the quality gate as production-passed.

## Gate Results

| Gate | Result | Reason |
| --- | --- | --- |
| Quality gate | Not passed for production | Fixed creator-rights golden set is missing. Pre-screen scores alone are not enough for replacement. |
| License/governance gate | Not passed | No candidate is both materially better and equal-or-cleaner than Ai2 OLMo for creator-rights provenance, nonprofit/commercial payout compatibility, and open-source compatibility. |

## Known Regressions And Risks

- Qwen3-4B may improve cost and context length, but refusal discipline and quote accuracy must be proven against the protocol's own banned-books and creator-rights prompts.
- Phi-4-mini is attractive for latency/cost, but smaller models can underperform on nuanced source attribution unless RAG constraints are strict.
- OLMo-3.1-32B and Gemma-4-31B may improve quality but add latency, hosting cost, and operational complexity for a v1 text assistant.
- Llama 3.1 and Cohere Command R7B remain weaker governance fits because of custom/gated or noncommercial terms.

## Cost And Latency Notes

- Lowest expected cost/latency: Qwen3-4B and Phi-4-mini.
- Closest incumbent-size experiments: Ministral-3-8B, Mistral-7B-Instruct-v0.3, Qwen2.5-7B.
- Highest cost/latency risk: OLMo-3.1-32B and Gemma-4-31B.
- No hosted-provider price change or routing change was made. Actual latency and cost must be measured with the same retrieval context before promotion.

## Approval Requirements Before Promotion

1. Create or locate the fixed creator-rights golden set and commit its path into the monitor docs.
2. Run the golden set against the incumbent and proposed candidate with deterministic scoring.
3. Legal/governance approval that license terms, acceptable-use terms, provenance, and payout compatibility are equal or cleaner than the incumbent.
4. Technical approval for hosting/runtime cost, latency, observability, rollback, and failure handling.
5. Integration-captain approval before any app default, hosted model setting, n8n flow, or production route changes.

## Rollback Path

If a future candidate is promoted and regresses, revert the model-routing/config change to `allenai/Olmo-3-7B-Instruct`, rerun the creator-rights golden set plus `npm run source-protocol:smoke`, verify no payout receipt schema changes were introduced, and document the regression in the next model-review packet before re-opening promotion.

## Validation

- `npm run source-protocol:smoke` passed in dry-run mode.
- `npx vitest run lib/source-respecting-llm-protocol.test.ts` passed: 7 tests.

## Next Run Focus

- Add or locate the fixed creator-rights golden set.
- Run Qwen3-4B-Instruct-2507, Ministral-3-8B-Instruct-2512, Phi-4-mini-instruct, and OLMo-3.1-32B-Instruct through the deterministic gate once the golden set exists.
- Capture real local or hosted latency/cost data using the same retrieval context.
