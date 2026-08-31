# Slack notification gate audit

Date: 2026-08-31
Lane: `codex/slack-gate-links`

This audit covers Portfolio Slack notifications that ask an operator to approve, reject, request revision, or review a protected gate. Slack remains a notification and lightweight decision surface only. Validation for this lane must not publish, schedule, upload, call social providers, create Gmail drafts, send Gmail, send SMS, mutate production data, or dispatch real Slack messages.

| Notification type | Primary operator action | Primary destination | Consistency status | Notes |
| --- | --- | --- | --- | --- |
| Social Content copy review | Approve draft, reject with feedback, or request revision | `/admin/social-content/{id}?step=copy#social-copy-gate` | Reference pattern | PR #902 put the copy decision panel at the first-viewport copy gate. |
| Scheduled Social Content publish gate | Review final submission gate or stale publication status | `/admin/social-content/{id}?step=submit#social-platform-submission-gate` or `/admin/social-content/{id}?step=status#social-publication-status-gate` | Normalized | Primary Slack button is the gate/recovery path. Queue links remain secondary. |
| Content Intelligence calendar approval due | Authorize draft handoff, reject, or recover stale calendar row | `/admin/social-content/{id}?step={gate}#{gate-anchor}` or `/admin/agents/content-intelligence?section=calendar&calendar_item={id}#content-calendar-gate` | Normalized | Social-content-backed rows land on the exact detail gate. Calendar-only rows land on the calendar decision table. |
| Social comment attention | Approve or reject prepared reply, or open Portfolio review for manual/provider-blocked replies | `/admin/social-content/engagement-inbox?comment={id}&post={id}#social-comment-review-gate` | Normalized | Focused comment cards receive the review-gate anchor and contain the draft, Approve, Reject, Ignore, and guarded Submit controls. |
| Warm outreach draft review | Review selected lead workroom and request the next approval step | `/admin/outreach?tab=leads&id={contactId}#warm-outreach-approval-gate` | Normalized | Copy now states that Slack does not create Gmail drafts, send email, send SMS, or contact a provider. |
| Agent Ops protected approvals | Open Portfolio decision gate for protected approval types | `/admin/agents/coordination?approvalRunId={runId}#vercel-autoresearch-approval-gate` | Normalized | Protected approvals do not expose one-tap Slack approval. Low-risk Vercel AutoResearch approval cards retain Slack decision controls. |
| Vercel AutoResearch approval webhook | Open proposal approval gate | `/admin/agents/coordination?approvalRunId={runId}#vercel-autoresearch-approval-gate` | Normalized | Text names the boundary: proposal decision only, no merge, deploy, Vercel setting change, or production mutation. |
| Agent Ops blockers, stale runs, review-ready work, and goal decisions | Acknowledge, assign, request revision, ask Shaka, or inspect trace | Existing Agent Ops trace/Kanban routes | Deferred | These are operational triage messages rather than approval/open-gate defects. They keep existing Slack action semantics and secondary context links. |

Deferred follow-up: if the captain wants strict parity for every Agent Ops work-item action, add dedicated hash targets to the run console and swarm-board detail panels. This lane kept the change scoped to Slack approval/review notifications whose current links could land away from the decision CTA.
