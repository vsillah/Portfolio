# PRD 09: Mission Control And Slack Traceability

## Objective

Research the operator interface for agentic work: Mission Control as the main cockpit, Agent Coordination as the controller queue, Agent Kanban as the work board, run detail as trace view, and Slack as the mobile unblock lane.

This chapter should show that agent systems need a visible operating surface.

## Research Questions

- What belongs in Mission Control versus drilldown pages?
- How does Agent Coordination turn vague work into controller packets?
- How does Slack support mobile decisions without bypassing Portfolio?
- Which trace links let an operator move from summary to evidence?

## Portfolio Evidence To Inspect

- `app/admin/agents/page.tsx`
- `app/admin/agents/coordination/page.tsx`
- `app/admin/agents/swarm-board/page.tsx`
- `app/admin/agents/runs/[runId]/page.tsx`
- `lib/agent-mission-control.ts`
- `lib/agent-slack-blocks.ts`
- `lib/agent-slack-actions.ts`
- `docs/agent-ops-slack-mobile-unblock.md`

## Public-Safe Claim Boundaries

- Use UI structure and workflow descriptions, not private queue content.
- Keep Slack examples generic or sanitized.
- Avoid promising mobile actions can perform high-risk production mutations.

## LinkedIn Output Target

- Format: carousel or standard post.
- Hook direction: "If agents are doing work, operators need a cockpit."
- Core point: Mission Control is the proof surface. Slack is the mobile unblock lane. The trace remains the source of truth.
- Close: ask what interface readers would need before trusting an agent team.

## Phase 2 Video Expansion

- YouTube angle: "Mission Control For Agentic Work."
- Target runtime: 6 to 8 minutes.
- Opening scene: Mission Control first viewport, then click into Coordination, Kanban, and run detail.
- Script framework fit: operator pain, interface map, walkthrough, governance boundary.
- HeyGen suitability: excellent for narrated product walkthrough.
- ElevenLabs suitability: use for short social cutdowns if the screen recording drives the main video.
- Storyboard/B-roll ideas: Mission Control, Agent Coordination create packet form, Kanban lanes, run trace, Slack command/card mock.
- Evidence needed before recording: authenticated local browser session and sanitized queue state.

## Acceptance Criteria

- Research memo maps each operator surface to its job.
- Output explains why Slack is limited by design.
- LinkedIn angle uses cockpit/control-plane language without hype.
- Phase 2 notes include a click path for video recording.

## UI Seeding Packet

Title: `Research PRD: Mission Control and Slack traceability`

Owner: Research Source Register

Runtime: codex

Narrative:
Research Portfolio's operator surfaces for agentic work: Mission Control, Agent Coordination, Agent Kanban, run detail, and Slack mobile unblock. Inspect admin pages, Mission Control read model, Slack blocks/actions, and Slack mobile unblock doc. Produce public-safe notes for a LinkedIn post or carousel plus Phase 2 product walkthrough video. Acceptance: map each surface to its operating job, explain Slack limits, name trace paths, and avoid private queue content.
