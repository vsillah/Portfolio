# Agent Swarm Monday Execution Roadmap

## Purpose

This roadmap defines the snap line between the completed Agent Ops control plane and the Monday execution loop.

Agent Ops is no longer a design rollout by default. Mission Control, Slack, Standup Room, Kanban, Decision Queue, Run Console, recovery packets, automation digest routing, and approval gates now form the operating system. The next step is to use that system to execute backlog work safely.

## Current State

### Shipped control plane

- Mission Control is the executive command surface for attention routing, Shaka prompts, status, and deep links.
- Standup Room is the agent interaction surface for attendance, goal planning, and swarm coordination.
- Agent Kanban is the work-state surface with fixed lanes, owner badges, collapsed cards, goal tags, dependency cues, and radiators.
- Decision Queue is the approval/controller surface for packets that need explicit human action.
- Run Console is the trace, event, artifact, recovery, and evaluation surface.
- Slack `/agent` and `/agent-staging` are the mobile command surfaces for fast unblock checks.
- Automation digest routing can convert sanitized digest findings into proposed Agent Ops work items.

### Existing backlog sources

The Monday execution loop should reference the backlog that already exists. Do
not create a parallel backlog unless a new roadmap is explicitly opened.

Use these sources in this order:

1. `docs/automation-digest-agent-ops-backlog.md` for already-seeded proposed Agent Ops work items from the Codex automation digest.
2. `docs/agent-operations-task-list.md` for remaining Agent Ops operational checks and maintenance watch items.
3. `docs/agent-operations-roadmap.md#maintenance-backlog` for capped rollout maintenance work.
4. `docs/agentic-operating-system-governance.md` for governance hardening, audit exports, delegation transparency, and payment/spend authority boundaries.
5. `docs/agent-decision-trust-v3-enforcement.md` for staged Decision Trust enforcement planning.

The currently seeded digest backlog is:

| Existing item | Category | Owner | Priority | Current use |
| --- | --- | --- | --- | --- |
| Prepare n8n drift access repair preflight | `blocked_until_access` | `automation-systems` | High | Prepare-only packet for n8n visibility/access drift. |
| Prepare authenticated Portfolio admin QA checklist | `blocked_until_access` | `chief-of-staff` | High | Authenticated QA checklist for admin surfaces. |
| Draft Codex thread-root repair decision packet | `needs_vambah_approval` | `chief-of-staff` | Medium | Human decision packet before changing Codex root behavior. |
| Prepare quiet-provider billing verification packet | `agent_can_prepare` | `automation-systems` | Medium | Prepare a billing verification packet without mutation. |
| Personality corpus reports unchanged | `watch_only` | None | Low | Keep out of the work queue unless the signal changes. |

The live simulation recorded the proposed work-item IDs in
`docs/automation-digest-agent-ops-backlog.md`; those IDs should be reused rather
than reseeded.

### Current snap line

The implementation roadmap is capped. New work should enter as:

- proposed Agent Ops work items,
- Standup Room goals,
- Decision Queue packets,
- n8n proposal packets,
- or maintenance backlog items.

Do not add another Agent Ops phase unless there is a new product decision to reopen the control-plane roadmap.

## Monday Objective

By Monday, the agent swarm should be able to start from a reviewed backlog, claim bounded work, show visible progress, and route blockers without requiring Vambah to manually rediscover what needs attention.

The Monday operating question is:

> What can the swarm execute today, what is waiting on Vambah, and what must remain behind an approval gate?

## Execution Phases

### Phase A: Sunday Closeout And Backlog Readiness

Goal: make sure the control plane is ready to carry Monday work.

Work:

- Confirm all open Agent Ops PRs are merged, closed, or explicitly deferred.
- Confirm local `main` is clean and aligned with `origin/main`.
- Confirm automation digest routing is merged and available.
- Confirm Slack production and staging command behavior is documented.
- Confirm no unreviewed dirty files are being silently treated as shipped work.
- Record any remaining work as proposed items, not loose chat notes.

Validation gate:

- `gh pr list --state open` has no unowned Agent Ops implementation PR.
- `git status --short --branch` is clean in the integration checkout.
- Any dirty root files have an explicit owner and are not swept into unrelated PRs.

### Phase B: Monday Morning Intake

Goal: turn inbound signals into a triaged Agent Ops backlog.

Inputs:

- existing proposed work items from `docs/automation-digest-agent-ops-backlog.md`,
- automation digest summaries,
- Slack `/agent inbox`, `/agent blockers`, and `/agent approvals`,
- Mission Control attention routes,
- stale or failed Run Console traces,
- Decision Queue pending packets,
- Kanban blocked and ready-for-review cards.

Work:

- Start with the existing proposed work items before creating new ones.
- Run the digest action router in dry-run mode first.
- Promote only sanitized, actionable findings into proposed work items.
- Use Shaka to group related proposed work into goals where the work has a shared outcome.
- Keep watch-only findings out of the work queue.
- Mark each item as one of:
  - `agent_can_prepare`,
  - `needs_vambah_approval`,
  - `blocked_until_access`,
  - `watch_only`.

Validation gate:

- Every proposed item has an owner candidate, next safe action, source link, approval boundary, and trace or digest provenance.
- No production mutation, outbound send, credential change, billing action, publishing action, or n8n activation is created by intake alone.

### Phase C: Standup Goal Formation

Goal: convert the highest-value work into bounded goals that agents can execute.

Work:

- Open Standup Room.
- Select the agents needed for the goal.
- Ask Shaka to draft the goal plan.
- Review proposed tasks, owners, dependencies, risk notes, and acceptance criteria.
- Approve task creation only after the plan is bounded.
- Ensure each child card carries the parent goal tag.

Recommended initial goal categories:

- existing automation digest proposed work items,
- Slack mobile unblock hardening.
- n8n drift and workflow proposal readiness.
- authenticated Portfolio admin QA.
- Open Brain roadmap projection cleanup.
- client-facing delivery roadmap projection.
- content generation packet preparation.
- subscription and revenue monitor cleanup.

Validation gate:

- Goal has a parent work item.
- Child work items have owner, acceptance criteria, traceability, and approval boundary.
- Kanban shows the goal tag and current state.

### Phase D: Agent Execution Loop

Goal: let agents execute bounded work while Integration Captain preserves merge quality.

Operating cycle:

1. Shaka starts the standup and summarizes priorities.
2. Agents claim cards only inside their lane authority.
3. Work that changes code uses named branches and PRs.
4. Work that changes provider config, credentials, production data, publishing, payments, external sends, or n8n activation becomes an approval packet.
5. Integration Captain reviews validation, merges only green scoped PRs, and verifies deployment contexts.
6. Mission Control and Slack show the resulting state change.

Default ownership:

- Shaka: goal decomposition, routing, blocker summaries, human-decision packets.
- Integration Captain: PR readiness, conflict resolution, merge sequencing, deployment verification.
- Automation Systems: n8n proposals, automation monitor packets, credential/readiness preflights.
- Moremi: risk and compliance warnings, governance review, safety gate checks.
- Askia Muhammad: research/source-register work, evidence packets, knowledge hygiene.
- Engineering Copilot: scoped implementation tasks and test fixes.
- Content Production agents: draft-only content packets and social handoff work.

Validation gate:

- No card moves to ready-for-merge without validation evidence.
- No agent claims production mutation authority from a chat message alone.
- Slack actions and Mission Control actions write traceable events.

### Phase E: Daily Closeout

Goal: make the day reviewable and restartable.

Work:

- Review Mission Control attention routes.
- Review Kanban by lane and by goal.
- Review Decision Queue for pending human action.
- Review Run Console for failed, stale, or waiting traces.
- Send a sanitized `#agent-ops` update if there are human-relevant blockers.
- Keep private details in the private digest or trace packets.

Validation gate:

- Completed work has a merged PR, trace, artifact, or approved packet.
- Incomplete work has an owner, blocker, and next step.
- Watch-only signals are not promoted into noise.

## Backlog Intake Rules

### Good first backlog items

Use Agent Ops immediately for work that is:

- bounded,
- traceable,
- reversible,
- safe to prepare without mutation,
- easy to validate,
- or blocked primarily by a clear human decision.

Examples:

- prepare a deployment-risk packet,
- draft a client roadmap projection,
- inspect stale runs and propose recovery,
- prepare an n8n workflow plan without activating it,
- generate a LinkedIn draft packet without publishing,
- create a QA checklist for an admin surface,
- summarize blockers for Slack mobile review.

### Do not auto-create work for

- vague ideas without an outcome,
- raw private data needing review,
- vendor replacement without bakeoff,
- production config changes,
- credential changes,
- external sends,
- publishing,
- payments,
- customer-data mutation,
- n8n workflow activation.

Those become Decision Queue packets or explicit approval tasks first.

## Monday Success Criteria

The Monday swarm is working if:

- Mission Control answers what needs attention now.
- Standup Room can create a bounded goal and task breakdown.
- Kanban shows who owns each task, how old it is, and what is blocked.
- Slack can surface mobile-safe approvals, blockers, and inbox items.
- Decision Queue owns human approvals.
- Run Console owns evidence and recovery traces.
- Integration Captain can merge green scoped PRs without guessing about ownership.
- Vambah can step away and return to a truthful operating picture.

## Known Decision Gates

- Whether to work the existing digest backlog in its current proposed state or
  convert one or more proposed items into a Standup Room goal.
- Whether to seed the next automation digest in apply mode or keep dry-run until Monday morning.
- Whether to make Slack production commands the default mobile surface or keep using `/agent-staging` for the next validation cycle.
- Whether the first Monday goal should be automation-health, sales/outreach, content production, or client roadmap projection.
- Whether n8n workflow proposals should remain prepare-only for the first full week of use.

## Recommended Monday First Move

Start with the existing digest backlog, then choose the first execution goal.
The recommended first goal is:

> Prepare and validate the mobile unblock loop for Agent Ops backlog execution.

Why:

- It uses the shipped Slack surface.
- It can be tested against the already-seeded proposed work items instead of inventing new backlog.
- It exercises Mission Control, Standup Room, Kanban, Decision Queue, and Run Console together.
- It improves Vambah's ability to unblock work away from the laptop.
- It does not require external sends, customer-data mutation, credential changes, or production n8n activation.

Suggested first tasks:

1. Review the four existing proposed digest work items in Mission Control or Agent Kanban.
2. Run `/agent inbox`, `/agent blockers`, and `/agent approvals` in production Slack.
3. Confirm the existing digest work items are reachable from Slack or have a clear Portfolio deep link.
4. Route one existing prepare-only item, preferably `Prepare authenticated Portfolio admin QA checklist`, through the mobile unblock loop.
5. Verify Mission Control/Kanban reflect the route or action event.
6. Record any Slack or deep-link gaps as follow-up work items with owners.

## Integration Captain Packet Template

Each Monday execution PR should close with:

- branch and PR,
- goal or work-item link,
- files changed,
- validation run,
- browser or Slack QA evidence,
- approval gates touched,
- rollback path,
- deployment context status,
- next owner.
