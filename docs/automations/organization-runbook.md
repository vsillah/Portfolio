# Organization Automation Runbook

Use this runbook for Codex automations that inspect Portfolio workspace roots, chat placement, project naming, or context organization drift.

## Purpose

Keep Portfolio work attached to the real project root, `/Users/vambahsillah/Projects/Portfolio`, while treating `/Users/vambahsillah/Projects` as the parent container.

## Decisions Supported

- Whether active chats or workspace roots point at the wrong project.
- Whether drift is informational or requires an explicit operational-state repair.
- Whether a repo doc, workflow instruction, or local Codex state needs a scoped follow-up.

## Inputs

- [`docs/memory-context-organization-workflow.md`](../memory-context-organization-workflow.md)
- [`../agents/enhancement-impact-preflight.md`](../agents/enhancement-impact-preflight.md)
- `/Users/vambahsillah/.codex/state_5.sqlite`, read-only unless an approved repair step exists.
- `/Users/vambahsillah/.codex/.codex-global-state.json`, read-only unless an approved repair step exists.

## Authority Boundary

Agents may inspect workspace roots, report active chat counts, and prepare repair plans. Agents must not rewrite Codex SQLite state or Desktop workspace JSON from a Portfolio PR.

## Expected Outputs

- Workspace-root status.
- Drift report with exact paths.
- Recommended repo doc updates or operational repair packet.

## Escalation Trigger

Escalate when active chats are rooted outside Portfolio, Codex Desktop keeps restoring the wrong root, or a repair would require editing Codex local state.
