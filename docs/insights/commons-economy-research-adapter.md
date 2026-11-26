# Commons Economy Map research-index adapter

Status: Phase 5 preparation only. No research skin has been authored, published, or connected to a live model.

## Lane binding

- Portfolio base: `0f0561741b8f17d44ef66495ff35e18697f53954`
- Branch: `claude/commons-economy-research-index`
- Worktree: `/Users/vambahsillah/.codex/worktrees/commons-economy-research/Portfolio`
- Commons producer branch: `claude/commons-economy-map`
- Commons producer checkpoint: `2c0ce0c`
- Lane classification: `Independent`
- Open-PR overlap: none across the intended Insights index, dashboard route, frame, source register, or QA harness
- High-conflict surface: `components/insights/EquityInsightFrame.tsx`; captain review is required before integration

## Existing Portfolio frame

Portfolio owns the AmaduTown research index in this repository:

- `app/insights/page.tsx` is the shared Insights index.
- `app/insights/[equityInsight]/page.tsx` owns the three Equity Code routes.
- `components/insights/EquityInsightFrame.tsx` embeds each same-origin authored dashboard and synchronizes the site theme and frame height.
- `public/insights/equity-code/` contains the exact Claude-authored HTML artifacts.
- `docs/insights/equity-code-source-register.md` and `scripts/qa/equity-code-source-integrity.test.ts` preserve authorship and hashes.
- `scripts/qa/equity-code-insights-review.cjs` exercises the index, interactions, responsive widths, reduced motion, and MP4 evidence.

The current Insights index contains Revenue Plumbing Map, The Compounding Graph, Home Front Ledger, and Owning the Block. The Commons Economy Map should become a fifth card and a fourth dashboard in the shared Equity Code-style frame only after the adapter is bound to the canonical Commons model.

## Non-duplication contract

The research skin must never maintain its own authored copy of a node, flow, caption, layer, walkthrough, responsibility, correction rule, source, or boundary stamp.

Phase 5 should define a transport-neutral consumer contract for the deterministic payload produced by `src/commons/economy-model.ts` in `rotla-immersive`. The consumer must:

1. accept one canonical serialized model envelope;
2. require the model version and a stable payload hash;
3. reject missing, unknown, stale, malformed, or hash-mismatched envelopes before rendering;
4. derive every visible label, relationship, control, walkthrough, and caption from the envelope;
5. keep theme, layout, legend, interaction state, and responsive presentation in the Portfolio skin only;
6. provide no fallback model, copied fixture, or independently authored production data;
7. use schema-shaped synthetic test fixtures that test validation behavior without reproducing the canonical Commons values; and
8. link back to `/commons/economy` once Phase 6 supplies a verified cross-repository destination.

The transport itself is a Phase 6 decision. Phase 5 must not silently choose a package registry, Git submodule, copied JSON file, runtime network fetch, provider integration, or build-time filesystem dependency.

## Phase 5 authored surface

Claude's implementation checkpoint should be limited to the research skin and adapter boundary. Expected files are:

- a new adapter/validator owned by the Insights surface;
- a new Claude-authored dashboard artifact or component that renders only validated injected model data;
- the Insights index card and route registration;
- frame typing needed to admit the new route;
- focused route, adapter, accessibility, interaction, and responsive tests;
- source-register and QA-harness additions that bind the returned artifact and preserve authorship.

The skin should reuse the research area's page frame, responsive legend and filter conventions, keyboard model, theme synchronization, and source/methodology disclosure pattern. It must retain the Commons model's fictional/proposed/TBD boundaries, privacy-by-altitude behavior, three separately toggled flow inks, layer defaults, label toggle, node clipping, claim links, and meal/dollar/vote walkthroughs.

## Validation gate

Before the Phase 5 checkpoint is accepted:

- the Portfolio base and branch binding must remain exact;
- the Commons payload used for validation must be generated from the accepted canonical producer checkpoint, never retyped;
- adapter rejection tests must cover version, hash, schema, missing-boundary, and extra-enum failures;
- every rendered semantic value must be traceable to the accepted envelope;
- desktop, tablet, mobile, keyboard, forced-colors, reduced-motion, theme, print, and no-horizontal-overflow checks must pass;
- all existing Insights routes and interactions must remain unchanged;
- the source register must distinguish Claude-authored presentation from the canonical Commons data producer; and
- no provider, deployment, publication, real-data, or external-network action may occur.

## Current stop

The worktree and adapter boundary are ready. Authored Phase 5 UI work has not started because the project requires Claude's actual implementation and the current authorization prohibits incurring charges. A new bounded Claude usage authorization is required before that design session can run.
