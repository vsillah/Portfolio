# Content And Voice Automation Runbook

Use this runbook for automations that inspect personality corpus reports, content voice drift, or content-system readiness.

## Purpose

Keep Portfolio-facing content and voice systems current without exposing private source material or raw corpus exports.

## Decisions Supported

- Whether the personality corpus changed materially.
- Whether a content or voice report needs Vambah's attention.
- Whether derived summaries need a repo-owned workflow update.

## Inputs

- [`docs/memory-context-organization-workflow.md`](../memory-context-organization-workflow.md)
- Personality corpus reports and derived summaries, read-only.
- Public-safe voice docs in the Portfolio repo.
- Private corpus exports only as local source material, not quoted into reports.

## Authority Boundary

Agents may inspect derived summaries, report changes, and recommend doc updates. Agents must not quote private exports, move corpus files, or edit `~/.codex/memories` without explicit approval.

## Expected Outputs

- Short change report.
- No-change confirmation when reports are stable.
- Escalation note when private-source handling or migration drift needs review.

## Escalation Trigger

Escalate when private source material appears in a public artifact, corpus migration paths drift, or report generation fails repeatedly.
