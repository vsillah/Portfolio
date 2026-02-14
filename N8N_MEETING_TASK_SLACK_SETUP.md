# n8n Meeting Action Tasks — Slack Setup Guide

## Overview

This guide explains how to connect the Meeting Action Tasks feature to Slack
so tasks from meetings appear as messages in Slack Kanban channels and
status changes are reflected when tasks are completed.

## Architecture

```
WF-MCH (Meeting Complete Handler)
  → writes meeting_records
  → calls POST /api/meetings/[id]/promote-tasks
    → creates meeting_action_tasks rows
    → fires N8N_TASK_SLACK_SYNC_WEBHOOK_URL
      → n8n posts task messages to #meeting-actions-todo

Admin marks task complete (app or Slack)
  → PATCH /api/meeting-action-tasks
    → fires N8N_TASK_SLACK_SYNC_WEBHOOK_URL (action: update_status)
      → n8n moves/updates task message in Slack
```

## Step 1: Create Slack Channels

Create these channels in your Slack workspace:

| Channel | Purpose |
|---------|---------|
| `#meeting-actions-todo` | New / pending action items |
| `#meeting-actions-in-progress` | Tasks being worked on |
| `#meeting-actions-done` | Completed tasks |

Get the **channel IDs** from Slack (right-click channel → View channel details → copy ID at bottom).

## Step 2: n8n Workflow — Task Slack Sync (WF-TSK)

Create a new n8n workflow with these nodes:

### 2a. Webhook Trigger

- **HTTP Method:** POST
- **Path:** `/task-slack-sync`
- **Response Mode:** Immediately

Receives payload:

```json
{
  "action": "create" | "update_status",
  "tasks": [
    {
      "id": "uuid",
      "title": "Prepare onboarding docs",
      "owner": "Vambah",
      "due_date": "2026-03-01",
      "status": "pending",
      "meeting_type": "kickoff",
      "project_name": "AI Chatbot",
      "client_name": "Acme Inc"
    }
  ]
}
```

### 2b. IF Node — Route by action

- **Condition:** `{{ $json.action }}` equals `create`
- **TRUE →** Create branch
- **FALSE →** Update branch

### 2c. Create Branch — Post tasks to #meeting-actions-todo

For each task in `{{ $json.tasks }}`:

**Slack: Send Message**
- **Channel:** `#meeting-actions-todo` (use channel ID)
- **Text:**

```
📋 *New Action Item*
*Title:* {{ $json.title }}
*Owner:* {{ $json.owner || 'Unassigned' }}
*Due:* {{ $json.due_date || 'No date' }}
*Meeting:* {{ $json.meeting_type || 'N/A' }}
*Task ID:* `{{ $json.id }}`
```

After posting, the Slack API returns a `ts` (message timestamp). You can
optionally POST back to the app to store `slack_message_ts` on the task:

```
PATCH /api/meeting-action-tasks
Body: { updates: [{ id: taskId, slack_message_ts: ts, slack_channel_id: channelId }] }
```

### 2d. Update Branch — Move or update task in Slack

For each task in `{{ $json.tasks }}` where `status === 'complete'`:

**Option A — Post to #meeting-actions-done:**
- Slack: Send Message to `#meeting-actions-done`
- Optionally delete original from `#meeting-actions-todo` (if you stored `slack_message_ts`)

**Option B — Add ✅ reaction to original message:**
- Slack: Add Reaction (emoji: `white_check_mark`, channel + ts from stored data)

### 2e. (Optional) Reverse — Slack reaction triggers completion

If you want admins to complete tasks from Slack (e.g. add ✅ to a task message):

1. Add a **Slack Trigger** node listening for `reaction_added` in `#meeting-actions-todo`.
2. Filter: reaction is `:white_check_mark:` and message text contains `Task ID:`.
3. Extract the task ID from the message text.
4. Call `PATCH /api/meeting-action-tasks` with `{ updates: [{ id: taskId, status: 'complete' }] }`.
5. Auth: Use a Header Auth credential with the ingest secret as bearer token, **or** create a dedicated service endpoint.

## Step 3: Connect WF-MCH

Add a node at the end of **WF-MCH** (after writing `meeting_records`) to call
the app's promote-tasks endpoint:

**HTTP Request node:**
- **Method:** POST
- **URL:** `{{ $env.APP_BASE_URL }}/api/meetings/{{ $json.meeting_record_id }}/promote-tasks`
  - Note: Since `$env` is blocked, hardcode the base URL or use a Header Auth credential.
- **Headers:** `Authorization: Bearer <admin_session_token>` (or use a service auth pattern)
- **Body:** `{ "sync_slack": true }`

This will:
1. Promote `action_items` from the meeting record into `meeting_action_tasks`.
2. Fire the `N8N_TASK_SLACK_SYNC_WEBHOOK_URL` to post tasks to Slack.

## Step 4: Environment Variable

Add to `.env.local`:

```env
N8N_TASK_SLACK_SYNC_WEBHOOK_URL=https://n8n.amadutown.com/webhook/task-slack-sync
```

## Step 5: Client Update Email (via existing progress-update webhook)

When admin sends a draft client-update email from the app, it calls the same
`N8N_PROGRESS_UPDATE_WEBHOOK_URL` with `update_type: 'action_items_update'`.

In your progress-update n8n workflow, add a branch for this update type:

- **IF:** `{{ $json.update_type }}` equals `action_items_update`
- **TRUE →** Route to email/Slack send as usual (subject + body are pre-rendered by the app)

No special template needed in n8n; the app renders the email content.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Tasks not appearing in Slack | Check `N8N_TASK_SLACK_SYNC_WEBHOOK_URL` is set and WF-TSK is active |
| WF-MCH not promoting tasks | Verify the HTTP Request node URL and auth; check n8n execution logs |
| Slack reaction not completing task | Check Slack Trigger channel ID matches `#meeting-actions-todo`; verify task ID extraction regex |
| Draft email not sending | Check `N8N_PROGRESS_UPDATE_WEBHOOK_URL` and that the workflow handles `action_items_update` |
