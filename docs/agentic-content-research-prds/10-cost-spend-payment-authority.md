# PRD 10: Cost, Spend, And Payment Authority

## Objective

Research how Portfolio handles cost visibility and payment/spend authority: LLM budget checks, cost events, payment approval action types, checkout/subscription/refund/vendor spend gates, and paid external job gates.

This chapter should explain why agentic systems need financial boundaries before they touch money or paid infrastructure.

## Research Questions

- How does Portfolio track or estimate AI/model spend?
- Which payment and spend actions are approval-gated?
- How does the system separate recommending spend from executing spend?
- What should clients expect before trusting agents near money movement?

## Portfolio Evidence To Inspect

- `lib/agent-budget-policy.ts`
- `lib/agent-policy.ts`
- `lib/agent-governance.ts`
- `lib/cost-calculator.ts`
- `app/api/admin/cost-events/ingest/route.ts`
- `lib/video-ideas-generation.ts`
- `docs/agentic-operating-system-governance.md`

## Public-Safe Claim Boundaries

- Discuss action categories and governance design.
- Do not publish real customer payment records, Stripe object IDs, cost event details, or vendor account data.
- Be explicit that payment execution authority is not expanded in this content phase.

## LinkedIn Output Target

- Format: standard post.
- Hook direction: "The scariest agent is not the one that writes code. It is the one that can spend money without a receipt."
- Core point: cost and payment authority need approval, scope, purpose, amount, time window, and trace evidence.
- Close: ask what financial boundary readers would require before using paid autonomous workflows.

## Phase 2 Video Expansion

- YouTube angle: "How To Keep Agents Away From Blank-Check Spending."
- Target runtime: 5 to 7 minutes.
- Opening scene: budget check or payment authority actions list.
- Script framework fit: risk story, policy model, live proof, client trust frame.
- HeyGen suitability: strong with governance and cost UI B-roll.
- ElevenLabs suitability: optional short clip narration.
- Storyboard/B-roll ideas: budget policy, cost summary, payment approval action types, governance pending approvals.
- Evidence needed before recording: sanitized cost/budget example without real payment or customer data.

## Acceptance Criteria

- Research memo explains the difference between cost tracking, budget checking, and payment authority.
- Output names all payment/spend approval action categories.
- Messaging makes financial controls feel practical and client-centered.
- Phase 2 notes identify safe visuals and excluded sensitive data.

## UI Seeding Packet

Title: `Research PRD: Cost, spend, and payment authority`

Owner: Research Source Register

Runtime: codex

Narrative:
Research Portfolio's cost, spend, and payment authority model. Inspect budget policy, agent policy, governance snapshot builder, cost calculator, cost ingest route, video ideas budget checks, and governance docs. Produce public-safe notes for a LinkedIn post and Phase 2 video explaining model spend visibility, budget gates, payment authority actions, and why agents should recommend spend separately from executing spend. Acceptance: list payment/spend gates, explain trace-bound authority, and avoid customer/payment data.
