# Revenue Reply Loop Smoke - 2026-06-26

## Scope

Validate the Jeanine / Mentor Rhode Island reply loop without sending any customer-facing reply.

This run covered:

- `WF-CLG-004: Reply Detection and Notification`
- `WF-GDR: Gmail Draft Reply`
- Production contact and outreach tracking for the Jeanine test thread
- The Slack approval alert path that tells Vambah to respond with `safe to send`, `modify: ...`, or `hold`

No customer-facing reply was sent during this run.

## Setup

Jeanine replied to the controlled Mentor Rhode Island test email:

- Gmail thread id: `19eff92a41bbba24`
- Reply message id: `19effbefbb0899c2`
- Reply subject: `Re: FYI test: AmaduTown reply workflow`
- Reply body: `It works! I received this!!!!`

The original Gmail UI send did not create or preserve a matching `outreach_queue` row. A production reconciliation row was inserted for this test thread only:

- `outreach_queue.id`: `d1c8c142-d9b7-4f75-8bdf-d0d14aa2cb6e`
- `contact_submission_id`: `13740`
- `thread_id`: `19eff92a41bbba24`
- `status`: `sent`
- `is_test_data`: `true`

That insert also produced the expected `email_messages` linkage via the existing database trigger:

- `email_messages.id`: `e8d5d8e4-be24-41f3-8f42-e72d9d2d732b`
- `source_system`: `outreach_queue`
- `source_id`: `d1c8c142-d9b7-4f75-8bdf-d0d14aa2cb6e`

## Workflow Changes Applied

`WF-CLG-004` was patched so `Extract Sender Email` can read either the normal Gmail trigger payload or a controlled smoke payload wrapped under `body`.

Temporary smoke webhooks were added to `WF-CLG-004` and `WF-GDR`, used once, then removed. The published active versions were re-read after cleanup and only the normal Gmail-trigger paths remained.

## Results

`WF-CLG-004` replay succeeded:

- Execution: `18494`
- `outreach_queue.status`: `replied`
- `outreach_queue.replied_at`: `2026-06-26 11:03:56.219+00`
- `outreach_queue.reply_content`: `It works! I received this!!!!`
- `contact_submissions.outreach_status`: `replied`

`WF-GDR` replay succeeded:

- Execution: `18495`
- `client_update_drafts.id`: `a9f63919-eda0-45f1-a6c6-3c2d8e2a0cfe`
- `client_update_drafts.status`: `draft`
- Gmail draft id: `r-5473122377145452398`
- Gmail draft message id: `19f039a0b018e1f0`
- Gmail draft thread id: `19eff92a41bbba24`
- Slack approval alert channel: `C0AFE8874LR`
- Slack approval alert timestamp: `1782471855.046519`

The draft/alert path respected the approval gate: it created a draft and alert, but did not send a customer-facing email.

## Findings

The manual replay path is green, but the natural end-to-end path is not fully proven.

Known gaps:

- The original Gmail UI send was outside the tracked send path, so reply detection had no matching `outreach_queue` row until the reconciliation row was inserted.
- `WF-GDR` did not naturally trigger on Jeanine's inbound reply before the manual replay, even though the replayed graph produced the expected app draft, Gmail draft, and Slack alert.
- The generated draft duplicated the subject line inside the email body. Treat that as a draft-quality issue before any real reply is sent.
- The send/follow-up workflow has credential-handling debt that should be remediated before scaling. Do not copy or expose credential values in docs, chat, or exported artifacts.

## Go / No-Go

Green:

- Jeanine reply can be matched when a tracked outreach row exists.
- App draft creation works.
- Gmail draft creation works.
- Slack approval alert works.
- The approval gate remains intact.

Yellow:

- Natural Gmail trigger behavior for `WF-GDR` still needs a live inbound proof without a temporary replay hook.
- Manual Gmail UI sends need a durable tracking strategy, or approved sends should be forced through the tracked workflow path.

No-go until resolved or explicitly waived:

- Do not scale Anna/Kyle/next-wave outreach on this proof alone.
- Do not treat a Gmail UI send as launch-safe unless thread tracking is registered in `outreach_queue`.
- Do not send any generated reply unless Vambah explicitly says `safe to send`.

## Recommended Next Fix

Patch the durable tracking gap before expanding outreach:

1. Choose one approved outbound path as canonical for launch.
   - Preferred: approved sends go through `WF-CLG-003`, which creates or updates the tracked `outreach_queue` row with the Gmail thread id.
   - Fallback: add a registration step for manual Gmail draft sends so the thread id is stored before reply detection depends on it.
2. Repair or prove the natural `WF-GDR` 4-hour Gmail trigger with a fresh controlled inbound message.
3. Tighten the reply prompt/parser so the body does not include a duplicated `Subject:` line.
4. Run one more controlled live test that starts with the canonical send path and ends with a draft plus Slack approval alert, without temporary webhooks.

## 2026-06-28 Slack Approval Handler Follow-Up

After PR #593 landed, a controlled internal WF-GDR smoke proved the production Slack approval handler can receive plain thread replies when the Slack app and channel are configured correctly.

Production Slack app configuration:

- App: `Portfolio Agent Ops`
- App ID: `A0B5UUPV6LS`
- Workspace: `AmaduTown Advisory Solutions`
- Event Subscriptions: on
- Request URL: `https://amadutown.com/api/slack/agent/events`
- Request URL verification: pass
- Bot events:
  - `app_mention`
  - `message.im`
  - `message.channels`
- Reinstalled scopes:
  - `commands`
  - `app_mentions:read`
  - `im:history`
  - `channels:history`
- Approval alert channel: `C0AFE8874LR` (`meeting-actions-todo`)
- Channel membership: `Portfolio Agent Ops` added to `#meeting-actions-todo`

Controlled internal smoke evidence:

- WF-GDR execution: `18739`
- App draft ID: `46f6aa29-92c0-4b31-be43-e6335d3d3f8b`
- Gmail draft ID: `r7886723628103744141`
- Slack alert timestamp: `1782673812.138509`
- `hold` thread reply: pass. The app replied, `Held. App draft 46f6aa29-92c0-4b31-be43-e6335d3d3f8b remains unsent.`
- `modify: ...` thread reply: pass. The app captured the modification request and confirmed no email was sent.
- `safe to send` thread reply: production route returned HTTP 200, but the app draft remained unsent. Root cause was the Slack connector suffixing the message with `Sent using ChatGPT`; the strict parser rejected the suffixed approval phrase before the send branch ran.
- Production route evidence: `/api/slack/agent/events` returned HTTP 200 for the post-configuration thread replies.

Important behavior note:

- `hold` keeps the draft unsent.
- `modify: ...` currently captures and acknowledges the requested revision, but does not automatically rewrite the Gmail draft.
- `safe to send` sends the Gmail draft and should only be used after confirming the draft recipient is internal or the user has explicitly approved the customer-facing send.
- After the Slack connector suffix parser fix is deployed, rerun `safe to send` against an internal-only draft before enabling this as a normal approval path.
