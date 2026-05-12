# Local-First Open Brain Service

This document defines the Portfolio-facing contract for the local Open Brain. The Open Brain is user-owned local infrastructure; Portfolio Admin is only a dashboard, proposal, and wiki-overlay surface.

## Source Of Truth

- Primary memory owner: local Open Brain service outside the Portfolio repo.
- Default local home: `OPEN_BRAIN_HOME=~/.open-brain`.
- Later storage target: local Postgres with pgvector.
- Local fallback for V1 development: `OPEN_BRAIN_HOME` JSON files for sources, events, links, proposals, and approved memories.
- Optional projection: Portfolio Admin at `/admin/agents/open-brain`.
- Optional mirror: Supabase or hosted dashboards may mirror sanitized metadata later, but must not become the only memory store.

## Core Records

- `sources`: Codex automations, workspace-root reports, repair packets, runbooks, agent runs, handoffs, work items, personality corpus projections, chatbot knowledge bundles, RAG/Pinecone staging plans, AutoResearch proposal packets, and generated wiki pages.
- `events`: append-only observations from tools and agents.
- `memories`: approved facts, decisions, preferences, workflows, risks, and operating rules.
- `links`: relationships between sources, memories, docs, automations, runs, and agents.
- `proposals`: approval-gated requests before durable memory changes are accepted.
- `model_ops`: local LLM benchmark, RAG quality, candidate, cultural-resource, swap-request, and unified router-decision projections.
- `wiki_overlay`: compiled non-canonical pages from approved non-private records.

Every record must carry:

- source id or source path,
- confidence,
- privacy tier,
- fingerprint,
- last observed or created timestamp,
- and an audit trail for approval or rejection when it becomes durable memory.

## Privacy Tiers

- `public_safe`: may be compiled into public-facing docs.
- `client_safe`: usable in client-specific views after client scoping.
- `internal_ops`: visible inside Portfolio Admin and internal runbooks.
- `private`: local-only; never compiled into repo-owned wiki pages.

## Portfolio Boundaries

Portfolio may:

- read sanitized Open Brain status,
- show pending proposals,
- approve or reject proposed memory records,
- compile wiki overlay previews,
- expose public-safe RAG projection previews,
- record sanitized source/event traces from approved producer workflows,
- and show runtime parity status.

Portfolio must not:

- treat generated wiki docs as the source of truth,
- generate durable memories from inference without approval,
- write directly to `~/.codex/memories`, `~/.codex/automations`, Codex SQLite, or Desktop workspace state,
- publish private memory records into repo-owned docs,
- write raw private exports into `/api/knowledge`, wiki pages, or Pinecone,
- ingest Open Brain projections into Pinecone without an explicit cutover approval,
- bifurcate local open-source and frontier model routing into separate user-facing router experiences,
- change production model defaults without an approved Model Ops swap request,
- or assume Codex MCP configuration applies to Hermes, OpenCode, Claude, Cursor, or ChatGPT.

## Model Ops Router Projection

`Local LLM Model Ops & Hermes Automation` is a domain projection inside Open Brain, not a separate router surface. Portfolio Admin should show one governance-aware router status view that can choose local, frontier, hybrid, tool, or approval-gated execution lanes.

The router decision record carries:

- `task_class`
- `selected_runtime`
- `fallback_runtime`
- `execution_lane`
- `confidence`
- `evidence_source`
- `approval_state`
- `reason`

The default policy is conservative:

- local for bounded extraction, scoring, classification, prompt formatting, and retrieval compression,
- frontier for client-facing drafts, strategic copy, ambiguous reasoning, and agent loops without enough local evidence,
- hybrid when local results are promising but still need fallback,
- approval-required for production model swaps and sensitive cultural corpus decisions.

## MCP Tool Contract

The local service should expose these MCP tools:

- `capture_memory`
- `search_memory`
- `get_context_packet`
- `propose_memory_write`
- `list_pending_memory_proposals`
- `link_memory_to_source`
- `compile_wiki_overlay`

The first production MCP registration is an operational-state step. It should be approved separately, because it edits runtime config outside the Portfolio git worktree.

The repo-owned MCP server prototype is `scripts/open-brain-mcp-server.ts`. It exposes the tool names above and stores local JSON records under `OPEN_BRAIN_HOME`, but registering it with Codex, Hermes, OpenCode, Claude, Cursor, or ChatGPT remains a separate local-state change.

## Karpathy Wiki Overlay

Karpathy Wiki pages are compiled views from approved, non-private Open Brain records. Initial pages:

- automation map,
- workspace-root state,
- repair backlog,
- governing runbooks,
- decision log,
- agent handoff map.
- source register,
- memory governance rules,
- AutoResearch experiment ledger.

Generated pages must link back to Open Brain memory ids and source ids. A wiki compile from Portfolio Admin is preview-only until a separate approved repo change commits the markdown.

## Producer Routing

Memory-producing systems should write Open Brain records in this order:

1. `source`: where the evidence or producer output came from.
2. `event`: append-only observation that something changed, was staged, or needs review.
3. `proposal`: suggested durable memory for facts, preferences, decisions, workflows, risks, or operating rules.
4. `memory`: approved durable record after review.
5. `projection`: wiki, Portfolio Admin, chatbot knowledge, Pinecone/RAG, or agent context packet.

Current producer routes:

- Personality corpus: public-safe derived pack appears as a `personality_corpus` source; raw private exports remain outside public projections.
- Chatbot knowledge: `/api/knowledge` remains a public-safe projection, not canonical memory.
- RAG/Pinecone: `/api/admin/rag-ingest` records shadow-plan source/event records and blocks writes pending cutover approval.
- AutoResearch: when `OPEN_BRAIN_AUTORESEARCH_TRACE=true`, proposal creation records `autoresearch_proposal` source/event records; experiments, merges, deploys, hosted config changes, and durable memories remain separately gated. Keep this producer flag off by default until trace volume and privacy behavior are reviewed.
- Model Ops: router decisions and swap requests appear as projection sources; model defaults remain approval-gated.

## RAG And Pinecone Projection

Open Brain-approved `public_safe` memories can be compiled into RAG projection documents. Each projected document must carry:

- Open Brain memory id,
- Open Brain source ids,
- privacy tier,
- source hash,
- projection version,
- deletion key,
- rollback key.

Pinecone remains a downstream projection. It must be rebuildable from approved Open Brain records and must not contain private records, unapproved inferences, or raw private exports.

## V1 Scope

V1 is intentionally narrow:

- Agent Ops, Codex state, personality-corpus public-safe projection metadata, chatbot knowledge projection metadata, RAG shadow-plan traces, AutoResearch proposal traces, and Model Ops projections.
- No broad client, sales, raw personality corpus, or private chat export ingestion.
- Summaries and paths only; no raw secrets or private exports.
- Approval-gated durable writes by default.
- Runtime parity is reported as connected, skipped, or blocked; actual config registration is separate.
