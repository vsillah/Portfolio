# PRD 08: Human-In-The-Loop Approvals

## Objective

Research Portfolio's human approval controls: approval checkpoints, run detail decisions, Slack-safe mobile actions, publishing gates, email gates, production mutation gates, and private-to-public content gates.

This chapter should frame human review as the trust layer that lets automation move safely.

## Research Questions

- Which actions require approval before side effects?
- Where can a human approve, reject, request revision, or route work?
- How does the system keep Slack mobile actions bounded?
- How should this be explained without making governance sound like slowdown?

## Portfolio Evidence To Inspect

- `lib/agent-policy.ts`
- `app/api/admin/agents/runs/[runId]/approval/route.ts`
- `app/api/admin/agents/chief-of-staff/actions/route.ts`
- `lib/agent-slack-actions.ts`
- `docs/agent-ops-slack-mobile-unblock.md`
- `docs/agentic-patterns.md`
- `app/admin/social-content/[id]/page.tsx`

## Public-Safe Claim Boundaries

- Discuss approval types and decision flow.
- Do not publish approval payloads that include private work, client data, or internal decision notes.
- Be clear that Slack is an unblock surface, not a direct production mutation lane.

## LinkedIn Output Target

- Format: reflective builder post.
- Hook direction: "Human-in-the-loop is not where automation stops. It is where authority becomes clear."
- Core point: agents can prepare, route, recommend, and package work; humans approve side effects.
- Close: ask where readers draw the line between recommendation and execution.

## Phase 2 Video Expansion

- YouTube angle: "Human Review Is The Trust Layer For Agentic AI."
- Target runtime: 5 to 7 minutes.
- Opening scene: pending approval packet, then a run event after decision.
- Script framework fit: common objection, reframe, control model, demo, principle.
- HeyGen suitability: strong if paired with approval UI B-roll.
- ElevenLabs suitability: optional short voiceover for approval explainer clips.
- Storyboard/B-roll ideas: run detail approvals, Agent Coordination, Slack card examples, social content approval queue.
- Evidence needed before recording: sanitized approval example or test/local approval drill.

## Acceptance Criteria

- Research memo lists approval-gated actions and where decisions are recorded.
- Output explains why human review increases operating speed over time by reducing risk.
- Phase 2 notes specify what should be blurred or avoided in approval screens.
- Messaging avoids treating humans as blockers.

## UI Seeding Packet

Title: `Research PRD: Human-in-the-loop approvals`

Owner: Research Source Register

Runtime: codex

Narrative:
Research Portfolio's human-in-the-loop approval model. Inspect agent policy, run approval route, Chief of Staff action route, Slack actions, Slack mobile unblock doc, agentic patterns scorecard, and social content review surface. Produce public-safe notes for a LinkedIn post and Phase 2 video explaining approval checkpoints, side-effect gates, Slack boundaries, and private-to-public content controls. Acceptance: list gated actions, decision surfaces, trace events, and safe demo options.
