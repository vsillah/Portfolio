---
name: Add branch protection rule on main (GitHub UI)
about: One-time repo settings task
title: Add branch protection rule on main (GitHub UI)
labels: improvement
assignees: ''
---

## TL;DR
Add a branch protection rule for `main` in the GitHub UI so force pushes and branch deletion are disabled.

## Current state
- No branch protection on `main`
- Force push or branch delete is possible if account is compromised or a collaborator is added later

## Expected outcome
- Branch protection enabled on `main` with:
  - **Do not allow** force pushes
  - **Do not allow** branch deletion
  - Optional: require a pull request before merging; restrict who can push to `main`

## Steps (GitHub UI)
1. Repo → **Settings** → **Branches**
2. **Add branch protection rule** (or edit existing)
3. Branch name pattern: `main`
4. Enable **Do not allow force pushes** and **Do not allow deletions**
5. Optionally: **Require a pull request before merging**, **Restrict who can push to matching branches** (only you/trusted admins)
6. Save

## Relevant files
None in codebase — repo settings only. Optionally add a short runbook (e.g. `docs/runbooks/github-branch-protection.md`) for future reference.

## Notes
- One-time setup per repo
- Apply to this repo and any other portfolio repos (e.g. Scylla, Slabwork) where you want the same protection
