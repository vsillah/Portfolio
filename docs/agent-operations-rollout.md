# Agent Operations Rollout

The Portfolio admin remains the control plane. Codex and n8n stay as the primary operating backbone, while Hermes is added as a secondary runtime after shared run tracing is available. OpenCode/OpenClaw are deferred until their work can be observed, audited, and rolled back through the same trace model.

## Runtime Model

Supported runtimes:

- `codex` — primary engineering and repo-aware operator.
- `n8n` — production workflow runtime for webhooks, schedules, integrations, and automation.
- `hermes` — secondary local runtime for critique, research, gateway, and parity experiments.
- `opencode` — deferred coding worker runtime for isolated review and worktree experiments.
- `manual` — human-triggered admin actions and approvals.

The standing operating role for site health, chatbot accuracy, scenario testing, and failure triage is the [Portfolio Operations Manager](./portfolio-operations-manager.md). It runs as an external Codex automation first and uses this Agent Operations control plane for visibility and approvals as deeper integration is added.

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

The console now includes an Agent Engagement roster so the operating model is visible from the same place as the traces:

- Portfolio Operations Manager — n8n/Codex morning review, stale-run cleanup, Slack notification, and health artifact.
- Hermes Health Analyst — read-only secondary runtime summary.
- Outreach Generation Agent — traced outreach drafts and cost-linked LLM usage.
- Value Evidence Agent — n8n evidence/listening workflows and generated reports.
- Approval Steward — manual approval checkpoints stored in `agent_approvals`.
- Slack Command Path — planned mobile-friendly command surface for read-only checks and approval-routed actions.

It also includes an Agent Organization Map that aligns the target operating model to the active n8n workflow families. The typed source of truth for that map is `lib/agent-organization.ts`, with org-level registry rows seeded by `migrations/2026_05_01_agent_organization_registry.sql`.

Current pod alignment:

- Chief of Staff — Agent Ops morning review and executive escalation layer.
- Strategy & Narrative — planned Codex/Hermes-first agents; not primarily n8n yet.
- Research & Knowledge — lead research, RAG, diagnostics, value evidence, source register workflows.
- Content Production — social extraction, repurposing, audio/image regeneration, brand/course agents.
- Product & Automation — client workflow backbone, monitoring, provisioning, task sync, tooling parity.
- Publishing & Follow-Up — social publish, outbound/follow-up, Gmail draft, nurture, Slack and meeting intake.

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

## Agent Ops Morning Review

Use `POST /api/cron/agent-ops-morning-review` with `Authorization: Bearer N8N_INGEST_SECRET` to run the daily no-human-in-the-loop review. The route:

- creates a traceable `n8n` runtime run,
- sweeps stale queued/running agent runs,
- builds the Agent Operations health summary,
- attaches an `agent_ops_morning_review` artifact,
- optionally posts a Slack summary when `SLACK_AGENT_OPS_WEBHOOK_URL` is configured.

Recommended schedule: n8n Cloud weekday morning trigger, owned by the automation layer. Slack remains a notification surface only; Portfolio admin and `agent_runs` remain the source of truth.

Admin operators can also trigger the same review with `POST /api/admin/agents/morning-review` or the **Run morning review** button on `/admin/agents`. This path requires admin auth and uses `trigger_source = admin_agent_ops_morning_review`.

The n8n import artifact lives at `n8n-exports/WF-AGENT-OPS-MORNING-REVIEW.json`. Keep it inactive until the n8n Cloud variables are confirmed:

- `AMADUTOWN_PUBLIC_BASE_URL=https://amadutown.com`
- `N8N_INGEST_SECRET=<same bearer secret configured in Portfolio>`

## Slack Agent Command

Configure the Slack slash command `/agent` to call `POST /api/slack/agent`. The production request URL is:

- `https://amadutown.com/api/slack/agent`

The route verifies Slack signatures with `SLACK_SIGNING_SECRET` when configured and returns ephemeral responses. Supported commands:

- `/agent status` — active runs, failed/stale counts, pending approvals, and cost-event activity.
- `/agent failed` — latest failed or stale agent runs with links back to Agent Operations.
- `/agent approvals` — pending approval checkpoints with run links.
- `/agent morning-review` — runs the approved Agent Ops morning review path with `trigger_source = slack_agent_ops_command`.
- `/agent agents` — lists active and partial agent organization entries with their engagement keys.
- `/agent run <agent-key>` — creates a traceable `manual` runtime engagement request in `agent_runs` without mutating production workflow data.

Slack is an engagement surface, not the source of truth. The admin console and shared trace tables remain authoritative.

## Chief of Staff Chat

The first conversational agent surface is `/admin/agents/chief-of-staff`.

- It is admin-only.
- It reads current Agent Operations context: active runs, recent failed/stale runs, pending approvals, and cost events.
- It creates a traced `codex` runtime `agent_run` for every exchange.
- It uses `CHIEF_OF_STAFF_AGENT_MODEL` when set, otherwise `gpt-4o-mini`.
- V1 is read-only. It can recommend next actions and approval paths, but it does not mutate production workflows, send messages, publish content, or change configuration.

## Safety Rules

- New agent work should create an `agent_run` before doing meaningful work.
- External side effects should be represented by either an `agent_run_event`, an `agent_run_artifact`, or an `agent_approval`.
- Runtime-specific pages may keep their existing tables, but new generic visibility should flow through `/admin/agents`.
- Hermes and OpenCode should not mutate production data in v1 without a pending approval checkpoint.
