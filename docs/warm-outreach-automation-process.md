# Warm Outreach Automation Process

Status: `draft-process`

This process extends the existing Portfolio Outreach system for relationship-aware warm outreach. It is not a new dashboard, contact store, or sending surface. Portfolio remains the canonical decision and audit store; external channels remain provider surfaces only after the relevant approval gates clear.

## Boundary

Warm outreach is relationship-based outreach to people who already have a known connection, context, meeting, referral path, prior message, contact record, or social relationship with Vambah or AmaduTown.

This process may:

- research the relationship context attached to a known contact,
- summarize why the contact is warm,
- recommend the best outreach channel,
- draft an email, LinkedIn DM, Facebook message, SMS-style note, or phone-contact follow-up,
- route the draft through human review,
- monitor replies where the provider path is configured,
- draft response options using the same relationship context.

This process must not:

- import private contact data into public content,
- send, schedule, DM, email, text, or post externally without the existing explicit send gate,
- bypass suppression, do-not-contact, unsubscribe, relationship, or provider capability checks,
- create a parallel outreach queue outside Portfolio,
- treat Slack as the source of truth.

## Existing Surfaces To Reuse

| Surface | Role |
| --- | --- |
| `contact_submissions` | Canonical contact/lead identity, source, suppression, relationship strength, and enrichment state. |
| `outreach_queue` | Canonical draft, approval, send, and status queue. |
| `contact_communications` | Durable interaction history and relationship evidence. |
| `email_messages` | Email-specific sent/draft/reply linkage. |
| Admin -> Lead Pipeline / Outreach | Operator surface for contacts, lead cards, queue review, draft edits, approvals, and send gates. |
| Admin -> Credentials | User-owned provider connection gate for Gmail and future provider capabilities. |
| Engagement Inbox | Pattern to reuse for inbound response triage, classification, draft reply, approval, and provider submission boundaries. |
| Agent Ops | Work-item routing and blocker recovery, not a duplicate outreach dashboard. |

## Warm Outreach Intake

Every warm outreach request should enter through one of these canonical paths:

1. Existing contact selected in Lead Pipeline.
2. Imported warm contact from a governed source such as Google Contacts, LinkedIn, Facebook, meeting records, referral notes, or prior correspondence.
3. Manual operator intake from a relationship note, meeting, event, introduction, or phone contact.
4. Agent Ops work item that deep-links to the contact or outreach row.

The intake packet should be stored as internal metadata attached to the contact, queue row, or work item. It should include:

- source channel,
- source record id or durable reference,
- relationship basis,
- consent/suppression state,
- last interaction summary,
- relevant commonality,
- recommended channel,
- recommended template,
- draft objective,
- confidence and risk,
- human-review requirement.

## Relationship Intelligence

The relationship research pass should answer six questions before any draft is generated:

1. How does Vambah know this person?
2. What is the strongest legitimate reason to reach out now?
3. What context can be safely referenced?
4. What channel is most natural for this relationship?
5. What should be avoided because it is private, stale, sensitive, or too assumptive?
6. What would a useful next step be for the recipient?

Allowed sources:

- Portfolio contact records,
- meeting records and meeting action tasks,
- prior approved outreach drafts,
- prior sent messages and imported replies,
- public profile or company information,
- user-provided notes,
- governed Google Contacts / LinkedIn / Facebook source metadata after provider capability is verified.

Restricted handling:

- Private relationship details should be summarized, not quoted.
- Personal phone contacts should remain internal unless the user explicitly approves the specific outreach use.
- Source evidence should be stored as metadata and concise summaries, not exposed in public-facing text.
- If the relationship basis is weak or uncertain, the draft must say less, not invent familiarity.

## Outreach Modes

### One-To-One Warm Outreach

Use for a known contact, referral, prior conversation, meeting follow-up, event follow-up, collaborator, prospect, or community relationship.

Workflow:

1. Select or import the contact.
2. Run relationship intelligence.
3. Confirm suppression and channel capability.
4. Pick a template family.
5. Generate a draft in `outreach_queue`.
6. Require human approval before external send.
7. Send only through the configured channel path.
8. Monitor response and create a reply draft if a response arrives.

Required gates:

- contact identity confirmed,
- relationship basis recorded,
- suppression clear,
- channel selected,
- draft reviewed,
- send approved.

### One-To-Many Warm Outreach

Use for a known group where Vambah has a relationship basis with every recipient, such as event attendees, alumni, community members, client ecosystem contacts, or past collaborators.

Workflow:

1. Define the cohort and source basis.
2. Confirm every recipient passes suppression and relationship checks.
3. Segment by relationship type and channel.
4. Review individualized draft plans, not a generic blast row.
5. Show a concise sample preview with full recipient-list access.
6. Hold draft generation, scheduling, provider actions, and sends behind explicit approval.
7. Route any approved future draft or response back to the contact and outreach queue.

Required gates:

- cohort provenance recorded,
- suppression checked per recipient,
- personalization basis per recipient,
- weak relationship basis blocked before draft generation,
- batch preview approved,
- deterministic batch and recipient draft idempotency keys active,
- per-channel send authority verified,
- external execution disabled until a later explicitly approved phase.

## Template Families

Warm outreach templates should be selected by relationship intent, not only by channel.

| Template family | Best use | Core opening move |
| --- | --- | --- |
| Reconnect | Dormant but legitimate relationship | Name the prior context briefly and make the reason for reaching out current. |
| Follow-up | Meeting, event, or conversation continuation | Tie back to the exact shared moment and offer a next step. |
| Referral path | Introduced or recommended contact | Respect the introducer and clarify why the connection is useful. |
| Community bridge | Shared community, school, creator, or professional circle | Start from the common ground, then make the ask modest. |
| Value-first note | Contact has a visible problem or opportunity | Offer a useful observation before asking for time. |
| Product relevance | The contact fits an AmaduTown offer | Explain the operating problem and invite a low-pressure review. |
| Response follow-up | Contact replied to outreach | Acknowledge the reply, answer directly, and propose the next smallest step. |

Channel rendering should adapt the same template:

- Email: subject + concise body + signature.
- LinkedIn: connection note when needed + follow-up DM.
- Facebook: short conversational message.
- Phone/SMS-style note: concise text for manual send only unless an approved SMS provider exists.
- Contact task: call script or manual reminder when a send channel is unavailable.

## Response Monitoring

Warm outreach response handling should reuse the Engagement Inbox pattern:

1. Ingest the response from the provider where supported.
2. Link it to the contact, original `outreach_queue` row, channel, and provider message/thread id.
3. Classify the response:
   - interested,
   - question,
   - referral,
   - objection,
   - not now,
   - unsubscribe / do not contact,
   - negative / sensitive,
   - ambiguous.
4. Draft a reply with relationship context and provenance.
5. Route to human QA unless the response is low-risk and the channel has an approved auto-reply policy.
6. Update contact state and follow-up task state after approval or send.

Auto-send should remain disabled by default for warm outreach. A later phase can consider a narrow low-risk auto-reply hold, but the first release should be human-review-only.

## Idempotency And Dedupe

Warm outreach automation must prevent duplicate pressure on the same person.

Use deterministic keys such as:

- `warm-outreach:intake:<source>:<source_record_id>`
- `warm-outreach:draft:<contact_id>:<channel>:<template_key>:<relationship_event_id>`
- `warm-outreach:send:<outreach_queue_id>:<provider>`
- `warm-outreach:reply:<provider>:<provider_thread_id>:<provider_message_id>`

Duplicate checks should run before:

- importing contacts,
- generating drafts,
- creating batch rows,
- sending externally,
- ingesting replies,
- creating follow-up tasks.

## Human QA Rules

Human QA is required for:

- first send to a contact,
- any batch send,
- uncertain relationship context,
- buying-intent responses,
- sensitive/private topics,
- negative replies,
- pricing or custom service promises,
- provider ambiguity,
- any channel where reply/submission capability has not been verified.

Human QA should see:

- contact identity,
- relationship basis,
- source summaries,
- proposed channel,
- selected template,
- generated draft,
- suppression status,
- provider capability,
- response monitoring plan,
- exact action that will happen if approved.

## Implementation Phases

### Phase 1: Warm Outreach Contract

Create the model and API contract for relationship intelligence packets without importing new private data or sending externally.

Acceptance:

- relationship packet shape defined,
- source/suppression/channel fields mapped to current tables,
- no provider calls,
- no sends,
- tests for relationship packet validation and suppression decisions.

### Phase 2: Draft Generation Integration

Extend the existing in-app outreach generator so warm templates can use relationship intelligence and channel-specific rendering.

Acceptance:

- warm template keys available,
- one-to-one warm draft can be generated into `outreach_queue`,
- existing cold outreach behavior remains unchanged,
- duplicate draft generation returns existing row or blocked reason.

### Phase 3: Warm Batch Review

Add a batch review path for one-to-many warm outreach while preserving per-contact approval state.

Acceptance:

- batch rows are individualized and preserve per-contact approval state,
- cohort provenance, relationship basis, selected channel, selected template, suppression status, and individualized draft preview are visible per recipient,
- concise sample preview and accessible full recipient list are available in the existing `/admin/outreach` workroom,
- suppression failures and weak relationship-basis gaps are visible and blocked before draft generation,
- duplicate review/draft planning uses deterministic idempotency and returns existing draft rows where present,
- no provider call, external send, Gmail draft, LinkedIn/Facebook/phone action, Slack action, n8n dispatch, scheduling, or monitoring path is enabled,
- `externalExecutionEnabled` remains false.

### Phase 4: Response And Follow-Up Lifecycle

Capture warm outreach responses inside the existing contact workroom and communication history. This phase remains internal-only: it can record a manually captured or approved inbound reply, classify it, draft a contextual reply, create a next-touch task, and propose suppression review. It does not activate provider monitoring, Gmail drafts, Slack actions, DMs, sends, or scheduled follow-ups.

Acceptance:

- responses are tied to the contact and optional `outreach_queue` row,
- response classes include interested, question, referral, objection, not now, unsubscribe / do not contact, negative / sensitive, and ambiguous,
- reply drafts and next-touch decisions require human QA by default,
- unsubscribe / do-not-contact replies create a clear human-gated suppression proposal,
- interested or sales-intent replies expose an outreach task/decision path,
- duplicate response capture and reply draft generation are idempotent,
- provider execution remains blocked unless a later explicit provider lane is approved.

### Phase 5: Provider-Assisted Response Monitoring

Reuse Engagement Inbox patterns to classify inbound warm outreach responses and draft replies inside the existing contact and outreach workrooms. This phase models provider-assisted readiness only: provider identifiers, thread/message ids, and alert deep links may be represented in Portfolio metadata, but provider polling, provider imports, Slack dispatch, reply submission, sends, scheduling, and suppression mutation stay disabled until separate approval gates clear.

Acceptance:

- response capture readiness appears on `/admin/outreach` and `/admin/contacts/[id]` through the existing relationship-packet workroom,
- manually captured or provider-assisted metadata rows link to contacts and optional `outreach_queue` rows,
- supported classifications remain interested, question, referral, objection, not now, unsubscribe / do not contact, negative / sensitive, and ambiguous,
- reply drafts require human QA by default,
- do-not-contact and unsubscribe responses expose a human-gated suppression proposal path and do not directly mutate suppression,
- interested or sales-intent responses expose a local outreach task/decision path,
- duplicate response capture and reply draft generation remain idempotent,
- provider capability rows are shown as blocked, manual, or metadata-readiness state only,
- Slack alert behavior is represented only as safe metadata/deep-link readiness; no Slack message is sent.

### Phase 5a: Manual Social Handoff

Prepare LinkedIn, Facebook, and phone-contact outreach from the existing relationship packet without adding a provider integration or parallel dashboard.

Acceptance:

- the handoff appears inside the canonical `/admin/outreach` selected-contact workroom,
- LinkedIn, Facebook, and phone-contact copy previews are generated from local warm relationship context,
- the operator sees one current CTA: copy/prepared text first, then record minimal manual evidence,
- manual evidence records only timestamp, channel, and a non-sensitive operator note,
- repeated evidence recording is hidden after the local evidence state is recorded,
- stable contact/channel/message-version keys are visible for audit and duplicate prevention,
- LinkedIn API, Facebook API, phone access, Gmail drafts/sends, Slack dispatch, SMS delivery, n8n dispatch, scheduling, provider polling, and production mutation remain disabled,
- `externalRequests` remains empty.

### Phase 6: Provider Activation

Enable each channel only after capability proof.

Acceptance:

- Gmail draft/send path smoke-tested with the intended sender identity,
- LinkedIn/Facebook response monitoring marked manual unless provider access is verified,
- phone contacts remain manual note/call task until an approved provider exists,
- every external send/reply remains approval-gated.

### Phase 6a: Warm Gmail Operational Execution Readiness

The successful one-recipient production canary is recorded in `docs/warm-outreach-qa/warm-gmail-send-canary-833e1019.md`. Treat that receipt as do-not-resend evidence for queue `833e1019-97c3-4059-8790-c590841328d1`, not as broad send authority.

Operational model:

- Portfolio remains the source of truth for recipient, draft, approval, idempotency, and submitted evidence.
- Slack may present the operator decision, but approve/reject/revise must write back to Portfolio and deep-link to the canonical workroom.
- Gmail provider execution is an admin readiness gate. If `ENABLE_WARM_GMAIL_SEND_EXECUTION` is still required, expose it as disabled/enabled provider state rather than hiding it as a captain-only toggle.
- The operator workroom may show eligibility and exact execution payload requirements, but it must not expose a broad auto-send action.
- Generic instructions such as `proceed`, `continue`, `approved`, or `looks good` are not live Gmail send authorization. Execution requires the exact `execute_warm_gmail_send_for_authorized_recipient` value plus the one-recipient request scope.
- Live execution remains one recipient, one queue row, one message version, and one submitted-evidence key unless a later phase explicitly expands the scope.

## Office-Week Outreach Ramp Backlog

Purpose: get warm outreach moving before Vambah returns to full-time office cadence while SMS remains parked behind Telnyx 10DLC approval.

Current working assumptions:

- Gmail is the first active external channel because the draft, approval, send, submitted-evidence, and response-monitoring boundaries already exist.
- Slack should remain the approval notification layer, with every approval/reject/revise action writing back to Portfolio.
- LinkedIn, Facebook, and phone-contact outreach should start as manual handoff channels with generated copy, copy-to-clipboard support, and operator-recorded send evidence.
- SMS remains candidate-only until Telnyx brand/campaign approval, sender/profile verification, no-send QA, and a separately approved one-recipient canary are complete.
- The UX should be action-led: one current CTA, compact status, progressive details, and minimal static explanation.

### P0: Start Outreach This Week

1. Warm lead shortlist
   - Create a daily shortlist of 10-15 contacts from existing Portfolio contacts.
   - Rank by relationship basis, last touch, channel readiness, and next useful ask.
   - Show blocked reasons inline: missing email, weak relationship basis, suppression risk, provider not connected, or SMS unavailable.

2. Gmail draft batch
   - Generate Gmail drafts for the top reviewed contacts only.
   - Store each draft in `outreach_queue` with contact id, template key, relationship packet version, and provider/draft evidence.
   - Keep send execution separate from draft creation.

3. Slack approval loop
   - Send one concise Slack approval notification per reviewed draft batch or priority contact.
   - Deep-link to the exact Portfolio review gate.
   - After approve/reject/revise, confirm the Portfolio state changes without requiring the operator to infer status from Slack.

4. One-recipient Gmail send execution
   - Execute sends only after exact per-recipient authorization.
   - Require matching contact id, queue id, message version, draft id, sender identity, and submitted-evidence key.
   - Block duplicate sends when submitted evidence or secondary-log repair state exists.

5. Response triage
   - Ingest or manually capture replies into the contact timeline.
   - Classify the response and create a follow-up draft or suppression proposal.
   - Keep reply sending behind the same human review gate.

6. Daily office-mode digest
   - Show outreach moved today: drafted, approved, sent, replied, blocked, and needs Vambah.
   - Include the next best action for the next office-day window.

### P1: First Full Office Week

1. Morning review queue
   - Surface the highest-priority warm contacts with one CTA each: draft, review, request approval, send approved draft, or handle response.

2. Lunch or afternoon send window
   - Group approved Gmail sends into a controlled operator window.
   - Keep execution one row at a time until batch-send authority is explicitly designed and approved.

3. LinkedIn/Facebook/phone manual handoff
   - Generate channel-ready copy and a manual-send checklist.
   - Record operator-confirmed manual evidence state in the Portfolio workroom.
   - Do not automate LinkedIn, Facebook, phone, or SMS sending unless a later provider capability and policy gate are approved.

5. Template library hardening
   - Add concise warm templates for reconnect, meeting follow-up, referral path, community bridge, value-first note, and response follow-up.
   - Keep template selection tied to relationship evidence, not just channel.

6. Relationship research sweep
   - Backfill relationship packets for the initial target contacts.
   - Mark uncertain records as research-needed instead of producing high-confidence copy.

### P2: After Telnyx 10DLC Clears

1. Telnyx brand/campaign completion
   - Confirm brand approval, campaign approval, sender/profile assignment, and provider status in Telnyx.
   - Store only references and non-secret status in Portfolio.

2. SMS no-send canary
   - Verify Portfolio can prepare the exact provider payload without calling Telnyx.
   - Confirm suppression, consent, sender, recipient, and audit state.

3. One-recipient SMS live canary
   - Temporarily enable SMS execution only for the approved queue row.
   - Send exactly one SMS, verify provider evidence, then disable execution again.

4. Cross-channel response orchestration
   - Route Gmail, manual LinkedIn/Facebook, and future SMS replies into one response lifecycle.
   - Preserve per-channel audit state and avoid duplicate pressure on the same contact.

### Backlog Acceptance Criteria

- The operator can open `/admin/outreach?filter=warm`, select a warm contact, review relationship context, generate a Gmail draft, request approval, record approval, execute an approved one-recipient send, and see response/follow-up state.
- Every external action has a clear current CTA, status, blocker, and recovery path.
- Slack approval links land on the exact Portfolio gate and Portfolio remains the source of truth.
- Manual channels can generate copy and record operator evidence without pretending provider automation exists.
- SMS remains visibly parked until Telnyx 10DLC approval and explicit provider activation gates clear.
- Mobile review avoids long static prose, nested cards, hidden CTAs, and repeated action buttons after a decision is recorded.
- Evidence records include contact id, queue id, channel, template key, approval source, provider reference when present, and idempotency key without raw secrets.

### Next Implementation Slices

1. `warm-outreach-shortlist`: daily prioritized warm-contact queue with blocked reasons and one current action.
2. `warm-gmail-batch-draft`: controlled multi-contact Gmail draft creation with per-row approval state and no send execution.
3. `warm-slack-approval-followthrough`: Slack approval notification state that reliably writes back to Portfolio and deep-links to the exact gate.
4. `warm-response-digest`: response-monitoring summary with follow-up drafts, suppression proposals, and office-mode daily digest.
5. `warm-manual-social-handoff`: LinkedIn/Facebook/phone manual copy handoff plus operator-recorded evidence.
6. `warm-sms-post-10dlc`: Telnyx completion, no-send canary, and one-recipient live SMS canary after brand/campaign approval.

## Safest Next Development Slice

The first code slice should be `relationship-intelligence contract + warm template selection`.

It should not add provider calls, contact scraping, phone access, Facebook/LinkedIn DMs, or auto-send. It should only:

- add typed packet validation,
- map existing contact/outreach fields into a warm relationship summary,
- add warm template keys and prompt previews,
- route generated drafts into the existing queue behind review,
- expose blocked/manual reasons when a provider path is not ready.

This keeps the system useful immediately without creating a risky external-action surface.
