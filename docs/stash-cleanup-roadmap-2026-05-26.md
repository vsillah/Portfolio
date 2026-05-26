# Stash Cleanup Roadmap - 2026-05-26

## Baseline

- Root checkout: `/Users/vambahsillah/Projects/Portfolio`
- Baseline branch: `main`
- Baseline commit: `4a0220a799aed7eca212e7cbf092557a4dae020b`
- Cleanup branch: `codex/stash-cleanup-roadmap`
- Root status at audit start: clean

Active sibling worktrees existed at audit time and are treated as unrelated lanes:

- `/Users/vambahsillah/Projects/Portfolio.worktrees/client-ai-ops-readiness-contract`
- `/Users/vambahsillah/Projects/Portfolio.worktrees/open-brain-map-filters`
- `/Users/vambahsillah/Projects/Portfolio.worktrees/subscription-watch`

## Operating Rule

Process stashes by stable stash commit hash or one-at-a-time from the top of the stack. Do not rely on `stash@{n}` labels after a stash is dropped because the labels shift.

Generated local artifacts are proposal inputs by default. Retire raw `.tmp`, `.codex-tmp`, screenshots, logs, and generated monitor payloads unless the signal is normalized into a durable doc, Agent Ops work item, Open Brain proposal, approval packet, or test fixture.

## Inventory

| Phase | Stash hash | Original label | Scope | Recommendation |
| --- | --- | --- | --- | --- |
| 1 | `4de54187b525385fcb2e79023f70108b115f2fb6` | `stash@{0}` | Visual QA screenshots under `.tmp/phase6-rollout-2-visual-qa/` | Retire as generated evidence unless a specific screenshot is still needed for proof. |
| 1 | `859266a14f82e5ef13e185ba7e392c27282ce5bd` | `stash@{1}` | Raw Vercel AutoResearch temp JSON under `.codex-tmp/` and `.tmp/` | Retire unless a normalized proposal is missing. |
| 4 | `f8e211ce672485f997deb93c577074fa29e5941d` | `stash@{2}` | Subscription monitor output in `docs/subscription-cancellation-audit.md` and `docs/subscription-status.json` | Compare against newer subscription reports. Rescue only if it fills an audit-history gap. |
| 3 | `9a98cf6f6de55d70aac90a738008ef22a387a376` | `stash@{3}` | Older Agent Ops engagement status UI/API/test slice | Verify whether current Agent Ops engagement work supersedes it; then drop or rescue missing tests only. |
| 2 | `e34e405dd541682858d84af5fd7ce78f858ae61e` | `stash@{4}` | `.gitignore` addition for `supabase/.temp/` | Rescue as a small hygiene change. |
| 3 | `2f7b1ac5c3c8f735080ac2915ff2d9af5444e760` | `stash@{5}` | Agent Ops docs plus untracked technology bakeoff files and `excalidraw.log` | Split review: drop already-landed Agent Ops note, compare bakeoff files against current repo, retire raw log unless normalized evidence is needed. |
| 5 | `dc6e093a2132cf469db02b2f0696fa775b52d84c` | `stash@{6}` | Presentation/Gamma nav consolidation and `/admin/presentations` deletion | Do not apply from stash. Keep as product decision or rebuild fresh from current UI. |
| 3 | `0bd08ce11d408acc70b91a569bdf35bfdf81b388` | `stash@{7}` | Gamma/AI layer-fit work, including untracked evaluation and presentation bakeoff files | Verify against current AI layer-fit implementation; drop if landed, rescue only unique tests/helpers. |
| 6 | `77bcce9287c20b49458db284e29e9859294dcf7d` | `stash@{8}` | Broad old WIP across chat/RAG, payments, carousel docs/assets, n8n, package lock, scheduling docs, and logo asset | Do not apply wholesale. Decompose into fresh rescue candidates. |

## Phase Plan

### Phase 0 - Safety Snapshot

Goal: create a durable inventory before modifying or dropping stashes.

Completion gate:

- Root checkout remains clean except this roadmap branch.
- Stash hashes, files, and recommendations are recorded.
- Active sibling worktrees are noted as out of scope.

### Phase 1 - Retire Generated Evidence

Goal: remove raw generated artifacts from the stash stack.

Candidates:

- `4de54187b525385fcb2e79023f70108b115f2fb6`
- `859266a14f82e5ef13e185ba7e392c27282ce5bd`

Completion gate:

- Confirm no normalized doc, approval, or test fixture depends on the raw payload.
- Drop the stashes one at a time.
- Re-list the stash stack after each drop.

### Phase 2 - Rescue Durable Hygiene

Goal: keep the useful low-risk ignore rule from the Supabase temp stash.

Candidate:

- `e34e405dd541682858d84af5fd7ce78f858ae61e`

Completion gate:

- Add `supabase/.temp/` to `.gitignore`.
- Run `git diff --check`.
- Drop the source stash after the change is committed or merged.

### Phase 3 - Retire Or Rescue Superseded Work

Goal: avoid resurrecting older implementations that have already landed in newer form.

Candidates:

- `9a98cf6f6de55d70aac90a738008ef22a387a376`
- `2f7b1ac5c3c8f735080ac2915ff2d9af5444e760`
- `0bd08ce11d408acc70b91a569bdf35bfdf81b388`

Completion gate:

- Compare each patch against current implementation.
- Drop duplicate/superseded content.
- Rescue only missing tests, docs, or helpers as fresh scoped changes.

### Phase 4 - Subscription Monitor Audit Decision

Goal: decide whether the May 17 subscription monitor payload belongs in durable history.

Candidate:

- `f8e211ce672485f997deb93c577074fa29e5941d`

Completion gate:

- Compare against current subscription audit history and status JSON.
- If useful, normalize into the current report format.
- If superseded, drop the stash.

### Phase 5 - Presentation/Gamma Product Decision

Goal: avoid accidental admin navigation regression.

Candidate:

- `dc6e093a2132cf469db02b2f0696fa775b52d84c`

Completion gate:

- Decide whether `/admin/presentations` should remain separate from Gamma Reports.
- If consolidation is still desired, rebuild from current code in a dedicated PR.
- Otherwise drop the stash.

### Phase 6 - Broad WIP Decomposition

Goal: handle the large old Agent Operations infrastructure stash without mixing unrelated features.

Candidate:

- `77bcce9287c20b49458db284e29e9859294dcf7d`

Completion gate:

- Produce a subtopic comparison: chat/RAG, payments, carousel, n8n, scheduling, assets, package lock.
- Rescue only still-relevant slices as fresh PRs.
- Drop the broad stash after all useful signal is extracted or rejected.

### Phase 7 - Closeout

Goal: leave the repo and stash stack clean.

Completion gate:

- Root checkout clean.
- Stash stack contains no stale generated artifacts or superseded WIP.
- Any rescued repo changes are merged through the Integration Captain path.
- Both Vercel contexts are verified for merged Portfolio changes:
  - `Vercel - portfolio`
  - `Vercel - portfolio-staging`

## Execution Log

- Phase 0 complete: audit roadmap created on `codex/stash-cleanup-roadmap`.
- Phase 1 complete: dropped generated-artifact stashes `4de54187b525385fcb2e79023f70108b115f2fb6` and `859266a14f82e5ef13e185ba7e392c27282ce5bd`.
- Phase 2 in progress: rescued the durable `supabase/.temp/` ignore rule from stash `e34e405dd541682858d84af5fd7ce78f858ae61e`.
