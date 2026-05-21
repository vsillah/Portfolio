# Postmortem: Branch And Worktree Residue After Parallel Agent Sweeps (2026-05-21)

## Summary

After a heavy Integration Captain sweep, the Portfolio repo still had many local branches and sibling worktrees even though their PRs had already been merged. The repo itself was healthy: `main` was clean, `origin/main` matched local `main`, and Vercel deploy gates were green. The issue was operational noise: stale local branches and worktrees made it harder to tell which work was active, which work was already shipped, and which work still needed a decision.

The cleanup confirmed that almost all residue came from already-merged PRs. One branch, `codex/decision-queue-structured-intake`, was intentionally left because PR #288 had been closed without merging and still represented a real product decision.

## Impact

- Increased cognitive load during captain sweeps.
- Made normal Git residue look like possible unmerged work.
- Created risk that a future agent might revive or delete a branch without understanding its origin.
- Made it harder for Vambah to distinguish normal integration mechanics from poor Git hygiene.

No production code regression, deployment failure, or data loss occurred.

## Timeline

| Time | Event |
| --- | --- |
| 2026-05-21 | Captain sweep merged and verified several PRs, leaving `main` clean. |
| 2026-05-21 | Local branch review found many merged branches still present locally, plus stale worktrees. |
| 2026-05-21 | Branches were classified by PR status, worktree ownership, and unique commits instead of raw Git ancestry alone. |
| 2026-05-21 | Merged-PR branches and clean worktrees were removed. Temporary visual QA screenshots were preserved in a named stash before deleting their worktree. |
| 2026-05-21 | `codex/decision-queue-structured-intake` was preserved because its PR was closed, not merged, and its changes were superseded rather than shipped. |

## Root Cause

The primary root cause was a mismatch between GitHub PR state and local Git ancestry after squash merges.

Portfolio uses squash merges. A squash merge creates a new commit on `main` instead of preserving the exact branch commits. GitHub correctly marks the PR as merged, but local Git can still show the old branch commit as not reachable from `origin/main`. That makes a branch look unmerged locally even though its feature has already landed.

## Contributing Factors

- Several implementation lanes used sibling worktrees, which keep branches checked out and prevent local branch deletion until the worktree is removed.
- Some merged remote branches were not automatically deleted by GitHub or the merge command.
- The existing cleanup rule protected branches with unique commits, which is conservative but noisy when squash merges are normal.
- Closed-but-unmerged branches were not always documented with a clear disposition after closure.
- Temporary visual QA artifacts stayed in `.tmp/` inside a worktree after the PR had already landed.

## What Went Well

- The captain did not bulk-delete blindly.
- Branches were cross-checked against GitHub PR state before deletion.
- Dirty temporary artifacts were stashed before removing their worktree.
- The closed-but-unmerged branch was preserved for an explicit product decision.
- The cleanup left the shared checkout clean on `main`.

## What Could Improve

- Post-merge cleanup should include GitHub PR-state-aware branch classification, not only `git log <branch> --not origin/main`.
- Every closed-unmerged branch should receive an explicit disposition: `revive`, `superseded`, `archive`, or `delete`.
- Temporary QA output should be classified at merge time as `discard`, `stash`, or `promote to durable evidence`.
- The terminal command cheatsheet should include a branch-origin tracing sequence, so future residue can be diagnosed quickly.

## Prevention Protocol

Run this sequence during every captain sweep before deleting local branches or worktrees:

```bash
git fetch --prune origin
git status --short --branch
git branch -vv --sort=-committerdate
git worktree list --porcelain
gh pr list --state all --json number,title,headRefName,state,mergedAt,closedAt,url --limit 120
```

Classify every non-`main` branch:

| Classification | Meaning | Action |
| --- | --- | --- |
| `merged-pr residue` | GitHub PR is merged, but branch still exists locally/remotely. | Delete branch after post-merge deploy verification. Remove clean worktree. |
| `closed-unmerged` | PR was closed without merge. | Preserve until owner decides revive, archive, or delete. |
| `active-pr` | PR is open. | Leave branch/worktree in place unless owner asks for cleanup. |
| `local-only` | No recent PR found. | Trace origin before deciding. |
| `dirty-worktree` | Worktree has uncommitted files. | Classify files before removing anything. |
| `temporary evidence` | Raw screenshots, traces, or generated artifacts. | Stash or normalize into docs before cleanup. |

## Root-Cause Analysis Commands

Use these commands when a branch origin is unclear:

```bash
git branch -vv
git reflog show --date=iso codex/name-of-branch
git merge-base origin/main codex/name-of-branch
git log --oneline --graph codex/name-of-branch --not origin/main
git diff --stat origin/main...codex/name-of-branch
git diff --name-status origin/main...codex/name-of-branch
gh pr list --state all --search "feature phrase" --json number,title,state,mergedAt,headRefName,url --limit 20
gh pr view <number> --json title,state,body,comments,files,commits
```

Interpretation:

- If GitHub says the PR is `MERGED`, prefer PR state over raw ancestry for cleanup because squash merge rewrites branch ancestry.
- If GitHub says the PR is `CLOSED` and `mergedAt` is null, treat the branch as a product decision, not cleanup noise.
- If the branch has no PR, use reflog, commit author/date, and changed files to reconstruct the likely owner and intent.

## Remediation If Preliminary Steps Are Circumvented

If someone deletes, closes, or overwrites a branch before classification:

1. Check GitHub PR history:

   ```bash
   gh pr list --state all --search "branch-or-feature-name" --json number,title,state,mergedAt,headRefName,url --limit 20
   ```

2. Check local reflogs:

   ```bash
   git reflog --date=iso --all | rg "branch-or-feature-name|commit-sha"
   ```

3. Check recovery stashes:

   ```bash
   git stash list --date=local
   ```

4. Check whether the remote branch still exists:

   ```bash
   git ls-remote --heads origin branch-name
   ```

5. Recreate a recovery branch when a commit SHA is known:

   ```bash
   git checkout -B recovery/branch-name <commit-sha>
   ```

6. If the branch is superseded, extract only the still-useful idea into a fresh branch from current `main`.

7. Record the final disposition in the captain report or a postmortem if the cleanup created confusion.

## Durable Rules Added

- Branch cleanup must be PR-state-aware when squash merges are normal.
- Closed-unmerged PRs are product decisions, not automatic cleanup candidates.
- Dirty worktree artifacts must be classified before deletion.
- Temporary generated artifacts should be stashed, normalized, or explicitly discarded.
- The branch-origin tracing commands belong in `docs/terminal-command-cheatsheet.md`.

## Action Items

| Priority | Action | Owner |
| --- | --- | --- |
| High | Add branch-origin tracing commands to the terminal cheatsheet. | Integration Captain |
| High | Update captain sweep guidance to classify branches by GitHub PR state before deletion. | Integration Captain |
| Medium | Add a stale branch/worktree report that labels `merged-pr residue`, `closed-unmerged`, `local-only`, and `dirty-worktree`. | Future automation |
| Medium | Require a disposition note when closing a PR without merge. | PR owner / Captain |
| Low | Periodically retire old recovery stashes after their normalized evidence has landed. | Captain |

## References

- Terminal commands: `docs/terminal-command-cheatsheet.md`
- Captain protocol: `commands/captain-sweep.md`
- Integration role: `docs/agents/integration-captain.md`
- Preserved visual QA screenshots: `stash@{Thu May 21 05:19:47 2026}`
- Preserved AutoResearch temp artifacts: `stash@{Wed May 20 23:28:52 2026}`
