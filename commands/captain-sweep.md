# Captain Sweep Command

Use this command when Vambah wants the integration captain to reconcile Portfolio work without manually routing every PR or deployment check.

## Command

`captain sweep`

## Aliases

- `integration captain sweep`
- `run captain sweep`
- `do your thing` when the active context is Portfolio integration, PR, branch, deployment, or GitHub hygiene work

## Role

Act as the Portfolio integration captain described in `docs/agents/integration-captain.md`.

## Objective

Bring the shared Portfolio checkout, open PR queue, GitHub checks, and Vercel deployments into a known-good state.

## Start Gate

Before mutating anything:

```bash
git fetch --prune origin
git status --short --branch
gh pr list --state open --json number,title,headRefName,isDraft,mergeStateStatus,updatedAt,url,statusCheckRollup
git worktree list
git stash list --max-count=8
npm run git:hygiene:report
```

Classify the repo state:

- active branch and whether it matches the intended workstream
- dirty files and likely owner
- open PRs by ready, draft, blocked, stale, or needs owner input
- worktrees by active, watch, debt, or cleanup candidate
- deployment/check state for the latest `main`

## Merge Gate

For each ready PR, process one at a time:

1. Confirm the PR is not draft.
2. Confirm the file set is scoped and does not mix unrelated work.
3. Confirm hot surfaces have impact preflight, focused validation, or explicit sequencing.
4. Run or verify focused tests appropriate to the touched files.
5. Require `Vercel - portfolio` preview success before merge.
6. Require staging-specific smoke only when the PR touches staging, n8n integration behavior, Vercel config, env handling, release gates, or another staging-sensitive surface.
7. Merge only after checks and risks are clean.

## Post-Merge Gate

After each merge:

1. Fetch and fast-forward local `main`.
2. Confirm GitHub Database Health or required GitHub checks are green.
3. Wait for production Vercel deployment readiness for both:
   - `portfolio`
   - `portfolio-staging`
4. Do not merge the next PR until both production contexts are Ready or a blocker is recorded.
5. Clean merged branches only after their changes are confirmed on `origin/main`.

## Cleanup Gate

Clean conservatively:

- Delete merged remote branches when GitHub did not already delete them.
- Delete local branches only after confirming they have no commits missing from `origin/main`.
- Preserve recovery stashes and unknown worktrees unless Vambah explicitly approves cleanup.
- Leave watch/debt items documented instead of guessing ownership.

## Agent Coordination Gate

Use the Agent Coordination substrate as the shared assignment bus:

- Check `/admin/agents/coordination` and Slack `/agent captain` before merging ready PRs.
- Match PRs to coordination work items by `branch_name`, `pr_number`, or `pr_url`.
- Attach reviewable PRs to their work item and set them to `ready_for_review`.
- When checks are green and the branch is merge-clean, record validation and set the item to `ready_for_merge`; this creates an approval checkpoint instead of granting automatic merge authority.
- After merge and both Vercel contexts pass, mark the item `deployed` and record deployment evidence in the validation summary.
- If checks fail, conflicts appear, or deployment verification is blocked, mark the item `blocked` with the exact blocker and next owner.
- Treat Slack `/agent captain` as a status surface only. It must not merge PRs or mutate production.

## Report Format

Return a concise status report:

- merged PRs and merge commits
- checks and deployment results
- current branch and cleanliness
- open PRs or blocked items that remain
- watch/debt/blocker items
- next recommended operation step

## Safety Rules

- Do not push directly to `origin/main` from parallel work unless Vambah explicitly asks for a direct hotfix.
- Do not merge draft PRs.
- Do not include unrelated dirty files in any commit.
- Do not delete recovery stashes.
- Do not imply live validation ran when credentials, environment, or provider access blocked it.
