# Hyperagent Parity Plan

## Positioning

Hyperagent is a useful benchmark for agent operating infrastructure, not a replacement for Portfolio.

Portfolio remains the control plane because it already owns the domain-specific pieces that matter for AmaduTown: Agent Ops traces, approvals, n8n workflow visibility, Slack commands, Mission Control, client-delivery context, and non-production data isolation rules.

The first parity target is rubric-based evaluation. This gives Portfolio a quality loop similar to Hyperagent Rubrics while keeping changes approval-gated.

## Feature Matrix

| Hyperagent feature | Portfolio equivalent today | Gap | Planned response | Priority |
| --- | --- | --- | --- | --- |
| Persistent cloud agents | n8n workflows, Codex lanes, Hermes probes, Agent Ops traces | Runtimes are visible but not scored consistently | Keep Portfolio as runtime-neutral trace layer | High |
| Skills and memories | Codex skills, agent organization, docs, source manifests | Failure-driven skill improvement is manual | Store evaluation failures as coaching candidates before any skill change | High |
| Slack invocation | `/agent` Slack command and Agent Ops routes | Standup and discuss paths exist, quality loop was missing | Add evaluation commands later after admin scoring proves stable | Medium |
| MCP and tool invocation | Codex MCP/tooling, n8n credentials, app APIs | Tool access differs by runtime | Keep runtime policy and approval gates as source of truth | Medium |
| Cron and recurring agents | n8n schedules, Vercel cron, Portfolio monitors | Quality of recurring outputs not trended | Score key recurring runs against rubrics | High |
| Fleet command center | `/admin/agents` Mission Control, run console, swarm board | Quality and coaching were not first-viewport signals | Add Quality Signals, Needs Coaching, and Rubric Trends panels | High |
| Cost tracking | `cost_events`, Agent Ops cost summary | Cost was not paired with successful quality | Add score history first; cost-per-good-output is next | Medium |
| Rubric evaluation | New `agent_eval_rubrics` and `agent_run_evaluations` | No historical score baseline yet | Seed first rubrics and allow manual run evaluation | High |
| Self-improving skills | Approval-gated Codex/Hermes skill edits | Auto-mutation would be risky | Store recommendations only; no autonomous prompt or skill mutation in v1 | High |
| External runtime marketplace | Runtime model supports `codex`, `n8n`, `hermes`, `opencode`, `manual` | Hyperagent API/workspace access not confirmed | Treat Hyperagent as a benchmarked external candidate | Low |

## V1 Implementation

V1 adds the evaluation foundation:

- `agent_eval_rubrics` stores active rubrics by agent and workflow.
- `agent_run_evaluations` stores trace-linked scores, dimension scores, judge implementation, summaries, and failure reasons.
- `evaluateAgentRun(runId, rubricKey)` scores one run against one rubric and records a trace event.
- `getAgentQualitySummary(...)` returns Mission Control-ready quality, trend, and coaching signals.
- Mission Control shows Quality Signals, Needs Coaching, and Rubric Trends.
- Run detail pages allow a human admin to evaluate a trace against one of the seeded rubrics.

The v1 judge is deterministic and trace-based. The schema is compatible with LLM-as-judge scoring, but the first implementation avoids unapproved model spend and avoids autonomous mutation.

## Seed Rubrics

- `chief-of-staff-synthesis-quality`
- `warm-lead-capture-trace-completeness`
- `meeting-intake-follow-up-safety-isolation`
- `inbox-follow-up-approval-readiness`
- `research-source-register-source-quality`

## Safety Model

Evaluation results are observability and coaching signals only.

They do not:

- rewrite prompts,
- modify Codex or Hermes skills,
- change n8n workflows,
- send Slack messages,
- publish content,
- touch client data,
- or mutate production runtime behavior.

Any prompt, skill, routing, policy, workflow, or production behavior change must go through the existing approval and integration-captain paths.

## Definition Of Done

- Rubric tables are migrated with RLS enabled.
- Seed rubrics exist in dev and production databases.
- Admin evaluation APIs require admin auth.
- A run can be evaluated from the run detail page.
- Mission Control remains safe with no evaluations.
- Low scores appear as Needs Coaching signals.
- Evaluation events link back to the source `agent_run`.
- No production prompt, skill, n8n workflow, or Slack behavior changes automatically.

## Next Parity Targets

1. Add cost-per-passing-output and cost-per-agent-quality trend.
2. Add Slack read-only commands for quality status after admin scoring is proven.
3. Add LLM-as-judge behind a budget and approval gate.
4. Add improvement candidate artifacts for failed evaluations.
5. Evaluate Hyperagent as an external runtime only after API/workspace access is confirmed.
