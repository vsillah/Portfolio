# Agent Operations Rollout

The Portfolio admin remains the control plane. Codex and n8n stay as the primary operating backbone, while Hermes is added as a secondary runtime after shared run tracing is available. OpenCode/OpenClaw are deferred until their work can be observed, audited, and rolled back through the same trace model.

## Runtime Model

Supported runtimes:

- `codex` — primary engineering and repo-aware operator.
- `n8n` — production workflow runtime for webhooks, schedules, integrations, and automation.
- `hermes` — secondary local runtime for critique, research, gateway, and parity experiments.
- `opencode` — deferred coding worker runtime for isolated review and worktree experiments.
- `manual` — human-triggered admin actions and approvals.

Supported run statuses:

- `queued`
- `running`
- `waiting_for_approval`
- `completed`
- `failed`
- `cancelled`
- `stale`

## Control Plane Shape

The first version adds an Agent Operations console under `/admin/agents`. It reads generic agent trace tables instead of building a custom dashboard for every workflow. Existing workflow-specific pages remain live during the rollout.

The shared trace tables are:

- `agent_registry`
- `agent_runs`
- `agent_run_steps`
- `agent_run_events`
- `agent_run_artifacts`
- `agent_handoffs`
- `agent_approvals`

Costs are linked through `cost_events.agent_run_id`.

## Rollout Sequence

1. Add the shared schema, helper library, and admin APIs.
2. Add `/admin/agents`, `/admin/agents/runs`, and `/admin/agents/runs/[runId]`.
3. Instrument outreach generation as the first production slice.
4. Pass `agent_run_id` into app-triggered n8n payloads as workflows are updated.
5. Register Hermes as a supported runtime for low-risk local tasks.
6. Add approval gates for publishing, outbound email, production data writes, config changes, and public content derived from private material.
7. Evaluate OpenCode/OpenClaw only after the shared trace layer can observe one test run.
8. Gradually migrate older workflow run tables into the shared model where it reduces duplication.

## Safety Rules

- New agent work should create an `agent_run` before doing meaningful work.
- External side effects should be represented by either an `agent_run_event`, an `agent_run_artifact`, or an `agent_approval`.
- Runtime-specific pages may keep their existing tables, but new generic visibility should flow through `/admin/agents`.
- Hermes and OpenCode should not mutate production data in v1 without a pending approval checkpoint.
