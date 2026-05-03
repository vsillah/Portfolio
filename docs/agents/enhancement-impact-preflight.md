# Enhancement Impact Preflight

Use this before starting two or more enhancements in parallel.

The goal is to identify likely code overlap before implementation, not after two branches already conflict.

## When To Run

Run this preflight when:

- two chats may work at the same time
- an enhancement touches admin routes, shared libs, API routes, database schema, Slack, email, costs, approvals, or chatbot knowledge
- the request sounds adjacent to another active branch or PR
- the file set is unclear

## Process

1. Name the enhancement in one sentence.
2. Identify the user-facing surface.
3. Search for likely entry points.
4. List predicted files before editing.
5. Compare predicted files and shared symbols with active PRs, dirty files, and worktrees.
6. Classify overlap as green, yellow, or red.

## Commands

Start with the current repo state:

```bash
git fetch --prune origin
git status --short --branch
git worktree list
gh pr list --state open --json number,title,headRefName,isDraft,mergeStateStatus,updatedAt,url
```

Find likely files:

```bash
rg -n "<feature keyword>|<route>|<table>|<function>|<component>" app lib scripts docs supabase
rg --files app lib scripts docs supabase | rg "<feature keyword>|<route>|<domain>"
```

Compare against active PRs:

```bash
gh pr diff <pr-number> --name-only
git diff --name-only origin/main...origin/<branch-name>
```

## Overlap Classification

Green:

- no shared files
- no shared route, API, table, generated artifact, or exported helper
- enhancements can proceed independently

Yellow:

- different files but same user workflow, database table, API contract, generated content, or shared helper
- proceed only with explicit ownership boundaries and merge order

Red:

- same file or same exported function/component/schema
- same generated artifact or migration
- one enhancement changes assumptions the other enhancement depends on
- do not run independently; sequence the work or split ownership first

## Required Preflight Output

Every parallel worker should include this before implementation or in the PR handoff:

```md
### Enhancement Impact Preflight

- Enhancement:
- User-facing surface:
- Predicted files:
- Shared routes/APIs/tables/helpers:
- Active PRs or branches checked:
- Dirty worktree files checked:
- Overlap rating: green/yellow/red
- Coordination decision:
- Merge-order note:
```

## Coordination Rules

- If overlap is green, workers can proceed on separate branches.
- If overlap is yellow, workers can proceed only after naming ownership boundaries.
- If overlap is red, one owner should implement the shared layer first, or the integration captain should sequence the branches.
- If predicted files change during implementation, update the handoff before opening the PR.
- Generated files count as shared files. Do not let two workers regenerate the same artifact independently.
