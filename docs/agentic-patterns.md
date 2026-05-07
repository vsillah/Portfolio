# Agentic Patterns Scorecard

Single source of truth for how this repo applies the 20 agentic AI design patterns (framing from the talk linked in the April 2026 planning session). Companion to the Cursor rule at [`.cursor/rules/agentic-patterns.mdc`](../.cursor/rules/agentic-patterns.mdc) — the rule tells you *when* to use each pattern, this doc tells you *where* we already do, where we don't, and what to build next.

Keep this doc in sync with reality: any PR that touches an agentic flow must update the relevant section.

## Canonical list (4 buckets)

Our pinned 20 patterns, grouped the same way as the talk:

- **Grounding:** Prompt Chaining, Routing, Parallelization, Tool Use, RAG.
- **Transparent decision-making:** Planning/Orchestration, Chain-of-Thought, Tree-of-Thought, Multi-Agent Collaboration, Goal Tracking.
- **Self-awareness / QA:** Reflection, Debate, Self-Consistency, Learning & Feedback, Memory Management.
- **Production constraints:** Exception Handling, Human-in-the-Loop, Guardrails & Safety, Monitoring & Observability, Cost/Resource Control.

## Coverage at a glance

| # | Pattern | Bucket | Coverage |
|---|---|---|---|
| 1 | Prompt Chaining | Grounding | Strong |
| 2 | Routing | Grounding | Strong (n8n) / Absent (app) |
| 3 | Parallelization | Grounding | Partial |
| 4 | Tool Use | Grounding | Strong (n8n) / Partial (app) |
| 5 | RAG | Grounding | Strong |
| 6 | Planning / Orchestration | Transparent | Strong |
| 7 | Chain-of-Thought | Transparent | Minimal / trace-ready |
| 8 | Tree-of-Thought | Transparent | Absent |
| 9 | Multi-Agent Collaboration | Transparent | Partial / org-mapped |
| 10 | Goal Tracking | Transparent | Strong in Agent Ops / Partial in legacy flows |
| 11 | Reflection | Self-awareness | Minimal |
| 12 | Debate | Self-awareness | Absent |
| 13 | Self-Consistency | Self-awareness | Absent |
| 14 | Learning & Feedback | Self-awareness | Partial |
| 15 | Memory Management | Self-awareness | Partial |
| 16 | Exception Handling | Production | Partial / improving |
| 17 | Human-in-the-Loop | Production | Strong on publish / Partial elsewhere |
| 18 | Guardrails & Safety | Production | Strong (authz) / Partial (content) |
| 19 | Monitoring & Observability | Production | Strong in Agent Ops / Partial in legacy flows |
| 20 | Cost/Resource Control | Production | Strong post-hoc / Partial pre-flight |

Coverage scale: **Strong** (consistent, reusable, tested) · **Partial** (present in some flows) · **Minimal** (one-off or offline only) · **Absent** (no deliberate implementation).

---

## Per-pattern sections

Each section follows the same template: *Definition · Where we use it today · Coverage · Gaps · Retrofit backlog*.

### 1. Prompt Chaining — Grounding

**Definition.** Break a single task into a sequence of LLM (or LLM + code) steps so each has a narrow, testable job.

**Where we use it today.**
- The social content pipeline (WF-SOC-001) chains extract topics → copy → image → voice → draft (see [`docs/admin-sales-lead-pipeline-sop.md`](admin-sales-lead-pipeline-sop.md) §15.1).
- Meeting Complete Handler ([`n8n-exports/WF-MCH-Meeting-Complete-Handler.json`](../n8n-exports/WF-MCH-Meeting-Complete-Handler.json)) chains multiple agent nodes.
- Build-time chain for chatbot knowledge via [`scripts/build-chatbot-knowledge.ts`](../scripts/build-chatbot-knowledge.ts) (pre-generates `lib/chatbot-knowledge-content.generated.ts`).

**Coverage.** Strong.

**Gaps.** None critical. App-layer chains are rare but also rarely needed (most chains live in n8n).

**Retrofit backlog.** None.

---

### 2. Routing — Grounding

**Definition.** A classifier decides which downstream branch (agent, workflow, model tier) handles the input.

**Where we use it today.**
- [`n8n-exports/WF-CAL-Calendly-Webhook-Router.json`](../n8n-exports/WF-CAL-Calendly-Webhook-Router.json) — routes calendar events to the right downstream workflow.
- [`n8n-exports/Client-Progress-Update-Router.json`](../n8n-exports/Client-Progress-Update-Router.json) — routes client progress updates.
- Diagnostic vs chatbot split documented in [`N8N_DIAGNOSTIC_SETUP.md`](../N8N_DIAGNOSTIC_SETUP.md).

**Coverage.** Strong at the n8n layer, **Absent** at the app layer (no policy/model router).

**Gaps.**
- App-side code hard-codes model IDs and providers per call site; no central place to switch by tenant/tier/feature flag.
- No "default branch" convention for routers in n8n — silent drops possible on unknown inputs.

**Retrofit backlog.** Ticket [#5](#top-retrofit-tickets) — app-layer policy router.

---

### 3. Parallelization — Grounding

**Definition.** Execute independent sub-tasks concurrently when they share no mutable state.

**Where we use it today.**
- Playwright `fullyParallel: true` in [`playwright.config.ts`](../playwright.config.ts).
- Some n8n branches fan out for independent enrichments.

**Coverage.** Partial.

**Gaps.**
- Lead Research Agent ([`n8n-exports/Lead-Research-and-Qualifying-Agent.json`](../n8n-exports/Lead-Research-and-Qualifying-Agent.json)) runs Perplexity/LinkedIn/Glassdoor/news lookups sequentially even though they are independent.
- App-layer agentic code uses `await` chains where `Promise.all` would be safe (e.g. onboarding content, outreach generation sub-steps).

**Retrofit backlog.**
- Identify 2–3 sequential n8n branches that can be parallelized; measure wall-clock before/after.
- Add a `Promise.all` audit pass during the reflection wrapper ticket ([#2](#top-retrofit-tickets)).

---

### 4. Tool Use — Grounding

**Definition.** The LLM calls external tools (APIs, databases, vector stores, deterministic code) instead of hallucinating.

**Where we use it today.**
- LangChain `agent` + `toolVectorStore` + Perplexity HTTP tools across n8n exports, most richly in [`n8n-exports/Lead-Research-and-Qualifying-Agent.json`](../n8n-exports/Lead-Research-and-Qualifying-Agent.json) (research tools mandated in the system prompt).
- [`n8n-exports/RAG-Chatbot-for-AmaduTown-using-Google-Gemini.json`](../n8n-exports/RAG-Chatbot-for-AmaduTown-using-Google-Gemini.json) — vector store tool + Pinecone + OpenAI embeddings.

**Coverage.** Strong in n8n; Partial in app.

**Gaps.**
- App-layer LLM callers like [`lib/ai-onboarding-generator.ts`](../lib/ai-onboarding-generator.ts) do not expose a tool-calling abstraction — they shove context into the prompt string.
- No shared convention for defining a tool schema once and reusing across call sites.

**Retrofit backlog.**
- Introduce a thin `lib/llm/tools.ts` (tool registry + typed schemas) once ticket [#5](#top-retrofit-tickets) lands; adopt in onboarding generator first.

---

### 5. RAG — Grounding

**Definition.** Retrieve relevant documents at query time and inject them into the LLM context.

**Where we use it today.**
- [`n8n-exports/WF-RAG-INGEST-Google-Drive-→-Pinecone-Ingestion-(Daily).json`](../n8n-exports/WF-RAG-INGEST-Google-Drive-→-Pinecone-Ingestion-(Daily).json) — daily Pinecone ingestion.
- [`n8n-exports/RAG-Chatbot-for-AmaduTown-using-Google-Gemini.json`](../n8n-exports/RAG-Chatbot-for-AmaduTown-using-Google-Gemini.json) — Gemini + Pinecone runtime query.
- Social pipeline references a dedicated `amadutown-rag-query` webhook in [`docs/admin-sales-lead-pipeline-sop.md`](admin-sales-lead-pipeline-sop.md).

**Coverage.** Strong.

**Gaps.**
- No evaluator of retrieval quality (top-k relevance, recall on a held-out set).
- No visibility into which chunks were retrieved per answer — hard to debug bad answers.

**Retrofit backlog.**
- Add a retrieval-debug field to chat responses in admin mode (top-k chunk ids + similarity scores).
- Run a quarterly RAG eval using a 20-item golden set; track in the scorecard.

---

### 6. Planning / Orchestration — Transparent decision-making

**Definition.** A top-level controller sequences multiple agents or workflows toward a goal, handling state and handoffs.

**Where we use it today.**
- Client lifecycle workflows WF-000 through WF-012 (see [`n8n-exports/manifest.json`](../n8n-exports/manifest.json)) together form an orchestrated pipeline.
- [`lib/testing/orchestrator.ts`](../lib/testing/orchestrator.ts) orchestrates simulated clients for E2E testing.
- Agent Operations Mission Control (`/admin/agents`) is the app-level operating room for routed agent work: status strip, Agent Inbox, Engagement Work Queue, War Room, Operating Signals, runtime controls, and trace drilldowns.
- `lib/agent-organization.ts` maps Chief of Staff, Research & Knowledge, Content Production, Product & Automation, and Publishing & Follow-Up pods to active or planned agent entries.

**Coverage.** Strong.

**Gaps.**
- The generic Agent Ops surface is strong, but some domain pages still use legacy workflow status tables as their first status source.
- App-side orchestration is intentionally read-only in V1 for Chief of Staff, War Room, inbox routing, and agent dispatch; production mutations remain approval-gated.

**Retrofit backlog.**
- Evaluate extracting the testing orchestrator's core into `lib/orchestrator/` once we have a second non-test caller.
- Keep migrating high-value workflow families into the shared trace envelope while preserving domain-specific progress tables where they still add UI value.

---

### 7. Chain-of-Thought — Transparent decision-making

**Definition.** Capture the model's intermediate reasoning so decisions are auditable, not just opaque outputs.

**Where we use it today.** `agent_run_steps.reasoning` exists as an optional trace field for call sites that deliberately persist concise, review-safe rationale. Most flows still store step names, input/output summaries, events, artifacts, and outcomes rather than full reasoning.

**Coverage.** Minimal / trace-ready.

**Gaps.**
- Reasoning capture is opt-in and not broadly populated.
- Private or sensitive reasoning should be summarized, not exposed as raw model internals.

**Retrofit backlog.**
- Add concise reasoning summaries first to admin-only review flows where they materially improve audit quality, such as approval recommendations, routing decisions, and evaluation results.

---

### 8. Tree-of-Thought — Transparent decision-making

**Definition.** Branch into multiple candidate reasoning paths, score them, prune.

**Where we use it today.** Nowhere.

**Coverage.** Absent.

**Gaps.** Not currently needed. Document as "evaluate case-by-case" — do not adopt without a concrete problem that single-pass reasoning fails on.

**Retrofit backlog.** None. Reassess annually.

---

### 9. Multi-Agent Collaboration — Transparent decision-making

**Definition.** Multiple specialized agents (researcher, writer, critic, etc.) cooperate, each with its own prompt and tools.

**Where we use it today.**
- [`n8n-exports/WF-MCH-Meeting-Complete-Handler.json`](../n8n-exports/WF-MCH-Meeting-Complete-Handler.json) — multiple agent nodes in sequence.
- [`n8n-exports/RAG-Chatbot-for-AmaduTown-using-Google-Gemini.json`](../n8n-exports/RAG-Chatbot-for-AmaduTown-using-Google-Gemini.json) — six diagnostic category agents (Tech Stack, Business Challenges, Automation Needs, AI Readiness, Budget/Timeline, Decision Making) with independent memory buffers.
- [`n8n-exports/HeyGen-Cold-Email---Sub-Agent---Jono-Catliff.json`](../n8n-exports/HeyGen-Cold-Email---Sub-Agent---Jono-Catliff.json) — sub-agent pattern for cold email.
- [`n8n-exports/WF-CLG-002-Outreach-Generation.json`](../n8n-exports/WF-CLG-002-Outreach-Generation.json) — multiple agent nodes.
- Agent Operations now has an explicit organization map in `lib/agent-organization.ts`, seeded registry rows, read-only engagement requests, War Room standups/discussions, and `agent_handoffs` available in the shared schema.

**Coverage.** Partial / org-mapped.

**Gaps.**
- The shared `agent_handoffs` table exists, but most production workflows still need to adopt it deliberately.
- No shared memory schema; per-lead facts produced by one agent are often not reused by the next.

**Retrofit backlog.**
- Define a `lead_state` JSON schema used as the handoff payload between agents in the cold-lead pipeline (WF-CLG-001 → 002 → 003 → 004).
- Add the first production `agent_handoffs` adoption only after the participating workflow family is already trace-linked.

---

### 10. Goal Tracking — Transparent decision-making

**Definition.** The agent knows what "done" looks like and reports progress toward it.

**Where we use it today.**
- RAG chatbot diagnostic flow tracks `{ completedCategories, questionsAsked, responsesReceived }` in n8n code nodes.
- Milestone workflows WF-006, WF-009, WF-012 track lifecycle goals.
- Agent Operations tracks cross-runtime run goals through statuses, current step, stale thresholds, approvals, artifacts, and outcomes.
- Mission Control derives Agent Inbox, Dead-Letter Monitor, Daily Operating Brief, Operating Signals, and Engagement Work Queue from the shared traces.

**Coverage.** Strong in Agent Ops; Partial in legacy/domain flows.

**Gaps.**
- Some workflow-specific progress remains local to legacy tables until each family adopts `agent_run_id` and generic callbacks.
- Entity-level progress such as "this lead is 60% through diagnostic" still needs richer projections from domain state into the shared admin view.

**Retrofit backlog.**
- Surface diagnostic progress on the admin lead detail page using shared trace links plus domain progress where needed.

---

### 11. Reflection — Self-awareness / QA

**Definition.** The agent (or a critic) reviews a draft output and revises it before shipping.

**Where we use it today.**
- Offline/post-hoc only: [`lib/llm-judge.ts`](../lib/llm-judge.ts), [`lib/source-validator/llm-judge.ts`](../lib/source-validator/llm-judge.ts), [`app/api/admin/llm-judge/route.ts`](../app/api/admin/llm-judge/route.ts), [`app/api/admin/chat-eval/diagnose/route.ts`](../app/api/admin/chat-eval/diagnose/route.ts).

**Coverage.** Minimal — no **inline** reflection before user-facing output.

**Gaps.**
- Outreach generation and AI onboarding content ship first-pass output with no self-critique.
- The existing llm-judge logic is not reusable as a generic "review-then-revise" wrapper.

**Retrofit backlog.** Ticket [#2](#top-retrofit-tickets) — inline reflection wrapper.

---

### 12. Debate — Self-awareness / QA

**Definition.** Run N model/prompt variants, have them argue, pick the winner.

**Where we use it today.** Nowhere.

**Coverage.** Absent.

**Gaps.**
- Lead qualification scoring could benefit — single-pass score is brittle for borderline leads.

**Retrofit backlog.**
- Prototype: run two different system prompts for lead AI-readiness scoring and reconcile. Use the shared trace/cost layer to compare quality, latency, and spend before promoting.

---

### 13. Self-Consistency — Self-awareness / QA

**Definition.** Sample N answers from the same model and aggregate (majority vote, median).

**Where we use it today.** Nowhere.

**Coverage.** Absent.

**Gaps.**
- Diagnostic category classification (does this message belong to Tech Stack or AI Readiness?) is currently a single call.

**Retrofit backlog.**
- A/B test self-consistency (N=3) vs single-call for diagnostic routing with `agent_run_id` cost linkage enabled.

---

### 14. Learning & Feedback — Self-awareness / QA

**Definition.** Outcomes feed back into prompts, retrieval, or routing policies.

**Where we use it today.**
- [`components/PrototypeFeedback.tsx`](../components/PrototypeFeedback.tsx) + `/api/prototypes/[id]/feedback` — collects user feedback.
- Chat-eval system under `app/admin/chat-eval/*` and [`app/api/admin/chat-eval/*`](../app/api/admin/chat-eval) scores transcripts.
- `lib/source-validator/llm-judge.ts` validates sources.

**Coverage.** Partial — we collect feedback but the loop to prompt/workflow updates is manual.

**Gaps.**
- No automated prompt regression tests keyed to feedback outcomes.
- No dashboard showing reply rate / conversion by outreach template over time.

**Retrofit backlog.**
- Weekly job aggregating chat-eval scores → Slack digest.
- Outreach template win/loss dashboard using shared trace and cost links where available.

---

### 15. Memory Management — Self-awareness / QA

**Definition.** Short-term (conversation) and long-term (per-entity facts) memory with explicit scoping and TTL.

**Where we use it today.**
- `@n8n/n8n-nodes-langchain.memoryBufferWindow` nodes in the RAG chatbot (six distinct windows — one per diagnostic agent).
- Session progress objects tracked in n8n code nodes.

**Coverage.** Partial.

**Gaps.**
- No long-term cross-workflow memory — facts learned in Lead Research Agent are not automatically available to Outreach Generation.
- No TTL or tenant scoping on memory stores.

**Retrofit backlog.**
- Design a `lead_memory` Supabase table storing structured facts per lead (AI readiness score, pain points, champions) written by any agent and readable by downstream agents.

---

### 16. Exception Handling — Production constraints

**Definition.** Network, LLM, and tool errors are caught, retried, logged, and surfaced with a user-safe message.

**Where we use it today.**
- Runtime gates: [`lib/n8n-runtime-flags.ts`](../lib/n8n-runtime-flags.ts) (`isN8nOutboundDisabled`, `isMockN8nEnabled`).
- User-facing error hygiene enforced by [`.cursor/rules/no-expose-errors-to-users.mdc`](../.cursor/rules/no-expose-errors-to-users.mdc).
- Trigger functions in [`lib/n8n.ts`](../lib/n8n.ts) return `{ triggered, message }` shape.
- Agent Operations marks failed and stale runs, derives a Dead-Letter Monitor from those traces, lets stale sweeps report checked/marked counts by runtime, and can create read-only recovery requests with retry/backoff metadata.
- [`lib/llm/with-retry.ts`](../lib/llm/with-retry.ts) provides a shared capped backoff helper with configurable retryable error matching and a give-up hook.
- n8n trigger calls use the shared helper for transient network and gateway failures while preserving generic user-facing failure messages.
- Central OpenAI/Anthropic JSON dispatch in [`lib/llm-dispatch.ts`](../lib/llm-dispatch.ts) uses the shared helper for retryable provider statuses.
- The source-validator LLM judge in [`lib/source-validator/llm-judge.ts`](../lib/source-validator/llm-judge.ts) uses the shared helper instead of a bespoke retry loop.

**Coverage.** Partial / improving.

**Gaps.**
- Direct LLM call sites still need to adopt the shared retry helper where transient provider failures are expected.
- Dead-letter visibility and routed recovery requests exist for Agent Ops traces, but some provider-call retry wrappers are still call-site specific.

**Retrofit backlog.** Continue Ticket [#3](#top-retrofit-tickets) by adopting the shared helper across remaining direct LLM/provider calls.

---

### 17. Human-in-the-Loop — Production constraints

**Definition.** A human approves AI-generated content before it reaches a client, prospect, or public channel.

**Where we use it today.**
- Social content queue: drafts → admin review → approve → publish (WF-SOC-001 → admin UI → WF-SOC-002), documented in [`docs/admin-sales-lead-pipeline-sop.md`](admin-sales-lead-pipeline-sop.md) §15.
- Gmail draft reply workflow [`n8n-exports/WF-GDR-Gmail-Draft-Reply.json`](../n8n-exports/WF-GDR-Gmail-Draft-Reply.json) — drafts, does not auto-send.

**Coverage.** Strong on publish paths; Partial on pre-publish content.

**Gaps.**
- Audit every path that produces client-bound AI content and confirm a review state exists: outreach generation ([`lib/outreach-queue-generator.ts`](../lib/outreach-queue-generator.ts)), AI onboarding content ([`lib/ai-onboarding-generator.ts`](../lib/ai-onboarding-generator.ts)), client progress updates.

**Retrofit backlog.**
- One-page HITL audit: for each AI output destination, document whether a human sees it before it ships.

---

### 18. Guardrails & Safety — Production constraints

**Definition.** Authz, content-safety, and output validation applied before AI artifacts leave the system.

**Where we use it today.**
- Authz: Supabase RLS (see [`.cursor/rules/supabase-rls.mdc`](../.cursor/rules/supabase-rls.mdc)), `verifyAdmin` for admin routes, Bearer `N8N_INGEST_SECRET` for ingest routes.
- User-facing error hygiene ([`.cursor/rules/no-expose-errors-to-users.mdc`](../.cursor/rules/no-expose-errors-to-users.mdc)).

**Coverage.** Strong on authz; Partial on content-safety.

**Gaps.**
- No content-safety check before LinkedIn publish in [`lib/publishing/linkedin.ts`](../lib/publishing/linkedin.ts) — a jailbroken draft could slip through HITL by social-engineering the reviewer.
- No output-schema validation for structured LLM responses across call sites.

**Retrofit backlog.** Ticket [#4](#top-retrofit-tickets) — content-safety gate before LinkedIn publish.

---

### 19. Monitoring & Observability — Production constraints

**Definition.** Every agent run produces a trace: `run_id`, steps, latency, tokens/$ cost, outcome.

**Where we use it today.**
- [`app/api/admin/cost-events/ingest/route.ts`](../app/api/admin/cost-events/ingest/route.ts) and [`lib/cost-calculator.ts`](../lib/cost-calculator.ts) — cost accounting.
- [`n8n-exports/WF-MON-001-Apify-Actor-Health-Monitor.json`](../n8n-exports/WF-MON-001-Apify-Actor-Health-Monitor.json) — actor health monitor.
- DB health check (`scripts/database-health-check.ts`) — referenced in [`CLAUDE.md`](../CLAUDE.md).
- Shared Agent Ops trace tables: `agent_runs`, `agent_run_steps`, `agent_run_events`, `agent_run_artifacts`, `agent_handoffs`, and `agent_approvals`.
- `/admin/agents`, `/admin/agents/runs`, and `/admin/agents/runs/[runId]` show mission control state, active/recent runs, timeline detail, costs, approvals, events, and artifacts.
- n8n social content, value evidence, and warm lead workflows dispatch `agent_run_id` plus the `agent_trace` callback envelope.
- Morning review, deployment watcher, Hermes health, War Room, Slack commands, stale sweep, runtime evaluation, and approval drills all write observable Agent Ops traces.

**Coverage.** Strong in Agent Ops; Partial in legacy/domain flows.

**Gaps.**
- Legacy workflow-specific tables still hold some primary progress detail until each workflow family is trace-linked or documented as domain-specific detail.
- Not every LLM/n8n call site emits latency, token, and cost fields consistently yet.

**Retrofit backlog.**
- Continue migrating workflow families into the shared trace envelope.
- Keep workflow-specific run tables only where they store useful domain state, as mapped in [`docs/agent-operations-rollout.md`](agent-operations-rollout.md).

---

### 20. Cost/Resource Control — Production constraints

**Definition.** Each agent call declares model tier, token cap, and per-request budget — no implicit blank-check calls.

**Where we use it today.**
- [`lib/cost-calculator.ts`](../lib/cost-calculator.ts) computes post-hoc costs.
- [`lib/agent-budget-policy.ts`](../lib/agent-budget-policy.ts) defines pre-flight per-runtime LLM warning and cap rules.
- Chief of Staff chat checks the Agent Ops budget policy before dispatch and logs the decision in its trace metadata.
- Outreach email and LinkedIn draft generation check the manual-runtime budget before dispatch, trace warning/block decisions, and persist the decision in draft provenance.
- Admin delivery email draft generation checks the manual-runtime budget before OpenAI dispatch and links cost events to its Agent Ops trace.
- Admin meeting lead extraction checks the manual-runtime budget before OpenAI dispatch and links cost events to its Agent Ops trace.
- AI onboarding preview generation checks the manual-runtime budget before dispatch and links admin-triggered previews to a manual Agent Ops run.
- Admin audit-from-meetings generation checks the manual-runtime budget before OpenAI dispatch and links cost events to its Agent Ops trace.
- Admin video prompt formatting checks the manual-runtime budget before OpenAI dispatch and links cost events to its Agent Ops trace.
- Admin video ideas generation checks the manual-runtime budget after context assembly and before GPT-4o dispatch, then links cost events to its Agent Ops trace.
- Admin social carousel conversion checks the manual-runtime budget before GPT-4o dispatch and links cost events to its Agent Ops trace.
- Admin in-person diagnostic insight generation checks the manual-runtime budget before GPT-4o-mini dispatch and links cost events to its Agent Ops trace.
- Admin meeting pain classification checks the manual-runtime budget before GPT-4o-mini fallback classification and links AI fallback cost events to its Agent Ops trace.
- Admin Chat Eval LLM judge evaluation checks the manual-runtime budget before Anthropic/OpenAI dispatch and links judge cost events to its Agent Ops trace.
- Admin Chat Eval axial-code generation and error diagnosis check the manual-runtime budget before Anthropic/OpenAI dispatch and link judge cost events to Agent Ops traces.
- Value Evidence source validation and dev testing LLM helpers check budget before direct provider calls.
- Cost-events ingest accumulates spend per event.
- `cost_events.agent_run_id` links usage costs to shared Agent Ops traces.
- Mission Control derives 24-hour Cost Intelligence by runtime, agent, workflow, client/project, and artifact type where run metadata exists.

**Coverage.** Strong post-hoc; Partial pre-flight.

**Gaps.**
- Pre-flight budget evaluation exists, but it is not yet enforced across every LLM dispatch path.
- Model IDs are hard-coded at call sites; no tenant/tier-aware policy.

**Retrofit backlog.** Ticket [#5](#top-retrofit-tickets) — policy router selects model + budget by tier.

---

## Top retrofit tickets

These are the first five PR-sized items seeded from the scorecard. Ticket 1 has landed; the remaining tickets are still the next PR-sized improvements for the gaps above.

### Ticket 1 — Agent run trace helper (Monitoring) — completed

- **Owner.** Agent Operations rollout.
- **Scope delivered.** `lib/agent-run.ts` plus shared trace tables, idempotent run/step/event/artifact helpers, approval records, handoffs, and `cost_events.agent_run_id`.
- **First adoptions.** Agent Operations admin surfaces, outreach/social/value/warm-lead n8n trace envelopes, Hermes health bridge, War Room, Slack commands, stale sweep, deployment watcher, runtime evaluation, and approval drill.
- **Acceptance criteria.**
  - Shared schema exists for runs, steps, events, artifacts, handoffs, approvals, and cost linkage.
  - Helpers and Agent Ops read models have focused tests.
  - Mission Control and run detail pages expose traces, costs, approvals, events, and artifacts.
  - Scorecard row for Monitoring & Observability is updated to "Strong in Agent Ops / Partial in legacy flows."
- **Still unblocks.** Broader reasoning summaries, workflow-family trace migrations, Learning & Feedback dashboards, Self-Consistency and Debate experiments with visible costs.

### Ticket 2 — Inline reflection wrapper (Reflection)

- **Owner.** _TBD_
- **Scope.** Add `lib/llm/with-reflection.ts` that takes `{ generate, critique, maxRevisions = 1 }` and returns `{ output, critique, revisions }`. The critique step uses a distinct prompt and can short-circuit when output already passes.
- **First adoption.** [`lib/ai-onboarding-generator.ts`](../lib/ai-onboarding-generator.ts).
- **Acceptance criteria.**
  - Wrapper logs each pass via the run trace helper (ticket #1).
  - AI onboarding tests cover: passes-first-try, revised-on-critique, critique-fails-gracefully.
  - Scorecard row for Reflection updated to "Partial" on completion.
- **Depends on.** Ticket #1 (for observability).

### Ticket 3 — Retry/backoff helper for LLM/n8n calls (Exception Handling) — in progress

- **Owner.** Agent Operations rollout.
- **Scope.** Add `lib/llm/with-retry.ts` with capped exponential backoff + jitter, configurable retryable error matcher, and a dead-letter hook. Wrap the trigger functions in [`lib/n8n.ts`](../lib/n8n.ts) and the direct LLM call sites found via grep.
- **First adoption.** n8n trigger calls now retry transient network and 502/503/504 failures through the shared helper.
- **Follow-on adoption.** Central OpenAI/Anthropic JSON dispatch and source-validator LLM judge calls use the shared helper for retryable provider/network failures.
- **Acceptance criteria.**
  - Unit tests for: success-on-first-try, success-after-N-retries, gives-up-after-max, honors non-retryable errors.
  - User-facing errors remain generic per `no-expose-errors-to-users.mdc`.
  - Scorecard row for Exception Handling updated to "Strong" after direct LLM/provider call sites also adopt the helper.

### Ticket 4 — Content-safety gate before LinkedIn publish (Guardrails)

- **Owner.** _TBD_
- **Scope.** In [`lib/publishing/linkedin.ts`](../lib/publishing/linkedin.ts), add a pre-publish safety call (moderation API or a lightweight classifier prompt) that blocks on configured red flags and logs the decision via the run trace helper.
- **Acceptance criteria.**
  - Block is configurable via env (policy strictness levels: `strict | standard | off`, default `standard`).
  - Blocked publishes surface to the admin queue with the reason, not to the end user.
  - Playwright test: publishing a deliberately-flagged post is blocked and logged.
  - Scorecard row for Guardrails & Safety updated accordingly.

### Ticket 5 — App-layer policy router (Routing + Cost/Resource Control)

- **Owner.** _TBD_
- **Scope.** Add `lib/llm/policy-router.ts` that chooses `{ provider, model, maxOutputTokens, budgetUsd }` given a `{ feature, tenantTier, env }` input. Defaults live in config; overrides via env vars per [`.cursor/rules/n8n-integration.mdc`](../.cursor/rules/n8n-integration.mdc) pattern. First adoption in [`lib/ai-onboarding-generator.ts`](../lib/ai-onboarding-generator.ts).
- **Acceptance criteria.**
  - Every LLM call in the onboarding generator goes through the router; no literal model strings remain in that file.
  - Router reuses the Agent Ops budget policy helper, refuses to dispatch a call whose estimated cost exceeds the budget cap, and logs the refusal.
  - Scorecard rows for Routing and Cost/Resource Control updated.

---

## Appendix — How the patterns compose

How the main agentic flows compose the patterns today (solid lines = request flow, dashed lines = observability).

```mermaid
flowchart LR
  user["User / Client"] --> policyRouter["Policy Router (app, ticket 5)"]
  policyRouter -->|"chat / diagnostic"| chatbotRAG["n8n: RAG Chatbot (RAG + Tools + Memory + Multi-agent)"]
  policyRouter -->|"publishing"| hitl["Admin HITL queue"]
  hitl --> linkedinPublish["LinkedIn publish (Guardrails, ticket 4)"]
  policyRouter -->|"lead intake"| leadQual["n8n: Lead Research Agent (Tools + Planning + Reflection TBD)"]
  policyRouter -->|"onboarding"| onboarding["AI Onboarding (Reflection wrapper, ticket 2)"]

  subgraph observability [Observability]
    costEvents["cost-events ingest"]
    runTrace["agent_runs + agent_run_steps"]
  end

  chatbotRAG -. trace .-> runTrace
  leadQual -. trace .-> runTrace
  linkedinPublish -. trace .-> runTrace
  onboarding -. trace .-> runTrace
  runTrace --> costEvents
```

## Review cadence

- **Every PR that touches an agentic flow** — update the relevant pattern section + coverage rating.
- **Quarterly** — re-score every pattern in the coverage-at-a-glance table and open/close backlog tickets.
- **Annually** — reassess the canonical 20-pattern list against the state of the field (Tree-of-Thought, Debate, new patterns).
