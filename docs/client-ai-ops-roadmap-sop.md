# Client AI Ops Roadmap SOP

This is the operating guide for selling, implementing, monitoring, and improving client-owned AI Ops stacks.

## Operating Principles

- The client owns the hardware, accounts, credentials, project data, and production approvals.
- AmaduTown access is named, revocable, and limited to startup, maintenance, monitoring, and approved changes.
- Proposal roadmap snapshots are fixed at send time. Later registry or pricing changes become upgrade recommendations, not silent proposal edits.
- Production technology swaps require approval before implementation.
- Smoke-test records stay available until a manual cleanup pass is approved. Do not reuse real client records for tests without approval.

## Sales Stage

1. Start from the sales or proposal context and generate the Implementation Roadmap & Startup Costs panel.
2. Review all phase tasks, startup costs, monthly operating costs, setup labor, and client responsibilities.
3. Refresh any technology registry item marked `needs_review`, `stale`, `quote_required`, or `source_unavailable` before sending a proposal.
4. Edit the roadmap estimate when the client has known constraints such as Mac-only, Windows-only, on-prem only, limited budget, or existing MDM/VPN tooling.
5. Attach the roadmap snapshot to the proposal only after costs and assumptions are clear enough for the client to understand the real startup burden.

## Delivery Stage

1. When a proposal is accepted or a client project is created, create the project roadmap if it does not already exist.
2. Project client-visible responsibilities into Client Dashboard tasks.
3. Project AmaduTown delivery tasks into Meeting Tasks.
4. Confirm each task has a phase, owner, due date when available, status, and source badge.
5. Keep internal traces, private logs, admin-only notes, credentials, and agent execution details out of the client dashboard.

## Monitoring Stage

The daily monitor runs through `/api/cron/client-ai-ops-monitor`.

- Vercel production cron uses `GET` with `Authorization: Bearer <CRON_SECRET>`.
- n8n/manual triggers can still use `POST` with `Authorization: Bearer <N8N_INGEST_SECRET>`.
- The monitor checks active and approved roadmaps for overdue tasks, stale pricing, missing reports, and open monitoring findings.
- When findings exist, the monitor creates a roadmap report and an internal follow-up roadmap task.
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

## Real Client Pilot Checklist

- Select one low-risk client project with a clear owner and known tech stack.
- Refresh registry pricing for only the tools proposed for that client.
- Generate the sales roadmap and confirm startup/monthly costs with the client.
- Create the project roadmap after acceptance.
- Verify Client Dashboard tasks and Meeting Tasks match the same source roadmap.
- Run the monitor once and confirm any findings become internal Meeting Tasks.
- Generate the first monthly report and review it before sending.
