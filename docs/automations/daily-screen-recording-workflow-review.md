# Daily Screen Recording Workflow Review

Automation id: `daily-screen-recording-workflow-review`

## Purpose

Review screen-recording workflow state and surface only meaningful operational issues or follow-up needs.

## Operating Rhythm

Daily review.

## Decisions Supported

- Whether the recording workflow is healthy.
- Whether a failed or missing recording needs attention.
- Whether the workflow needs repo documentation or an explicitly approved local-state repair.

## Inputs

- [`../memory-context-organization-workflow.md`](../memory-context-organization-workflow.md)
- Relevant local workflow reports or state files, read-only.
- Any repo-owned docs referenced by the workflow.

## Authority Boundary

Read-only review only. Do not move recordings, delete recordings, edit local automation state, or expose private screen content in repo artifacts.

## Expected Outputs

- Brief health report.
- Missing/failed workflow finding when needed.
- Follow-up packet for repo docs or operational-state repair.

## Escalation Trigger

Escalate when recordings contain sensitive material, the workflow repeatedly fails, source files are unavailable, or a fix requires local state changes.
