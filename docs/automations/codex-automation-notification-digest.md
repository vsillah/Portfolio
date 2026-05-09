# Codex Automation Notification Digest

Automation id: `codex-automation-notification-digest`

## Purpose

Summarize local Codex automation notifications so Vambah can see meaningful changes without reviewing every automation artifact manually.

## Operating Rhythm

Recurring digest. Confirm the exact schedule from local Codex automation metadata.

## Decisions Supported

- Which automation notifications need attention.
- Whether a digest item should become a repair packet, follow-up PR, or operational-state request.

## Inputs

- Local automation notification state, read-only.
- [`../memory-context-organization-workflow.md`](../memory-context-organization-workflow.md)
- Automation runbooks in this folder.

## Authority Boundary

Digest and triage only. Do not edit notification state, automation TOMLs, memory files, or repo docs from the digest without a separate scoped task.

## Expected Outputs

- Concise digest of meaningful automation notifications.
- Clear no-change report when there is nothing material.
- Follow-up recommendation for repo-owned docs or explicitly approved operational-state repair.

## Escalation Trigger

Escalate when repeated failures, high-risk credential items, duplicate automation conflicts, or missing local access prevent reliable digesting.
