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
4. Classify the PR as docs-only, low-risk code, or hot-surface code.
5. For non-docs PRs, run the Multi-Agent Review Gate before moving the work item to `ready_for_merge`.
6. Run or verify focused tests appropriate to the touched files.
7. Require `Vercel - portfolio` preview success before merge.
8. Require staging-specific smoke only when the PR touches staging, n8n integration behavior, Vercel config, env handling, release gates, or another staging-sensitive surface.
9. Merge only after checks and risks are clean.

## Multi-Agent Review Gate

Use this gate for every non-docs PR and for docs PRs that touch policies, runbooks, migrations, security posture, customer-facing commitments, or operational instructions.

Launch three independent read-only review lanes before the captain makes the merge decision:

1. `PR scope/risk reviewer`
   - Inspect changed files, purpose, and blast radius.
   - Classify the PR as docs-only, code/data-affecting, security-sensitive, migration/data-affecting, or workflow-affecting.
   - Name the risks, evidence assumptions, and whether the PR is narrow enough to undraft or merge.
2. `Validation planner`
   - Infer the minimum focused validation from the changed files and package scripts.
   - Name broader validation only when the blast radius justifies it.
   - State which expensive/live checks can be skipped and why.
3. `Agent Coordination auditor`
   - Confirm the PR has exactly one Agent Coordination work item, or recommend the title/owner/status for one.
   - Check overlap against other open PRs by touched file and overlap group.
   - Recommend the next status transition and whether an approval checkpoint is needed.

The captain owns synthesis:

- Do not delegate the final merge decision.
- Record the review result and exact validation commands in the work item's validation summary.
- Keep the work item at `ready_for_review` while the PR is draft, checks are pending, or the review lanes disagree on a material risk.
- Move the work item to `ready_for_merge` only after the captain validates the plan and creates the approval checkpoint.

Docs-only fast path:

- If the PR is clearly docs-only, does not change policy/runbook authority, and has no cross-PR overlap, the captain may skip subagents.
- Still run `git diff --check` and verify the PR is not draft, scoped, and merge-clean.

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
- Delete local branches only after checking both GitHub PR state and local commit state. Squash-merged PR branches can still show commits missing from `origin/main`.
- Treat a closed-unmerged PR as a product decision, not routine cleanup. Preserve it until the owner decides revive, archive, or delete.
- Classify dirty worktree files as temporary evidence, normalized proposal, approved durable artifact, or stale debris before removing the worktree.
- Preserve recovery stashes and unknown worktrees unless Vambah explicitly approves cleanup.
- Leave watch/debt items documented instead of guessing ownership.

If a branch or worktree origin is unclear, run the RCA sequence in `docs/terminal-command-cheatsheet.md` and use the postmortem protocol in `docs/postmortems/2026-05-21-branch-worktree-residue-and-traceability.md` before deleting anything.

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
