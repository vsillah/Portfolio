# Git Hygiene Watch Classifications

Last reviewed: 2026-05-04

Use this file as the integration captain's current disposition register for watch items that should not be deleted blindly.

## Gone Local Branches

These local branches have deleted upstreams and one commit not reachable from `origin/main`. Current recommendation: keep until the captain is ready to delete superseded local-only branches in one explicit cleanup pass.

| Branch | Unique commit | Classification | Rationale | Next action |
| --- | --- | --- | --- | --- |
| `codex/agent-autopilot-tasklist` | `6e17fac` | `superseded` | Agent task list and Chief of Staff dispatch capabilities are now represented by the merged Agent Ops task list, Chief of Staff chat, engagement, and command-room work. | Safe to delete after one final captain review confirms no active chat references it. |
| `codex/agent-engagement-hub` | `c0ba00c` | `superseded` | Admin engagement request functionality exists on `main` through `app/api/admin/agents/engage`, `lib/agent-engagement`, and `/admin/agents`. | Safe to delete after final review. |
| `codex/agent-engagement-workpackets` | `837764c` | `superseded` | Work packet artifacts are present on `main` in `lib/agent-engagement.ts` and related tests. | Safe to delete after final review. |
| `codex/agent-first-task-templates` | `cc2f475` | `superseded` | First-task templates are represented in current engagement dispatch logic and documented as complete in `docs/agent-operations-task-list.md`. | Safe to delete after final review. |
| `codex/agent-readonly-dispatch` | `247b1ef` | `superseded` | Read-only dispatch is present on `main` through admin engagement and Slack command flow. | Safe to delete after final review. |
| `codex/automation-context-dashboard` | `e96dc60` | `superseded` | Automation Context exists on `main` at `/admin/agents/automations` with nav entry and route coverage. | Safe to delete after final review. |
| `codex/chief-of-staff-actions` | `c5f5012` | `superseded` | Chief of Staff approval/action routes and chat integration are present on `main`. | Safe to delete after final review. |
| `codex/roadmap-rule-activation` | `80f5525` | `preserve` | This is outside the Agent Ops merge stream and touches client AI ops roadmap surfaces. Do not delete without a separate roadmap-owner review. | Keep and review separately. |
| `codex/slack-agent-readonly-dispatch` | `f5d793e` | `superseded` | Slack `/agent run` read-only engagement dispatch is present on `main`. | Safe to delete after final review. |

## Worktrees

| Worktree | Branch | Classification | Rationale | Next action |
| --- | --- | --- | --- | --- |
| `/Users/vambahsillah/Projects/Portfolio` | varies | `normal` | Primary shared checkout. It may be detached for integration verification or on an active captain branch while work is in progress. | Keep. |
| `/private/tmp/portfolio-slack-sync` | `main` | `normal` | Dedicated main worktree used to keep `main` available while the shared checkout is detached or on a branch. | Keep. |
| `/private/tmp/portfolio-ops-approval-guard` | `codex/portfolio-ops-approval-guard` | `preserve` | Recovery/approval-guard worktree with unique commit history. | Keep until explicitly retired. |
| `/private/tmp/portfolio-ops-approval-guard-20260502` | `codex/portfolio-ops-approval-guard-20260502` | `preserve` | Recovery/approval-guard worktree with unique commit history. | Keep until explicitly retired. |
| `/private/tmp/portfolio-ops-approval-guard-20260503` | `codex/portfolio-ops-approval-guard-20260503` | `preserve` | Recovery/approval-guard worktree with unique commit history. | Keep until explicitly retired. |

## Vercel Staging Lag

Classification: `watch`.

Use the thresholds in `docs/agents/vercel-verifier.md`:

- under 5 minutes: `normal`
- 5-10 minutes: `watch`
- over 10 minutes repeatedly: `debt`
- failed, cancelled, or timed out: `blocker`

Next action: keep collecting timing through `npm run deploy:watch`; only escalate if staging repeatedly exceeds the debt threshold.

## GitHub Transient Merge Errors

Classification: `watch`.

Current handling is sufficient:

1. Check PR state.
2. Check `origin/main`.
3. Poll briefly.
4. Retry once if the PR remains open, clean, and mergeable.
5. Stop and report if the second attempt remains stuck.

Next action: no automation yet. Add retry instrumentation only if this repeats across several PRs.
