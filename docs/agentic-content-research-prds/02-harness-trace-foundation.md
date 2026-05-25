# PRD 02: Harness And Trace Foundation

## Objective

Research the harness that makes agent work observable: run records, steps, events, artifacts, approvals, handoffs, work items, stale recovery, and linked costs.

This chapter should make the case that the first layer of agentic maturity is not intelligence. It is traceability.

## Research Questions

- What is the minimum trace envelope an agentic system needs before it can be trusted?
- How does Portfolio connect runs, artifacts, approvals, handoffs, work items, and costs?
- Which surfaces show status and failure states without reading database rows?
- Where do legacy workflow tables still coexist with shared Agent Ops traces?

## Portfolio Evidence To Inspect

- `docs/agent-operations-roadmap.md`
- `lib/agent-run.ts`
- `lib/agent-mission-control.ts`
- `lib/agent-work-items.ts`
- `lib/agent-stale-runs.ts`
- `app/admin/agents/runs/page.tsx`
- `app/admin/agents/runs/[runId]/page.tsx`
- `app/api/admin/agents/runs/[runId]/route.ts`

## Public-Safe Claim Boundaries

- Discuss trace structure and operating model, not private run contents.
- Use route and table names as implementation proof.
- Avoid publishing internal error messages or any sensitive artifact body.

## LinkedIn Output Target

- Format: builder insight post.
- Hook direction: "The first thing I want from an AI agent is not creativity. I want a receipt."
- Core point: agents need a harness that records who acted, what happened, where the artifact lives, and what still needs approval.
- Close: ask what trace evidence readers would require before letting an agent touch real work.

## Phase 2 Video Expansion

- YouTube angle: "Build The Harness Before You Trust The Agent."
- Target runtime: 5 to 7 minutes.
- Opening scene: a failed agent run or stale work item, followed by the trace detail page.
- Script framework fit: problem, cost of invisible work, trace envelope, example, operating rule.
- HeyGen suitability: strong for narration; pair with screen capture of run detail.
- ElevenLabs suitability: optional short-form clip voiceover for a "receipt for agent work" excerpt.
- Storyboard/B-roll ideas: run list, run detail timeline, artifacts, approvals, cost summary, stale sweep.
- Evidence needed before recording: sanitized screenshot or recording of a run detail page with no private content exposed.

## Acceptance Criteria

- Research memo defines the trace envelope in plain language.
- Output lists concrete Portfolio files/routes and what each proves.
- LinkedIn angle avoids abstract observability jargon.
- Phase 2 notes identify safe B-roll and sensitive areas to blur or avoid.

## UI Seeding Packet

Title: `Research PRD: Harness and trace foundation`

Owner: Research Source Register

Runtime: codex

Narrative:
Research Portfolio's Agent Ops trace harness: runs, steps, events, artifacts, handoffs, approvals, work items, stale recovery, and costs. Inspect the roadmap, agent-run helpers, Mission Control snapshot, work item helpers, and run detail routes. Produce public-safe notes for a LinkedIn builder post and Phase 2 YouTube segment. Acceptance: define the trace envelope, cite concrete repo evidence, name safe screenshots/B-roll, and avoid private run content.
