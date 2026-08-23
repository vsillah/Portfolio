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
4. Generate individualized drafts, not a generic blast.
5. Batch for review with sample expansion.
6. Hold sends behind explicit batch approval.
7. Monitor responses and route every response back to the contact and outreach queue.

Required gates:

- cohort provenance recorded,
- suppression checked per recipient,
- personalization basis per recipient,
- batch preview approved,
- per-channel send authority verified,
- throttle and idempotency keys active.

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

- batch rows are individualized,
- sample preview and full recipient list available,
- suppression failures are visible,
- no batch send without explicit approval.

### Phase 4: Response Monitoring

Reuse Engagement Inbox patterns to classify inbound warm outreach responses and draft replies.

Acceptance:

- provider response rows link to contacts and outreach rows,
- reply drafts require human QA by default,
- do-not-contact and unsubscribe responses update suppression state,
- Slack alerts summarize only safe metadata and deep-link back to Portfolio.

### Phase 5: Provider Activation

Enable each channel only after capability proof.

Acceptance:

- Gmail draft/send path smoke-tested with the intended sender identity,
- LinkedIn/Facebook response monitoring marked manual unless provider access is verified,
- phone contacts remain manual note/call task until an approved provider exists,
- every external send/reply remains approval-gated.

## Safest Next Development Slice

The first code slice should be `relationship-intelligence contract + warm template selection`.

It should not add provider calls, contact scraping, phone access, Facebook/LinkedIn DMs, or auto-send. It should only:

- add typed packet validation,
- map existing contact/outreach fields into a warm relationship summary,
- add warm template keys and prompt previews,
- route generated drafts into the existing queue behind review,
- expose blocked/manual reasons when a provider path is not ready.

This keeps the system useful immediately without creating a risky external-action surface.
