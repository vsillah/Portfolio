# Revenue Reply Response Automation SOP

Prepared: 2026-06-24
Purpose: Prevent lag after warm outreach replies so the revenue experiment is not dependent on manual inbox checking.

## Principle

The outreach experiment should not rely on Vambah manually noticing replies.

Every approved outbound message needs a reply path:

1. detect the reply,
2. match it to the original outreach/contact,
3. classify the reply,
4. prepare a follow-up draft,
5. alert Vambah with the draft and recommended next action,
6. wait for explicit approval before sending.

No external reply should be sent automatically. The send gate remains the exact phrase:

`safe to send`

## Service Level Target

For revenue outreach replies:

- Detect and alert within 30 minutes.
- Draft a follow-up within 60 minutes.
- Escalate scheduling intent, buying intent, or referral names as high priority.
- If automation fails, produce a daily exception report so the failure is visible.

The workflow can run more frequently than the general inbox sweep because this lane is tied to active sales experiments. General inbox triage can remain slower; revenue replies need faster handling.

## Existing Assets To Reuse

Portfolio and n8n already have the right building blocks:

- `n8n-exports/WF-GDR-Gmail-Draft-Reply.json`
  - Watches Gmail.
  - Extracts sender, subject, body, message id, and thread id.
  - Fetches app context.
  - Generates a reply draft.
  - Stores the draft in Portfolio.
  - Can create a Gmail draft.
- `n8n-exports/WF-CLG-004-Reply-Detection-and-Notification.json`
  - Watches Gmail.
  - Matches replies to `outreach_queue.thread_id`.
  - Marks outreach as replied.
  - Updates contact status.
  - Cancels pending follow-ups.
  - Sends Slack alerts with context.
  - Detects scheduling intent.
- Portfolio admin surfaces:
  - `/admin/outreach`
  - `/admin/outreach/dashboard`
  - `outreach_queue`
  - `contact_submissions`
  - `client_update_drafts`

## Required Hardening Before Live Reliance

Do not rely on the current checked-in WF-GDR export as production-ready until these gates pass:

1. Confirm the active n8n Cloud workflow IDs for:
   - Gmail Draft Reply
   - Reply Detection and Notification
2. Replace any `localhost:3000` app API URLs in active n8n workflows with a public Portfolio base URL:
   - production: `https://amadutown.com`
   - staging/dev only when the callback host is reachable and uses matching secrets/data
3. Confirm the Gmail credential is the customer-facing account:
   - `vambah@amadutown.com`
4. Confirm reply matching uses Gmail `thread_id` from the sent outreach row.
5. Confirm Slack alert delivery goes to Vambah personally or the configured owner alert channel.
6. Confirm Gmail draft creation does not send automatically.
7. Confirm the exact phrase `safe to send` is required before any AI-assisted send action.

## Reply Classification

Every detected reply should be classified into one of these labels:

| Label | Meaning | Draft Goal |
| --- | --- | --- |
| `buyer-interest` | They describe a current workflow, budget, urgency, or decision owner. | Offer a short workflow read or book a compare-notes call. |
| `referral-name` | They name a person or organization. | Ask whether they are comfortable making a light intro, or offer two forwardable sentences. |
| `what-is-this` | They ask what AmaduTown does or what the offer is. | Send the plain-language one-paragraph explanation. |
| `scheduling-intent` | They mention time, calendar, call, availability, or meeting. | Suggest a specific next step and include scheduling language only after Vambah approval. |
| `context-only` | They are curious but not close to a buyer path. | Ask who owns the workflow or where they are seeing pressure. |
| `not-now` | They are polite but there is no current need. | Preserve the relationship and ask for permission to circle back later. |
| `hold` | Awkward, sensitive, private, wrong person, or wrong channel. | Do not draft a sales reply. Alert Vambah only. |

## Alert Format

Each alert should include:

- sender first name and broad context,
- original outreach lane,
- detected reply label,
- urgency level,
- reply summary,
- recommended next move,
- draft follow-up,
- explicit approval prompt:

`Reply safe to send, or send edits.`

Do not include phone numbers, secrets, raw contact exports, or unnecessary private relationship notes in alerts.

## Draft Rules

Drafts should be short and useful:

- acknowledge their actual reply,
- avoid pitching too early,
- move one step at a time,
- ask one clear question,
- preserve Vambah's voice,
- point to AmaduTown only when it helps the next action.

Default AmaduTown explanation:

```text
AmaduTown Advisory Solutions helps mission-driven teams turn scattered work into governed AI workflows, reviewable handoffs, and measurable next steps.
```

## Human Approval Gate

The automation may:

- detect replies,
- classify intent,
- create drafts,
- save Gmail drafts,
- alert Vambah,
- update internal status fields.

The automation may not:

- send a reply,
- promise pricing,
- book a meeting,
- make a client commitment,
- disclose private context,
- change proposal terms,
- mark a deal as won,
- publish public content.

Send is allowed only after Vambah gives explicit approval with:

`safe to send`

If Vambah sends edits instead, revise the draft and ask again.

## Weekly Experiment Protection

Manual reply lag is a threat to the experiment.

Track these every week:

- replies detected,
- replies with drafts created,
- average time from reply to alert,
- average time from reply to draft,
- average time from Vambah approval to send,
- qualified conversations created,
- proposals requested,
- diagnostic proposals sent,
- revenue committed or collected.

If more than 10% of replies are missed or drafted after 24 hours, pause new outbound volume and fix the automation before increasing touches.

## Next Validation Gate

Before the next warm outreach batch is sent:

1. Verify active n8n Cloud workflow IDs.
2. Verify public Portfolio API base URLs in those active workflows.
3. Send one controlled test reply to a test outreach thread.
4. Confirm Portfolio marks the row replied.
5. Confirm Slack alert arrives.
6. Confirm a draft is created.
7. Confirm no auto-send occurs.
8. Confirm sending requires `safe to send`.

Only after that should the outreach experiment scale beyond the first controlled batch.
