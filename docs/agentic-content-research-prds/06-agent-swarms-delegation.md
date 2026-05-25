# PRD 06: Agent Swarms And Delegation

## Objective

Research Portfolio's agent organization as a practical swarm: named agents, pods, responsibilities, active/partial/planned states, work items, handoffs, standups, and Kanban.

This chapter should make the point that swarms need structure before they need more agents.

## Research Questions

- How does Portfolio define agent pods and responsibilities?
- What makes a swarm accountable instead of chaotic?
- How do work items, handoffs, standups, and Kanban turn agents into an operating team?
- Which agent names and roles are most useful for public explanation?

## Portfolio Evidence To Inspect

- `lib/agent-organization.ts`
- `lib/agent-swarm-board.ts`
- `lib/agent-work-items.ts`
- `app/admin/agents/swarm-board/page.tsx`
- `app/admin/agents/standup/page.tsx`
- `app/api/admin/agents/work-items/route.ts`
- `app/api/admin/agents/war-room/route.ts`

## Public-Safe Claim Boundaries

- Use agent display names and roles that already exist in code.
- Avoid claiming every planned agent is production-ready.
- Do not expose private work item details or private standup transcripts.

## LinkedIn Output Target

- Format: list post or carousel.
- Hook direction: "An agent swarm without roles is just noise moving faster."
- Core point: the swarm needs pods, owners, handoff rules, and one operating board.
- Close: ask how readers assign responsibility when more than one agent touches a workflow.

## Phase 2 Video Expansion

- YouTube angle: "How We Structure Agent Swarms Without Losing Control."
- Target runtime: 6 to 8 minutes.
- Opening scene: Agent Kanban with owners and swimlanes.
- Script framework fit: team analogy, org map, handoff flow, risk boundary, lesson.
- HeyGen suitability: strong; use avatar narration over board and roster B-roll.
- ElevenLabs suitability: good for short summaries of each pod.
- Storyboard/B-roll ideas: agent roster, swarm board lanes, standup page, work item detail, handoff actions.
- Evidence needed before recording: safe board state with no sensitive work item text.

## Acceptance Criteria

- Research memo maps the pods and at least six agents to their responsibilities.
- Output explains active, partial, and planned statuses.
- Messaging avoids shallow novelty around agent names and focuses on operating discipline.
- Phase 2 notes include a board-walkthrough structure.

## UI Seeding Packet

Title: `Research PRD: Agent swarms and delegation`

Owner: Research Source Register

Runtime: codex

Narrative:
Research Portfolio's agent swarm model: pods, named agents, statuses, responsibilities, work items, handoffs, standups, and Kanban. Inspect agent organization, swarm board helpers, work item helpers, Agent Kanban, standup page, work item routes, and War Room route. Produce public-safe notes for a LinkedIn post or carousel plus Phase 2 board-walkthrough video. Acceptance: map at least six agents to roles, explain swarm accountability, and avoid private work item content.
