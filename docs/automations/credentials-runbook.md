# Credentials Automation Runbook

Use this runbook for Codex automations that inspect credential rotation readiness, due dates, or approval packets.

## Purpose

Protect Portfolio runtime credentials by keeping rotation status visible without exposing, rotating, revoking, or syncing secrets automatically.

## Decisions Supported

- Which credentials are due or overdue for rotation.
- Whether a staging drill or production proposal packet is needed.
- Whether duplicate credential-monitoring automations should be consolidated or kept with documented scope.

## Inputs

- [`docs/credential-management-system.md`](../credential-management-system.md)
- [`docs/credential-rotation-runbook.md`](../credential-rotation-runbook.md)
- [`docs/credential-rotation-map.md`](../credential-rotation-map.md)
- [`docs/credential-inventory.json`](../credential-inventory.json)
- Local Codex automation metadata under `~/.codex/automations`, read-only.

## Authority Boundary

Agents may inspect docs, produce status reports, and prepare approval packets. Agents must not print secrets, rotate secrets, revoke secrets, update runtime sinks, or edit local automation state without explicit approval.

## Expected Outputs

- Credential due report.
- Duplicate-monitor finding when overlapping jobs exist.
- Approval packet when production or client-impacting action is needed.
- Clear statement of checks that could not run due to missing provider access.

## Escalation Trigger

Escalate to Vambah when a production credential is overdue, a secret may be exposed, duplicate jobs conflict, provider access is missing, or any rotation/revocation would affect production or client systems.
