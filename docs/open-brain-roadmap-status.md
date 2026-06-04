# Open Brain Roadmap Status

Generated: 2026-06-04T09:13:50.199Z

Open Brain is established as the default local-first memory structure. Runtime registration and Pinecone cutover remain the main approval-gated gaps.

Current focus: Retrieval QA for Phase 5 and runtime-specific approval packets for Phase 2.

## phase-1: Lock Open Brain As Canonical Memory

Status: `complete`

Completed:
- Open Brain is documented as the local-first source of truth for durable memory.
- Portfolio is documented as a dashboard, approval, and projection surface only.
- Privacy tiers and forbidden projection paths are documented.

Remaining:
- None.

Gates:
- Durable memories still require proposal approval before promotion.

Evidence:
- docs/open-brain-local-service.md
- docs/memory-context-organization-workflow.md

Next action: Keep new producers aligned with the source -> event -> proposal -> memory contract.

## phase-2: Register Local Open Brain Runtime

Status: `approval_gated`

Completed:
- Runtime registration dry-run packet exists.
- Codex, Hermes, OpenCode/OpenClaw-style agents, Claude Desktop, and Cursor config snippets are generated without mutating configs.

Remaining:
- Register each runtime one at a time after local-state approval.
- Run each runtime doctor/list/manual MCP verification after registration.

Gates:
- Do not edit agent runtime configs without explicit local-state approval.
- Do not copy secrets across agent configs.

Evidence:
- lib/open-brain-runtime-registration.ts
- scripts/open-brain-runtime-registration.ts
- docs/open-brain-local-service.md

Next action: Prepare a runtime-specific approval packet for the next chosen runtime.

## phase-3: Route Producers Into Open Brain

Status: `complete`

Completed:
- Personality corpus, Codex automation inventory, Agent Ops work items/handoffs, RAG shadow plans, AutoResearch proposals, and Model Ops projections have producer routes.
- Producer routes record sanitized source/event traces before durable memory proposals.

Remaining:
- Keep adding producers only through sanitized source/event/proposal flows.

Gates:
- No raw private exports, work item bodies, handoff bodies, secrets, or hosted mutations in producer traces.

Evidence:
- scripts/open-brain-personality-corpus-producer.ts
- scripts/open-brain-automation-producer.ts
- scripts/open-brain-agent-ops-producer.ts
- scripts/open-brain-autoresearch-producer.ts
- app/api/admin/rag-ingest/route.ts
- lib/model-ops-open-brain.ts

Next action: Use producer traces as audit records and keep durable memories approval-gated.

## phase-4: Karpathy Wiki Overlay

Status: `complete`

Completed:
- Wiki overlay compilation is preview-only.
- Wiki pages expose source memory IDs, source IDs, source event IDs, privacy tier, and approval state.
- Private records are excluded from wiki overlays.

Remaining:
- Commit generated wiki pages only through a separate approved repo change.

Gates:
- Do not treat wiki output as canonical memory.

Evidence:
- lib/open-brain.ts
- app/admin/agents/open-brain/page.tsx
- app/api/admin/agents/open-brain/wiki/compile/route.ts

Next action: Use wiki preview for review and traceability, not as a write path.

## phase-5: RAG And Pinecone Projection

Status: `in_progress`

Completed:
- Public-safe Open Brain RAG projection documents carry memory/source IDs, privacy tier, source hash, projection version, deletion key, and rollback key.
- Chatbot knowledge has opt-in JSON mode for public-safe Open Brain projection metadata.
- RAG ingest endpoint records shadow-plan traces and blocks Pinecone writes pending approval.

Remaining:
- Run retrieval-quality tests before production promotion.
- Stage Pinecone ingestion only after explicit cutover approval.
- Verify deletion and rollback keys in any external vector store staging packet.

Gates:
- No raw private exports or unapproved inference can enter chatbot knowledge or Pinecone.
- Pinecone remains downstream and rebuildable from approved Open Brain records.

Evidence:
- lib/chatbot-knowledge.ts
- app/api/knowledge/route.ts
- app/api/admin/rag-ingest/route.ts
- docs/open-brain-local-service.md

Next action: Build a retrieval QA packet for the Open Brain public-safe projection before any Pinecone cutover.

## phase-6: AutoResearch Loop Integration

Status: `complete`

Completed:
- AutoResearch proposals include experiment config, metric gate, not-run result summary, rollback path, promotion recommendation, and forbidden actions.
- Open Brain event metadata and pending proposals carry the experiment trace.
- Experiments, merges, deploys, hosted config mutation, and durable memory writes remain blocked without separate approval.

Remaining:
- After approved experiments run, record metrics and rollback notes as source/event records before proposing durable memories.

Gates:
- AutoResearch cannot execute experiments automatically.

Evidence:
- lib/vercel-deployment-research.ts
- lib/open-brain.ts
- docs/model-ops-autoresearch.md

Next action: Use approval cards to decide the next scoped experiment, then record outcomes as source/event records.
