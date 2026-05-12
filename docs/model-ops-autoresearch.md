# Model Ops AutoResearch

Use this workflow to turn benchmark monitor metrics into bounded Model Ops
research proposals. The benchmark monitor remains the measurement loop; this
planner decides what to evaluate next from the current Open Brain / Model Ops
projection.

## Operating Model

V1 is planning and approval only. It does not install models, change routing,
merge branches, deploy, edit hosted provider settings, or mutate production
workflows.

```bash
npm run model-ops:snapshot
npm run model-ops:research:plan -- --repo-snapshot
npm run model-ops:research:plan -- --repo-snapshot --json
```

The planner reads the unified router status, benchmark results, RAG quality
runs, and swap requests already projected into Model Ops. It emits proposals for
the next eval iteration only when current metrics expose a gap, such as:

- expanding reply-intent evals toward the 200+ reviewed-example gate,
- expanding routed-local RAG judgments toward the 200-query gate,
- adding answer-level chatbot evals before public local-RAG cutover,
- preparing a production swap packet after gates pass.

## Approval Gate

Every proposal includes:

- proposal title,
- hypothesis,
- expected impact,
- scorecard baseline,
- touched files or settings,
- risk level,
- rollback path,
- explicit approval question,
- next metric gate.

Low-risk local eval expansion can proceed on branches or local artifacts.
Production swaps, hosted routing changes, n8n production workflow changes,
Supabase or Pinecone changes, secrets, and provider routing remain
approval-gated.

Approving a proposal authorizes only the next scoped research action. It does
not authorize merge, deployment, model installation, production default changes,
or durable Open Brain memory writes.

## Benchmark Monitor Integration

The recurring Hermes benchmark monitor should refresh Model Ops data, sync the
Portfolio snapshot, then run:

```bash
npm --prefix /Users/vambahsillah/Projects/Portfolio run model-ops:research:plan -- --repo-snapshot
```

The dated monitor report should include the proposal IDs, the chosen next
iteration, and any approval packet required before moving beyond local or shadow
testing.

## Boundaries

- Hermes + LM Studio remain the local workbench.
- The benchmark monitor owns measurement and dated reports.
- Model Ops AutoResearch owns proposal generation from current metrics.
- Open Brain remains the source of truth for router evidence and memory
  proposals.
- Portfolio remains the dashboard, review, and approval layer.
- Integration Captain owns merge and deployment sequencing.
