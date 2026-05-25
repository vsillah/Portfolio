# PRD 03: Shaka Controller Brain

## Objective

Research Shaka as the controller layer: the Chief of Staff that interprets intent, routes work, recommends agent engagements, and keeps side effects gated.

This chapter should explain why a governed system needs a brain that coordinates before agents execute.

## Research Questions

- What does Shaka do that a generic chat interface does not?
- How does deterministic delegation reduce risk and improve explainability?
- Which task types, risk classes, evidence requirements, and fallback rules exist today?
- How should this be explained to a nontechnical operator?

## Portfolio Evidence To Inspect

- `lib/chief-of-staff-chat.ts`
- `lib/agent-delegation-policy.ts`
- `app/admin/agents/chief-of-staff/page.tsx`
- `app/api/admin/agents/chief-of-staff/chat/route.ts`
- `app/api/admin/agents/chief-of-staff/actions/route.ts`
- `docs/agentic-operating-system-governance.md`

## Public-Safe Claim Boundaries

- Describe Shaka's routing and recommendation role.
- Avoid implying Shaka can independently mutate production systems.
- Do not expose private operator prompts or raw model replies.

## LinkedIn Output Target

- Format: standard post.
- Hook direction: "In an agentic system, the controller matters as much as the agents."
- Core point: delegation should be visible, explainable, and tied to evidence.
- Close: ask readers whether their agents can explain why work went to a specific runtime or specialist.

## Phase 2 Video Expansion

- YouTube angle: "Why Every Agent Swarm Needs A Chief Of Staff."
- Target runtime: 5 to 6 minutes.
- Opening scene: ask Shaka a status/routing question, then show the recommended engagement path.
- Script framework fit: familiar workplace analogy, technical mapping, governance rule, demo.
- HeyGen suitability: strong. Avatar narration can introduce the concept, then switch to screen share.
- ElevenLabs suitability: good for a short companion audio clip explaining "controller before execution."
- Storyboard/B-roll ideas: Chief of Staff page, delegation policy code snippets, Agent Coordination queue, run trace events.
- Evidence needed before recording: one safe Shaka interaction that does not reveal private client data.

## Acceptance Criteria

- Research memo describes Shaka's role without overclaiming autonomy.
- Output explains task type, risk class, required evidence, fallback, and confidence in plain language.
- Messaging includes one workplace analogy and one concrete Portfolio example.
- Phase 2 notes identify a safe demo interaction.

## UI Seeding Packet

Title: `Research PRD: Shaka controller brain`

Owner: Research Source Register

Runtime: codex

Narrative:
Research Shaka as Portfolio's controller layer for Agent Ops. Inspect Chief of Staff chat/action routes, deterministic delegation policy, governance docs, and admin surfaces. Produce source-backed notes for a LinkedIn post explaining why agent systems need a controller that routes work, requires evidence, and keeps side effects gated. Acceptance: explain task types, risk classes, fallback, confidence, and approval boundaries in plain language, plus a Phase 2 video demo idea.
