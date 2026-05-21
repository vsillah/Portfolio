# Agentic OS Client Advisory Explainer

## Positioning

We do not sell agents that operate without boundaries. We build governed agent operating systems.

The client promise is practical confidence: every agent has a role, every role has a scope, every delegation has a reason, every side effect has an approval path, every dollar has a gate, and every action leaves a trace.

## What Clients Can Validate

- Which agents exist and what each one is responsible for.
- What data classes, tools, and write authority each agent can use.
- How Shaka routes work to specialist agents.
- Which actions require approval before external side effects can happen.
- Whether payment, refund, subscription, vendor spend, paid API, or paid external job actions are gated.
- Where the audit evidence lives without exposing raw private logs.

## Client-Safe Export Boundary

The governance export is designed for review, not raw discovery. It includes scope summaries, delegation trace references, payment authority gates, and pending authority checkpoints.

It excludes raw prompts, private run logs, secrets, credentials, private reasoning, private source material, and sensitive records. Operators can use the trace references to inspect full evidence inside Portfolio Admin when they have the right permission.

Exports can be scoped with query parameters when a client or internal reviewer only needs one slice of evidence:

- `runId` for one Agent Ops trace. Use the Agent Ops run UUID.
- `clientProjectId` for one client/project lane.
- `from` and `to` for a date window.

The scope filters affect delegation and authority evidence. The capability inventory remains included so the reviewer can see the governing role boundaries behind the filtered trace.

## Advisory Talk Track

Most organizations do not need more automation first. They need a way to know what the automation is allowed to do.

Our approach starts with the operating model:

- name the agent,
- define its scope,
- route work through Shaka,
- require approvals for side effects,
- gate payment authority,
- and preserve the audit trail.

That lets a nonprofit, small business, or executive team adopt AI agents without guessing whether the system is acting inside the boundaries they intended.
