# Revenue Sprint Launch Gate Validation Packet

Prepared: 2026-06-24
Scope: smallest useful credit-conscious launch gate before increasing outreach volume.

## Goal

Make sure a reply to approved outreach is not dependent on Vambah manually noticing an inbox message.

The launch gate is ready only when the system can:

1. detect a reply,
2. match it to the outreach/contact where possible,
3. classify the reply or surface intent,
4. create or preserve a follow-up draft,
5. alert Vambah,
6. wait for explicit approval before any send.

The send phrase remains:

`safe to send`

## Live Workflow Findings

| Workflow | Live ID | Active state | Finding |
| --- | --- | --- | --- |
| `WF-GDR: Gmail Draft Reply` | `zXfZmgqM6g1teIMY` | Active | Uses public Portfolio URLs, creates Gmail drafts, stores app drafts, posts approval alert, and states no email is sent without approval. |
| `WF-CLG-004: Reply Detection and Notification` | `i2IGVOYWcpxFidpf` | Active | Matches replies to `outreach_queue.thread_id`, marks outreach replied, updates contact status, cancels pending follow-ups, and posts Slack alerts. |

The checked-in n8n exports are stale for these workflows. The active n8n Cloud workflow IDs above are the current production references.

## Live Patch Applied

`WF-CLG-004` had two launch-gate issues:

- The active Gmail trigger was set to weekly Monday at 9:00 AM.
- The `Is Outreach Reply?` IF node used an older unary `notEmpty` condition shape that failed current validation.

Applied live n8n Cloud patch:

- Changed `New Email Received` trigger to every 30 minutes.
- Added `singleValue: true` to the `Is Outreach Reply?` object `notEmpty` condition.
- Updated the workflow note to say every 30 minutes and to point drafting responsibility to `WF-GDR`.

Verification:

- Active workflow graph now shows `New Email Received` polling every 30 minutes.
- Active workflow graph now shows `Is Outreach Reply?` with `singleValue: true`.
- n8n version history shows partial update version `105`, created 2026-06-24 12:24:39, operation count 2.
- A later note-only partial update also saved successfully.

## Launch Gate Assessment

| Requirement | Status | Evidence |
| --- | --- | --- |
| Active workflow IDs known | Pass | `WF-GDR` = `zXfZmgqM6g1teIMY`; `WF-CLG-004` = `i2IGVOYWcpxFidpf`. |
| Public Portfolio API URLs | Pass for `WF-GDR` | Active graph uses `https://amadutown.com` for context, prompt, and draft storage calls. |
| Reply detection cadence | Pass after patch | `WF-CLG-004` now polls every 30 minutes. |
| Draft creation | Pass by configuration | `WF-GDR` stores the draft in Portfolio and creates a Gmail draft in the same thread. |
| Alert to Vambah | Pass by configuration | `WF-GDR` posts a revenue reply approval alert; `WF-CLG-004` posts reply alerts. |
| No auto-send | Pass by configuration | `WF-GDR` creates a Gmail draft and says no email is sent by the workflow. |
| `safe to send` approval gate | Pass by configuration | `WF-GDR` alert instructs `safe to send`, `modify: ...`, or `hold`. |
| Gmail account is `vambah@amadutown.com` | Pass for outbound sender identity | Replacement smoke on 2026-06-24 showed `WF-CLG-003` outbound mail from `Vambah Sillah <vambah@amadutown.com>`. See `docs/revenue-sprint/gmail-credential-replacement-2026-06-24.md`. |
| End-to-end reply smoke | Pending | Sender identity is fixed, but the controlled reply has not yet been sent through `WF-CLG-004` and `WF-GDR`. See `docs/revenue-sprint/gmail-credential-replacement-2026-06-24.md`. |

## Decision

The smallest useful next goal is not broad lead volume.

The next goal should be to run one controlled reply-loop smoke:

1. use the corrected `vambah@amadutown.com` n8n Gmail credential,
2. send or use a known safe test outreach thread,
3. reply to it from a controlled inbox,
4. wait up to 30 minutes for `WF-CLG-004`,
5. wait up to 4 hours for `WF-GDR` unless we decide to lower its cadence too,
6. confirm:
   - outreach row marked `replied`,
   - Slack alert appears,
   - Gmail draft exists,
   - app draft exists,
   - no send occurred,
   - the draft is usable after a light edit.

If the draft path needs to be faster than 4 hours, change `WF-GDR` from every 4 hours to every 30 or 60 minutes. Keep this as a separate decision because it increases Gmail/LLM activity.

## Controlled First Batch

Hold this batch until the n8n Gmail credential sends from `vambah@amadutown.com` and the reply-loop smoke passes.

| Contact | Warmth | Opening context | Draft posture | Likely reply handling |
| --- | --- | --- | --- | --- |
| Jeanine | Very warm/test | Mentor Rhode Island board context; only Jeanine gets test-header language. | Clearly labeled test, short, asks for workflow-read feedback. | If she replies, treat as smoke proof, not a sales signal. |
| Anna Berin | Warm/existing context | Prior MentorRI context already exists; do not write like cold outreach. | Reference existing conversation/context, ask whether a light AI ops read would be useful. | If she replies with interest, draft a compare-notes follow-up. |
| Kyle Peterson | Warm lead | Prior Monomoy/warm-lead context exists in workflow docs. | Informal ACA-style note, no heavy pitch, ask if he is seeing messy handoffs or AI workflow pressure. | If he names a pressure point, draft a bounded workflow-read offer. |
| MentorRI-adjacent operations contact | Warm referral path | Shared mission/board context; no fake closeness. | Ask who owns the operational workflow pain, not whether they want to buy. | If they redirect, draft two forwardable sentences. |
| Trusted professional-services contact | Warm/referral path | Relationship-first, advisory angle. | Ask who they know with AI workflow pressure rather than pitching directly. | If they offer a name, draft a permissioned intro ask. |

## Drafting Rules For This Batch

- Use first name in salutation.
- Sign with Vambah's name.
- Include AmaduTown Advisory Solutions with this plain-language tagline:

```text
AmaduTown Advisory Solutions helps mission-driven teams turn scattered work into governed AI workflows, reviewable handoffs, and measurable next steps.
```

- Include a hyperlink to the AmaduTown website in the signature when the channel supports HTML.
- Include phone number only from the approved source of truth, never from memory.
- Do not include Jeanine's test-header note for anyone else.
- Do not make Anna Berin sound like a cold outreach contact.
- Keep the first ask small: a workflow read, a compare-notes conversation, or the right owner/referral path.

## Pivot Rules

Metric that matters in this chunk:

`qualified_reply_loop_success_rate`

Definition:

The percentage of controlled replies where both systems do their jobs without manual rescue:

- CLG-004 detects and marks the reply within 30 minutes.
- GDR creates and alerts a usable draft within the chosen draft SLA.
- No external reply is sent before `safe to send`.

Pivot between this iteration and the next if:

- the controlled smoke does not produce a Slack alert,
- the outreach row is not marked replied,
- no Gmail/app draft appears,
- the draft goes to or comes from the wrong mailbox,
- the draft is too generic to use without heavy editing,
- reply-to-draft lag exceeds the SLA we choose for this experiment,
- any workflow sends without approval.

## Recommended Next Goal

Run one controlled reply-loop smoke against the corrected `vambah@amadutown.com` n8n Gmail credential and produce a go/no-go packet for the first five-contact batch.

Acceptance criteria:

- `WF-CLG-003` outbound smoke sender is `vambah@amadutown.com`.
- `WF-CLG-004` reply tracking verified on a real thread.
- `WF-GDR` draft and alert verified on a real reply.
- Gmail draft appears under the intended customer-facing mailbox.
- The generated draft is approval-ready or the failure mode is documented.
- No external email is sent without `safe to send`.
