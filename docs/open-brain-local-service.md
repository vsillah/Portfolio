# Local-First Open Brain Service

This document defines the Portfolio-facing contract for the local Open Brain. The Open Brain is user-owned local infrastructure; Portfolio Admin is only a dashboard, proposal, and wiki-overlay surface.

## Source Of Truth

- Primary memory owner: local Open Brain service outside the Portfolio repo.
- Default storage target: local Postgres with pgvector.
- Local fallback for V1 development: `OPEN_BRAIN_HOME` JSON files for proposals and approved memories.
- Optional projection: Portfolio Admin at `/admin/agents/open-brain`.
- Optional mirror: Supabase or hosted dashboards may mirror sanitized metadata later, but must not become the only memory store.

## Core Records

- `sources`: Codex automations, workspace-root reports, repair packets, runbooks, agent runs, handoffs, work items, and generated wiki pages.
- `events`: append-only observations from tools and agents.
- `memories`: approved facts, decisions, preferences, workflows, risks, and operating rules.
- `links`: relationships between sources, memories, docs, automations, runs, and agents.
- `proposals`: approval-gated requests before durable memory changes are accepted.
- `model_ops`: local LLM benchmark, RAG quality, candidate, cultural-resource, swap-request, and unified router-decision projections.

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
- and show runtime parity status.

Portfolio must not:

- treat generated wiki docs as the source of truth,
- generate durable memories from inference without approval,
- write directly to `~/.codex/memories`, `~/.codex/automations`, Codex SQLite, or Desktop workspace state,
- publish private memory records into repo-owned docs,
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

## Karpathy Wiki Overlay

Karpathy Wiki pages are compiled views from approved, non-private Open Brain records. Initial pages:

- automation map,
- workspace-root state,
- repair backlog,
- governing runbooks,
- decision log,
- agent handoff map.

Generated pages must link back to Open Brain memory ids and source ids. A wiki compile from Portfolio Admin is preview-only until a separate approved repo change commits the markdown.

## V1 Scope

V1 is intentionally narrow:

- Agent Ops and Codex state only.
- No broad client, sales, or personality corpus ingestion.
- Summaries and paths only; no raw secrets or private exports.
- Approval-gated durable writes by default.
- Runtime parity is reported as connected, skipped, or blocked; actual config registration is separate.
