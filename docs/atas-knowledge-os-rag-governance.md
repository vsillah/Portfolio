# ATAS Knowledge OS RAG Governance

This document defines the governed RAG design for the ATAS AI Agent Organization.
It replaces broad Drive-to-Pinecone ingestion with source classification,
namespace routing, approval gates, and Agent Ops visibility.

## Operating Owner

- **Pod:** Research & Knowledge
- **Primary agent:** Hatshepsut (Kemet) - Private Knowledge Librarian
- **Source classification owner:** Askia Muhammad (Songhai) - Research Source Register
- **Escalation owner:** Shaka (Zulu) - Chief of Staff

The Hatshepsut (Kemet) - Private Knowledge Librarian owns ingestion runs, Pinecone namespaces,
metadata completeness, duplicate detection, privacy checks, and retrieval health.
The Askia Muhammad (Songhai) - Research Source Register classifies source material before it is
eligible for ingestion. The Shaka (Zulu) - Chief of Staff escalates failed health checks,
privacy violations, eval regressions, and production cutover decisions.

## Index Strategy

- Current legacy index: `publications`
- New staged index: `amadutown-knowledge-v1`
- Cutover status: shadow only until approved

The legacy `publications` index is retained for audit and rollback. It should not
be deleted or overwritten during this phase.

## Namespaces

| Namespace | Purpose | Max public route privacy |
| --- | --- | --- |
| `public_chatbot` | Public facts, services, products, FAQs, campaigns | `public_safe` |
| `voice_story` | Public-safe narrative, voice, thought leadership | `public_safe` |
| `sales_context` | Client-safe proof, case studies, outreach examples | `client_safe` |
| `internal_ops` | SOPs, admin workflows, runbooks | admin-only |
| `legacy_quarantine` | Audit-only legacy Pinecone state | not routed |

No public route should search all namespaces by default.

## Source Manifest Contract

Every ingested source must be listed in `lib/knowledge-source-manifest.ts`.
Every chunk produced from that source must carry:

- `sourceId`
- `title`
- `sourceType`
- `namespace`
- `privacyTier`
- `canonicalPathOrUrl`
- `contentFingerprint`
- `chunkIndex`
- `chunkCount`
- `ingestRunId`

Ingestion must reject unclassified sources, missing metadata, private material in
public namespaces, and excluded private sources marked as RAG-approved.

## Retrieval Routes

| Route | Allowed namespaces | Max privacy | Default use |
| --- | --- | --- | --- |
| `public_chatbot` | `public_chatbot` | `public_safe` | Public factual answers |
| `public_chatbot_voice` | `public_chatbot`, `voice_story` | `public_safe` | Public answers with voice/story context |
| `outreach_email` | `sales_context`, `voice_story` | `client_safe` | In-app outreach and delivery drafts |
| `admin_internal` | `internal_ops` | `internal` | Admin-only tools |
| `legacy_health` | `legacy_quarantine` | `internal` | Legacy connectivity checks only |

Portfolio's curated `/api/knowledge` bundle remains the authoritative public
fact projection for products, services, campaigns, and public-safe bio context.
The canonical durable-memory layer is the local Open Brain; `/api/knowledge`
and Pinecone are downstream projections.

## Agent Ops Visibility

Agent Ops should record:

- ingest runs
- source-audit runs
- eval runs
- approval requests
- production cutover decisions
- privacy violations
- rollback notes

The `/admin/agents` mission-control snapshot exposes the current manifest,
namespace counts, validation status, and approval gate. `/api/admin/rag-health`
returns route policy and governance status alongside the n8n RAG probe.

## Ingestion Trigger

Governed ingestion starts at `POST /api/admin/rag-ingest`. The endpoint accepts
admin auth or `Authorization: Bearer <N8N_INGEST_SECRET>` for n8n. It builds a
shadow ingestion plan by validating the manifest, extracting local text, chunking
content, generating deterministic IDs, checking metadata completeness, rejecting
public namespace privacy violations, and recording an Agent Ops run.

Current write mode is intentionally blocked. Requests with `{ "write": true }`
return `blocked_pending_pinecone_cutover_approval` until Pinecone index creation,
production n8n activation, and default retrieval cutover are explicitly approved.

Each shadow plan also records sanitized Open Brain source/event records:

- source kind `rag_projection` for shadow-only plans,
- source kind `pinecone_projection` when a write was requested and blocked,
- event kind `rag_projection_staged` with counts, status, privacy-violation
  count, and approval state.

These records are trace metadata only. They do not write Pinecone, promote
private-derived material, or create durable Open Brain memories.

## Approval Gates

The following actions require explicit approval:

- production cutover from `publications` to `amadutown-knowledge-v1`
- any public chatbot/RAG behavior change
- production n8n activation/deactivation for RAG workflows
- promoting private-derived material into public retrieval
- deleting or overwriting the legacy Pinecone index
- ingesting Open Brain projections into Pinecone
- promoting any Open Brain memory into public chatbot or RAG projections unless
  it is approved and `public_safe`
