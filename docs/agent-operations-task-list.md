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
   - [x] Add warm lead export callbacks for successful ingest completion across Facebook, Google Contacts, and LinkedIn workflows.
   - Add remaining workflow-specific progress, completion, and failure callbacks where legacy workflows still lack them.
   - Keep legacy workflow pages active until replacement views are proven.

4. Reporting and hardening
   - [x] Add all-runtime stale-run detection.
   - [x] Add derived dead-letter handling for failed and stale runs without introducing a separate queue table.
   - [x] Add cost summaries by runtime, agent, workflow, client/project, and artifact type.
   - [x] Keep morning review and deployment watcher outputs visible in Agent Operations.
   - [x] Document legacy workflow run tables as domain detail or future trace-link migration candidates.
   - [x] Update the Agentic Patterns scorecard to reflect strong Agent Ops observability.
   - [x] Link video generation workflow sync runs to Agent Ops traces while preserving domain status UI.

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
- [x] Dead-letter monitor for failed/stale traces in review.
- [x] All-runtime stale sweep coverage reporting in review.
- [x] Cost Intelligence summary by runtime, agent, workflow, client/project, and artifact type in review.
- [x] Operating Signals for morning review and deployment watcher traces in review.
- [x] Pre-flight budget policy helpers and admin policy API visibility in review.
- [x] Chief of Staff chat pre-flight budget adoption in review.
- [x] Outreach email and LinkedIn pre-flight budget adoption in review.
- [x] Delivery email draft pre-flight budget adoption and trace linkage in review.
- [x] Meeting lead extraction pre-flight budget adoption and trace linkage in review.
- [x] AI onboarding preview pre-flight budget adoption in review.
- [x] Audit-from-meetings pre-flight budget adoption and trace linkage in review.
- [x] Video prompt formatter pre-flight budget adoption and trace linkage in review.
- [x] Video ideas generation pre-flight budget adoption and trace linkage in review.
- [x] Social carousel conversion pre-flight budget adoption and trace linkage in review.
- [x] In-person diagnostic insights pre-flight budget adoption and trace linkage in review.
- [x] Meeting pain classification pre-flight budget adoption and trace linkage in review.

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
