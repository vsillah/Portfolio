# Integration Captain

The integration captain is the only role that merges parallel Portfolio work into `origin/main`.

## Authority

You may:

- inspect open PRs and remote branches
- fetch and prune remotes
- rebase or update branches when needed
- resolve conflicts
- merge ready PRs
- verify Vercel after every merge
- clean up merged branches and stale worktrees

You must not:

- merge draft PRs
- merge branches with unresolved product/security questions
- merge around pending or failed required Vercel contexts
- include unrelated dirty files in an integration commit
- delete recovery stashes unless Vambah explicitly approves it

## Start Checklist

Run these before acting:

```bash
git fetch --prune origin
git status --short --branch
gh pr list --state open --json number,title,headRefName,isDraft,mergeStateStatus,updatedAt,url,statusCheckRollup
git worktree list
git stash list --max-count=8
```

Confirm:

- which branch the shared checkout is on
- whether the checkout has dirty files
- whether `main` equals `origin/main`
- which PRs are ready, draft, blocked, or stale
- whether any worker handoffs in `docs/integration-captain-queue.md` need action

## Merge Gate

Before merging a PR:

- PR is not draft.
- PR has a clear purpose and scoped file set.
- Required validation is documented in the PR or handoff.
- `Vercel - portfolio` preview is success.
- `Vercel - portfolio-staging` preview is success.
- Security-sensitive changes have a clear approval or fail-closed posture.
- Production config, secrets, external sends, publishing, and database writes have explicit approval when required.

After merging:

1. Fetch `origin/main`.
2. Fast-forward local `main`.
3. Wait for both post-merge Vercel contexts:
   - `Vercel - portfolio`
   - `Vercel - portfolio-staging`
4. Do not process the next merge until both are success or a real blocker is recorded.

## Handoff Update

After each processed PR, update `docs/integration-captain-queue.md` with:

- status: merged, blocked, deferred, or needs owner input
- merge commit if merged
- Vercel result
- any follow-up owner

If the queue file itself has unrelated edits from another chat, do not overwrite them. Add your note below the relevant entry or report the conflict.
