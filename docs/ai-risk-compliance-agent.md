# Moremi (Ife) - Risk & Compliance

## Purpose

Moremi (Ife) - Risk & Compliance watches AI agent, AI ethics, security, privacy, and regulatory developments, then translates relevant signals into Portfolio exposure checks and upgrade requests.

This is a spinout from the Research & Knowledge pod. It does not replace the Research Source Register. The source register collects and classifies evidence; Moremi decides whether the evidence creates operational risk for Portfolio.

## Parent And Supporting Agents

- Parent pod: Research & Knowledge
- Primary router: Shaka (Zulu) - Chief of Staff
- Evidence intake: Askia Muhammad (Songhai) - Research Source Register
- Implementation owner when a gap is confirmed: Piye (Kush) - Engineering Copilot
- Automation owner when a workflow or monitor is needed: Yaa Asantewaa (Ashanti) - Automation Systems
- Decision capture: Nzinga (Ndongo/Matamba) - Decision Journal

## Watch Topics

- Agent autonomy failures, including tool misuse, unapproved actions, and prompt injection.
- Data privacy, consent, retention, and client-data exposure.
- AI safety, bias, discrimination, model misuse, and deceptive output risks.
- Regulatory obligations affecting AI agents, general-purpose AI, automated decisions, data processing, and consumer disclosures.
- Vendor incidents involving AI infrastructure, agent frameworks, model providers, workflow automation, browser automation, RAG systems, and retrieval stores.
- Security guidance for LLM and agentic systems.

## Signal Triage

Every signal should be classified before it becomes work:

| Classification | Meaning | Next step |
| --- | --- | --- |
| `watch_only` | Interesting, but no credible Portfolio exposure yet. | Save source and revisit if pattern repeats. |
| `exposure_check` | Plausible Portfolio surface exists. | Open a read-only assessment work item. |
| `upgrade_request` | Confirmed gap or missing control. | Open a scoped implementation request. |
| `approval_required` | Fix may touch policy, production config, public content, external sends, or client data. | Route to Shaka and approval gate. |

## Monitor Endpoint

The first implementation surface is read-only by default and approval-gated for work creation:

- `GET /api/admin/agents/risk-compliance/monitor` returns Moremi's monitor configuration and safety boundary.
- `POST /api/admin/agents/risk-compliance/monitor` accepts supplied signal briefs and returns exposure assessments plus proposed upgrade-request payloads.
- Default `POST` behavior does not create work items, mutate workflows, write remediation changes, or send notifications.
- `POST` may create proposed Agent Ops work items only when the caller sends both `create_work_items: true` and `confirmation: "create_ai_risk_work_items"`.
- Created work items stay in `proposed` status with human review required before remediation, merge, deployment, production config, or workflow mutation.
- The endpoint does not fetch live news automatically in v1.
- Source feeds are explicit and filterable before ingestion is automated:
  - `GET /api/admin/agents/risk-compliance/monitor?category=prompt_injection`
  - `GET /api/admin/agents/risk-compliance/monitor?priority=standards`
  - `GET /api/admin/agents/risk-compliance/monitor?enabled_only=false`

### Scheduled Read-Only Monitor

Moremi runs a weekly source-feed coverage monitor through Vercel cron:

- `GET /api/cron/moremi-risk-monitor` runs from Vercel cron with `CRON_SECRET`.
- `POST /api/cron/moremi-risk-monitor` remains available for n8n/manual cron triggering with `N8N_INGEST_SECRET`.
- The monitor creates an Agent Ops run and artifact with enabled/disabled feed counts, category coverage, priority coverage, and warnings.
- The monitor does not fetch live external pages, create work items, mutate workflows, change production config, send public content, or touch client data.
- The first schedule is weekly on Monday at 14:00 UTC, after the daily client AI Ops monitor.

### Operational Drill

Moremi has a repeatable synthetic drill for proving the signal-to-work-item path without production remediation or client-data access.

- `GET /api/admin/agents/risk-compliance/drill` previews the synthetic signal, assessment, and proposed work-item request.
- `POST /api/admin/agents/risk-compliance/drill` creates or reuses one idempotent proposed work item only when the caller sends `confirmation: "run_moremi_operational_drill"`.
- The drill uses the fixed idempotency key `ai-risk-drill:moremi-operational-drill:v1`.
- The created work item stays `proposed`, is tagged as synthetic/non-production data, and should be visible in `/admin/agents/coordination` and Slack `/agent work`.
- Production remediation, workflow mutation, public claims, and client-data access remain approval-gated.

Expected signal payload:

```json
{
  "signals": [
    {
      "title": "Regulator issues AI agent privacy warning",
      "summary": "The warning focuses on agents processing customer data without consent controls.",
      "sourceName": "Regulator bulletin",
      "sourceUrl": "https://example.com/source",
      "severity": "high",
      "category": "privacy_data"
    }
  ]
}
```

Explicit work-item conversion payload:

```json
{
  "create_work_items": true,
  "confirmation": "create_ai_risk_work_items",
  "signals": [
    {
      "id": "regulator-agent-privacy-warning",
      "title": "Regulator issues AI agent privacy warning",
      "summary": "The warning focuses on agents processing customer data without consent controls.",
      "sourceName": "Regulator bulletin",
      "severity": "high",
      "category": "privacy_data"
    }
  ]
}
```

## Exposure Checklist

When a signal is relevant, Moremi checks Portfolio for:

- Affected route, workflow, agent, prompt, model, provider, or data store.
- Existing policy or approval gate covering the risk.
- Existing trace coverage in `agent_runs`, `agent_run_events`, `agent_approvals`, or `agent_work_items`.
- Whether the risk affects production, staging, local-only development, or documentation.
- Whether the risk involves client data, leads, meetings, payment data, private knowledge, credentials, publishing, outbound email, or production config.
- Required owner for remediation.

## Outputs

- Risk signal brief with source, affected Portfolio surface, likelihood, impact, and confidence.
- Portfolio exposure assessment.
- Upgrade request routed to the right owner agent.
- Proposed Agent Ops work item when explicitly confirmed.
- Approval packet when remediation crosses an approval gate.
- Decision journal entry after acceptance, rejection, or deferral.

## Safety Boundaries

- Read-only research and exposure checks are allowed.
- No production workflow mutation, config change, prompt change, public claim, vendor switch, database write outside known safe workflows, publishing, or external send is allowed without approval.
- Do not copy production customer, lead, client, contact, meeting, payment, or private operational data into non-production validation.
- Do not treat news commentary as policy. Prefer primary sources, regulator guidance, vendor incident notices, standards bodies, and security advisories where available.

## Baseline Source Families

Moremi should prioritize primary and standards-oriented sources before commentary:

- [OWASP Agent Security Initiative](https://owasp.org/www-project-top-10-for-large-language-model-applications/initiatives/agent_security_initiative/) for agentic AI security risks.
- [OWASP AI Vulnerability Scoring System](https://aivss.owasp.org/) for severity scoring patterns specific to AI risks.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) and the Generative AI Profile for risk management vocabulary.
- [EU Regulation 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) for AI Act obligations and regulatory language.
- [FTC AI business guidance](https://www.ftc.gov/business-guidance/technology/artificial-intelligence) for consumer protection and AI claims/disclosure risk.

## Definition Of Done

A risk signal is done when it has one of these outcomes:

- `watch_only`: source retained and no current Portfolio exposure found.
- `exposure_check`: assessment complete and owner assigned.
- `upgrade_request`: scoped remediation request created with validation criteria.
- `approval_required`: approval packet created and routed.
- `closed`: risk accepted, resolved, superseded, or marked not applicable with rationale.
