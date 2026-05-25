# PRD 07: Permission Scopes And Risk Boundaries

## Objective

Research how Portfolio limits agent risk through runtime policies, capability profiles, data classes, write classes, outbound authority, spend authority, and approval-required actions.

This chapter should make least privilege feel like a product feature, not a security footnote.

## Research Questions

- What permissions exist at the runtime level?
- How are those permissions translated into agent capability profiles?
- What does the system allow by default, and what requires approval?
- Which boundaries matter most for client trust?

## Portfolio Evidence To Inspect

- `lib/agent-policy.ts`
- `lib/agent-governance.ts`
- `app/api/admin/agents/policies/route.ts`
- `app/admin/agents/page.tsx`
- `docs/agentic-operating-system-governance.md`
- `docs/agentic-patterns.md`

## Public-Safe Claim Boundaries

- Discuss policy categories and approval actions.
- Do not expose secrets, env values, private data samples, or sensitive admin-only content.
- Be careful not to imply that planned agents inherit broad authority.

## LinkedIn Output Target

- Format: standard post.
- Hook direction: "Agent access should look less like a blank check and more like a permission slip."
- Core point: trust comes from knowing what an agent can read, write, send, spend, and change.
- Close: ask whether readers can explain their agent permissions without opening code.

## Phase 2 Video Expansion

- YouTube angle: "The Permission Model Behind Governed Agents."
- Target runtime: 5 to 7 minutes.
- Opening scene: governance status and capability inventory.
- Script framework fit: risk scenario, permission map, live proof, principle.
- HeyGen suitability: strong with capability table B-roll.
- ElevenLabs suitability: optional narration for short educational clips.
- Storyboard/B-roll ideas: runtime policies, governance profiles, approval required actions, Agent Governance panel.
- Evidence needed before recording: safe view of capability inventory with no sensitive data.

## Acceptance Criteria

- Research memo explains runtime policy and agent capability profile as separate layers.
- Output names read, write, client data, production write, outbound, and spend boundaries.
- LinkedIn angle treats governance as practical trust, not fear.
- Phase 2 notes include a simple permission-map visual.

## UI Seeding Packet

Title: `Research PRD: Permission scopes and risk boundaries`

Owner: Research Source Register

Runtime: codex

Narrative:
Research Portfolio's permission and risk boundary model. Inspect agent policy, governance profile builder, policies route, Agent Governance UI, governance docs, and agentic patterns scorecard. Produce public-safe notes for a LinkedIn post and Phase 2 video explaining runtime policies, agent capability profiles, data classes, write classes, outbound authority, spend authority, and approval-required actions. Acceptance: separate runtime policy from agent scope, name the major permission categories, and avoid secrets or private data.
