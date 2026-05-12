# Banned Books Rights-Ready Corpus

This workflow builds a U.S.-first banned and challenged books inventory for
rights-cleared RAG ingestion. The first deliverable is a rights-ready shortlist,
not a claim that every globally banned book has been captured.

## Operating Model

The registry is staged in `data/source-protocol/banned-books-rights-ready-corpus.json`
and projected into `/admin/source-protocol` under the `Banned Books` tab.

```bash
npm run banned-books:report
npm run banned-books:report -- --json
```

The projection reuses the existing Source-Respecting LLM Protocol:

- creators map to `source_creators`,
- approved works map to `licensed_works`,
- explicit RAG-only permission maps to `license_grants`,
- full text and chunks map to `source_chunks` only after rights approval,
- usage and payout attribution continue through `answer_receipts`,
  `answer_receipt_chunks`, and `monthly_creator_payouts`.

## Swarm Lanes

The v1 swarm is intentionally MECE:

- Amina, Source Registry Lead: source evidence only.
- Nana Asma'u, Bibliographic Normalizer: canonical work and edition dedupe.
- Yaa Asantewaa, Rights Holder Mapper: likely rightsholder and contact path.
- Nzinga, Outreach Strategist: RAG-only permission packets and follow-up.
- Mansa Musa, Creator Economics Lead: payout simulation assumptions.
- Imhotep, Ingestion Architect: rights-cleared chunking and indexing plan.
- Shaka, Governance Captain: rights, consent, revocation, and sensitivity gates.
- Timbuktu Scribe, QA Archivist: provenance and audit reports.

## Rights Boundary

V1 permission asks for retrieval, citation, summarization, educational use,
optional commercial use, limited excerpt allowance, revocation, and payout
participation. Fine-tuning is excluded unless a later legal review approves it.

Do not ingest copyrighted full text, run OCR, create embeddings, or mark chunks
retrievable until all of these are true:

- active RAG-only license grant,
- verified chain of title,
- sensitivity review complete,
- governance approval recorded.

## Review Loop

Recurring reports should include:

- titles discovered,
- source-evidence coverage,
- rights-ready titles,
- outreach-ready titles,
- outreach sent and responses,
- approvals and blocked works,
- indexed chunks,
- answer receipt accruals,
- monthly payout simulation.
