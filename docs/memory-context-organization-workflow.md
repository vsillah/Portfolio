# Memory And Context Organization Workflow

This document defines the Portfolio-facing workflow for organizing Codex memory, workspace-root visibility, automation context, and readiness reporting. It is intentionally read-only for local Codex operational state.

## Scope

Owned in this workflow:

- Portfolio Admin automation and context dashboard surfaces.
- Codex workspace-root visibility for Portfolio-related automations.
- Memory and context readiness reporting.
- Workflow docs that help future agents understand what to inspect before acting.

Outside the Portfolio git worktree:

- Direct writes under `~/.codex/memories`.
- Direct writes under `~/.codex/automations`.
- SQLite or Codex Desktop state repairs.

Any operational state write outside the repo must be called out before it happens, backed up when appropriate, and reported separately from git changes.

## Dashboard Progress Model

The Automation Context dashboard reports progress from the current read-only inventory. Progress is not a project-management database and does not create or save tasks. It is a computed readiness signal.

Current task series:

1. Automation inventory: local TOML inventory is readable.
2. Context readiness questions: every visible automation can be evaluated against the seven operating-context questions.
3. Workspace-root visibility: visible automations declare the Portfolio workspace path in `cwds`.
4. Governing docs and runbooks: visible automations reference docs, skills, source paths, or runbooks.
5. Authority boundaries: visible automations state what agents may inspect, recommend, or never do automatically.
6. Duplicate and overlap review: duplicate automation candidates are flagged for deliberate consolidation or justification.
7. Memory/context cleanup backlog: context-health status identifies remaining docs, prompts, or runbooks needed before repair work.

## Readiness Questions

Each automation is checked against these questions:

1. What does this automation protect or improve?
2. What decision does it support?
3. What does it inspect?
4. What should it never do automatically?
5. What should it produce?
6. What failure should alert Vambah?
7. What doc, skill, or runbook governs it?

Missing answers should create recommendations only. V1 does not generate final answers or write them back to TOML, memory, skills, or docs.

## Repair Packets

Repair packets turn readiness gaps into reviewable next-action packets. They are generated from the read-only inventory and should be treated as planning artifacts, not as permission to mutate Codex state.

Each packet includes:

- the automation id and source TOML file,
- priority based on risk, context health, and duplicate status,
- missing readiness questions,
- recommended context additions,
- governing doc candidates,
- and the operational boundary that no `~/.codex` memory or automation files should be edited without a separate approved operational-state step.

Use repair packets to decide which prompt, doc, skill, or runbook needs a scoped follow-up PR or an explicitly approved local-state update.

Repo-owned automation runbooks now live under [`docs/automations/`](./automations/README.md). When a repair packet points at a missing governing doc, prefer adding or updating one of those runbooks before requesting any direct `~/.codex` automation edit.

## Workspace-Root Visibility

The dashboard also surfaces a read-only Codex workspace-root report. It compares the expected Portfolio root with:

- Codex Desktop saved workspace roots,
- Codex Desktop active workspace roots,
- Codex project-order roots,
- and active non-archived thread roots grouped by `cwd`.

This report is for visibility and repair planning only. It must not rewrite `.codex-global-state.json`, `state_5.sqlite`, thread roots, or Desktop state from a Portfolio PR.

## Enhancement Impact Preflight

### Enhancement Impact Preflight

- Enhancement: Add a computed next-step task series and progress bar for Portfolio memory/context organization readiness.
- User-facing surface: `/admin/agents/automations`, under Agent Operations.
- Predicted files: `app/admin/agents/automations/page.tsx`, `lib/codex-automation-inventory.ts`, `lib/codex-automation-inventory.test.ts`, `docs/memory-context-organization-workflow.md`.
- Shared routes/APIs/tables/helpers: `lib/codex-automation-inventory.ts` and the existing `/api/admin/agents/automations` response shape; no database tables or mutating APIs.
- Active PRs or branches checked: `codex/client-ai-ops-roadmap-next` PR 190, `codex/subscription-watch-next` PR 191, `codex/credential-reporting-next` PR 192, `codex/vercel-build-observability` worktree.
- Dirty worktree files checked: current `codex/memory-organization-next` worktree was clean before implementation.
- Overlap rating: green.
- Coordination decision: Proceed in the dedicated memory organization worktree; do not touch Agent Ops, Client AI Ops, credential reporting, subscription watch, or Vercel observability files.
- Merge-order note: Can merge independently after the integration captain handles active roadmap, credential, subscription, and observability branches; no shared files were identified.

Implementation update: `lib/chief-of-staff-chat.test.ts` also needed a fixture update because it imports the automation inventory contract. This was an intentional shared-helper compatibility fix, not a change to Chief of Staff behavior. The overlap rating remains green against active PRs because no active PR modifies that file or helper.

### Enhancement Impact Preflight

- Enhancement: Add read-only repair packets for automation memory/context gaps.
- User-facing surface: `/admin/agents/automations`, under Agent Operations.
- Predicted files: `app/admin/agents/automations/page.tsx`, `lib/codex-automation-inventory.ts`, `lib/codex-automation-inventory.test.ts`, `docs/memory-context-organization-workflow.md`.
- Shared routes/APIs/tables/helpers: `lib/codex-automation-inventory.ts` and the existing `/api/admin/agents/automations` response shape; no database tables or mutating APIs.
- Active PRs or branches checked: `codex/client-ai-ops-roadmap-next` PR 190, `codex/subscription-watch-next` PR 191, `codex/credential-reporting-next` PR 192, `codex/vercel-build-observability` PR 193, `cursor/regression-test-coverage-224e` PR 195.
- Dirty worktree files checked: current `codex/memory-context-repair-packets` worktree was clean before implementation.
- Overlap rating: green.
- Coordination decision: Proceed in the dedicated memory organization worktree and keep changes limited to automation context dashboard, inventory, tests, and memory workflow docs.
- Merge-order note: Can merge independently after integration-captain review; active PRs do not touch these files.

### Enhancement Impact Preflight

- Enhancement: Add repo-owned governing runbooks for automation repair packet targets.
- User-facing surface: `/admin/agents/automations` repair packets and the linked Portfolio documentation trail.
- Predicted files: `docs/automations/README.md`, `docs/automations/*-runbook.md`, `docs/automations/<automation-id>.md`, `docs/memory-context-organization-workflow.md`.
- Shared routes/APIs/tables/helpers: none; docs only.
- Active PRs or branches checked: no open PRs at implementation start; only `main` and this `codex/memory-context-runbooks` worktree were active.
- Dirty worktree files checked: current `codex/memory-context-runbooks` worktree was clean before implementation.
- Overlap rating: green.
- Coordination decision: Proceed with repo-owned docs only. Do not edit dashboard code, shared helpers, local Codex memory, or local Codex automation state.
- Merge-order note: Can merge independently after review because it adds governing docs only.

### Enhancement Impact Preflight

- Enhancement: Add read-only Codex workspace-root and active chat placement visibility to the Automation Context dashboard.
- User-facing surface: `/admin/agents/automations`, under Agent Operations.
- Predicted files: `app/admin/agents/automations/page.tsx`, `app/api/admin/agents/automations/route.ts`, `app/api/admin/agents/automations/route.test.ts`, `lib/codex-workspace-roots.ts`, `lib/codex-workspace-roots.test.ts`, `docs/memory-context-organization-workflow.md`.
- Shared routes/APIs/tables/helpers: existing `/api/admin/agents/automations` response shape; no database tables, migrations, or mutating APIs.
- Active PRs or branches checked: no open PRs at implementation start; only `main` and this `codex/workspace-root-visibility` worktree were active.
- Dirty worktree files checked: current `codex/workspace-root-visibility` worktree was clean before implementation.
- Overlap rating: green.
- Coordination decision: Proceed in the dedicated memory organization worktree. Keep the report read-only and do not edit local Codex state.
- Merge-order note: Can merge independently after review because there are no active overlapping PRs.

## Operating Boundary

The dashboard may show that local operational state is missing or incomplete. It should not repair that state by itself.

Allowed:

- Read local automation metadata server-side.
- Sanitize and summarize prompts.
- Flag missing workspace roots, missing docs, missing authority boundaries, duplicates, and context gaps.
- Show progress and task status computed from the inventory.
- Show read-only Codex workspace-root and active thread placement drift.

Not allowed in this workflow without an explicit operational-state step:

- Editing `~/.codex/automations`.
- Editing `~/.codex/memories`.
- Updating Codex SQLite thread state.
- Rewriting Codex Desktop workspace roots.
- Pausing, deleting, creating, or rescheduling automations.
