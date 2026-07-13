# Open Brain RAG Retrieval QA Packet

Generated: 2026-07-13T15:11:55.370Z

Status: `fail`

## Overview

- Documents evaluated: 0
- Queries evaluated: 3
- Passed queries: 0
- Warning queries: 0
- Failed queries: 3
- Metadata failures: 0
- Privacy failures: 0
- Pinecone write status: `blocked_pending_approval`

## Retrieval Checks

### personality-corpus-projection-rule

- Status: `fail`
- Score: 0.00
- Top document: none
- Source hash: none
- Matched terms: none
- Missing terms: `personality corpus`, `public-safe`, `projection`, `agent context`, `rag`
- Forbidden hits: none
- Note: No public-safe Open Brain RAG projection documents are available.

### private-export-boundary

- Status: `fail`
- Score: 0.00
- Top document: none
- Source hash: none
- Matched terms: none
- Missing terms: `raw private exports`, `local-only`, `wiki pages`, `chatbot knowledge`, `Pinecone`
- Forbidden hits: none
- Note: No public-safe Open Brain RAG projection documents are available.

### approval-gated-pinecone

- Status: `fail`
- Score: 0.00
- Top document: none
- Source hash: none
- Matched terms: none
- Missing terms: `Pinecone`, `approval`, `downstream`, `projection`, `rebuildable`
- Forbidden hits: none
- Note: No public-safe Open Brain RAG projection documents are available.

## Metadata Findings

- None.

## Privacy Findings

- None.

## Recommendations

- Approve at least one public-safe Open Brain memory before staging Open Brain projection content for RAG.
- Do not cut over Pinecone until failed retrieval checks are corrected with approved public-safe memory content.
- Keep Pinecone as a downstream rebuildable projection; no writes should occur until explicit cutover approval.

