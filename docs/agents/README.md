# Agent Roles

Use these role files when multiple Codex, Cursor, Hermes, or other agent chats are working in Portfolio at the same time.

The goal is simple: workers can keep moving, but only one integration captain merges to `origin/main`.

## Required Flow

1. Pick the role that matches the chat's job.
2. Read that role file before editing.
3. Run the enhancement impact preflight when another chat may be working in the same area.
4. Work on a named branch.
5. Commit only scoped files.
6. Push the branch.
7. Open a PR if the work is ready for review.
8. Add a handoff entry to `docs/integration-captain-queue.md`.
9. Stop before merging unless the chat is explicitly acting as integration captain.

## Commands

Use `captain sweep` when Vambah wants the integration captain to inspect repo state, process ready PRs, verify GitHub/Vercel gates, and clean up conservatively. The command spec lives at `commands/captain-sweep.md`.

For non-docs PRs, `captain sweep` now uses a repeatable multi-agent review gate before merge consideration. The Integration Captain keeps merge authority, but parallel read-only reviewers split scope/risk review, validation planning, and Agent Coordination audit so PRs are not merged from a single-thread judgment call.

## Roles

| Role | File | Use When |
| --- | --- | --- |
| Integration Captain | `docs/agents/integration-captain.md` | Sequencing PRs, resolving conflicts, merging, and verifying Vercel |
| PR Worker | `docs/agents/pr-worker.md` | Building a scoped feature/fix and handing it off |
| Enhancement Impact Preflight | `docs/agents/enhancement-impact-preflight.md` | Predicting overlap before parallel implementation starts |
| Vercel Verifier | `docs/agents/vercel-verifier.md` | Checking preview or post-merge deployment health |
| Slack Agent Reviewer | `docs/agents/slack-agent-reviewer.md` | Reviewing Slack command behavior before merge |

## Standing Rule

If multiple chats are active, treat the shared checkout as user-owned. Do not assume dirty files belong to the current chat.

For recurring cleanup and reporting decisions, use the GitHub hygiene methods in `docs/agents/integration-captain.md` before deleting branches, worktrees, or queue entries.
