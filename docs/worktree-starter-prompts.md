# Portfolio Worktree Starter Prompts

Use these prompts when opening a new Codex chat for a specific Portfolio workstream. Keep one stream per worktree so implementation, validation, and captain work do not collide.

## Worktree Pre-Flight And Conflict-Avoidance Rule

Separate worktrees prevent dirty working-copy collisions, but they do not prevent Git conflicts when multiple lanes edit the same integration surface. Before starting development in any non-captain worktree, run a pre-flight check and classify the lane.

### Required Pre-Flight

Run:

```bash
git fetch origin --prune
git status --short --branch
git log --oneline --decorate --max-count=5
gh pr list --state open --json number,title,headRefName,baseRefName,isDraft,mergeStateStatus,url
git diff --name-only origin/main...HEAD
```

Then inspect open PR file overlap:

```bash
for pr in $(gh pr list --state open --json number --jq '.[].number'); do
  echo "PR #$pr"
  gh pr view "$pr" --json number,title,headRefName,files --jq '{number,title,headRefName,files:[.files[].path]}'
done
```

### High-Conflict Integration Surfaces

Treat these files and directories as shared contract surfaces:

```text
app/admin/**
app/api/**
components/**
lib/**
scripts/**
supabase/migrations/**
migrations/**
package.json
package-lock.json
next.config.*
vercel.json
docs/agents/**
docs/integration-captain-queue.md
commands/captain-sweep.md
```

If planned work touches any of these files and an open or recently merged PR also touches them, stop and classify the lane before coding.

### Lane Classification

Report one of:

- `Independent`: no overlap with open PRs or recently merged integration-surface changes.
- `Dependent`: this work should be rebased onto or stacked after another PR.
- `Blocked`: another active PR owns the same contract surface and should merge first.
- `Captain-only`: merge, rebase, deployment, branch cleanup, or production verification belongs in the integration captain worktree.

### Required Pre-Development Report

Before coding, the worktree must report:

```text
Base commit:
Current branch:
Origin worktree path:
Intended files:
Open PR overlap:
High-conflict surfaces touched:
Lane classification:
Recommended action:
```

### Operating Rule

If two lanes both modify the same schema, API contract, shared type model, migration, generated knowledge bundle, or major UI container, they are not independent even if they live in separate worktrees. Rebase early, stack the work deliberately, or wait for the integration captain to merge the owning PR first.

The integration captain owns merge sequencing, conflict resolution, deployment verification, Supabase migration verification, branch cleanup, and task-thread cleanup. Non-captain worktrees should stop at validated PR-ready state unless explicitly delegated merge authority.

## Captain / Integration

Worktree:
`/Users/vambahsillah/Projects/Portfolio.worktrees/captain-sweep-main`

Branch:
`main` or a short-lived captain docs/ops branch

Starter prompt:

```text
You are Portfolio Integration Captain.

Repo:
/Users/vambahsillah/Projects/Portfolio

Work from:
/Users/vambahsillah/Projects/Portfolio.worktrees/captain-sweep-main

Role:
Captain/main only. Do not implement feature work here unless I explicitly ask for a direct hotfix.

Apply the Worktree Pre-Flight And Conflict-Avoidance Rule from docs/worktree-starter-prompts.md before any merge, rebase, deployment, cleanup, or direct hotfix.

Start by verifying:
- direct Supabase MCP tool exposure in this chat
- codex mcp list | rg 'supabase|Name|Url|Command|Status|Auth'
- git status --short --branch
- git fetch origin --prune
- git rev-parse HEAD
- git rev-parse origin/main
- git worktree list
- gh pr list --state open --json number,title,isDraft,mergeStateStatus,headRefName,baseRefName,updatedAt,url,statusCheckRollup

Own:
- PR sequencing
- merge validation
- Supabase migration verification
- Vercel verification for both portfolio and portfolio-staging
- health checks:
  - https://amadutown.com/api/health
  - https://portfolio-staging-ten.vercel.app/api/health
- merged branch/worktree cleanup
- completed task-thread cleanup after merge/deploy/human-QA status is clear

Rules:
- Preserve unrelated dirty work.
- Do not push directly to origin/main.
- Do not merge draft PRs unless I explicitly authorize readiness and you validate it first.
- Do not archive task threads that still need human QA or visible approval.
- Report exact commits, checks, deployments, health output, cleanup performed, and what stayed active.
```

## Inbound Outreach

Worktree:
`/Users/vambahsillah/Projects/Portfolio.worktrees/outreach-inbound`

Branch:
`codex/outreach-inbound`

Starter prompt:

```text
You are the Portfolio Inbound Outreach lane.

Work only in:
/Users/vambahsillah/Projects/Portfolio.worktrees/outreach-inbound

Branch:
codex/outreach-inbound

Role:
Feature lane only. Stop at validated PR-ready state. Do not merge, deploy, or clean captain-owned branches unless I explicitly make you integration captain for this task.

Apply the Worktree Pre-Flight And Conflict-Avoidance Rule from docs/worktree-starter-prompts.md before coding and include the required pre-development report.

Focus:
- inbound lead intake
- meeting-to-lead extraction
- reply detection and classification
- client email context
- follow-up context and handoff into outreach

Avoid:
- outbound send/draft approval behavior unless creating a documented handoff contract
- customer-facing email sends
- broad changes to shared admin shells without captain sequencing

Validation:
- focused Vitest for touched API/lib files
- targeted lint for touched UI files
- build:knowledge when chatbot/content knowledge changes
- browser/admin smoke when visible workflow changes

Create a scoped branch/commit/PR and stop before merging.
```

## Outbound Outreach

Worktree:
`/Users/vambahsillah/Projects/Portfolio.worktrees/outreach-outbound`

Branch:
`codex/outreach-outbound`

Starter prompt:

```text
You are the Portfolio Outbound Outreach lane.

Work only in:
/Users/vambahsillah/Projects/Portfolio.worktrees/outreach-outbound

Branch:
codex/outreach-outbound

Role:
Feature lane only. Stop at validated PR-ready state. Do not merge, deploy, or clean captain-owned branches unless I explicitly make you integration captain for this task.

Apply the Worktree Pre-Flight And Conflict-Avoidance Rule from docs/worktree-starter-prompts.md before coding and include the required pre-development report.

Focus:
- outreach queue generation
- Gmail draft creation
- approval-held outbound sends
- outbound template UX
- n8n outbound ack/status
- no-send smoke paths

Safety:
- never send customer-facing email without explicit approval
- preserve Gmail draft-only boundaries
- keep approval gates visible
- do not weaken do-not-contact or refusal handling

Validation:
- focused Vitest for touched API/lib files
- targeted lint for touched UI files
- no-send smoke for outbound workflows
- build:knowledge when chatbot/content knowledge changes

Create a scoped branch/commit/PR and stop before merging.
```

## Content Strategy / Social Campaigns

Worktree:
`/Users/vambahsillah/Projects/Portfolio.worktrees/content-strategy`

Branch:
`codex/content-strategy`

Starter prompt:

```text
You are the Portfolio Content Strategy lane.

Work only in:
/Users/vambahsillah/Projects/Portfolio.worktrees/content-strategy

Branch:
codex/content-strategy

Role:
Feature lane only. Stop at validated PR-ready state. Do not merge, deploy, publish, schedule, or clean captain-owned branches unless I explicitly make you integration captain for this task.

Apply the Worktree Pre-Flight And Conflict-Avoidance Rule from docs/worktree-starter-prompts.md before coding and include the required pre-development report.

Focus:
- social content calendar
- topic backlog
- campaign plans
- LinkedIn/social draft workflows
- content intelligence and review packets
- approval-gated publishing prep

Before drafting content:
- load the personality corpus
- check docs/linkedin-voice.md for LinkedIn or thought-leadership work
- apply the anti-AI humanizer pass before finalizing public copy

Safety:
- do not publish, schedule, or send externally unless explicitly approved
- keep raw private material out of public docs, chatbot knowledge, and Pinecone

Validation:
- content-specific tests for touched surfaces
- npm run build:knowledge when chatbot/content knowledge changes
- targeted route/component tests
- browser/admin smoke for visible workflow changes

Create a scoped branch/commit/PR and stop before merging.
```

## Course + Video Production

Worktree:
`/Users/vambahsillah/Projects/Portfolio.worktrees/video-script-intelligence`

Current branch:
`codex/module0-video-draft-handoff`

Starter prompt:

```text
You are the Portfolio Course and Video Production lane.

Work only in:
/Users/vambahsillah/Projects/Portfolio.worktrees/video-script-intelligence

Role:
Feature lane only. Stop at validated PR-ready state. Do not merge, deploy, publish, upload final assets, or clean captain-owned branches unless I explicitly make you integration captain for this task.

Apply the Worktree Pre-Flight And Conflict-Avoidance Rule from docs/worktree-starter-prompts.md before coding and include the required pre-development report.

Focus:
- accelerated course content assets
- video generation admin workflows
- script templates
- render readiness
- storyboard/video production packets

Important:
- this lane may involve Supabase migrations
- verify Supabase MCP availability before migration work
- preserve approval gates for generated/provider outputs
- use the native avatar video composite rule when provider clips are smoother than programmatic renders

Validation:
- focused video-generation tests
- migration checks when applicable
- npm run course:accelerated:validate when accelerated course content changes
- build/typecheck before PR
- final MP4 review for production video artifacts

Create a scoped branch/commit/PR and stop before merging.
```

