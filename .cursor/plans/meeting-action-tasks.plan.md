# Meeting Action Tasks + Client Update Drafts

**Created:** 2026-02-14
**Status:** Complete
**Progress:** 100%

## Overview

Promote meeting-record action items into tracked tasks (visible in Slack Kanban channels),
and generate draft client-update emails when tasks are completed. Drafts are tracked in-app
(not Gmail-only) so they aren't lost.

## Architecture

```
Meeting completes → WF-MCH → meeting_records (action_items JSONB)
  ↓
App webhook / promote API → meeting_action_tasks (one row per action)
  ↓
n8n mirrors tasks to Slack #meeting-actions-todo channel
  ↓
Admin marks task complete (app or Slack reaction/channel move)
  → meeting_action_tasks.status = 'complete'
  ↓
Admin clicks "Generate update email"
  → Renders subject + body from completed tasks
  → Inserts client_update_drafts (status = 'draft')
  ↓
Admin edits draft in-app → "Send" → n8n progress-update webhook → email/Slack
```

## Implementation Checklist

| # | Task | Status |
|---|------|--------|
| 1 | Create tracking plan document | ✅ Done |
| 2 | Migration: `meeting_action_tasks` + `client_update_drafts` | ✅ Done |
| 3 | Lib: `lib/meeting-action-tasks.ts` (promote, CRUD, Slack) | ✅ Done |
| 4 | Lib: `lib/client-update-drafts.ts` (generate, render, send) | ✅ Done |
| 5 | API: `POST /api/meetings/[id]/promote-tasks` | ✅ Done |
| 6 | API: `GET/PATCH /api/meeting-action-tasks` | ✅ Done |
| 7 | API: `POST/GET /api/client-update-drafts` + `[id]` | ✅ Done |
| 8 | Admin UI: `/admin/meeting-tasks` page | ✅ Done |
| 9 | Admin dashboard nav card | ✅ Done |
| 10 | n8n setup guide (Slack channels, completion detection) | ✅ Done |
| 11 | Update SOP + docs with new workflows | ✅ Done |
| 12 | Build verification + lint check | ✅ Done |

## Decisions

- **Scope:** Meeting-record actions only (no ad-hoc tasks for now).
- **Task visibility:** Slack channels as Kanban; app as source of truth.
- **Draft location:** In-app (`client_update_drafts`); Gmail optional via n8n.
- **Completion detection:** Admin marks complete in app; Slack sync is informational.

## Verification Results

- Build: PASS
- Lint: PASS (ReadLints — no errors)
- Unit tests: SKIP (no test runner configured)
- API smoke: SKIP (migration not yet applied)
- E2E smoke: SKIP (migration not yet applied)
