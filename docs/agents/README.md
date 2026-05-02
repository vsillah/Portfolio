# Agent Roles

Use these role files when multiple Codex, Cursor, Hermes, or other agent chats are working in Portfolio at the same time.

The goal is simple: workers can keep moving, but only one integration captain merges to `origin/main`.

## Required Flow

1. Pick the role that matches the chat's job.
2. Read that role file before editing.
3. Work on a named branch.
4. Commit only scoped files.
5. Push the branch.
6. Open a PR if the work is ready for review.
7. Add a handoff entry to `docs/integration-captain-queue.md`.
8. Stop before merging unless the chat is explicitly acting as integration captain.

## Roles

| Role | File | Use When |
| --- | --- | --- |
| Integration Captain | `docs/agents/integration-captain.md` | Sequencing PRs, resolving conflicts, merging, and verifying Vercel |
| PR Worker | `docs/agents/pr-worker.md` | Building a scoped feature/fix and handing it off |
| Vercel Verifier | `docs/agents/vercel-verifier.md` | Checking preview or post-merge deployment health |
| Slack Agent Reviewer | `docs/agents/slack-agent-reviewer.md` | Reviewing Slack command behavior before merge |

## Standing Rule

If multiple chats are active, treat the shared checkout as user-owned. Do not assume dirty files belong to the current chat.
