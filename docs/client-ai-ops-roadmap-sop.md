# Client AI Ops Roadmap SOP

This is the operating guide for selling, implementing, monitoring, and improving client-owned AI Ops stacks.

## Operating Principles

- The client owns the hardware, accounts, credentials, project data, and production approvals.
- The roadmap must choose where the client data store, local LLM repository, and always-on worker runtime live: client-owned Mac mini/PC node, cloud runtime, or hybrid local/cloud fallback.
- AmaduTown access is named, revocable, and limited to startup, maintenance, monitoring, and approved changes.
- The roadmap is the shared source of truth. Client Dashboard tasks and admin Meeting Tasks are projections of the same roadmap task records, not separate parallel plans.
- Every roadmap must include implementation, reporting, monitoring, and tracking. Treat reports, monitor findings, task projections, and cost assumptions as part of the roadmap deliverable.
- Proposal roadmap snapshots are fixed at send time. Later registry or pricing changes become upgrade recommendations, not silent proposal edits.
- Production technology swaps require approval before implementation.
- Smoke-test records stay available until a manual cleanup pass is approved. Do not reuse real client records for tests without approval.

## Sales Stage

1. Start from the sales or proposal context and generate the Implementation Roadmap & Startup Costs panel.
2. Review all phase tasks, startup costs, monthly operating costs, setup labor, and client responsibilities.
3. Refresh any technology registry item marked `needs_review`, `stale`, `quote_required`, or `source_unavailable` before sending a proposal.
4. Edit the roadmap estimate when the client has known constraints such as Mac-only, Windows-only, on-prem only, limited budget, or existing MDM/VPN tooling.
5. Confirm whether 24/7 access is expected from client-owned hardware, a cloud runtime, or hybrid fallback before presenting startup and monthly costs.
6. Attach the roadmap snapshot to the proposal only after costs and assumptions are clear enough for the client to understand the real startup burden.

## Delivery Stage

1. When a proposal is accepted or a client project is created, create the project roadmap if it does not already exist.
2. Project client-visible responsibilities into Client Dashboard tasks.
3. Project AmaduTown delivery tasks into Meeting Tasks.
4. Confirm each task has a phase, owner, due date when available, status, and source badge.
5. Keep internal traces, private logs, admin-only notes, credentials, and agent execution details out of the client dashboard.
6. Treat local-device setup, cloud provisioning, remote access, and runtime configuration as approval-gated implementation work.
7. If a roadmap task changes status from the client dashboard or meeting task queue, sync the status back to the source roadmap task and refresh phase rollups.

## Monitoring Stage

The daily monitor runs through `/api/cron/client-ai-ops-monitor`.

- Vercel production cron uses `GET` with `Authorization: Bearer <CRON_SECRET>`.
- n8n/manual triggers can still use `POST` with `Authorization: Bearer <N8N_INGEST_SECRET>`.
- The monitor checks active and approved roadmaps for overdue tasks, stale pricing, missing reports, and open monitoring findings.
- When findings exist, the monitor creates a roadmap report and an internal follow-up roadmap task.
- The monitor also records the AI Ops readiness contract status in the monitoring summary. If readiness needs approval or connector decisions, it can create the same internal monitoring review without attempting live setup.
- Monitoring follow-up tasks are also projected into Meeting Tasks so the admin work queue shows the issue immediately.

## Technology Registry

The first registry seed is intentionally conservative. Pricing snapshots start as `needs_review` because live vendor pricing must be checked near the proposal date.

Use the registry to compare:

- cost and pricing freshness,
- stack fit,
- spin-up speed,
- integration complexity,
- governance and security fit,
- monitoring support,
- data ownership fit,
- rollback burden.

Better-scoring alternatives should create upgrade recommendations. They should not trigger automatic production swaps.

## Monthly Reporting

Monthly reports should separate:

- client action,
- AmaduTown action,
- approval needed,
- cost movement,
- stale pricing,
- blocker status,
- monitoring findings,
- upgrade recommendations.

Client-facing summaries should be understandable and avoid exposing private logs, agent traces, credentials, or internal-only notes.

## Roadmap Projection Status

The client roadmap read model exposes a compact projection status for dashboards and admin monitoring. It is derived from existing roadmap tasks, org-board metadata, cost items, and the latest roadmap report.

Projection status may show:

- total and completed client-visible tasks,
- blocked tasks,
- open client, AmaduTown, and shared actions,
- approval-gated and isolation-required work counts,
- overdue task and stale cost counts from the latest monitor report,
- whether the first report is missing,
- the next reporting action.

Keep this projection read-only. It can recommend follow-up, escalation, cost refreshes, or approval review, but it must not create credentials, connect OAuth, activate workflows, send outbound messages, publish client-facing reports, mutate client data, or change production configuration without the normal approval path.

## Connector Readiness

Connector readiness is part of the roadmap snapshot and client/admin read model. It uses the shared connector catalog and source precedence from Agent Swarm Board work:

1. Admin/client-verified tech stack.
2. Audit tech stack and audit enrichment.
3. Meeting-derived audit notes.
4. BuiltWith/domain lookup.
5. Roadmap/client project metadata.

Connector readiness may show required connectors, ready connectors, approval-blocked connectors, missing critical connectors, detected providers, and the next setup action. Treat these as planning signals only. OAuth, API keys, service accounts, webhook setup, workflow activation, outbound sends, publishing, production deploys, and client-data mutation remain approval-gated.

## Synthetic Pilot Fixture

Use `buildSyntheticClientAiOpsPilot` from `lib/client-ai-ops-synthetic-pilot.ts` as the no-side-effect regression path for new roadmap, connector, and swarm-board changes. It proves the current MVP flow with synthetic data only:

1. Audit and verified stack signals produce connector readiness.
2. The roadmap snapshot carries connector readiness into the client/admin read model.
3. The swarm board can project the same synthetic client into the correct operational column.
4. Discovery, technology decision, provisioning planning, and QA handoffs stay autonomous only for read-only work.
5. Credential sync, live OAuth/API setup, outbound sends, provider writes, deploys, publishing, and client-data mutation route to approval boundaries.

The fixture is not a seed script and must not create client records, credentials, OAuth connections, provider resources, live workflows, outbound messages, or production configuration.

## Readiness Contract

Use `buildClientAiOpsReadinessContract` from `lib/client-ai-ops-readiness-contract.ts` when an admin/API surface needs a compact readiness packet. The contract summarizes connector readiness, roadmap projection status, optional swarm-board health, and fixed approval boundaries while keeping `sideEffectsEnabled` false.

`GET` and `POST` on `/api/admin/client-projects/[id]/ai-ops` return this readiness packet alongside the existing roadmap response. Consumers should treat it as a read-only decision surface. It can tell an admin what needs approval or planning next, but it must not be used as permission to connect OAuth, sync credentials, call providers, send outbound messages, deploy production changes, or mutate client data.

The Client Dashboard should only show a client-safe setup readiness summary derived from the roadmap and connector read model. It may show readiness status, next action, connector counts, approval counts, isolation checks, and that live setup remains locked until approved. It should not expose internal swarm columns, agent traces, private approval packets, credential details, or provider implementation internals.

## Roadmap Rule Checklist

Use this checklist whenever a roadmap feature, monitor, report, or client implementation phase changes:

- One shared roadmap object exists for the client project.
- Client-visible roadmap tasks appear in the Client Dashboard.
- AmaduTown/internal roadmap tasks appear in Meeting Tasks.
- Status updates from either projection sync back to the roadmap task.
- Phase rollups and cost summaries refresh after task or cost changes.
- The monitor can create a roadmap report and follow-up task when drift, stale pricing, missing reports, or blockers appear.
- The monitor records readiness status, next action, connector counts, and side-effect lock state in monitoring summaries.
- Roadmap projection status is visible from the same source data and remains read-only.
- Connector readiness is visible from verified stack, audit, BuiltWith, and roadmap signals without live credential setup.
- The synthetic pilot fixture still proves audit-to-roadmap-to-client/admin projection and read-only autonomous handoff boundaries.
- The admin AI Ops readiness contract stays present and keeps `sideEffectsEnabled` false.
- The client dashboard shows setup readiness without exposing internal swarm traces or credential/provider details.
- Client-facing output excludes private logs, agent traces, credentials, and internal-only notes.

## Real Client Pilot Checklist

- Select one low-risk client project with a clear owner and known tech stack.
- Refresh registry pricing for only the tools proposed for that client.
- Generate the sales roadmap and confirm startup/monthly costs with the client.
- Create the project roadmap after acceptance.
- Verify Client Dashboard tasks and Meeting Tasks match the same source roadmap.
- Run the monitor once and confirm any findings become internal Meeting Tasks.
- Generate the first monthly report and review it before sending.
