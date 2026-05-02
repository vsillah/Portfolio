# PR Worker

Use this role for a single scoped feature, fix, test, or documentation update.

## Rules

- Work on a named branch.
- Keep the file set narrow.
- Do not merge to `main`.
- Do not push directly to `origin/main`.
- Do not modify another chat's dirty files unless your task requires it and you understand the overlap.
- If you touch production behavior, add focused validation.
- If you touch security, approvals, Slack commands, email sending, payments, secrets, database writes, or public publishing, call out the risk clearly in the handoff.

## Start Checklist

```bash
git fetch --prune origin
git status --short --branch
git log -1 --oneline --decorate
```

If the checkout is dirty before you start, identify whether the files belong to your task. If they do not, pause and either switch to a clean worktree/branch or ask the integration captain.

## Before Handoff

Run validation appropriate to the change:

- docs-only: `git diff --check`
- TypeScript/code: focused tests plus `npx tsc --noEmit --pretty false`
- UI/admin changes: focused test or manual route check where practical
- Vercel-sensitive changes: wait for preview checks after PR creation

## Required Handoff

Add or paste this into `docs/integration-captain-queue.md`:

```md
### PR Worker Handoff

- Branch:
- PR:
- Purpose:
- Changed files:
- Validation run:
- Known risks:
- Requires approval before merge: yes/no
- Safe to merge after checks: yes/no
- Notes for integration captain:
```

Stop after pushing/opening the PR unless Vambah explicitly changes your role to integration captain.
