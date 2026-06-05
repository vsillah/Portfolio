# Client Journey Agentic Goal Catalog

Date: 2026-06-05
Status: Goal catalog for Agent Ops planning and UI seeding

## Objective

Stitch the Portfolio agentic suite into one governed business lifecycle: social signal, lead capture, outreach, reply handling, meeting, sales package, proposal, payment, onboarding, delivery, maintenance, renewal, upsell, downsell, cancellation, and winback.

The goal is not to create a second CRM. The goal is to make Portfolio's existing surfaces operable through agents, mobile review, chat commands, and approval-gated automations.

## Operating Principle

Agents can prepare, recommend, evaluate, and route work automatically.

Agents need approval before public publishing, outbound sends, calendar mutation, proposal terms, payment/subscription actions, client-visible updates, production changes, or winback offers.

## Goal ID Map

| Goal ID | Automation Seed ID | Goal | Primary Surface | Gate |
| --- | --- | --- | --- | --- |
| `CJ-001` | `client-journey-lifecycle-control-plane` | Install the client journey lifecycle control plane | Agent Ops, Outreach, Meetings, Sales, Client Projects | Approval before side effects or client-visible changes |
| `CJ-002` | `meeting-to-social-drafts` | Turn source-backed ideas into social launch assets | Social Content, Video Generation, Meetings | Approval before publishing or provider execution |
| `CJ-003` | `campaign-experimentation-ab-optimizer` | Run governed campaign experimentation and A/B optimization | Social Content, Outreach, Analytics, Value Evidence | Approval before launching, sending, publishing, or scaling variants |
| `CJ-004` | `warm-lead-review-ready-outreach` | Capture warm leads and produce review-ready outreach | Outreach, Lead Dashboards | Approval before outbound use or new source expansion |
| `CJ-005` | `cold-lead-draft-sequence` | Source cold leads and draft outreach sequences | Outreach, Email Center | Approval before Send Now or sequence activation |
| `CJ-006` | `inbound-lead-triage-to-booking` | Convert inbound lead signals into qualified next actions | Lead Pipeline, Outreach, Email Center | Approval before external replies or calendar changes |
| `CJ-007` | `meeting-intake-follow-up-drafts` | Convert meetings into follow-up drafts and tasks | Meetings, Meeting Tasks, Outreach | Approval before emails or calendar invitations |
| `CJ-008` | `value-evidence-presentation-package` | Build lead-specific value evidence and sales packages | Value Evidence, Gamma Reports, Lead Dashboards | Approval before client-facing delivery or proposal terms |
| `CJ-009` | `client-onboarding-progress-updates` | Move paid clients into onboarding and progress updates | Client Projects, Meeting Tasks | Approval before client-visible updates or project mutation |
| `CJ-010` | `client-reporting-roadmap-updates` | Send delivery, roadmap, and maintenance updates | Client Projects, Reports, Meeting Tasks | Approval before client delivery and roadmap commitments |
| `CJ-011` | `subscription-revenue-monitoring` | Monitor cancellations, subscriptions, cost, upsell, downsell, and winback | Cost & Revenue, Subscription Watch, Decision Queue | Approval before cancellation, payment, pricing, vendor, or offer actions |
| `CJ-012` | `mobile-chat-command-approval-surface` | Control lifecycle actions from mobile or chat | Standup Room, Decision Queue, Slack/mobile | Approval applies only to the explicitly described next gate |
| `CJ-013` | `rag-source-governance-exceptions` | Protect source governance and memory quality | Open Brain, RAG health, Source Protocol | Approval before private source promotion or public chatbot policy changes |
| `CJ-014` | `risk-compliance-signal-triage` | Route AI risk, privacy, security, and regulatory signals into work items | Decision Queue, Open Brain | Approval before remediation, policy, credential, or production changes |
| `CJ-015` | `script-to-video-draft-queue` | Convert approved scripts into video draft queues | Video Generation, Videos | Approval before brand release, provider execution, or public publishing |

## Lifecycle Stages

| Stage | Trigger Examples | Agent Output | Human Gate |
| --- | --- | --- | --- |
| `signal` | Social comment, reaction, website visit, audit form, content engagement | Source-linked signal record and campaign attribution | None unless source expansion is needed |
| `lead` | Contact form, imported warm lead, cold lead discovery | Dedupe, enrichment, lead score, next action | Approval before external outreach |
| `outreach_drafted` | Lead qualifies or campaign variant wins | Draft email, LinkedIn note, or reply | Approval before send |
| `reply_received` | Email reply, social DM, comment, form response | Intent classification and next-best response | Approval before reply or booking action |
| `meeting_booked` | Calendar booking or manual scheduling | Confirmation draft and lead attribution | Approval before calendar/email mutation unless already permitted |
| `meeting_completed` | Meeting transcript, notes, or task extraction | Meeting notes, action items, sales context | Approval before external follow-up |
| `sales_package_ready` | Qualified opportunity with enough evidence | Sales script, value evidence, Gamma/report package | Approval before client-facing delivery |
| `proposal_ready` | Offer recommendation, pricing, bundle, scope | Proposal packet, terms, contract/payment path | Approval before send or payment setup |
| `paid_client` | Payment, contract, accepted proposal | Onboarding plan and project setup packet | Approval before production/client-visible setup |
| `delivery` | Milestone, blocker, task progress | Weekly update draft and roadmap delta | Approval before client send |
| `maintenance` | Monitoring, support, continuity interval | Health report and improvement recommendations | Approval before changes or paid work |
| `renewal_or_upsell` | Success milestone, guarantee outcome, usage signal | Continuity, upsell, or cross-sell recommendation | Approval before offer send |
| `cancelled_or_at_risk` | Cancellation, churn signal, payment issue | Downsell, save offer, or winback packet | Approval before outreach or pricing action |

## Campaign Experiment Loop

`CJ-003` adds the A/B experimentation behavior to AutoResearch.

Required packet fields:

- `campaign_id`
- `hypothesis`
- `audience`
- `channel`
- `variant_ids`
- `source_packet_path`
- `approval_status`
- `launch_window`
- `metrics_window`
- `primary_metric`
- `secondary_metrics`
- `decision_rule`
- `challenger_findings`
- `winner`
- `retired_variants`
- `next_variant_recommendation`
- `human_decision_required`

Metrics should include:

- impressions
- reactions
- comments
- saves
- clicks
- replies
- booked calls
- proposal starts
- accepted proposals
- paid conversion
- approval burden
- time to next action

Decision rules:

- Do not call a winner without enough sample size or a clear metric window.
- Do not optimize only for reactions if booked calls or qualified replies are the real business outcome.
- A challenger agent must flag weak evidence, overfitting, voice drift, source gaps, privacy issues, or misleading claims.
- Winning variants can be adapted into a new channel, but publishing and sending remain approval-gated.

## End-Of-Week Build Order

1. Seed `CJ-001`, `CJ-003`, and `CJ-012` from Agent Ops Automation Context.
2. Wire `CJ-001` into the existing seeded Tier 1 goals so every lead, meeting, campaign, proposal, and client update can expose a lifecycle stage.
3. Use `CJ-003` for the first Agentic AI sales outreach campaign variants.
4. Use `CJ-012` to make the approval packets actionable from Standup/mobile instead of forcing Vambah through every admin page.
5. Keep downstream sends, publishing, payments, and client-visible updates gated until each packet is approved.

## First Campaign Candidate

Campaign ID: `campaign-agentic-operations-2026-06`

Hypothesis: Leaders will respond more strongly when agentic AI is framed as governed operating capacity instead of model novelty.

Initial variants:

- `variant-governed-execution`: flagship LinkedIn post about governed execution.
- `variant-seven-things`: carousel on the seven operating layers after the demo.
- `variant-scope-safety`: post on scope as the safety model.
- `variant-qa-scorecards`: post on agent QA and authority.
- `variant-client-proof`: post turning Portfolio into a client proof surface.

Primary metric: qualified replies or booked conversations.

Secondary metrics: comments, saves, clicks, reactions, approval burden, and time from engagement to next action.

Human gate: approve each post, approve each outreach follow-up, and approve any variant scaling recommendation.
