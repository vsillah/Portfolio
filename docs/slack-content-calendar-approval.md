# Slack Content Calendar Approval

Content Intelligence calendar reminders use Slack as an internal decision surface for draft-handoff authorization. The canonical record remains `social_content_calendar_items.authorization_status`, with downstream handoff details stored in `metadata.platform_draft_handoff`.

## Current Payload

New Slack buttons use `schemaVersion: social-calendar-approval/v1` and one of these action values:

- `social_calendar_draft_handoff.approve`
- `social_calendar_draft_handoff.reject`

Each payload must include `calendarItemId`. It may include `contentId` when the calendar row already has a linked Social Content draft. Approve records only the internal draft handoff and keeps provider generation, uploads, external scheduling, publishing, Gmail, and SMS disabled.

## Compatibility

Older URL-only Slack reminders remain valid: they open the Portfolio readiness route and do not mutate state. Legacy action values `social_calendar.approve` and `social_calendar.reject` are accepted when they include `calendarItemId`, but new cards should emit the `social_calendar_draft_handoff.*` actions.

Duplicate approve actions are idempotent: an already-authorized row returns the existing Social Content and handoff references without creating duplicate draft or work-item records. Duplicate reject actions return the existing rejected state and revision work item. A reject action cannot overturn an already-authorized row from Slack; Portfolio must handle any later revision or recovery.
