# PRD 11: Client-Safe Audit Export

## Objective

Research the client-safe governance export layer: capability inventory, scoped delegation evidence, authority approvals, export formats, export ledger metadata, and privacy exclusions.

This chapter should show how an agentic system can prove governance without dumping raw logs on a client.

## Research Questions

- What information belongs in a client-safe governance export?
- How do run, client project, and date-window scopes work?
- What should be excluded from exports by default?
- How does the ledger prove that an export happened without storing raw report payloads?

## Portfolio Evidence To Inspect

- `lib/agent-governance-export.ts`
- `lib/agent-governance-export-ledger.ts`
- `lib/agent-governance-scope.ts`
- `app/api/admin/agents/governance/export/route.ts`
- `app/api/admin/agents/governance/export/route.test.ts`
- `docs/agentic-os-client-advisory-explainer.md`
- `docs/agentic-operating-system-governance.md`

## Public-Safe Claim Boundaries

- Explain export shape and privacy exclusions.
- Do not include raw export contents from private runs.
- Avoid claiming exports are a compliance certification.
- Treat exports as review evidence and advisory proof.

## LinkedIn Output Target

- Format: standard post or carousel.
- Hook direction: "A client should not have to take your word that the agent stayed inside the guardrails."
- Core point: client-safe proof needs role boundaries, scoped trace references, authority decisions, and privacy filters.
- Close: ask what proof readers would want before letting an AI system into client operations.

## Phase 2 Video Expansion

- YouTube angle: "Client-Safe Audit Trails For AI Agents."
- Target runtime: 5 to 7 minutes.
- Opening scene: governance export button, then explain what leaves and what stays private.
- Script framework fit: trust gap, export model, privacy boundary, client value.
- HeyGen suitability: strong with sanitized UI and markdown export B-roll.
- ElevenLabs suitability: good for a short voiceover explaining "proof without raw logs."
- Storyboard/B-roll ideas: governance export route, scoped query examples, ledger summary, advisory explainer.
- Evidence needed before recording: one safe local/dev export or mocked export with no private payload.

## Acceptance Criteria

- Research memo explains export contents and exclusions.
- Output names scope filters and why capability inventory remains included.
- Messaging connects audit proof to client confidence.
- Phase 2 notes include safe export demo requirements.

## UI Seeding Packet

Title: `Research PRD: Client-safe audit export`

Owner: Research Source Register

Runtime: codex

Narrative:
Research Portfolio's client-safe governance export layer. Inspect governance export builder, export ledger, scope parser, export API route/tests, advisory explainer, and governance docs. Produce public-safe notes for a LinkedIn post or carousel plus Phase 2 video explaining scoped evidence, capability inventory, authority approvals, ledger metadata, and privacy exclusions. Acceptance: name export contents/exclusions, explain run/client/date scopes, and avoid raw private payloads.
