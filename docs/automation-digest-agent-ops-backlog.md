# Automation Digest To Agent Ops Backlog

## Contract

The Codex automation digest has three outputs:

1. Private executive digest to `vambah@amadutown.com` and the private Slack DM.
2. Sanitized action summary to `#agent-ops` (`C0B1MM4LQKB`).
3. Proposed Agent Ops work items for actionable decisions and follow-up work.

The private digest remains the full context surface. `#agent-ops` and work-item
objectives get only sanitized titles, owner/routing, urgency, safe follow-up
prompts, and safe Portfolio links.

## Action Categories

- `needs_vambah_approval`: a decision packet or explicit approval is needed before mutation.
- `agent_can_prepare`: an agent can prepare a packet, checklist, audit, or preflight without changing external systems.
- `blocked_until_access`: an agent can prepare, but execution waits on credentials, admin context, or provider access.
- `watch_only`: no work item should be created; the signal exists only for digest continuity.

## Work Item Rules

- Work items use `source_type: codex_automation_digest`.
- Work items are created as `status: proposed`.
- The idempotency key format is:
  `codex_automation_digest:<digest-date>:<automation-id>:<category>:<hash>`.
- Metadata must include the digest date, automation id/name, category, safe
  prompt, source summary path, `privacy_boundary: sanitized_action_only`, and
  `requires_explicit_approval_for_mutation: true`.
- Work items do not approve credential rotation, billing cancellation, provider
  mutation, production config changes, external sends, repo merge, or deployment.

## Routing Defaults

- Shaka / `chief-of-staff`: approval routing, ambiguous decisions, admin context requests.
- `automation-systems`: n8n, credentials, provider checks, billing packets, automation fixes.
- `integration-captain`: PR, merge, deployment, and captain queue coordination.
- Unassigned: items that need human triage before routing.

## 2026-05-28 Review Fixture

The expected-actions fixture lives at
`docs/automation-digest-agent-ops-backlog-fixtures/2026-05-28-expected-actions.json`
and captures the expected dry-run actions from the May 28 digest summaries:

- Prepare n8n drift access repair preflight.
- Prepare authenticated Portfolio admin QA checklist.
- Draft Codex thread-root repair decision packet.
- Prepare quiet-provider billing verification packet.
- Keep personality corpus no-change as watch-only.

The CLI validation fixtures are sanitized synthetic digest summaries:

- `docs/automation-digest-agent-ops-backlog-fixtures/2026-05-28-synthetic-actions-summary.json`
- `docs/automation-digest-agent-ops-backlog-fixtures/2026-05-28-synthetic-watch-summary.json`

Dry-run validation:

```bash
npm run automation:digest-actions -- \
  --summary-file docs/automation-digest-agent-ops-backlog-fixtures/2026-05-28-synthetic-actions-summary.json \
  --summary-file docs/automation-digest-agent-ops-backlog-fixtures/2026-05-28-synthetic-watch-summary.json \
  --json
```

## Phase 4 Live Simulation - 2026-05-28

Live simulation used the already-sent 2026-05-28 digest summaries and ran the
action router in `--apply` mode. The router created or reused four proposed
Agent Ops work items:

- `766a91eb-e9f1-41f6-913a-d1585bdbabdc` - Draft Codex thread-root repair decision packet.
- `6cc7ba9d-0024-4ae2-ba55-57c7f2553cd9` - Prepare quiet-provider billing verification packet.
- `d54729c6-992c-4bc0-b660-703355d481e2` - Prepare n8n drift access repair preflight.
- `d17fef5a-4c8a-4c60-8bc5-e7c70a8b25b5` - Prepare authenticated Portfolio admin QA checklist.

The sanitized simulation post was sent to `#agent-ops`:

`https://amadutownadvi-3ze6268.slack.com/archives/C0B1MM4LQKB/p1780011824744919`

Slack channel history verified the post is visible in `#agent-ops`. Re-running
the apply command returned the same work item IDs, confirming idempotent
create/reuse behavior.

Pixel mobile verification was retried after the paired device reappeared in
`adb devices -l`. The Pixel 10 Pro Slack window showed `#agent-ops` with the
sanitized simulation summary and work-item IDs visible on mobile. Evidence:
`/tmp/pixel-agentops-visible.png`.
