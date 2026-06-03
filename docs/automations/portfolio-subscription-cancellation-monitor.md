# Portfolio Subscription Cancellation Monitor

Automation id: `portfolio-subscription-cancellation-monitor`

## Purpose

Keep Portfolio's paid-app, vendor, hosted-service, model-provider, automation-runtime, and integration usage visible without taking cancellation action automatically.

## Operating Rhythm

Daily subscription and integration usage monitor.

## Decisions Supported

- Whether a vendor remains active, quiet, blocked, redundant, or ready for deeper review.
- Whether a cancellation packet should be proposed after repeated inactivity evidence.
- Whether a credential, dashboard, receipt, or provider-access issue is blocking reliable subscription judgment.

## Inputs

- [`../subscription-cancellation-audit.md`](../subscription-cancellation-audit.md)
- [`../subscription-status.json`](../subscription-status.json)
- Dated run artifacts under [`../subscription-monitor-runs/`](../subscription-monitor-runs/)
- Local automation memory at `/Users/vambahsillah/.codex/automations/portfolio-subscription-cancellation-monitor/memory.md`
- Local action-tracker feedback at `/Users/vambahsillah/.codex/automation-notifications/automation-action-feedback.json`
- Read-only provider and connector checks when credentials or authenticated connectors are available.

## Authority Boundary

Read-only monitoring and report generation only. Do not cancel subscriptions, remove provider credentials, deactivate production integrations, mutate provider settings, delete production data, or remove code paths without Vambah's exact approval phrase: `Cancel <tool/vendor> for Portfolio`.

## Output Contract

Write the full daily monitor report to a dated artifact first:

- Path: `docs/subscription-monitor-runs/YYYY-MM-DD.md`
- Heading: `# YYYY-MM-DD Subscription Monitor Run`
- Include full sanitized sections for summary, raw findings, discovered inventory, inactivity evidence, candidate cancellations, approval needed, and next audit focus.
- Do not include secrets, raw account payloads, private meeting content, private exports, or full logs.

Then update the compact tracker files:

- `docs/subscription-cancellation-audit.md` should receive only the daily heading, status, link to the dated artifact, and a compact summary of the material findings.
- `docs/subscription-status.json` should update `latestMonitorArtifact` to the new dated artifact path and keep `monitorRunArtifactPattern` as `/docs/subscription-monitor-runs/YYYY-MM-DD.md`.
- Preserve prior dated artifacts. Do not paste another full monitor report into `docs/subscription-cancellation-audit.md`.

Finally write the normal sanitized pending notification JSON under `/Users/vambahsillah/.codex/automation-notifications/pending/` and update local automation memory when the automation runner permits it.

## Validation

Before finalizing a run that changes repo artifacts:

```bash
node -e "JSON.parse(require('fs').readFileSync('docs/subscription-status.json','utf8')); console.log('subscription-status.json valid')"
npm test -- --run lib/subscription-status.test.ts
git diff --check
```

Run broader TypeScript or build validation when code, schemas, or admin UI fields change.

## Escalation Trigger

Escalate when a provider crosses the cancellation threshold, provider access regresses, billing evidence conflicts with usage evidence, repeated quiet usage persists across two or more runs, or the automation cannot write the dated artifact and compact tracker consistently.
