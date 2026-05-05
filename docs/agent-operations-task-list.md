# Agent Operations Task List

This is the active implementation queue for Agent Operations. The phase gates, definitions of done, and scope-control rules live in [Agent Operations Roadmap](./agent-operations-roadmap.md). If a proposed task is not allowed by that roadmap, treat it as a scope-change request before implementing it.

## Integration Queue

- [ ] Merge PR #125: Agent Inbox routing.
- [ ] Retarget or merge PR #127: Engagement Work Queue.
- [ ] Merge this roadmap definition branch after PR #125 and PR #127 are reconciled.
- [ ] Verify both Vercel contexts after merge:
  - `Vercel – portfolio`
  - `Vercel – portfolio-staging`

## Next Build Queue

1. Queue affordances
   - [x] Add filters for status, agent, runtime, source, and execution mode.
   - [x] Clarify owner, next action, and source trace on queue items.
   - [x] Keep this inside Mission Control; do not add `/admin/agents/work` unless the overview becomes crowded after review.

2. Approval-backed execution
   - [x] Convert Chief of Staff side-effect recommendations into explicit approval checkpoints.
   - [x] Store the action payload with the approval/run artifact.
   - [x] Preserve approval action payload metadata when approve/reject decisions are recorded.
   - [x] Keep email, publishing, production config, unknown DB writes, and private-to-public material behind `agent_approvals`.

3. n8n trace expansion
   - Prioritize workflows that already touch production automation or LLM costs.
   - [x] Pass `agent_run_id` plus a generic callback URL into traced social content, value evidence, and warm lead payloads.
   - [x] Let generic n8n callbacks record both run events and stage steps.
   - Add remaining workflow-specific progress, completion, and failure callbacks where legacy workflows still lack them.
   - Keep legacy workflow pages active until replacement views are proven.

4. Reporting and hardening
   - Add all-runtime stale-run detection.
   - Add dead-letter handling for failed runs.
   - Add cost summaries by runtime, agent, workflow, client/project, and artifact type.
   - Keep morning review and deployment watcher outputs visible in Agent Operations.

## Completed Or In Review

- [x] Shared trace schema and helper library.
- [x] `/admin/agents`, `/admin/agents/runs`, and run detail pages.
- [x] Mission Control first-screen command center.
- [x] Daily Operating Brief.
- [x] Chief of Staff command and typed recommendations.
- [x] Agent Inbox derived from trace signals.
- [x] Read-only agent dispatch from admin and Slack.
- [x] Slack `/agent` command surface for status, agents, inbox, route, brief, run, standup, and discuss.
- [x] Hermes health bridge as read-only runtime trace.
- [x] Approval drill and run-detail approval decisions.
- [x] Runtime evaluation probe for OpenCode/OpenClaw.
- [x] Engagement Work Queue in review.
- [x] Queue affordance filters and owner/source clarity in review.
- [x] Approval-backed execution payloads and decision metadata in review.
- [x] n8n trace callback envelope and generic stage callback endpoint in review.

## Scope Guard

Do not add the following without an explicit scope-change decision:

- another chat channel beyond Slack,
- a separate queue table,
- autonomous multi-agent launch loops,
- production data writes outside known workflows,
- Hermes/OpenCode mutation from the web app,
- replacement of legacy workflow pages,
- graph/3D/animation-first views,
- new vendors, models, or runtimes without a bakeoff,
- non-captain merges to `main`.
