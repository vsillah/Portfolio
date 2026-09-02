# Outreach Mode Gating

Portfolio recognizes four outreach modes for internal review and model policy only:

- Cold 1:1
- Cold 1:many
- Warm 1:1
- Warm 1:many

All four modes stay on the canonical `/admin/outreach` workroom. They may support lead review, evidence enrichment, draft preparation, batch recipient review, individualized draft planning, and human approval packets. They do not enable external sends, scheduling, provider calls, publication, or Slack/provider side effects.

Manual LinkedIn, Facebook, and phone-contact handoff is copy-and-record only on the same workroom. It can show channel-specific text, a manual-send checklist, stable contact/channel/message-version keys, and operator-recorded timestamp/channel/note evidence. Durable manual evidence is stored as a redacted `contact_communications` manual row keyed by contact, manual channel, message version, handoff key, and evidence key. It does not store the raw private message body, phone number, screenshot, provider identifier, or external thread ID, and it does not call LinkedIn, Facebook, phone, SMS, Gmail, Slack, n8n, scheduling, polling, or provider APIs.

Required gates:

- Source or relationship basis must be visible.
- Do-not-contact, suppression, and privacy checks must pass where applicable.
- Warm 1:many batches must preserve per-recipient approval state and block weak relationship basis before draft generation.
- Message or segment fit must be reviewed before any execution request.
- Human approval before send or schedule remains a separate gate.
- Captured replies, response classification, reply drafts, next-touch tasks, and suppression proposals remain internal workflow state until a human approves the next action.

Implementation note: `lib/outreach-mode-gating.ts` is the typed policy reference. It intentionally sets `externalExecutionEnabled: false` for every mode.
