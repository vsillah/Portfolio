# Portfolio Credential Rotation Due Report 2

Automation id: `portfolio-credential-rotation-due-report-2`

## Purpose

This automation appears to overlap with `portfolio-credential-rotation-due-report`. Keep it visible until Vambah or the integration captain decides whether to consolidate, rename, pause, or document a distinct scope.

## Operating Rhythm

Credential due review. Confirm the exact schedule from local Codex automation metadata before relying on timing.

## Decisions Supported

- Whether this job is a duplicate or a deliberately separate credential-reporting lane.
- Whether one credential report should become authoritative.

## Inputs

- [`credentials-runbook.md`](./credentials-runbook.md)
- [`portfolio-credential-rotation-due-report.md`](./portfolio-credential-rotation-due-report.md)
- [`../credential-management-system.md`](../credential-management-system.md)
- Local Codex automation metadata, read-only.

## Authority Boundary

Read-only review only. Do not pause, delete, edit, or reschedule this automation without a separate approved operational-state step.

## Expected Outputs

- Duplicate candidate finding.
- Recommendation to consolidate, rename, or justify both jobs.
- Approval packet if an operational-state change is requested.

## Escalation Trigger

Escalate when duplicate jobs produce conflicting reports or when consolidation would require editing `~/.codex/automations`.
