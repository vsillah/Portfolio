# Creator-Rights Model Review Monitor

## Purpose

The creator-rights model review is a separate monitor from `hermes-benchmark-monitor`.

`hermes-benchmark-monitor` focuses on local model ops, Hermes, LM Studio, and Portfolio chatbot/RAG swaps. This monitor focuses on the source-respecting LLM protocol: citation faithfulness, license provenance, creator-rights fit, and payout-accounting risk.

## Cadence

Run monthly.

Use official and primary sources where possible:

- Hugging Face model metadata and model cards
- official provider release notes
- license files
- technical reports
- known retrieval/citation benchmarks
- Portfolio golden-set results when available

## Initial Candidate Set

- `allenai/Olmo-3-7B-Instruct` as the trust-first candidate
- `Qwen/Qwen3-4B-Instruct-2507` as the cost/performance candidate
- `Qwen/Qwen2.5-7B-Instruct` as the mature Qwen fallback
- `mistralai/Mistral-7B-Instruct-v0.2` as the stable Apache fallback
- `meta-llama/Llama-3.1-8B-Instruct` as the ecosystem-performance candidate with custom-license review
- `CohereLabs/c4ai-command-r7b-12-2024` as a retrieval-style comparison candidate with noncommercial-license review

## Promotion Gates

A model replacement recommendation requires both gates:

- **Quality gate:** candidate improves or matches the incumbent on citation faithfulness, refusal discipline, quote accuracy, source coverage, latency, and cost.
- **License/governance gate:** candidate has equal or cleaner terms for nonprofit use, commercial payout, open-source distribution, and creator-rights positioning.

If either gate fails, keep the incumbent.

## Review Packet

Each monthly run should produce:

- incumbent model
- discovered candidates
- candidate license notes
- source links checked
- benchmark table
- known regressions
- cost and latency notes
- quality gate result
- license/governance gate result
- recommendation
- rollback path

The monitor may recommend a change. It must not silently alter production model routing, hosted settings, paid providers, n8n production flows, or secrets.

## Implementation Anchor

Use `buildCreatorRightsModelReview` from [`lib/source-respecting-llm-protocol.ts`](../lib/source-respecting-llm-protocol.ts) to keep the scoring gate deterministic.
