# Warm Gmail Operating Loop QA

This packet exercises the existing warm outreach workroom with synthetic fixture data. It covers the canonical outreach queue route and the same contact's response lifecycle:

- `/admin/outreach?tab=leads&filter=warm&id=42&contactId=42&queueId=qa-warm-slack-send-approval-queue-42&qa=warm-slack-send-approval#warm-gmail-operating-loop`
- `/admin/contacts/42?qa=warm-slack-send-approval#warm-response-lifecycle`

Run locally:

```bash
QA_BASE_URL=http://127.0.0.1:3064 node scripts/record-warm-gmail-operating-loop-qa.mjs
```

The recorder checks 360px, 390px, 430px, 768px, and 1440px layouts, fails on horizontal page overflow, clicks only the inert fixture approval request, and records any Gmail draft/send, Slack, n8n, provider-read, or response-polling request as unexpected.

Expected boundaries:

- The approval request records fixture-local intent only.
- Gmail draft creation and Gmail send remain off.
- Slack and n8n dispatch remain off.
- Response import remains attached to the same outreach item but live Gmail polling remains off.
- A generic `proceed` never authorizes live Gmail execution.

Artifacts:

- `docs/warm-outreach-qa/warm-gmail-operating-loop.mp4`
- `docs/warm-outreach-qa/warm-gmail-operating-loop-qa.json`
- responsive screenshots prefixed `docs/warm-outreach-qa/warm-gmail-operating-loop-`
