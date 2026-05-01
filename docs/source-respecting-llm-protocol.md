# Source-Respecting LLM Protocol

## Purpose

This protocol is the operating blueprint for an open nonprofit research assistant that protects creators whose work is being banned, challenged, removed, or made harder to access.

The first audience is banned and challenged authors. The next expansion path is Black history museums, archive contributors, oral historians, and community memory stewards.

The product is RAG-first. It pays and attributes based on approved source chunks used at inference time. It does not claim to prove which training-token influence produced a model output.

## Product Shape

- **Creator onboarding:** verify identity, rights holder role, payout destination, anonymity preference, and creator category.
- **Licensed work ingestion:** ingest only opt-in material with chain-of-title review and active license grants.
- **Permission-aware retrieval:** retrieve only source chunks whose license grant covers the intended use.
- **Cited answer generation:** answer from approved chunks and refuse unsupported claims.
- **Answer and payout receipts:** record source use, attribution weights, payout simulation, license basis, model ID, and abuse flags.

## Rights And Consent Defaults

- Content is opt-in only.
- Public-domain or openly licensed material still keeps attribution.
- Fine-tuning is disabled for v1 unless the creator grants fine-tuning rights and legal review approves the path.
- Museum and archive uploads require rights review because holding an artifact, scan, donor file, oral history, or metadata record may not mean the uploader controls AI reuse.
- Community-held knowledge can require community consent, even when an individual uploader is verified.

## Chain Of Title Checklist

Every work should record the controlling rights path before retrieval:

- author-owned
- publisher-controlled
- estate-controlled
- illustrator or translator interest
- museum-owned
- archive-owned
- donor-restricted
- community-stewarded
- public-domain or open-license source

If chain of title is not verified, the work can be staged for review but should not be retrievable.

## Creator Protection Controls

- Protected identity option for creators at risk of harassment.
- Revocation path for future retrieval.
- Dispute handling for ownership, misattribution, or unsafe use.
- Sensitive-history handling for family records, sacred/community-restricted knowledge, minors, violence, and doxxing risk.
- Monthly transparency report covering source use, payouts, disputes, revoked works, and model-review decisions.

## Payout Simulation

Launch payouts in simulation mode first.

Default split per paid query:

- 60% creator pool
- 25% protocol operations
- 15% legal, reserve, and community fund

Creator-pool allocation is based on cited and allowed source chunks that materially support the answer. The source receipt should show supported output tokens and payout weight per chunk.

## Abuse Controls

The protocol must flag:

- duplicate query patterns
- creator self-query payout risk
- duplicate source retrieval
- source stuffing
- unsupported citation claims
- revoked or disputed license usage

Abuse flags do not delete the receipt. They mark it for review so the ledger stays auditable.

## Implementation Anchor

The deterministic domain logic lives in [`lib/source-respecting-llm-protocol.ts`](../lib/source-respecting-llm-protocol.ts).

It currently covers:

- license-use decisions
- source-chunk attribution receipts
- payout simulation
- abuse flags
- model-review gates

Future UI/API work should wrap this module rather than reimplementing permission or payout logic in page components.
