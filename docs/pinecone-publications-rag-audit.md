# Pinecone Publications RAG Audit

Date: 2026-05-05

This is a read-only audit note for the legacy Pinecone `publications` index. It
captures the current retrieval quality problem that motivated the governed ATAS
Knowledge OS rebuild. No Pinecone records were deleted, overwritten, or promoted
as part of this audit.

## Scope

- Legacy index: `publications`
- New target index: `amadutown-knowledge-v1`
- Legacy index treatment: audit and rollback only
- Operational owner: Hatshepsut (Kemet) - Private Knowledge Librarian
- Escalation owner: Shaka (Zulu) - Chief of Staff

## Observed Legacy State

The legacy index is usable from a connectivity standpoint, but the stored records
do not meet the metadata, routing, or privacy requirements for production RAG.

Observed index traits:

- Record count: 3,387
- Region: `us-east-1`
- Shape: dense vector index
- Namespace state: default namespace only
- Legacy source marker: broad `source: "blob"` values rather than source IDs
- Common blob types: PDF, DOCX, plain text, and CSV extraction remnants

Representative metadata issues:

- Missing durable source IDs
- Missing source titles
- Missing canonical paths or URLs
- Missing privacy tiers
- Missing route/use-case intent
- Missing ingest run IDs
- Missing stable chunk IDs tied to content fingerprints

Representative content-quality issues:

- Duplicate or near-duplicate chunks appear in top results.
- Some chunks are small fragments from malformed extraction rather than useful
  source-backed knowledge.
- Several records look like raw operational exports rather than curated
  public-safe knowledge.
- At least one sampled result category appeared contact-like or client/private
  enough that it should not be available to public routes.

## Risk Classification

| Risk | Status | Impact |
| --- | --- | --- |
| Source provenance | Failing | Chatbot cannot cite or rank trustworthy source titles. |
| Metadata completeness | Failing | Retrieval cannot route by audience, privacy tier, or use case. |
| Duplicate control | Failing | Top results can repeat the same weak passage. |
| Privacy routing | Failing | Public and internal material are not cleanly separated. |
| Extraction quality | Mixed | Some chunks are usable, but malformed records pollute retrieval. |
| Rollback value | Useful | Keep as a legacy reference until the new index beats it in shadow. |

## Required Remediation

The current `WF-RAG-INGEST` behavior should remain legacy/read-only pending the
governed rebuild. Future ingestion must go through Portfolio-owned validation:

- source manifest classification
- required metadata checks
- deterministic content fingerprints
- deterministic chunk IDs
- namespace policy enforcement
- privacy-tier enforcement
- duplicate detection
- Agent Ops run recording

The replacement trigger is `POST /api/admin/rag-ingest`. n8n can call this route
with `Authorization: Bearer <N8N_INGEST_SECRET>`, but the app keeps control of
manifest validation, extraction, chunking, deduplication, privacy checks, and run
recording.

## Cutover Gate

Do not route production chatbot or outreach retrieval to `amadutown-knowledge-v1`
until shadow evaluation shows that the new index is materially better than
`publications` on relevance, source quality, deduplication, and privacy safety.
