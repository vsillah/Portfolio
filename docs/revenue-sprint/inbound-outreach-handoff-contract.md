# Inbound Outreach Handoff Contract

Version: `inbound-outreach-handoff/v1`

This contract lets inbound lead intake, client email context, meeting follow-up context, and reply classification hand context to downstream workflows without changing outbound send or draft approval behavior.

## Boundary

Every packet must include:

- `approval_boundary: "context_handoff_only_no_send_no_auto_approval"`
- `human_review_required: true`

Consumers may use the packet to ground a reply, prepare a reviewed follow-up, or route a lead into the admin outreach surface. Consumers must not send email, approve a draft, mark a draft ready, create a calendar event, or bypass the existing outreach/email review gates from this context response alone.

## Current Producers

- `GET /api/client-email-context?email=...`
  - `intent: "client_reply_context"` for active client project context.
  - `intent: "lead_reply_context"` for lead-only inbox context.
- `GET /api/meetings/[id]/follow-up-context`
  - `intent: "meeting_follow_up_context"` for scheduling or follow-up preparation.

## Packet Shape

```json
{
  "version": "inbound-outreach-handoff/v1",
  "intent": "lead_reply_context",
  "next_action": "review_lead_reply_for_outreach",
  "approval_boundary": "context_handoff_only_no_send_no_auto_approval",
  "human_review_required": true,
  "contact": {
    "name": "Lead Person",
    "email": "lead@example.com",
    "company": "Lead Co"
  },
  "source_refs": {
    "source_type": "lead",
    "lead_id": 42
  },
  "context_signals": [
    "Interest: AI ops",
    "Last meeting: Lead wants faster reply drafting."
  ],
  "handoff_notes": [
    "Use this packet to ground a reply or outreach review.",
    "Do not send, approve, or mark a draft ready from this context response alone."
  ],
  "target_surface": "/admin/outreach?tab=leads&id=42"
}
```

## Consumer Rules

- Reply detection may classify inbound replies and attach this packet as review context.
- Meeting-to-lead extraction may pass this packet into the Add Lead or outreach review flow.
- Client email workflows may use the packet for drafting context only.
- Follow-up schedulers may use the packet to prepare copy or a scheduling recommendation only.
- Any side-effecting step must continue through the existing admin review, outreach queue, Gmail draft, or calendar approval gate.
