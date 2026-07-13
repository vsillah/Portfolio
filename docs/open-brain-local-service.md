# Local-First Open Brain Service

This document defines the Portfolio-facing contract for the local Open Brain. The Open Brain is user-owned local infrastructure; Portfolio Admin is only a dashboard, proposal, and wiki-overlay surface.

Current implementation status is tracked in `docs/open-brain-roadmap-status.md`. Regenerate it with `npm run open-brain:roadmap-status -- --write docs/open-brain-roadmap-status.md` after completing an Open Brain implementation slice.

## Source Of Truth

- Primary memory owner: local Open Brain service outside the Portfolio repo.
- Default local home: `OPEN_BRAIN_HOME=~/.open-brain`.
- Portfolio source root: defaults to the current repo working directory; set `OPEN_BRAIN_PORTFOLIO_ROOT=/path/to/Portfolio` when launching the MCP server or projection scripts from another directory.
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

## Private Creative Manuscript Summaries

Codex Chronicles and other private manuscripts can be indexed into Open Brain as chapter-level private memories without copying raw manuscript text into the Portfolio repo, public wiki overlays, chatbot knowledge, Pinecone, or public RAG.

The producer is:

```bash
npm run open-brain:manuscript-summaries
```

By default it runs in dry-run mode. It reads private `creative_manuscript` source records from `OPEN_BRAIN_HOME/sources.json`, resolves matching plain-text exports from `OPEN_BRAIN_MANUSCRIPT_EXPORT_DIR` or `~/.open-brain/private-vault/manuscripts`, detects chapter headings, and reports the private memory records it would create.

To write private chapter summaries into the local Open Brain:

```bash
npm run open-brain:manuscript-summaries -- --write
```

Source handling rules:

- Google Docs should be exported as `.txt` files into the private manuscript vault before running the producer.
- The producer writes `private` memory records only.
- The producer records provenance events with `rawFullTextIncluded: false`.
- The CLI output is sanitized and does not print chapter bodies or raw manuscript text.
- Generated chapter summaries are retrieval and orientation aids; they do not replace a human literary summary.

## Runtime Registration Packet

Phase 2 uses a dry-run registration packet before any agent config is edited:

```bash
npm run open-brain:runtime-registration
```

The packet reports:

- the resolved `OPEN_BRAIN_HOME`,
- the Portfolio root used by the MCP server,
- the exact stdio MCP command,
- runtime-specific config snippets for Codex, Hermes, OpenCode/OpenClaw-style agents, Claude Desktop, and Cursor,
- per-runtime registration status,
- and verification commands for each runtime.

To save a reviewable packet without changing agent configs:

```bash
npm run open-brain:runtime-registration -- --write tmp/open-brain-runtime-registration.md
```

The planner is intentionally non-mutating. It does not create or edit `~/.codex/config.toml`, `~/.hermes/config.yaml`, Cursor/Claude/OpenCode config files, or durable Open Brain memory records. Actual runtime registration remains a local-state approval step and should be performed one runtime at a time, followed by that runtime's own doctor/list/manual MCP verification.

## LM Studio Bridge

LM Studio should connect to Open Brain through its MCP integration, not through a separate static `rag-v1` document index. Open Brain remains the governed memory layer; LM Studio is the local model workbench that can call read-only search/context tools, proposal-gated memory tools, and a guarded Portfolio patch lane.

Current local registration shape:

```json
{
  "mcpServers": {
    "open-brain": {
      "command": "/Users/vambahsillah/.hermes/bin/open-brain-mcp"
    }
  }
}
```

Operational-state boundary:

- This config lives at `~/.lmstudio/mcp.json`, outside the Portfolio git worktree.
- Editing it requires an explicit local-state action and should be backed up first.
- The `mcp/open-brain` integration may lazy-start only when a tool call is requested.
- A healthy active tool call has an LM Studio-owned `mcpbridgeworker.js` process with an Open Brain MCP server child.
- Stale MCP server processes from manual smoke tests can be stopped, but do not stop the LM Studio-owned bridge while a tool call is active.

Recommended LM Studio usage:

- Start Open Brain prompts from a fresh chat when testing local models. Old chats can exceed the model context window and make tool behavior look broken.
- Keep the `open-brain` integration chip attached to the chat.
- Approve `search_memory` when the model asks for read-only retrieval.
- Do not grant blanket approval to all Open Brain tools unless a separate trust policy is approved.
- If a local model repeats the same search request, deny the repeated call with a reason and tell the model to answer from the already returned context.
- For Portfolio or Open Brain repo updates, start with `get_update_workspace_context`, then `read_update_target`, then `apply_portfolio_patch` with `apply=false`.
- Only apply a local patch after reviewing the dry-run result. Actual application requires `apply=true`, the approval phrase `APPLY PORTFOLIO PATCH`, and human approval of the LM Studio tool call.
- The patch lane applies local files only. It does not commit, push, deploy, change hosted settings, or approve durable Open Brain memory.
- Use explicit prompts for Qwen-style reasoning models:

```text
Use mcp/open-brain. Call search_memory once with query "<topic>". After the tool result, stop using tools and answer in one paragraph. Do not call search_memory again unless I ask.
```

For local update work, use this prompt pattern:

```text
Use mcp/open-brain as the update lane. First call get_update_workspace_context. Then read only the files needed. Prepare a unified diff and call apply_portfolio_patch with apply=false. Stop after the dry run and ask me before applying.
```

LM Studio update tools:

- `get_update_workspace_context`: reports Portfolio root, branch/status, Open Brain health, allowed scopes, and update boundaries.
- `read_update_target`: reads a scoped text file from the Portfolio worktree. It blocks secrets, private folders, generated media, binary files, and paths outside the repo.
- `apply_portfolio_patch`: checks or applies a unified diff. Dry-run is the default. Applying requires `apply=true`, `approvalPhrase="APPLY PORTFOLIO PATCH"`, and LM Studio tool approval.

Allowed patch scopes:

- `open_brain`: `docs/open-brain*`, `scripts/open-brain*`, `lib/open-brain*`, `lib/model-ops-open-brain*`, `/admin/agents/open-brain`, and `/api/admin/agents/open-brain` files.
- `portfolio`: `docs`, `app`, `components`, `lib`, `scripts`, `package.json`, and `package-lock.json`.

Blocked paths include env files, `local-private`, `.git`, `.next`, `.vercel`, `node_modules`, and generated/binary media.

Validation commands:

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"lm-studio-smoke","version":"1.0"}}}\n' | /Users/vambahsillah/.hermes/bin/open-brain-mcp | head -1
openbrain-ask --model qwen3.6-27b-optiq --limit 1 "In one sentence, name one Open Brain boundary."
npm test -- --run scripts/open-brain-mcp-server.test.ts
```

Expected boundary answer:

```text
Durable Open Brain memory writes require approval before they become part of the verified record.
```

Troubleshooting:

- If LM Studio shows `mcp/open-brain` disconnected, verify `~/.lmstudio/mcp.json`, toggle the integration off and back on, then retry from a fresh chat.
- If the chat context indicator is above 100%, create a new chat before testing tools again.
- If `openbrain-ask` works but LM Studio loops on tool calls, the issue is the model planner or chat context, not the Open Brain server.
- If direct MCP initialization fails, inspect `.env.local`, `OPEN_BRAIN_HOME`, and the wrapper at `/Users/vambahsillah/.hermes/bin/open-brain-mcp`.

### OpenClaw Evaluation Gate

OpenClaw is not required for Phase 2 parity unless it proves value beyond the already connected runtimes. Treat it as an evaluation candidate, not an install-by-default dependency.

Before installing or registering OpenClaw, confirm:

- it supports the local Open Brain MCP stdio server without copying secrets or weakening approval gates,
- it can consume generated personality-pack exports without drifting from the canonical corpus,
- durable memory writes remain proposal-gated, auditable, reversible, and local-first,
- it provides coding, planning, long-running execution, or interoperability value Hermes does not already cover,
- and setup, auth, config backups, doctor/list verification, and rollback are maintainable across future parity checks.

If those criteria are not met, keep OpenClaw on the migration watch list and defer installation.

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

- Personality corpus: public-safe derived pack appears as a `personality_corpus` source; raw private exports remain outside public projections. The local private corpus home is `/Users/vambahsillah/Projects/Portfolio/.local/personality-corpus`; the old generated Codex path is compatibility fallback only. Run `npm run open-brain:personality-corpus` to persist the public-safe source/event trace and a deterministic pending memory proposal into `OPEN_BRAIN_HOME` without copying raw private corpus content, promoting durable memory, or writing Pinecone.
- Codex automation inventory: Portfolio-related automation and repair-packet summaries appear as `codex_automation` and `repair_packet` sources. Run `npm run open-brain:automation-producer` to persist internal-ops source/event traces without copying raw automation prompts.
- Agent Ops work items and handoffs: active work items appear as `work_item` sources and latest handoffs appear as `handoff` sources. Run `npm run open-brain:agent-ops-producer` to persist internal-ops source/event traces and deterministic review proposals for blocked or review-ready work without copying full work-item or handoff bodies.
- Chatbot knowledge: `/api/knowledge` remains a public-safe projection, not canonical memory.
- RAG/Pinecone: `/api/admin/rag-ingest` records shadow-plan source/event records and blocks writes pending cutover approval.
- AutoResearch: when `OPEN_BRAIN_AUTORESEARCH_TRACE=true`, proposal creation records `autoresearch_proposal` source/event records; experiments, merges, deploys, hosted config changes, and durable memories remain separately gated. Keep this producer flag off by default until trace volume and privacy behavior are reviewed. Run `npm run open-brain:autoresearch-producer` to persist Vercel AutoResearch proposal source/event traces and pending review proposals without executing experiments or changing hosted settings. Each proposal trace must carry its experiment config, metric gate, `not_run` result summary, rollback path, promotion recommendation, and forbidden actions so approval cards can evaluate the next scoped action without implying permission to run it.
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

Before any Pinecone cutover, run the local retrieval QA packet:

```bash
npm run open-brain:rag-retrieval-qa -- --write docs/open-brain-rag-retrieval-qa.md
```

The packet evaluates only approved `public_safe` Open Brain RAG projection documents. It checks expected retrieval matches, projection metadata completeness, privacy leakage patterns, and keeps `pineconeWriteStatus` at `blocked_pending_approval`. A failing packet is a cutover blocker, not a reason to weaken privacy tiers or ingest raw sources.

`GET /api/knowledge` and `GET /api/knowledge/chatbot` remain backwards-compatible plain-text public-safe chatbot bundles by default. Operators can request `?format=json&include_open_brain=true` to preview the same curated bundle with optional Open Brain public-safe RAG projection documents and provenance metadata. This JSON mode does not write Pinecone, does not promote memories, and does not include non-`public_safe` Open Brain records.

## V1 Scope

V1 is intentionally narrow:

- Agent Ops, Codex state, personality-corpus public-safe projection metadata, chatbot knowledge projection metadata, RAG shadow-plan traces, AutoResearch proposal traces, and Model Ops projections.
- No broad client, sales, raw personality corpus, or private chat export ingestion.
- Summaries and paths only; no raw secrets or private exports.
- Approval-gated durable writes by default.
- Runtime parity is reported as connected, skipped, or blocked; actual config registration is separate.
