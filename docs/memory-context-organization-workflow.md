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

## Operating Boundary

The dashboard may show that local operational state is missing or incomplete. It should not repair that state by itself.

Allowed:

- Read local automation metadata server-side.
- Sanitize and summarize prompts.
- Flag missing workspace roots, missing docs, missing authority boundaries, duplicates, and context gaps.
- Show progress and task status computed from the inventory.

Not allowed in this workflow without an explicit operational-state step:

- Editing `~/.codex/automations`.
- Editing `~/.codex/memories`.
- Updating Codex SQLite thread state.
- Rewriting Codex Desktop workspace roots.
- Pausing, deleting, creating, or rescheduling automations.
