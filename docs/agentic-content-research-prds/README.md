# Agentic Content Research PRD Pack

This pack turns the Portfolio Agent Ops build into a research backlog for a LinkedIn-first thought leadership series. Each PRD is also prepared for a Phase 2 YouTube/video expansion using the existing Portfolio video generation, HeyGen, ElevenLabs, storyboard, and B-roll surfaces.

## Operating Rule

Research first. Draft later. Publishing stays gated.

The first pass should produce research notes, source-backed claims, narrative angles, and content recommendations. It should not publish LinkedIn posts, start HeyGen jobs, regenerate audio, send outbound messages, or write directly to Supabase. Backlog seeding should happen through `/admin/agents/coordination`.

## Series Backlog

| # | PRD | Working LinkedIn angle | Phase 2 video angle |
| --- | --- | --- | --- |
| 1 | [Agentic Operating System Overview](01-agentic-operating-system-overview.md) | The website is becoming proof of a governed agentic operating system. | Walk through the whole lifecycle from harness to audit. |
| 2 | [Harness And Trace Foundation](02-harness-trace-foundation.md) | Fast AI demos are easy; traceable systems are the hard part. | Show the run, step, event, artifact, handoff, approval, and cost envelope. |
| 3 | [Shaka Controller Brain](03-shaka-controller-brain.md) | The most important agent may be the one that says where work should go. | Explain Shaka as controller, router, and executive interface. |
| 4 | [Open Brain Memory Architecture](04-open-brain-memory-architecture.md) | Memory needs ownership, privacy tiers, and approval before it becomes truth. | Explain local-first memory and compiled wiki overlays. |
| 5 | [Self-Evaluation And Quality Loops](05-self-evaluation-quality-loops.md) | Agents need review loops before they earn more authority. | Show rubrics, budget checks, evals, and coaching signals. |
| 6 | [Agent Swarms And Delegation](06-agent-swarms-delegation.md) | Swarms only help when each agent has a role, owner, and handoff rule. | Map the pods and work queue as an operating team. |
| 7 | [Permission Scopes And Risk Boundaries](07-permission-scopes-risk-boundaries.md) | Agent access should look more like least privilege than blank-check autonomy. | Show capability profiles and runtime policies. |
| 8 | [Human-In-The-Loop Approvals](08-human-in-the-loop-approvals.md) | Human review is not a brake. It is the trust layer. | Walk through approval checkpoints and side-effect gates. |
| 9 | [Mission Control And Slack Traceability](09-mission-control-slack-traceability.md) | Operators need one cockpit and one mobile unblock lane. | Demo Mission Control, Kanban, run detail, and Slack boundaries. |
| 10 | [Cost, Spend, And Payment Authority](10-cost-spend-payment-authority.md) | Agents should not move money without trace-bound authority. | Explain cost intelligence and payment/spend gates. |
| 11 | [Client-Safe Audit Export](11-client-safe-audit-export.md) | Clients need proof without raw private logs. | Explain scoped governance exports and evidence boundaries. |
| 12 | [Messaging Synthesis](12-messaging-synthesis.md) | The story is practical: build agents that people can trust. | Convert the research into LinkedIn posts, carousels, and video scripts. |

## Shared Evidence Sources

- `docs/agentic-operating-system-governance.md`
- `docs/agent-operations-roadmap.md`
- `docs/agentic-patterns.md`
- `docs/agentic-os-client-advisory-explainer.md`
- `docs/agent-ops-slack-mobile-unblock.md`
- `docs/linkedin-voice.md`
- `docs/heygen-template-brand-setup.md`
- `lib/agent-organization.ts`
- `lib/agent-governance.ts`
- `lib/agent-delegation-policy.ts`
- `lib/agent-policy.ts`
- `lib/agent-evaluations.ts`
- `lib/open-brain.ts`
- `lib/agent-mission-control.ts`
- `lib/agent-swarm-board.ts`
- `lib/video-ideas-generation.ts`
- `app/api/admin/video-generation/generate-ideas/route.ts`
- `app/api/admin/video-generation/ideas-queue/[id]/generate/route.ts`
- `app/api/admin/social-content/[id]/regenerate-audio/route.ts`

## PRD Format

Each PRD uses the same structure:

- Objective
- Research questions
- Portfolio evidence to inspect
- Public-safe claim boundaries
- LinkedIn output target
- Phase 2 video expansion
- Acceptance criteria
- UI seeding packet

## UI Seeding Defaults

Use `/admin/agents/coordination`.

- Template: Agent follow-up
- Owner: Research Source Register
- Runtime: codex
- Title: `Research PRD: <chapter title>`
- Narrative: copy the UI seeding packet from the PRD

If a packet is primarily about content shaping, keep the UI owner as Research Source Register and name Nefertiti, the Voice & Content Architect, as the downstream reviewer in the narrative. The current owner dropdown does not expose every agent.
