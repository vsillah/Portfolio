# Portfolio Terminal Command Cheatsheet

Common commands for working in the Portfolio repo from macOS Terminal or the Codex terminal.

## Change Directory

Go to the main Portfolio repo:

```bash
cd /Users/vambahsillah/Projects/Portfolio
```

Go to the active Agent Ops worktree:

```bash
cd /Users/vambahsillah/Projects/Portfolio.worktrees/agent-ops-standup-room
```

Show the current folder:

```bash
pwd
```

List files in the current folder:

```bash
ls
```

## Install And Start

Install dependencies:

```bash
npm install
```

Start local development on the default port:

```bash
npm run dev
```

Start local development with outbound n8n actions disabled:

```bash
MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run dev
```

Open the main admin Agent Ops page:

```bash
open http://localhost:3000/admin/agents
```

Check whether the local app responds:

```bash
curl -I http://localhost:3000/admin/agents
```

## Stop Or Restart Port 3000

Find the process using port 3000:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

Stop the process using port 3000:

```bash
kill $(lsof -ti tcp:3000)
```

Force-stop the process if it did not exit:

```bash
kill -9 $(lsof -ti tcp:3000)
```

Restart the dev server after clearing the port:

```bash
kill $(lsof -ti tcp:3000) 2>/dev/null || true
MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run dev
```

Use another port when 3000 should stay occupied:

```bash
PORT=3001 npm run dev
```

## Cancel Running Commands

Cancel the command currently running in the terminal:

```bash
Control-C
```

Clear the terminal screen:

```bash
clear
```

## Git Basics

Check current branch and changed files:

```bash
git status --short --branch
```

Fetch latest remote branches:

```bash
git fetch origin
```

Update the current branch from `origin/main`:

```bash
git pull --ff-only origin main
```

Create or switch to a feature branch:

```bash
git checkout -B codex/name-of-change
```

Show file changes:

```bash
git diff
```

Stage specific files:

```bash
git add path/to/file.tsx path/to/test.tsx
```

Commit staged files:

```bash
git commit -m "feat: describe the change"
```

Push the branch:

```bash
git push -u origin codex/name-of-change
```

## Trace Branch Origin

Use these when a local branch is still hanging around and you need to understand where it came from, what it changed, and whether it should be revived or retired.

List local branches, tracking branches, and latest commit messages:

```bash
git branch -vv
```

Show when a branch was created and how it moved locally:

```bash
git reflog show --date=iso codex/name-of-branch
```

Find the branch point against current `main`:

```bash
git merge-base origin/main codex/name-of-branch
```

Show commits that exist on the branch but not on `main`:

```bash
git log --oneline --graph codex/name-of-branch --not origin/main
```

Summarize the files changed by the branch:

```bash
git diff --stat origin/main...codex/name-of-branch
```

Show the exact changed files:

```bash
git diff --name-status origin/main...codex/name-of-branch
```

Inspect the related GitHub PR when you know the PR number:

```bash
gh pr view 288 --json title,state,body,comments,files,commits
```

Search recent PRs by feature phrase when you do not know the PR number:

```bash
gh pr list --state all --search "decision queue" --json number,title,state,mergedAt,headRefName,url --limit 20
```

## Validation

Run one focused test file:

```bash
npm test -- app/admin/agents/page.test.tsx
```

Run Agent Ops focused tests:

```bash
npm test -- app/admin/agents/page.test.tsx app/admin/agents/standup/page.test.tsx app/admin/agents/swarm-board/page.test.tsx app/admin/agents/coordination/page.test.tsx
```

Run all tests:

```bash
npm test
```

Run TypeScript:

```bash
npx tsc --noEmit --pretty false
```

Run lint:

```bash
npm run lint
```

Run the production build locally:

```bash
npm run build
```

## Deployment And Vercel Checks

Watch the latest deployment once:

```bash
npm run deploy:watch:once
```

Generate deployment metrics:

```bash
npm run deploy:metrics
```

Use the Vercel CLI when needed:

```bash
vercel ls
```

## Useful Agent Ops URLs

Mission Control:

```text
http://localhost:3000/admin/agents
```

Standup Room:

```text
http://localhost:3000/admin/agents/standup
```

Decision Queue:

```text
http://localhost:3000/admin/agents/coordination
```

Agent Kanban:

```text
http://localhost:3000/admin/agents/swarm-board
```

Run Console:

```text
http://localhost:3000/admin/agents/runs
```

## Quick Recovery Patterns

When localhost is frozen:

```bash
cd /Users/vambahsillah/Projects/Portfolio
kill $(lsof -ti tcp:3000) 2>/dev/null || true
MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run dev
```

When dependencies look stale:

```bash
cd /Users/vambahsillah/Projects/Portfolio
npm install
npm run dev
```

When you need a clean read of repo state:

```bash
cd /Users/vambahsillah/Projects/Portfolio
git fetch origin
git status --short --branch
```
