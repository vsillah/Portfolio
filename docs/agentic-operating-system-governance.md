# Agentic Operating System Governance

Portfolio already has the base of an agentic operating system: named agents, runtime policies, shared traces, approvals, work items, budget checks, Slack commands, and Mission Control. This document formalizes the missing governance layer so the system can be operated internally and explained to clients without overselling autonomy.

Input source: Vambah's May 20, 2026 notes from the YouTube video [Google Spent a Year Stitching MCP, A2A, AG-UI Together. I/O Today.](https://www.youtube.com/watch?v=zP6TnEiueEc). The four-component model below follows Vambah's summary: agents and tools, delegation, payment authorization, and traceable UI/audit.

## CTO Recommendation

Build this as a governance hardening track inside existing Agent Ops, not as a separate product surface.

Why: Portfolio already has `agent_runs`, `agent_run_steps`, `agent_run_events`, `agent_run_artifacts`, `agent_approvals`, `agent_work_items`, `agent_handoffs`, `cost_events.agent_run_id`, Mission Control, and Shaka. The highest-leverage move is to make the rules more explicit and auditable, then project them through `/admin/agents`, `/admin/agents/runs/[runId]`, and client-facing advisory material.

Do not start by giving agents more authority. Start by proving that scope, delegation, authorization, and payment intent are visible and reviewable.

## Governance Components

| Component | What Portfolio Has Today | Gap | Recommended Hardening |
| --- | --- | --- | --- |
| Agent, scope, and tools | `lib/agent-organization.ts` maps named agents, responsibilities, runtimes, workflow refs, and approval gates. `lib/agent-policy.ts` defines runtime-level permissions. | Permissions are runtime-level, not agent-specialty-level. Tool access is implied through runtime/workflow descriptions rather than inventory-scored per agent. | Add an agent capability inventory that scores each agent on tools, data access, write authority, outbound authority, spend authority, and required approval gates. |
| Delegation and monitoring | Shaka uses the routing catalog from `AGENT_ORGANIZATION`, returns typed `agent_engagements`, prefers active/partial agents, and traces each chat. | Delegation policy lives inside the prompt and parser. It is inspectable in code but not yet exposed as deterministic routing rules or a decision record. | Add a deterministic delegation policy layer: task taxonomy, routing criteria, required context checks, confidence, fallback, and a trace event recording why Shaka chose the agent. |
| Payment and spend authorization | Stripe helpers, checkout routes, subscription/refund helpers, cost events, and per-runtime LLM budget checks exist. Agent approvals cover production config, outbound email, publishing, unknown DB writes, and private-to-public content. | There is no first-class `make_payment`, `create_checkout_session`, `create_subscription`, or `refund_payment` agent action gate that ties payment intent to user authorization, amount, counterparty, and trace evidence. | Add payment/spend approval gates before any agent-triggered purchase, subscription, checkout creation, refund, vendor spend, or external paid API escalation. |
| UI, validation, and audit | Mission Control, run detail, work items, approvals, cost summaries, stale/dead-letter handling, and artifacts provide strong traceability. | The UI does not yet show one consolidated "why this agent / why this permission / why this approval" view for agentic OS governance. | Add an Agent Governance tab or section under Mission Control with agent capability inventory, delegation rules, pending authority decisions, payment authority ledger, and audit export. |

## Current Inventory Findings

### Strong Foundations

- Agent identities and specialties are already concrete: Shaka, Amina, Mansa Musa, Askia Muhammad, Hatshepsut, Nzinga, Moremi, Nefertiti, Hannibal, Taharqa, Menelik II, Piye, Yaa Asantewaa, and other mapped agents have responsibilities and approval gates in `lib/agent-organization.ts`.
- Runtime policy exists in `lib/agent-policy.ts` for file reads/writes, external APIs, client data, production writes, publishing, email, config changes, and private-to-public material.
- Shaka records traced runs and typed proposals through `lib/chief-of-staff-chat.ts` and the Chief of Staff API routes.
- Approval checkpoints are durable in `agent_approvals` and decisions are written back to `agent_run_events`.
- Budget controls exist for LLM spend in `lib/agent-budget-policy.ts`.
- Cross-runtime coordination has durable fields for expected files, touched files, branches, PRs, blockers, validation, approvals, and handoffs through `agent_work_items` and `agent_handoffs`.

### Gaps To Close

- Agent scope is not yet a least-privilege matrix. The current policy answers "what can this runtime do?" more clearly than "what should this specialist agent be allowed to do?"
- Shaka's delegation logic is partially deterministic, but the routing criteria are still embedded in the prompt. Operators can inspect the trace result, but they cannot yet see a stable rule table that explains the decision before dispatch.
- Payment authority is present in product code through Stripe utilities, but agent authority around payments is not explicit. That matters because client-facing trust depends on proving who authorized money movement, what amount was approved, and what action actually executed.
- The UI has trace detail, but it needs a governance narrative view that answers the user's practical questions: who acted, why that agent, what authority was granted, what was blocked, what cost or payment was involved, and what evidence supports the decision.

## Target Control Model

Every agentic action should resolve into this envelope:

| Field | Purpose |
| --- | --- |
| `agent_key` | Which named agent is responsible. |
| `runtime` | Which execution environment acted. |
| `scope_profile` | The agent's approved tools, data classes, write classes, outbound authority, and spend boundary. |
| `delegation_reason` | Why Shaka or another controller routed the work there. |
| `operator_intent` | The user/admin request that authorized the run or proposal. |
| `approval_checkpoint_id` | The approval record when side effects are possible. |
| `payment_authority_id` | The spend/payment authorization record when money can move or a paid session is created. |
| `trace_id` | The `agent_runs.id` tying together steps, events, artifacts, costs, approvals, and handoffs. |
| `audit_summary` | Human-readable explanation for admin review and client-safe export. |

## Implementation Backlog

### 1. Agent Capability Inventory

Objective: Turn current agent descriptions into a least-privilege matrix.

Recommended fields:

- `agent_key`
- `display_name`
- `pod`
- `primary_runtime`
- `allowed_tools`
- `allowed_data_classes`
- `allowed_write_classes`
- `outbound_authority`
- `spend_authority`
- `approval_required_for`
- `sensitive_boundaries`
- `last_reviewed_at`
- `review_status`

Validation gate: every active or partial agent has a reviewed scope profile; Shaka can have broad visibility, but specialist agents should not inherit broad authority by default.

### 2. Shaka Delegation Policy

Objective: Make delegation explainable before and after dispatch.

Recommended policy inputs:

- task type: status, recovery, research, content, code, automation, payment, approval, client delivery, publishing
- risk class: read-only, internal write, client-data access, outbound send, production mutation, payment/spend
- required evidence: source run, work item, approval, client project, proposal, cost event, payment object
- preferred agent keys
- fallback agent key
- approval gate
- confidence threshold

Trace requirement: each routed engagement should write an event like `delegation_decision_recorded` with selected agent, alternatives considered, required evidence, confidence, and fallback.

### 3. Payment And Spend Authority Layer

Objective: Separate "agent recommends spending" from "money can move."

New approval actions to add:

- `create_checkout_session`
- `create_subscription`
- `create_refund`
- `make_vendor_payment`
- `increase_paid_api_budget`
- `start_paid_external_job`

Required payment authority fields:

- requesting agent
- approving user
- amount
- currency
- counterparty
- purpose
- payment rail: Stripe, vendor API, subscription, refund, paid job
- allowed execution window
- maximum retries
- revocation status
- resulting Stripe/vendor object ids
- linked trace id

Validation gate: no agent-triggered payment, refund, subscription, or paid external job can execute without a linked approval and trace event. Test mode checkout creation remains explicitly marked as testing.

### 4. Agent Governance UI

Objective: Give the operator and future clients a single proof surface.

Recommended surface: `/admin/agents` Governance section or a one-click L2 page from Mission Control.

Views:

- capability inventory by agent
- delegation policy table and recent delegation decisions
- approval queue with authority boundaries
- payment/spend ledger
- audit trail export by run, work item, client project, or time window
- red/yellow/green governance status for each agent

Validation gate: an operator can answer these questions without reading code: what can this agent do, who gave it authority, what did it actually do, how much did it cost, did money move, and where is the evidence?

## Client-Facing Positioning

Use this as the advisory framing:

We do not sell "agents that do everything." We build governed agent operating systems.

That means every agent has a role, every role has a scope, every side effect has an approval boundary, every delegation has a reason, every dollar has authorization, and every action leaves a trace.

The client value is not novelty. It is confidence: a nonprofit, small business, or executive team can use AI agents without guessing whether the system is acting inside the boundaries they intended.

## Non-Negotiable Boundaries

- Background agents do not approve their own work.
- Shaka may coordinate broadly, but side effects still pass through approval checkpoints.
- Specialist agents should receive least-privilege profiles.
- Payment authority must be amount-bound, purpose-bound, time-bound, and trace-bound.
- Test payment flows must stay marked as test data and must not touch production customer payment records.
- Client-facing exports summarize traces and governance decisions; they do not expose raw private logs, secrets, private reasoning, or sensitive records.

## Recommended Rollout

1. Add the capability inventory and expose it read-only.
2. Extract Shaka's delegation logic into deterministic policy helpers while keeping the LLM for synthesis.
3. Add payment/spend approval action types and payment authority records.
4. Add the Mission Control governance view.
5. Create a client-safe audit export and a short sales/advisory explainer.

This sequence is reversible until payment authority is introduced. Payment/spend controls should ship behind explicit approval and test-mode validation before any production use.

## Implementation Status

Phase 1 through Phase 4 have a v1 implementation in Portfolio:

- `lib/agent-governance.ts` derives a read-only agent capability inventory from the current agent organization and policy records.
- `lib/agent-delegation-policy.ts` applies deterministic Shaka delegation routing and records `delegation_decision_recorded` trace events.
- `lib/agent-policy.ts` now treats payment and paid-job actions as approval-gated authority events across runtimes.
- `/admin/agents` includes an Agent Governance section with capability inventory, delegation trace, payment authority, and governance status signals.

Phase 5 has a v1 implementation:

- `lib/agent-governance-export.ts` converts the governance snapshot into a client-safe audit payload and Markdown report.
- `GET /api/admin/agents/governance/export` returns authenticated JSON or Markdown exports without raw prompts, private logs, secrets, or sensitive records.
- `/admin/agents` links the export actions from the Agent Governance panel.
- `docs/agentic-os-client-advisory-explainer.md` provides the first advisory/sales framing for client conversations.

The next refinement is to add scoped exports by run, client project, or date range after operators review the v1 report against real governance traces.
