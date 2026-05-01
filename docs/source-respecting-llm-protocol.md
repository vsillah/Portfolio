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

## Payout Accrual And Monthly Settlement

Launch payouts in simulation mode first.

Default split per paid query/use:

- 60% creator pool
- 25% protocol operations
- 15% legal, reserve, and community fund

Creator-pool allocation is calculated per use. Each `AnswerReceipt` records the cited and allowed source chunks that materially support the answer, the supported output tokens, and the accrued payout weight per chunk.

Actual money movement should happen as a monthly settlement, not as a transaction per answer. Monthly settlement reduces payment-processing costs, makes creator statements easier to review, and gives the protocol time to hold suspicious accruals for review before paying them out.

Default monthly settlement rules:

- Aggregate all per-use accruals by creator and period.
- Use `YYYY-MM` as the settlement period.
- Hold payouts below the minimum settlement threshold for review or rollover.
- Hold payouts with abuse flags, disputes, revoked licenses, or unresolved rights questions.
- Pay only approved monthly settlements.

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
- monthly payout settlement
- abuse flags
- model-review gates

The persistence foundation lives in:

- [`database_schema_source_respecting_llm.sql`](../database_schema_source_respecting_llm.sql)
- [`migrations/20260501193000_source_respecting_llm.sql`](../migrations/20260501193000_source_respecting_llm.sql)
- [`lib/source-respecting-llm-persistence.ts`](../lib/source-respecting-llm-persistence.ts)
- [`scripts/seed-source-respecting-llm-demo.sql`](../scripts/seed-source-respecting-llm-demo.sql)

Internal persistence APIs:

- `POST /api/admin/source-protocol/receipts` persists one `AnswerReceipt` plus attributed chunk rows.
- `POST /api/admin/source-protocol/monthly-payouts` upserts monthly payout settlement rows.

Both routes require `Authorization: Bearer <SOURCE_PROTOCOL_INGEST_SECRET>`. They are internal admin/system endpoints and should not be exposed as public creator UX.

Smoke test:

- `npm run source-protocol:smoke` builds a synthetic receipt and monthly settlement without network calls.
- `SOURCE_PROTOCOL_API_BASE_URL=http://localhost:3000 SOURCE_PROTOCOL_INGEST_SECRET=... npm run source-protocol:smoke -- --post` posts the same synthetic payloads to the internal APIs.

Future UI work should wrap these modules and routes rather than reimplementing permission or payout logic in page components.
