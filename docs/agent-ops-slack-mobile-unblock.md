# Agent Ops Slack Mobile Unblock

Slack is the mobile action surface for Agent Ops. Mission Control remains the full operating console; Slack is for quick, governed unblocks when the packet is safe enough to decide away from Portfolio.

## Slack App Configuration

- Slash command request URL: `/api/slack/agent`
- Interactivity request URL: `/api/slack/agent/actions`
- Event subscription URL: `/api/slack/agent/events`
- Required signing secret: `SLACK_SIGNING_SECRET`
- Required operator allowlist for non-local environments: `SLACK_AGENT_OPS_ALLOWED_USER_IDS`
- Existing Shaka/Event replies use the Slack bot token path already configured for Agent Ops.

`SLACK_AGENT_OPS_ALLOWED_USER_IDS` is a comma-separated list of Slack user IDs that may trigger Agent Ops mobile actions. If the allowlist is missing outside local development, the action endpoint rejects mutations.

## Allowed Mobile Actions

Slack can show Agent Ops cards for approvals, work items, blockers, and inbox entries. Safe buttons include:

- approve or decline low-risk approval packets,
- request revision,
- assign or hand off a work item,
- mark a work item ready,
- route an inbox item,
- ask Shaka for a context summary,
- open Portfolio trace, Kanban, Decision Queue, or Run Console links.

## Mobile Unblock Packet

`/agent unblock` is the first-stop mobile triage command for the Monday execution loop. It returns one compact packet across:

- pending approval checkpoints,
- blocked work items,
- review or merge candidates,
- proposed work items,
- Agent Inbox count and routing reminder,
- Mission Control, Kanban, and Run Console deep links.

The command is read-first. Its buttons reuse the same governed work-item and approval actions listed above. It can assign, hand off, mark ready, acknowledge blockers, ask Shaka, or route to Portfolio, but it does not merge, deploy, activate n8n, publish, send, change credentials, mutate customer data, touch payments, or change production config.

## Governance Boundary

Slack must not directly perform production workflow activation, credential changes, outbound sends, customer-data mutation, publishing, payments, or n8n workflow activation. Those actions deep-link back to Portfolio for review.

Every accepted Slack action should write an Agent Ops event so Mission Control, Run Console, and Kanban can reflect the mobile decision trail.

## Mobile Notification Bridge

Portfolio can also push a compact unblock packet into Slack from Mission Control or the Standup Room through `POST /api/admin/agents/slack-notifications`.

Supported packet kinds:

- `pending_approvals`
- `blockers`
- `review_ready`
- `goal_decisions`
- `standup_blockers`
- `selected_agent_question`

The route requires admin authentication, builds Block Kit payloads with Portfolio deep links, posts through `SLACK_AGENT_OPS_WEBHOOK_URL`, and records a `slack_mobile_notification` run. Packets are deduped within an hourly window by kind, goal, and selected agents unless an explicit force flag is sent.
