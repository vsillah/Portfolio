# PRD 04: Open Brain Memory Architecture

## Objective

Research the memory architecture behind Portfolio Agent Ops: local-first Open Brain records, source records, events, memories, links, proposals, runtime parity, producer gates, and compiled wiki overlays.

This chapter should make memory feel like governance, not magic.

## Research Questions

- Why does durable memory need source records and approval proposals?
- How does Portfolio separate local Open Brain truth from dashboard projection?
- Which privacy tiers and source kinds matter for public-facing content?
- How should the system decide what becomes public-safe, client-safe, internal, or private?

## Portfolio Evidence To Inspect

- `lib/open-brain.ts`
- `app/admin/agents/open-brain/page.tsx`
- `app/api/admin/agents/open-brain/route.ts`
- `app/api/admin/agents/open-brain/proposals/route.ts`
- `app/api/admin/agents/open-brain/wiki/compile/route.ts`
- `docs/vambah-personality-public-safe.md`
- `docs/agentic-operating-system-governance.md`

## Public-Safe Claim Boundaries

- Discuss memory structure, privacy tiers, producer gates, and approval proposals.
- Do not quote raw private corpus, private AI chats, client data, or sensitive Open Brain records.
- Treat compiled wiki pages as overlays, not the source of truth.

## LinkedIn Output Target

- Format: reflective systems post.
- Hook direction: "Agent memory gets dangerous when every note becomes truth."
- Core point: memory needs provenance, privacy, review, and revocation.
- Close: ask what a system should be allowed to remember and who gets to approve it.

## Phase 2 Video Expansion

- YouTube angle: "How To Think About Memory In Agentic Systems."
- Target runtime: 6 to 8 minutes.
- Opening scene: a clean Open Brain dashboard, then a simple diagram of source -> proposal -> memory -> wiki overlay.
- Script framework fit: tension, operating model, example, privacy boundary, principle.
- HeyGen suitability: strong with diagram B-roll and dashboard screen share.
- ElevenLabs suitability: useful for a short voiceover clip on "memory is governance."
- Storyboard/B-roll ideas: Open Brain router, proposals, wiki compile preview, producer gates, runtime parity.
- Evidence needed before recording: current Open Brain dashboard screenshot with private details excluded.

## Acceptance Criteria

- Research memo explains the memory flow without treating memory as a black box.
- Output names privacy tiers and why they matter.
- Messaging connects memory to dignity, consent, and operational trust.
- Phase 2 notes include a simple diagram brief.

## UI Seeding Packet

Title: `Research PRD: Open Brain memory architecture`

Owner: Research Source Register

Runtime: codex

Narrative:
Research Portfolio's Open Brain memory architecture for agentic systems. Inspect open-brain types, admin page, proposal routes, wiki compile route, public-safe personality pack, and governance docs. Produce public-safe notes for a LinkedIn post and Phase 2 video explaining source records, proposals, memories, links, privacy tiers, producer gates, and compiled wiki overlays. Acceptance: distinguish source of truth from projection, avoid raw private material, and provide a diagram-friendly video outline.
