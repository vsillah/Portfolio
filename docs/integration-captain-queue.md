# Integration Captain Queue

This is the shared coordination surface for parallel Portfolio agent work.

Every worker chat should add a handoff here or paste the same structure into the PR. The integration captain uses this file to sequence PRs, avoid duplicate merges, and preserve unresolved risks.

## Operating Rules

- Non-captain chats do not merge.
- Draft PRs stay unmerged.
- Required Vercel contexts must pass before and after merge.
- Production config, secret, external-send, publishing, payment, and broad database changes require explicit approval.
- If a PR changes a hot surface already being patched by another PR, mark it as overlap and wait for captain review.

## Active Watch Items

### Slack Agent Command Behavior

- Current state: resolved in PR #92 and deployed to both Vercel contexts.
- Standard: fast results return directly in Slack; slow results must use a reliable delivery path such as Vercel `waitUntil` for Slack `response_url` delivery or a durable `agent_run` link.
- Watch item: future Slack command changes still need reviewer coverage because `/api/slack/agent` is a hot operations surface.
- Role to apply: `docs/agents/slack-agent-reviewer.md`.

### Source Protocol Database Verification

- Git/deploy state: merged.
- Remaining verification: source-protocol DB seed/API smoke after Supabase CLI auth and `SUPABASE_DB_PASSWORD` are correctly set.
- Treat this as database verification, not a Git integration blocker.

## Queue

### Template

```md
### <PR or Branch Name>

- Branch:
- PR:
- Owner/chat:
- Purpose:
- Changed files:
- Validation run:
- Vercel preview:
- Known risks:
- Requires approval before merge:
- Safe to merge after checks:
- Captain status:
- Notes:
```

### PR #92 - Slack Agent Sync Status

- Branch: `codex/slack-agent-sync-status`
- PR: #92
- Owner/chat: Slack agent command workstream
- Purpose: Return Slack agent status inside the initial Slack response window.
- Changed files:
  - `app/api/slack/agent/route.ts`
  - `app/api/slack/agent/route.test.ts`
- Validation run: tests, typecheck, build, Vercel preview, post-merge Vercel production/staging, and live Slack smoke.
- Vercel preview: passed for `portfolio` and `portfolio-staging`; post-merge deployments also passed.
- Known risks: resolved by adding Vercel `waitUntil` delayed delivery for slow Slack commands.
- Requires approval before merge: resolved.
- Safe to merge after checks: merged.
- Captain status: complete.
- Notes: Live `/agent status` smoke returned Agent Ops status in `#agent-ops`.

### Draft PR #91 - Client AI Ops Monitor Coverage

- Branch: `cursor/regression-test-coverage-165f`
- PR: #91
- Owner/chat: Cursor coverage workstream
- Purpose: Test coverage for client AI ops monitor findings.
- Changed files: see PR.
- Validation run: see PR.
- Vercel preview: passed at last captain review.
- Known risks: draft PR.
- Requires approval before merge: no extra approval known, but draft status blocks merge.
- Safe to merge after checks: no while draft.
- Captain status: defer.
- Notes: Worker should mark ready and provide handoff before captain processes.

### Draft PR #75 - Agent Guardrails Coverage

- Branch: `cursor/missing-test-coverage-e44f`
- PR: #75
- Owner/chat: Cursor coverage workstream
- Purpose: Test coverage for agent guardrails and approval status.
- Changed files: see PR.
- Validation run: see PR.
- Vercel preview: stale but previously passed.
- Known risks: draft PR and old base.
- Requires approval before merge: no extra approval known, but draft status blocks merge.
- Safe to merge after checks: no while draft.
- Captain status: defer.
- Notes: Rebase/update before any future merge consideration.
