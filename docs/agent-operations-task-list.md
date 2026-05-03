# Agent Operations Task List

This is the active implementation queue for turning the agent organization into usable operating software.

## Current Autopilot Block

- [x] Confirm baseline: `origin/main`, open PRs, and production/staging Vercel deployment state.
- [x] Keep Portfolio admin as the source of truth for agent operations.
- [x] Support read-only agent dispatch from `/admin/agents`.
- [x] Support the same read-only dispatch from Slack `/agent run <agent-key>`.
- [x] Let Chief of Staff chat recommend mapped agents and launch their read-only dispatch runs.
- [x] Keep every launched agent engagement visible in `/admin/agents/runs`.
- [x] Add first-task templates to read-only dispatch artifacts for priority agents.
- [x] Add read-only Automation Context visibility for Portfolio-related Codex automations.
- [ ] Validate with focused tests, typecheck, lint, build, PR previews, merge, and production/staging deployment checks.

## Next Operating Milestones

1. Chief of Staff dispatcher
   - The chat should recommend which mapped agent to run next.
   - Recommendations should include `agent_key`, label, and rationale.
   - Launching the recommendation must create the same traced read-only engagement used by admin and Slack.

2. Agent-specific first tasks
   - Give the highest-value agents a first narrow read-only task:
     - `chief-of-staff`
     - `research-source-register`
     - `voice-content-architect`
     - `automation-systems`
     - `inbox-follow-up`
   - Planned agents should stay queued until the first task is explicit.

3. Approval-backed execution
   - Convert safe read-only recommendations into approval checkpoints when they require side effects.
   - Keep publishing, outbound email, unknown database writes, production config, and private-to-public content behind `agent_approvals`.

4. Mobile operation
   - Keep Slack as the lightweight command surface.
   - Keep Portfolio admin as the source of truth.
   - Avoid adding another channel unless Slack cannot support the workflow.

5. Hardening
   - Keep Codex automation context visible in Agent Operations so future agents can inspect purpose, cadence, authority boundary, and missing context before acting.
   - Add stale-run handling for every runtime.
   - Add dashboard-level cost summaries by agent and runtime.
   - Keep n8n compatibility adapters live until the generic trace model is proven.
