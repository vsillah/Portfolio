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
- whether any ready PR skipped an impact preflight despite touching a hot surface

## Merge Gate

Before merging a PR:

- PR is not draft.
- PR has a clear purpose and scoped file set.
- PR has an impact preflight when it touches a hot surface or overlaps another active branch.
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

## Status Reporting Standard

Separate normal integration mechanics from process debt so the report does not create noise.

Treat these as normal course of work unless they block validation, merging, or cleanup:

- a draft PR that is intentionally waiting for more work
- a temporary worktree created to isolate a branch or keep `main` available
- a detached checkout used for read-only verification
- a deleted upstream branch after its PR has already merged
- a Vercel context that is pending because the deployment is still queued or building

Flag these as process debt or Git hygiene issues:

- uncommitted files with unclear ownership
- multiple agents editing the same files without an impact preflight
- stale worktrees with unmerged commits, dirty files, or unknown purpose
- local branches whose remote was deleted before their changes were merged
- repeated direct pushes to `origin/main` from parallel work chats
- branches or PRs that stay open after their work has landed elsewhere

When reporting, label each finding as one of:

- `normal`: expected residue from active integration work
- `watch`: harmless now, but worth cleaning if it persists
- `debt`: inefficient, risky, or likely to create future merge noise
- `blocker`: must be resolved before the next merge or deployment step

## GitHub Hygiene Methods

Use these methods when they reduce future merge noise or make parallel work easier to reason about.

### Branch Lifecycle

- Prefer short-lived branches named by owner and purpose, such as `codex/agent-command-room`.
- Keep one branch to one feature, fix, or docs update.
- Delete remote branches after their PR is merged and post-merge verification passes.
- Delete local branches only when they have no commits missing from `origin/main`.
- Leave recovery stashes and unknown local branches in place until their owner or purpose is clear.

Before deleting a local branch with a gone upstream, check:

```bash
git log --oneline <branch> --not origin/main
```

If that command returns commits, classify the branch as `watch` or `debt` instead of deleting it.

### PR Queue Discipline

- Process one non-draft PR at a time.
- Do not start the next merge until both post-merge Vercel contexts are green.
- Treat draft PRs as `normal` unless they overlap hot files, stay stale for several days, or their work already landed elsewhere.
- Promote a draft PR to merge consideration only after the owner marks it ready or the captain verifies its intent directly.
- If two PRs touch the same hot files, merge the lower-risk/shared-foundation PR first, then re-check the second PR against updated `main`.

### Hot File Awareness

Treat these as hot surfaces that deserve extra scrutiny:

- shared admin shells, nav, layout, and auth wrappers
- shared agent runtime libraries and Slack command handlers
- database migrations, RLS policies, seeds, and generated schema types
- Vercel config, environment handling, webhooks, and cron routes
- generated files that are expensive to regenerate or easy to pollute

For hot surfaces, require one of:

- an impact preflight in the PR or handoff
- a focused local re-validation by the captain
- explicit sequencing because another active PR touches the same surface

### Automated Checks Worth Adding

Recommend automation when the same issue appears more than twice:

- stale branch report: list local branches with gone upstreams and whether they have unique commits
- open PR age report: flag ready PRs older than 48 hours and draft PRs older than 7 days
- hot-file overlap report: compare open PR file lists before implementation starts
- post-merge health monitor: verify Vercel contexts plus `/api/health` for production and staging
- queue hygiene report: compare `docs/integration-captain-queue.md` against open PRs

Start these as read-only reports. Only add auto-cleanup after the captain has proven the report is accurate over repeated runs.
