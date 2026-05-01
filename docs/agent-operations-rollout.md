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

## n8n Callback Contract

App-triggered n8n workflows should receive both the existing workflow-specific `run_id` and the shared `agent_run_id`. The legacy ID keeps existing workflow pages working; `agent_run_id` lets n8n report into Agent Operations.

Supported callback conventions:

- Progress callbacks include `agent_run_id`, `workflow_id`, `stage`, `status`, and optional item counts.
- Completion callbacks include `agent_run_id`, `run_id`, `workflow_id`, `status`, optional item counts, and `error_message` on failure.
- Generic callbacks can write events with `POST /api/admin/agents/runs/[runId]/events` using `N8N_INGEST_SECRET`.
- Generic status updates can use `PATCH /api/admin/agents/runs/[runId]` using `N8N_INGEST_SECRET`.

Current n8n trace coverage:

- Social content extraction creates an `n8n` run, dispatches `agent_run_id`, and completes/fails the shared run from the n8n completion callback.
- Value evidence workflows create an `n8n` run, dispatch `agent_run_id`, record progress stages, preserve auto-chained VEP-001 to VEP-002 behavior, and complete/fail the shared run after the final phase.
- Warm lead scrapers create an `n8n` run, dispatch `agent_run_id`, and can complete/fail the shared run when the n8n completion callback echoes the ID.

## Hermes Bridge

The first Hermes slice is read-only: `POST /api/admin/agents/hermes/system-health`.

It creates a `hermes` runtime run, collects operational health signals, records steps/events through the shared agent run tables, and attaches a system health summary artifact. The deployed app does not spawn a local Hermes process; this bridge establishes the trace and governance contract that Hermes Gateway can call later.

Current safety constraints:

- No production writes beyond agent trace tables.
- No external publishing, email sending, or client-data mutation.
- Metadata marks the run as `bridge_read_only`.
- Future Hermes write actions must go through `agent_approvals`.

## Runtime Policy And Approval Gates

Runtime policies live in `lib/agent-policy.ts` and are shown in `/admin/agents`.

Policy dimensions:

- file reads
- file writes
- external API calls
- client-data access
- production data writes
- actions requiring approval

Approval gates are represented in `agent_approvals`, not ad hoc UI state. Pending approvals move eligible runs into `waiting_for_approval`; approving the last pending checkpoint returns the run to `running`; rejecting or cancelling a checkpoint terminates the run as `failed` or `cancelled`.

Current required approval gates:

- publishing
- sending email
- database writes outside known workflows
- production config changes
- public content derived from private material

Slack should be treated as a notification and lightweight decision surface later. The source of truth remains Portfolio admin plus `agent_approvals`.

## Approval Drill

Use `POST /api/admin/agents/approval-drill` or the **Approval Drill** card on `/admin/agents` to create a disposable `manual` runtime run with a pending approval checkpoint. This verifies that:

- pending approvals appear on the run detail page,
- the run starts in `waiting_for_approval`,
- approve/reject decisions write through `agent_approvals`,
- rejected drills terminate without touching a production workflow.

## OpenCode/OpenClaw Evaluation

Use `POST /api/admin/agents/runtime-evaluation` or the **Runtime Evaluation** card on `/admin/agents` to create an observable `opencode` runtime evaluation run. The v1 probe is deliberately side-effect free: it checks whether `opencode`, `openclaw`, or `opencode-ai` is available on `PATH`, records the result as a step and artifact, and fails the run when no executable is installed.

This keeps OpenCode/OpenClaw out of production automation until installation, auth, rollback, and audit behavior are proven through Agent Operations.

## Stale Run Sweep

Use `POST /api/admin/agents/runs/stale-sweep` or the **Sweep stale** button on `/admin/agents/runs` to mark queued/running runs as `stale` when they pass `stale_after` or the default active-run threshold. Runs waiting for approval are intentionally excluded so human checkpoints do not auto-expire as infrastructure failures.

## Safety Rules

- New agent work should create an `agent_run` before doing meaningful work.
- External side effects should be represented by either an `agent_run_event`, an `agent_run_artifact`, or an `agent_approval`.
- Runtime-specific pages may keep their existing tables, but new generic visibility should flow through `/admin/agents`.
- Hermes and OpenCode should not mutate production data in v1 without a pending approval checkpoint.
