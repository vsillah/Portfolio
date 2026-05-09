# Personality Corpus Report Monitor

Automation id: `personality-corpus-report-monitor`

## Purpose

Monitor derived personality corpus reports and surface material changes while keeping private source exports protected.

## Operating Rhythm

Recurring report review. Confirm the exact schedule from local Codex automation metadata.

## Decisions Supported

- Whether the corpus report changed in a way that affects content work.
- Whether a migration path, source map, or derived summary needs follow-up.
- Whether Portfolio needs a repo-owned doc update.

## Inputs

- [`content-voice-runbook.md`](./content-voice-runbook.md)
- [`../memory-context-organization-workflow.md`](../memory-context-organization-workflow.md)
- Derived personality corpus reports, read-only.
- Private source exports only as local source material; do not quote them.

## Authority Boundary

Read-only report monitoring. Do not edit `~/.codex/memories`, move corpus files, quote private exports, or alter automation TOMLs without explicit approval.

## Expected Outputs

- No-change summary when reports are stable.
- Material-change summary when derived reports shift.
- Repair packet when paths, governance, or privacy boundaries are missing.

## Escalation Trigger

Escalate when private content appears in a public artifact, corpus reports fail repeatedly, or the monitor runs outside the expected Portfolio governance boundary.
