# Agent Operations Roadmap

This roadmap is the scope-control document for Agent Operations. It defines what "done" means for the work, what belongs in each phase, and what should be deferred unless Vambah explicitly changes the scope.

Portfolio admin remains the control plane. Slack remains the mobile command surface. `agent_runs`, `agent_run_steps`, `agent_run_events`, `agent_run_artifacts`, `agent_approvals`, and `cost_events.agent_run_id` remain the source of truth.

## Product Definition

Agent Operations is done when Vambah can:

- see the agent system state at a glance from `/admin/agents`,
- ask Chief of Staff what needs attention,
- run or route read-only agent work from Mission Control or Slack,
- see every agent run, handoff, artifact, approval, and cost in a traceable place,
- approve or reject side-effecting work before it touches production, clients, public channels, or private-to-public material,
- understand which agents are live, partial, planned, or deferred,
- run the same morning/standup/status workflow without needing a human to manually check multiple tools,
- hand off merge/deployment responsibility to the Integration Captain without losing traceability.

## Operating Principles

- One control plane: Portfolio admin is authoritative.
- One mobile channel: Slack is enough for v1.
- One trace model: all runtimes write into the shared agent run tables.
- Read-only first: new agents start as advisory or dispatch-only.
- Approval before mutation: publishing, sending, production writes, config changes, and private-to-public content require `agent_approvals`.
- No hidden runtimes: Hermes, OpenCode, n8n, manual, and Codex work must be observable before they become operationally important.
- Integration Captain owns merges to `main`; feature agents branch, commit, push, and stop.

## Phase Roadmap

### Phase 0: Architecture Baseline

Status: Complete.

Goal: Establish the runtime and trace model without breaking existing workflow pages.

Definition of done:

- `docs/agent-operations-rollout.md` names the architecture, runtimes, and statuses.
- Supported runtimes are `codex`, `n8n`, `hermes`, `opencode`, and `manual`.
- Supported statuses are `queued`, `running`, `waiting_for_approval`, `completed`, `failed`, `cancelled`, and `stale`.
- Existing workflow-specific admin pages remain live.

Out of scope:

- Replacing every workflow status page.
- Promoting Hermes or OpenCode as primary orchestrators.

### Phase 1: Shared Trace Foundation

Status: Complete.

Goal: Make agent work observable through shared tables and helpers.

Definition of done:

- Shared schema exists for registry, runs, steps, events, artifacts, handoffs, and approvals.
- `cost_events.agent_run_id` links usage cost to agent runs.
- `lib/agent-run.ts` supports start, step, event, artifact, completion, and failure writes.
- Helpers are retry-safe where practical through idempotency keys.
- Unit tests cover core trace helper behavior.

Out of scope:

- Migrating every historical workflow table.
- Building detailed dashboards before the trace foundation exists.

### Phase 2: Mission Control Console

Status: In review.

Goal: Turn `/admin/agents` into a first-screen command center rather than a long observability page.

Definition of done:

- `/admin/agents` shows status strip, Daily Operating Brief, Chief of Staff command, Agent Inbox, Engagement Work Queue, active/partial roster, controls, and latest activity.
- `/admin/agents/runs` lists recent and active runs.
- `/admin/agents/runs/[runId]` shows timeline, artifacts, costs, approvals, errors, and related context.
- Dense controls move into drilldowns or compact sections.
- Admin route protection is consistent with other admin pages.
- UI smoke confirms first viewport loads without server error.

Out of scope:

- A separate 3D graph or animated agent map.
- Replacing every workflow-specific admin route.
- Public-facing agent surfaces.

### Phase 3: Conversational Routing

Status: In review.

Goal: Make Chief of Staff the natural-language front door for agent work.

Definition of done:

- `/admin/agents/chief-of-staff` can answer status, blocker, priority, and next-action questions from Agent Ops context.
- Chief of Staff writes a traced `codex` run for each exchange.
- Chief of Staff can return typed agent engagement recommendations.
- Mission Control can launch recommended read-only engagements with `POST /api/admin/agents/engage`.
- Launched engagements appear in the Engagement Work Queue and run console.

Out of scope:

- Letting Chief of Staff mutate production data directly.
- Autonomous planning loops that launch multiple agents without traceable operator intent.
- Long-term memory beyond trace/artifact summaries.

### Phase 4: Agent Inbox And Work Queue

Status: In review.

Goal: Convert trace signals into a clear operating queue.

Definition of done:

- Agent Inbox derives actionable items from failed, stale, approval-waiting, high-cost, and stale-standup signals.
- Admin can route inbox items.
- Slack can list and route inbox items.
- Engagement Work Queue derives from `agent_engagement_request` traces.
- Queue items preserve source inbox item, source run, owning agent, next action, execution mode, and trace link.
- No new table is introduced unless trace-derived queue state proves insufficient.

Out of scope:

- Kanban drag-and-drop.
- Custom assignment tables.
- Queue state that does not reconcile back to `agent_runs`.

### Phase 5: Slack Mobile Command Surface

Status: In review.

Goal: Let Vambah check and route Agent Ops from Slack without adding another mobile channel.

Definition of done:

- `/agent status` summarizes active, failed, stale, approval, and cost signals.
- `/agent agents` lists mapped runnable agents.
- `/agent inbox` lists numbered Agent Inbox items.
- `/agent route <number-or-id>` routes an inbox item.
- `/agent engagements` lists the latest routed engagement queue.
- `/agent brief` returns the Daily Operating Brief.
- `/agent run <agent-key>` creates a traced read-only engagement.
- `/agent standup` and `/agent discuss <question>` write War Room traces.
- Slack signing is fail-closed when configured for production.
- Slow commands either respond within Slack expectations or use a durable delayed path.

Out of scope:

- Telegram, SMS, Discord, or other chat surfaces in v1.
- Slack actions that publish, send email, or write production data without approval.

### Phase 6: n8n Production Instrumentation

Status: Partial.

Goal: Make production automations visible through the shared trace model.

Definition of done:

- App-triggered n8n calls include `agent_run_id`.
- n8n callbacks can record progress events, completion, and structured failures.
- Outreach, social content, value evidence, and warm lead workflows have shared trace coverage where practical.
- Legacy workflow status pages remain compatible during migration.
- Failure callbacks show in Agent Inbox and run detail.

Out of scope:

- Rewriting all n8n workflows at once.
- Removing legacy workflow-specific run tables before replacement views are proven.
- Letting n8n bypass approval gates for sensitive actions.

### Phase 7: Approval-Backed Execution

Status: Partial.

Goal: Move from read-only dispatch toward safe execution where side effects are explicit.

Definition of done:

- Runtime policy is visible and test-covered.
- Approval checkpoints use `agent_approvals`, not local UI state.
- Run detail supports approval and rejection for pending checkpoints.
- Publishing, outbound email, production data writes, config changes, and private-to-public content require approval.
- Approval decisions are recorded as trace events.
- Rejected work terminates safely or returns a reviewable failure.

Out of scope:

- Background agents approving their own work.
- Implicit approval from Slack text that does not map to a specific checkpoint.
- Bulk approvals without explicit target runs.

### Phase 8: Hermes Secondary Runtime

Status: Partial.

Goal: Add Hermes as a secondary observable runtime for low-risk work.

Definition of done:

- Hermes is registered as a supported runtime.
- Hermes system health bridge creates traced `hermes` runs.
- Hermes outputs attach artifacts.
- Hermes failures write structured events.
- Hermes remains read-only for production-adjacent workflows unless an approval checkpoint exists.

Out of scope:

- Letting the web app spawn uncontrolled local Hermes processes.
- Production data mutation through Hermes in v1.
- Making Hermes the primary orchestrator.

### Phase 9: Runtime Evaluation And Tooling Parity

Status: Partial.

Goal: Evaluate OpenCode/OpenClaw and future runtimes without letting them become hidden production dependencies.

Definition of done:

- Runtime evaluation route can detect whether candidate binaries exist.
- At least one observable evaluation run writes to Agent Operations.
- Tooling parity docs explain which runtimes can access which tools.
- Any future worker runtime must prove install, auth, trace, rollback, and audit behavior before production automation.

Out of scope:

- OpenCode/OpenClaw production automation.
- Untracked local worktree mutation from the admin UI.
- Auto-installing agent runtimes from the web app.

### Phase 10: Hardening, Reporting, And Migration

Status: Complete / monitoring.

Goal: Make Agent Operations reliable enough to run as an operating system.

Definition of done:

- Stale-run detection covers all runtimes.
- Dead-letter handling exists for failed or abandoned runs.
- Cost dashboards group by runtime, agent, workflow, client/project, and artifact type.
- Morning review runs on schedule and writes a traceable report.
- Deployment watcher distinguishes Vercel queue delay from failure.
- Old workflow run tables are either migrated or documented as domain-specific detail.
- `docs/agentic-patterns.md` is updated once observability coverage is strong.

Out of scope:

- Removing working legacy tables just for architectural purity.
- Fully autonomous production remediation.
- Cost optimization that changes vendors without a bakeoff.

Current progress:

- Mission Control derives a 24-hour Cost Intelligence summary from `cost_events.agent_run_id` without adding schema or copying data.
- The first grouped view covers runtime, agent, workflow, client/project, and artifact type where trace metadata exists, with safe unassigned fallbacks.
- Source validator and dev-testing LLM surfaces now use pre-flight budget checks and Agent Ops trace linkage, completing the last known Phase 10 LLM/budget trace cleanup surfaces.

### Phase 11: Provider Resilience And Retry Hygiene

Status: Complete / monitoring.

Goal: Standardize how provider calls recover from transient n8n, LLM, and tool failures.

Definition of done:

- A shared retry/backoff helper exists for provider calls.
- n8n trigger calls use capped retry behavior for transient network and gateway failures.
- Direct LLM call sites can adopt the same helper without bespoke loops.
- Provider failures remain user-safe and traceable; implementation details stay in logs/traces.
- Retry metadata can feed dead-letter and recovery flows without introducing a separate queue table.

Out of scope:

- Retrying non-idempotent production mutations without an explicit workflow-level safety check.
- Replacing existing dead-letter visibility.
- Changing vendors, models, or workflow ownership.

Current progress:

- A reusable `lib/llm/with-retry.ts` helper is being introduced with capped exponential backoff, configurable retryable error matching, and a give-up hook for dead-letter integration.
- The first adoption targets n8n trigger calls, where transient 502/503/504 and network failures can be retried without exposing raw provider errors to users.
- Central LLM provider dispatch and the source-validator LLM judge use the shared helper, replacing bespoke retry loops where the provider call is not intentionally injected for tests/timeouts.
- Direct provider helpers for audit-from-meetings, meeting lead extraction, AI onboarding preview, delivery email drafts, meeting pain classification, in-person diagnostic insights, social carousel conversion, video prompt formatting, video ideas generation, dev testing remediation, and dev testing chat-agent calls now use a shared provider fetch wrapper.
- Mission Control surfaces the latest `agent_ops_morning_review` and `agent_ops_deployment_watch` traces as Operating Signals.
- The deployment watcher supports `--trace` so integration-captain and autopilot runs write a visible Agent Ops run/artifact.
- Stale-run detection now reports checked and marked counts by runtime across `codex`, `n8n`, `hermes`, `opencode`, and `manual` runs when those runtimes have active queued/running work.
- Legacy workflow-specific run tables are mapped in `docs/agent-operations-rollout.md` as either domain detail to keep or future trace-link migration candidates.
- `docs/agentic-patterns.md` now reflects the stronger Agent Ops observability state while preserving partial coverage notes for legacy/domain flows.
- Video generation workflow sync runs now create linked Agent Ops traces while preserving the existing domain status table for admin chips/history.
- Pre-flight budget policy helpers now define per-runtime LLM warning/cap rules and expose them through the admin policy API; enforcement remains adoption-by-adoption, not a silent global behavior change.
- Chief of Staff chat now runs a traced pre-flight budget check before dispatching its LLM call, carrying the budget decision into cost metadata and the API response.
- In-app outreach generation now checks the manual-runtime budget before email or LinkedIn LLM dispatch, records warning/block decisions in Agent Ops traces, and persists the budget decision into `outreach_queue.generation_inputs`.
- Admin delivery email draft generation now starts a manual Agent Ops trace, checks the manual-runtime budget before OpenAI dispatch, and links post-hoc OpenAI cost events back to the trace.
- Admin meeting lead extraction now starts a manual Agent Ops trace, checks the manual-runtime budget before OpenAI dispatch, and links lead-extraction cost events back to the trace.
- AI onboarding preview generation now creates a traced manual Agent Ops run from the admin preview endpoint, checks the manual-runtime budget before OpenAI dispatch, and links generated cost events to the trace when available.
- Admin audit-from-meetings generation now starts a manual Agent Ops trace, checks the manual-runtime budget before OpenAI dispatch, and links diagnostic-extraction cost events back to the trace.
- Admin video prompt formatting now starts a manual Agent Ops trace, checks the manual-runtime budget before OpenAI dispatch, and links prompt-formatting cost events back to the trace.
- Admin video ideas generation now starts a manual Agent Ops trace, checks the manual-runtime budget after context assembly and before GPT-4o dispatch, and links idea-generation cost events back to the trace.
- Admin social carousel conversion now starts a manual Agent Ops trace, checks the manual-runtime budget before GPT-4o dispatch, and links carousel-generation cost events back to the trace.
- Admin in-person diagnostic insights now start a manual Agent Ops trace, check the manual-runtime budget before GPT-4o-mini dispatch, and link insight-generation cost events back to the trace.
- Admin meeting pain classification now starts a manual Agent Ops trace, checks the manual-runtime budget before GPT-4o-mini fallback classification, and links AI fallback cost events back to the trace.
- Admin Chat Eval LLM judge evaluation now starts a manual Agent Ops trace, checks the manual-runtime budget before Anthropic/OpenAI dispatch, and links judge cost events back to the trace.
- Admin Chat Eval axial-code generation and error diagnosis now start manual Agent Ops traces, check budget before Anthropic/OpenAI dispatch, and link cost events back to the trace.
- Value Evidence source validation and dev testing LLM helpers now run pre-flight budget checks before direct provider calls.
- Failed, stale, and cancelled Agent Ops traces can now create a read-only recovery request with retry attempt, backoff, earliest-retry metadata, and an attached recovery packet. This routes dead-letter work without re-running production automation from Mission Control.

### Phase 12: Operational Recovery Hygiene

Status: In progress.

Goal: Make recovery and dead-letter handling durable enough for daily use without creating duplicate queues or bypassing approval gates.

Definition of done:

- Recovery requests respect their backoff windows and do not create duplicate retry packets while a prior recovery is still waiting.
- Mission Control clearly distinguishes unrouted failures from failures that already have recovery work in motion.
- Stale and failed traces remain trace-derived; no separate dead-letter table is introduced.
- Recovery requests remain read-only and never re-run production automation directly.
- Focused tests cover duplicate recovery prevention, expired backoff windows, and recoverable status boundaries.

Out of scope:

- Fully autonomous remediation.
- Retrying production workflows from the web app without workflow-specific safety checks.
- Adding a separate queue table for dead-letter state.

Current progress:

- Recovery request creation now checks prior `agent_recovery_request` traces for active `earliest_retry_at` windows and returns a conflict response instead of creating duplicate packets during backoff.

## Cross-Phase Definition Of Done

Every implementation phase must satisfy these gates before it is considered done:

- Source of truth: New operational state is trace-backed or explicitly documented as derived.
- UI: Admin can see the state or action without digging through raw logs.
- Slack: If the workflow is mobile-relevant, Slack has a read-only command or clear reason for deferral.
- Tests: Focused tests cover happy path, auth boundaries, malformed input, and failure behavior.
- Type/build: Typecheck and production build pass, or failures are documented as pre-existing blockers.
- Browser smoke: `/admin/agents` or the touched admin surface loads in the integrated browser.
- Audit: Runs, approvals, events, and artifacts link back to a trace ID.
- Safety: Side effects are approval-gated.
- Integration: Work is on a named branch or PR, not merged directly to `main` by a non-captain chat.
- Deployment: Integration Captain verifies both `portfolio` and `portfolio-staging`.

## Scope Creep Rules

The following require an explicit scope-change decision before implementation:

- Adding a new chat channel beyond Slack.
- Adding a new database table for queue state.
- Adding autonomous multi-agent loops that launch more than one agent from one operator request.
- Letting any runtime write production data outside a known workflow.
- Letting Hermes or OpenCode mutate files or data from the web app.
- Replacing legacy workflow pages.
- Building visual graph/3D/animation-first views.
- Adding new vendor/model/runtime dependencies without a bakeoff.
- Moving merge/deploy authority away from the Integration Captain.

## Current Review Stack

These are the current known Agent Operations PR dependencies:

- PR #125: Agent Inbox routing.
- PR #127: Engagement Work Queue.

Integration order:

1. Merge PR #125.
2. Retarget or merge PR #127.
3. Rebase this roadmap branch if needed.
4. Verify `portfolio` and `portfolio-staging`.

## Next Three Build Phases

1. Queue affordances: filters, owner/next-action clarity, and a focused queue drilldown if the overview becomes crowded.
2. Approval-backed execution: convert recommended side effects into approval checkpoints with explicit action payloads.
3. n8n trace expansion: make the highest-value automation workflows report progress and failure into Agent Operations consistently.
