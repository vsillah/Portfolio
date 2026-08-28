# Warm Response Import Readiness QA

Route:

`/admin/contacts/42?qa=warm-slack-send-approval#warm-response-lifecycle`

Generate the privacy-safe MP4 walkthrough:

```bash
node scripts/record-warm-slack-send-approval-qa.mjs
node scripts/create-warm-response-readiness-qa-video.mjs
```

Expected artifact:

`docs/warm-outreach-qa/warm-response-readiness-mobile.mp4`

The video must show the existing contact workroom, the compact Gmail response import activation rows, the disabled live import boundary, and the decision gate for Vambah human QA. The normal route, script, and tests must keep Gmail API reads, Gmail draft creation, Gmail send, Slack, n8n, provider polling, and database writes disabled unless a separate current captain authorization exists.
