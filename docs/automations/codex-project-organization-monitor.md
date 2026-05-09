# Codex Project Organization Monitor

Automation id: `codex-project-organization-monitor`

## Purpose

Detect drift between Portfolio's intended project root and the local Codex workspace or chat state.

## Operating Rhythm

Recurring organization drift check.

## Decisions Supported

- Whether active Codex work is rooted in Portfolio.
- Whether a workspace-root repair is needed.
- Whether a repo doc or instruction needs a clarification.

## Inputs

- [`organization-runbook.md`](./organization-runbook.md)
- [`../memory-context-organization-workflow.md`](../memory-context-organization-workflow.md)
- Local Codex workspace state, read-only.

## Authority Boundary

Read-only inspection and reporting. Do not edit Codex SQLite state, Desktop JSON state, generated chat folders, or memory files without explicit approval and backups.

## Expected Outputs

- Workspace-root status.
- Drift finding with exact affected paths.
- Repair packet when operational-state changes are required.

## Escalation Trigger

Escalate when active chats are outside Portfolio, when Codex Desktop reverts workspace roots, or when the repair requires local state edits.
