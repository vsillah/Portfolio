# Decision Trust V3 Enforcement Plan

V3 moves Decision Trust from shadow observation toward enforceable guardrails. It does not turn on autonomous enforcement by default. The first deliverable is a clear policy contract that can be implemented behind staged modes, measured against live V1/V2 evidence, and rolled back without losing audit history.

V1 records why an agent trusted a source, app, vendor, tool, or spend-related action. V2 projects those records into the Open Brain relationship map as read-only evidence, review insights, and proposal-ready relationship metadata. V3 defines when those trust decisions should influence execution.

## Recommendation

Ship V3 as staged enforcement inside existing Agent Ops policy, not as a new approval system.

The enforcement layer should read sanitized `AgentDecisionFrame` records, evaluate the recommended gate, and return an execution posture. It should continue using:

- `agent_decision_trust_recorded` events for evidence,
- `agent_approvals` for human decisions,
- Open Brain relationship proposals for durable trust promotion,
- existing runtime policies in `lib/agent-policy.ts`,
- existing admin surfaces for operator review.

Do not add a new database table for V3 unless repeated real frames prove that trace-derived enforcement state is insufficient.

## Non-Negotiable Boundaries

These actions require `human_review` at minimum, even when relationship trust is high:

- payment, refunds, checkout, subscriptions, vendor spend, or paid external jobs,
- OAuth authorization, app install, broad permissions, or credential access,
- client data or private material access,
- production configuration or production data mutation,
- outbound email, publishing, or private-to-public content,
- irreversible or hard-to-reverse actions.

These signals should recommend `block` until a human explicitly resolves the evidence:

- scam marker,
- impersonation,
- typosquat or domain mismatch,
- known-bad source,
- contradiction against trusted evidence,
- excessive unexplained permissions.

Blocked decisions should create review evidence. They should never create positive Open Brain trust links.

## Enforcement Modes

V3 should introduce an explicit mode rather than a hidden behavior change.

```ts
export type DecisionTrustEnforcementMode =
  | 'shadow'
  | 'advisory'
  | 'soft_gate'
  | 'hard_block'
```

Mode behavior:

| Mode | Behavior | Production Default |
| --- | --- | --- |
| `shadow` | Record and display the Decision Trust frame only. No execution impact. | Yes |
| `advisory` | Return warnings to the calling workflow and UI, but let existing behavior continue. | No |
| `soft_gate` | Convert `human_review` decisions into existing `agent_approvals` checkpoints before side effects. | No |
| `hard_block` | Block `block` decisions before execution, while still recording the frame and linked run evidence. | No |

The rollout should allow different surfaces to adopt modes independently. For example, technology bakeoff recommendations can stay `advisory` while spend authority actions move to `soft_gate`.

Mode values should pass through `resolveDecisionTrustEnforcementMode(value, fallback)`.
Invalid, missing, or emergency-disable values resolve to `shadow` by default so
rollback is fail-open on execution impact while still preserving recorded
Decision Trust evidence.

## Gate Contract

V3 should preserve the current Decision Trust gate meanings:

| Gate | Execution Posture |
| --- | --- |
| `allow` | Allowed only for low-risk, reversible work with strong relationship trust and complete evidence. |
| `sandbox` | Allowed only in an isolated or read-only path with no sensitive side effect. |
| `human_review` | Must create or reuse a specific approval checkpoint before side effects occur. |
| `block` | Must not execute unless a human records an explicit override or the evidence is corrected. |

`allow` is narrow by design. It should not apply to spend, OAuth, private data, production config, publishing, outbound email, or irreversible actions.

## Proposed Helper

The implementation phase should add a pure helper before wiring routes:

```ts
export type DecisionTrustEnforcementRecommendation = {
  mode: DecisionTrustEnforcementMode
  gate: DecisionTrustGate
  mayProceed: boolean
  requiresApproval: boolean
  shouldBlock: boolean
  approvalType: string | null
  reason: string
  evidence: {
    decisionId: string
    linkedRunId: string | null
    selectedCandidate: string
    scores: DecisionTrustScore
    missingEvidence: string[]
  }
}
```

The helper should take an `AgentDecisionFrame`, the requested enforcement mode, and optional runtime/action context. It should be deterministic, side-effect free, and testable without Supabase.

## Integration Points

Initial code wiring should happen in this order:

1. Chief-of-Staff approval creation: use `soft_gate` for spend/payment-like actions first because they already map to `agent_approvals`.
2. Shaka delegation: use `advisory` first so delegation traces show trust posture without blocking normal routing.
3. Technology bakeoff: use `advisory` first so vendor and tool recommendations surface stale evidence, unknown vendors, and missing alternatives.
4. Open Brain relationship proposals: keep proposal-gated behavior. Enforcement can recommend review, but it must not mutate Open Brain directly.

No route should implement `hard_block` until `block` frames have been observed in production-like traces and reviewed for false positives.

## Rollout Stages

### Stage 0: Current State

Decision Trust is shadow/proposal-gated.

Acceptance:

- frames are recorded,
- recent frames appear in Agent Governance,
- frames project into Open Brain review insights,
- high-risk decisions remain approval-gated through existing policy.

### Stage 1: Advisory Warnings

Add helper and display warnings where a frame recommends `sandbox`, `human_review`, or `block`.

Acceptance:

- no behavior changes,
- no new database tables,
- focused tests cover the helper,
- admin UI clearly labels advisory posture.

### Stage 2: Soft Gates

Use `agent_approvals` for `human_review` decisions before sensitive side effects.

Acceptance:

- payment and spend actions always require approval,
- OAuth and app-install frames require approval,
- client/private data and production mutation frames require approval,
- approval records link back to the decision frame and run.

### Stage 3: Hard Blocks

Block `block` decisions before execution for known-bad and scam-like signals.

Acceptance:

- blocked actions still write trace evidence,
- operators can see the block reason,
- override requires a separate explicit approval path,
- no positive Open Brain trust link is created from a blocked frame.

### Stage 4: Durable Trust Promotion

Approved Open Brain proposals may strengthen durable relationship links. Execution remains governed by policy; durable trust never bypasses high-risk approval boundaries.

Acceptance:

- approved trust links are traceable to decision ids and source events,
- rejected proposals remain visible as audit history,
- stale or contradicted evidence can weaken future recommendations.

## Test Plan

Before turning on any non-shadow mode, add focused tests that prove:

- `shadow` never blocks execution.
- `advisory` returns warnings without changing `mayProceed`.
- `soft_gate` converts payment, OAuth, private data, production mutation, publishing, and irreversible frames into approval requirements.
- `hard_block` blocks domain mismatch, scam, known-bad, contradiction, and excessive unexplained permission frames.
- prior approval raises relationship trust but never bypasses payment review.
- stale or missing evidence prevents `allow`.
- unresolved vendors create review posture, not fake durable trust.
- blocked frames never create positive Open Brain trust links.

## Rollback

Rollback should be an environment or config change back to `shadow` or `advisory`.
Until a central admin policy surface exists, route-level constants and any env
or config adoption must use `resolveDecisionTrustEnforcementMode`. To roll back
execution impact, set the affected surface to `shadow`. Use `advisory` only when
operators still need warnings returned to the caller while side effects continue
through the pre-existing Agent Ops policy.

Rollback must preserve:

- recorded Decision Trust frames,
- linked run events,
- approval records,
- Open Brain review insights and proposals.

Rollback must not delete evidence. It only changes whether future decisions influence execution.

## Open Questions Before Code Enforcement

- Which config surface should own per-route enforcement mode: environment variable, admin policy config, or static route-level constants?
- Should human override for `block` reuse `agent_approvals`, or require a distinct override action type under the same table?
- What false-positive threshold is acceptable before `hard_block` can apply beyond test fixtures?
- Which admin export should include Decision Trust enforcement posture for client-safe audit packets?

## V3 Definition Of Done

V3 is done when:

- enforcement mode is explicit and defaulted to `shadow`,
- a pure recommendation helper is covered by unit tests,
- spend/payment and other high-risk frames can create or require existing approval checkpoints in `soft_gate`,
- `block` decisions can be prevented in `hard_block` without mutating Open Brain,
- Agent Governance and Open Brain make the enforcement posture visible,
- rollback to `shadow` is documented and tested.
