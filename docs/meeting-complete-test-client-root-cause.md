# Meeting Complete / Test Client in #project-updates — Root Cause & Fix

This doc explains **why** "Test Client" messages keep appearing in Slack (e.g. #project-updates) and how to find and stop the source so you're not running automations and incurring run costs for no reason.

---

## 1. There is no cron in this repo that calls meeting-complete

The app does **not** run a cron or scheduled job that POSTs to the meeting-complete webhook. All triggers are **event-driven** or **scheduled inside n8n**.

---

## 2. How meeting-complete gets triggered (two main paths)

### Path A: Slack → WF-SLK → meeting-complete (event-driven)

1. **Read.ai** (or any bot) posts a meeting summary into a **Slack channel** that your Slack app is subscribed to.
2. **Slack** sends an event to **WF-SLK: Slack Meeting Intake** (`POST /webhook/slack-meeting-intake`) for **every message** in that channel.
3. **WF-SLK** filters messages whose text matches: `meeting|call|summary|recap|transcript|read.ai|action items|key topics|highlights|attendees`.
4. If the message matches, WF-SLK parses it and **POSTs to `https://n8n.amadutown.com/webhook/meeting-complete`**.
5. **WF-MCH** runs: AI structuring (cost), DB write, **Post Summary to Slack**, status update, agenda generation, follow-up scheduler.

So **any** message in the subscribed channel that contains one of those words can trigger the full WF-MCH run. If Read.ai posts test/demo meeting summaries to that channel (or to a channel that is #project-updates, or that gets mirrored there), you get repeated "Test Client" summaries. It feels like a cron because **every such message** triggers the chain — e.g. Read.ai re-posting, retries, or multiple test meetings.

**How to confirm:**

- In **n8n**: Open **WF-SLK** and check **Executions**. Look at trigger payloads: `body.event.text`, `body.event.channel`. That tells you which Slack channel and which messages are firing it.
- In **Slack**: App settings → **Event Subscriptions** → see which channel(s) or events (e.g. `message.channels`) are subscribed. If it’s broad (e.g. all public channels), any message in #project-updates that matches the filter will trigger WF-SLK → meeting-complete.
- In **Read.ai**: Confirm where Read.ai is posting (which Slack channel). If it’s #project-updates or a channel that feeds it, and you have test/demo meetings with "Test Client", that’s the source.

**How to stop:**

- Narrow Slack app subscriptions to a single channel (e.g. #meeting-transcripts) and have Read.ai post only there; **or**
- In **WF-SLK**, add a filter (e.g. by channel ID) so only messages from that channel are forwarded to meeting-complete; **or**
- In Read.ai, stop posting test/demo meetings to Slack, or use a different channel for tests.

---

### Path B: WF-AGE daily schedule (scheduled)

**WF-AGE: Agenda Email Sender** runs on a **schedule** (e.g. every 24 hours).

1. It fetches **all** `meeting_records` that have `next_meeting_type` set (i.e. have an agenda).
2. For **each** such meeting it fetches the linked `client_projects` row, builds an agenda email, and **posts an agenda brief to Slack** (channel chosen by meeting type).

If you have **test** meeting records (from test client meetings that were processed by WF-MCH), WF-AGE will pick them up **every day** and post "Agenda Sent: … Test Client" (or similar) to the same Slack channels. That can feel like a cron: one run per day, but each run loops over all meetings including test ones.

**How to confirm:**

- In **n8n**: Open **WF-AGE** → **Executions**. Check run frequency and how many items the "Loop Each Meeting" node processes. If you see multiple items per run and names like "Test Client", that’s the source.
- In **Supabase**: Query `meeting_records` where `client_project_id` in (select id from client_projects where client_email in ('test-onboarding@example.com', 'test-kickoff@example.com', 'client@example.com'))`. If rows exist, WF-AGE will process them every run.

**How to stop:**

- **Option A (done in this repo):** In **WF-MCH**, test clients are now detected and **Post Summary to Slack** is skipped (see below). New test meetings will no longer post to Slack. Existing test meeting_records can still be processed by WF-AGE.
- **Option B:** In **WF-AGE**, add a filter (e.g. by `client_email` or a test-flag) so meetings for test clients are skipped before building/sending agenda and posting to Slack.
- **Option C:** Delete or archive test `meeting_records` and test `client_projects` so they’re not in the loop (e.g. run Admin → Clean Up Test Data or equivalent).

---

## 3. What was changed in this repo (Option A)

- **WF-MCH (Meeting Complete Handler)**  
  - In the **Parse and Store** code node, a test-client check was added using:
    - Emails: `client@example.com`, `test-onboarding@example.com`, `test-kickoff@example.com`, `test-stripe@example.com`
    - Names matching: `test client`, `test onboarding`, `test kickoff` (case-insensitive).
  - A new node **Is Test Client?** was added: condition `isTestClient === false`.
  - Flow is now: **Parse and Store** → **Write Meeting Record** (unchanged) and **Parse and Store** → **Is Test Client?** → (only when **not** test client) → **Post Summary to Slack**.  
  So test clients no longer get a summary posted to Slack; DB write and status/agenda still run so data stays consistent.

- **Applying the change in n8n**  
  The file `n8n-exports/WF-MCH-Meeting-Complete-Handler.json` was updated. To use it in n8n:
  1. In n8n, open **WF-MCH**.
  2. Re-import from that JSON (or manually add the **Is Test Client?** IF node and the test-client logic in **Parse and Store** as above), then reconnect **Parse and Store** → **Is Test Client?** → **Post Summary to Slack** and remove the direct **Parse and Store** → **Post Summary to Slack** link.
  3. Save and activate.

---

## 4. Summary

| What you see            | Likely source                          | How to confirm                    | How to stop                                      |
|-------------------------|----------------------------------------|-----------------------------------|--------------------------------------------------|
| Repeated "Test Client" in #project-updates | WF-SLK (Slack messages → meeting-complete) and/or WF-AGE (daily agenda loop) | n8n executions for WF-SLK, WF-AGE; Slack app events; Read.ai target channel | Filter test clients in WF-MCH (done); narrow Slack/Read.ai or filter in WF-SLK; filter or delete test data for WF-AGE |
| “Feels like a cron”     | WF-AGE runs daily; or many Slack events | WF-AGE schedule; WF-SLK execution count | Limit WF-AGE to real clients; reduce WF-SLK triggers (channel/filter) |

There is **no** cron in the app code that calls meeting-complete; the repeat effect comes from **Slack-driven WF-SLK** and/or **scheduled WF-AGE** processing the same test data repeatedly.
