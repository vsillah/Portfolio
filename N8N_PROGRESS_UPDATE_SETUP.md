# N8N Progress Update Workflow Setup

## Overview

This workflow receives progress update payloads from the portfolio app when a milestone is marked complete, and routes the message to either Slack or email based on the client's configuration.

## Environment Variable

Add to `.env.local`:
```
N8N_PROGRESS_UPDATE_WEBHOOK_URL=https://n8n.amadutown.com/webhook/progress-update
SLACK_SIGNING_SECRET=your-slack-signing-secret
```

## Webhook Payload

The app sends the following payload to the webhook:

```json
{
  "client_project_id": "uuid",
  "client_name": "John Smith",
  "client_email": "john@company.com",
  "client_company": "Acme Inc",
  "slack_channel": "#proj-acme",
  "channel": "slack",
  "update_type": "milestone_completed",
  "email_subject": "Progress update on AI Chatbot",
  "email_body": "Hi John, progress update for you...",
  "slack_body": "Hey John -- progress update on *AI Chatbot*:...",
  "milestone_index": 2,
  "milestones_progress": "3 of 7 milestones complete",
  "attachments": [
    {
      "url": "https://supabase-url/storage/v1/object/public/...",
      "filename": "chatbot-mockup.png",
      "content_type": "image/png"
    }
  ],
  "callback_url": "https://your-domain.com/api/progress-updates/uuid/delivered"
}
```

## n8n Workflow Structure

```
Webhook Trigger (POST /progress-update)
    |
    v
IF Node: {{ $json.channel }} == "slack"
   |                         |
   v                         v
[Slack Branch]          [Email Branch]
   |                         |
   v                         v
IF: attachments.length > 0   IF: attachments.length > 0
   |          |               |          |
   v          v               v          v
Download   Skip            Download   Skip
Files                      Files
   |                         |
   v                         v
Slack: Post    ───────>   Gmail: Send
Message                   Email
   |                         |
   (if attachments)          |
   v                         v
Slack: Upload              HTTP Request
Files                      (callback)
   |
   v
HTTP Request
(callback)
```

## Node Configuration

### 1. Webhook Trigger
- **Method**: POST
- **Path**: `/progress-update`
- **Response Mode**: Immediately

### 2. IF Node (Channel Router)
- **Condition**: `{{ $json.channel }}` equals `slack`
- **True output** → Slack branch
- **False output** → Email branch

### 3. Slack Branch

#### Slack: Post Message
- **Channel**: `{{ $json.slack_channel }}`
- **Text**: `{{ $json.slack_body }}`

#### IF: Has Attachments
- **Condition**: `{{ $json.attachments.length }}` greater than `0`

#### HTTP Request: Download Files (if attachments)
- **Method**: GET
- **URL**: `{{ $json.attachments[0].url }}` (use Split In Batches for multiple)
- **Response Format**: File

#### Slack: Upload Files
- **Channel**: `{{ $json.slack_channel }}`
- **Binary Data**: From HTTP Request node
- **Initial Comment**: `Attachment: {{ $json.attachments[0].filename }}`

### 4. Email Branch

#### IF: Has Attachments
- **Condition**: `{{ $json.attachments.length }}` greater than `0`

#### HTTP Request: Download Files (if attachments)
- **Method**: GET
- **URL**: `{{ $json.attachments[0].url }}`
- **Response Format**: File

#### Gmail/SMTP: Send Email
- **To**: `{{ $json.client_email }}`
- **Subject**: `{{ $json.email_subject }}`
- **Body**: `{{ $json.email_body }}`
- **Attachments**: Binary data from HTTP Request (if available)

### 5. Callback (both branches)

#### HTTP Request: Delivery Callback
- **Method**: POST
- **URL**: `{{ $json.callback_url }}`
- **Body**:
```json
{
  "delivery_status": "sent"
}
```

## Error Handling

Add an Error Trigger node that:
1. Catches any failures in the workflow
2. Calls the callback URL with `{ "delivery_status": "failed", "error_message": "..." }`
3. Optionally sends an admin notification

## Slack Slash Command Setup

To use the `/milestone-complete` shortcut:

1. Create a Slack App at https://api.slack.com/apps
2. Add a Slash Command:
   - **Command**: `/milestone-complete`
   - **Request URL**: `https://your-domain.com/api/slack/milestone-complete`
   - **Short Description**: Mark a project milestone as complete
   - **Usage Hint**: `[client-id] [milestone-number]`
3. Copy the **Signing Secret** to `SLACK_SIGNING_SECRET` env var
4. Install the app to your workspace

## Testing

1. Create a client project with an onboarding plan
2. Go to Admin Dashboard → Client Projects → [Project] 
3. Click "Mark Complete" on a milestone
4. Optionally attach a screenshot and add a note
5. Confirm -- the progress update will be sent via the configured channel
6. Check the Progress Updates sidebar for delivery status
