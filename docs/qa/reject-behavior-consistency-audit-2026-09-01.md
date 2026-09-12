# Reject Behavior Consistency Audit - 2026-09-01

## Boundary

This audit compares Portfolio reject and revision affordances against the approved Social Content copy-gate pattern from PR #905 and PR #906.

Reference pattern:

- Initial review state shows the primary approval action plus `Reject`.
- Revision-specific action appears only after the operator enters the reject flow.
- Feedback is optional unless the surface has a stronger domain requirement.
- Guidance appears directly under the relevant action area.
- Once rejected, repeat approve/reject actions are locked or removed until the item is explicitly returned to review.
- Rejected states expose a clear recovery action such as `Return to Review`, `Revise`, or the surface's existing equivalent.

No provider calls, publishing, scheduling, Gmail, SMS, Slack dispatch, uploads, production data mutation, or migrations were performed for this audit.

## Inventory

| Surface | Current reject behavior | Pattern fit | Recommended action |
| --- | --- | --- | --- |
| Social Content detail copy gate, `/admin/social-content/[id]?step=copy#social-copy-gate` | Draft review shows `Approve Copy`/`Approve Copy & Next` plus `Reject`; `Request Revision` is revealed only after `Reject`; rejected copy shows a locked `Rejected` state plus `Return to Copy Review` recovery under the copy editor. | Matches reference pattern. | Keep as canonical behavior. Use this as the implementation reference for copy-review gates. |
| Social Content detail section gates, `/admin/social-content/[id]?step=visuals` for visual assets, asset packet, privacy, and LinkedIn draft handoff | Each section uses a two-step reject flow: initial reject opens a local rejection note; final rejection requires the note. Rejected sections show locked controls and a revision-in-progress message. | Mostly matches, with intentional stronger feedback requirement. | Keep. These gates have higher evidence/provenance risk than copy-only rejection, so required notes are appropriate. A future polish pass can add a stronger named recovery CTA when each section's repair status supports it. |
| Social Content list quick reject, `/admin/social-content` | Draft cards expose compact approve/reject icon buttons. Rejection is immediate through the list-level quick action and does not show the richer two-step revision flow. | Partial drift. | Do not patch inside this broad audit. Recommended slice: either route reject clicks to the detail copy gate or turn the quick reject into a confirm/reject-flow action that preserves optional feedback and no-repeat state. |
| Engagement Inbox comment replies, `/admin/social-content/engagement-inbox#social-comment-review-gate` | Focused comment cards show `Draft Response`, `Approve`, `Reject`, `Ignore`, and guarded `Submit`. Reject records `response_approval_state='rejected'` and keeps submission in draft/not-applicable state. No explicit in-card return-to-review or revise affordance was visible in the audited card. | Partial drift. | Recommended slice: add a rejected reply state with approve/reject locked, `Revise Reply` or `Return to Reply Review`, and guidance next to the reply action area. Preserve provider submission as a separate later gate. |
| Content Intelligence calendar approval table, `/admin/agents/content-intelligence?section=calendar#content-calendar-gate` | Pending rows show `Authorize Draft Handoff` plus `Reject`; choosing reject reveals the decision note. Rejected rows still render the decision note and action area, and the authorize control remains enabled while the reject control displays disabled `Rejected`. | Clear drift. | Recommended first code slice. Rejected calendar rows should lock authorize/reject until edited or returned to review, and expose an explicit recovery action. Keep the existing stronger requirement that calendar rejection includes a decision note. |
| Campaign content plan calendar rows, `/admin/campaigns/[id]` | Similar calendar-item controls appear in campaign context. Rejection requires a decision note, but the rejected state still leaves the broader decision block in place and uses a disabled `Rejected` button. | Clear drift, likely same state model as Content Intelligence calendar. | Include with the calendar slice if file overlap permits. Use one shared behavior across both calendar contexts. |
| Warm outreach workroom send approval, `RelationshipPacketPanel` | Gmail/Slack send approval states expose approve, revise, and reject choices. Rejected or revision-requested Gmail state routes to `Revise Gmail draft`; Slack approval card records reject/revise intent only and keeps Gmail sending blocked. | Domain-specific fit. | Keep. This is an outbound-send authority gate, so `Revise` is a peer decision rather than a hidden copy-revision action. Preserve strict external-send boundaries. |
| Warm SMS manual decision loop, `RelationshipPacketPanel` | Manual SMS readiness shows `Approve`, `Revise`, and `Reject` together. Reject remains clickable and directly changes local manual-decision state. | Intentional domain difference, with one UX risk. | Do not combine with copy-gate work. Recommended future SMS-only polish: after `rejected`, make repeat reject unavailable and keep `Revise` as the recovery path. Do not imply SMS provider readiness or live send authority. |
| Visual asset review, `/admin/content/visual-assets` | Reject opens a dialog, requires a reason, and can reject or reject-and-regenerate. Rejected candidates reopen the dialog as a regeneration workflow and remove the repeat plain reject action. | Matches intent with stronger feedback requirement. | Keep. The generation domain requires structured rejection feedback for provenance and repair. |
| Agent Ops run approval detail, `/admin/agents/runs/[runId]` | Pending approvals show approve/reject only. Once no longer pending, the action controls disappear. Rejection terminates or blocks the run depending on approval type. | Domain-specific fit. | Keep. Agent-run approval rejection is a terminal or blocked checkpoint, not an editorial revise loop. Recovery belongs in retry/new work-item flows. |
| Agent Ops Vercel AutoResearch approval queue, `/admin/agents/coordination#vercel-autoresearch-approval-gate` | Pending proposal cards show approve/reject plus evidence and `Ask Shaka`. Rejection blocks the related work item through the approval API; the queue is pending-only. | Domain-specific fit. | Keep. This is controller approval for research/work-item state, not copy revision. |
| Agent social-insights lane review, `/admin/agents/social-insights/[id]` | Review lane shows `Return to Review`, `Reject Lane`, and `Approve Lane`. If blocked, the reject button label becomes `Rejected`; recovery is visible through `Return to Review`. | Mostly matches. | Minor future polish only: disable repeat reject when already blocked, matching the no-repeat standard, while keeping `Return to Review` visible. |
| Open Brain memory proposals, `/admin/agents/open-brain` | Pending memory proposals show approve/reject. Once decided, actions disappear. | Domain-specific fit. | Keep. Rejection is a final memory-proposal decision, not a content revision loop. |
| Chat eval diagnoses and axial-code reviews, `/admin/chat-eval/...` | Pending/reviewed rows expose quick approve/reject controls. Once rejected, actions are removed or status is shown. | Domain-specific fit. | Keep. These are QA classification decisions; recovery is a new diagnosis/review cycle, not a copy gate. |
| Value evidence/source protocol QA | Rejected state is represented as a badge/status in evidence rows. Importer-level rejection cannot be overridden by approval packets. | Domain-specific fit. | Keep. This is source-safety validation, not editorial revision. |

## Recommended PR Slices

1. Calendar authorization rejection UX:
   - Update Content Intelligence and campaign calendar item controls together.
   - For `authorization_status='rejected'`, remove or disable approve/reject decisions until the item is edited or explicitly returned to pending review.
   - Add a visible recovery CTA such as `Edit and Return to Review` or a two-step `Return to Review` action if the API supports it.
   - Keep the existing required decision note for calendar rejection.

2. Engagement Inbox reply rejection UX:
   - Add a rejected reply panel near the draft reply controls.
   - Lock repeat approve/reject after rejection.
   - Expose `Revise Reply` or `Return to Reply Review`.
   - Preserve provider `Submit` as blocked until a fresh approval exists.

3. Social Content list quick reject:
   - Replace immediate quick reject with a detail-route handoff or a compact reject flow.
   - Preserve optional feedback and no-repeat state from the canonical copy gate.

4. Minor Agent social-insights polish:
   - When a lane is already blocked, keep `Return to Review` visible and disable or remove repeat `Reject Lane`.

## Lane Decision

The drift is broad and spans at least four different state models: social copy review, calendar handoff authorization, comment-reply approval, and warm outreach send authority. A single code pass would touch shared UI, API routes, tests, and possibly lifecycle semantics across unrelated approval domains. This lane should stop at the audit artifact and use the calendar authorization slice as the next bounded implementation PR.
