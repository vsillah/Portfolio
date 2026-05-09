# Portfolio Automation Runbooks

This folder holds repo-owned governing docs for Portfolio-related Codex automations. These files give future agents enough operating context to understand purpose, inputs, outputs, authority, and escalation before acting.

These runbooks do not replace the local Codex automation TOML files under `~/.codex/automations`. They are Portfolio-facing context documents that repair missing governance references without writing to local operational state.

## Active Repair Targets

| Automation | Runbook | Category |
| --- | --- | --- |
| `portfolio-credential-rotation-due-report` | [`portfolio-credential-rotation-due-report.md`](./portfolio-credential-rotation-due-report.md) | Credentials |
| `portfolio-credential-rotation-due-report-2` | [`portfolio-credential-rotation-due-report-2.md`](./portfolio-credential-rotation-due-report-2.md) | Credentials |
| `codex-automation-notification-digest` | [`codex-automation-notification-digest.md`](./codex-automation-notification-digest.md) | Operations |
| `codex-project-organization-monitor` | [`codex-project-organization-monitor.md`](./codex-project-organization-monitor.md) | Organization |
| `daily-screen-recording-workflow-review` | [`daily-screen-recording-workflow-review.md`](./daily-screen-recording-workflow-review.md) | Operations |
| `personality-corpus-report-monitor` | [`personality-corpus-report-monitor.md`](./personality-corpus-report-monitor.md) | Content/Voice |

## Shared Rules

- Keep local automation TOML files as the source of truth for schedule, prompt, model, and execution environment.
- Keep this folder as the source of truth for repo-owned governing context.
- Do not edit `~/.codex/automations`, `~/.codex/memories`, or Codex SQLite state from a Portfolio PR.
- Any direct operational-state repair needs a separate approval step, backup plan, and explicit handoff.
