# Outreach Mode Gating

Portfolio recognizes four outreach modes for internal review and model policy only:

- Cold 1:1
- Cold 1:many
- Warm 1:1
- Warm 1:many

All four modes stay on the canonical `/admin/outreach` workroom. They may support lead review, evidence enrichment, draft preparation, and human approval packets. They do not enable external sends, scheduling, provider calls, publication, or Slack/provider side effects.

Required gates:

- Source or relationship basis must be visible.
- Do-not-contact, suppression, and privacy checks must pass where applicable.
- Message or segment fit must be reviewed before any execution request.
- Human approval before send or schedule remains a separate gate.
- Captured replies, response classification, reply drafts, next-touch tasks, and suppression proposals remain internal workflow state until a human approves the next action.

Implementation note: `lib/outreach-mode-gating.ts` is the typed policy reference. It intentionally sets `externalExecutionEnabled: false` for every mode.
