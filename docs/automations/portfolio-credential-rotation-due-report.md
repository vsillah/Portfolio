# Portfolio Credential Rotation Due Report

Automation id: `portfolio-credential-rotation-due-report`

## Purpose

Keep credential rotation due dates visible for Portfolio without rotating, revoking, syncing, or exposing secrets.

## Operating Rhythm

Weekly credential due review.

## Decisions Supported

- Which credentials need review now.
- Whether a production approval packet is needed.
- Whether duplicate credential reporting jobs should be consolidated.

## Inputs

- [`credentials-runbook.md`](./credentials-runbook.md)
- [`../credential-management-system.md`](../credential-management-system.md)
- [`../credential-rotation-runbook.md`](../credential-rotation-runbook.md)
- [`../credential-rotation-map.md`](../credential-rotation-map.md)
- [`../credential-inventory.json`](../credential-inventory.json)

## Authority Boundary

Read-only report generation only. Do not print, rotate, revoke, or sync secret values. Production-impacting action requires explicit approval.

## Expected Outputs

- Credential due report.
- Duplicate-monitor note when another job overlaps.
- Approval packet recommendation when required.

## Escalation Trigger

Escalate when production credentials are overdue, provider access is missing, or duplicate jobs disagree about status.
