# Warm Response Import Readiness QA

Route:

`/admin/contacts/42?qa=warm-slack-send-approval#warm-response-lifecycle`

Generate the privacy-safe MP4 walkthrough:

```bash
node scripts/record-warm-slack-send-approval-qa.mjs
node scripts/create-warm-response-readiness-qa-video.mjs
```

Expected artifacts:

`docs/warm-outreach-qa/warm-response-readiness-mobile.mp4`
`docs/warm-outreach-qa/warm-response-readiness-mobile-390.png`
`docs/warm-outreach-qa/warm-response-readiness-desktop.png`

The video must show the existing contact workroom, the compact Gmail response import canary readiness rows, the disabled live import boundary, provenance/idempotency fields, and the decision gate for Vambah human QA. The normal route, script, and tests must keep Gmail API reads, Gmail draft creation, Gmail send, Slack, n8n, provider polling, reply-draft creation, and database writes disabled unless a separate current captain authorization exists.

The canary readiness packet should make these operator states visible through fixture or dry-run data:

- not connected or provider disabled,
- ready for dry-run,
- explicit live Gmail read approval required,
- imported response found,
- no response found,
- duplicate/deduped,
- error/retry.

Importing a response is separate from follow-up drafting and external send authority. Any live Gmail provider read for a one-recipient canary remains a future explicit gate; a generic `proceed` does not authorize it.
