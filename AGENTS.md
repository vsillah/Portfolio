# Portfolio Worktree Instructions

Use these instructions for Portfolio workstreams under `/Users/vambahsillah/Projects/Portfolio` and sibling worktrees under `/Users/vambahsillah/Projects/Portfolio.worktrees`.

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

## Portfolio Captain Startup Gate

Before any captain repo, PR, merge, deployment, or migration work, verify both:

1. Direct Supabase MCP tool exposure in the current chat. Accept `supabase`, `supabase-prod`, `supabase-stdio`, or `supabase-prod-stdio` tools such as `list_migrations`, `list_tables`, `execute_sql`, or `apply_migration`.
2. CLI MCP state:

```bash
codex mcp list | rg 'supabase|Name|Url|Command|Status|Auth'
```

If the CLI state is correct but direct Supabase tools are absent, stop captain work and report the Codex Desktop MCP hydration blocker. Do not create a non-migration exception.

## Integration Captain Migration Authorization Rule

After a migration PR is merged and its focused tests and captain review pass, the Integration Captain may apply that migration to the Portfolio staging database and run read-only or rolled-back validation without requesting another human approval. Record the migration identity, validation evidence, and persisted row state in the captain handoff.

Require explicit current approval before applying a migration to production when it is destructive, rewrites or deletes data, changes authentication, authorization, RLS, grants, privacy, billing, or another security boundary, enables a provider or external side effect, or has an uncertain rollback path. Non-destructive production migrations with no permission, provider, or external-execution impact may follow the normal captain merge and deployment authority after staging validation.

Migration approval is distinct from UX human QA. Reserve rendered human QA for meaningful user-facing workflow changes. Provider activation, external publishing, scheduling, outreach, public replies, and other irreversible external actions retain their existing explicit human gates regardless of migration status.

## Integration Captain Review Identity Rule

Formal GitHub approval requires a reviewer account that is different from the PR author. If the active `gh` identity is also the PR author, do not attempt to approve the PR with `gh pr review --approve`; GitHub will reject it and the transcript will imply a review state that does not exist.

When a distinct reviewer identity is not available, the integration captain should instead add a PR comment headed `Captain Review: PASS` or `Captain Review: REJECT` with the exact validation performed, then merge or return the PR based on that review. State in the handoff that no formal GitHub approval was possible because the available reviewer identity matched the author.

## Human QA Video Evidence Rule

Whenever a Portfolio change reaches Vambah's human QA gate for changed product behavior, the captain handoff must include a short video walkthrough or equivalent screen-recorded test artifact showing the exact operator path being reviewed.

- Record the behavior on the same preview, staging, production, or production-equivalent route that Vambah is being asked to approve.
- Show the setup state, the primary action path, blocked or disabled states when relevant, and the expected completion or handoff state.
- For responsive or mobile workflow changes, include the narrow-width path in the recording or provide a separate mobile-width clip.
- Keep recordings privacy-safe: use synthetic, fixture, redacted, or already-public data when possible, and avoid exposing secrets, private messages, raw contact details, or unrelated browser/app state.
- Store or reference the video alongside the PR, captain review comment, QA packet, or handoff summary so the reviewed evidence is durable.
- Do not ask Vambah for human QA on changed behavior with only automated test output unless video capture is technically blocked; if blocked, state why and provide screenshots plus exact reproduction steps.

## Human And Task-Thread Closeout Rule

Merge and deployment success are not always the end of the lane. Keep implementation, review-helper, or smoke-test task threads visible when Vambah still needs to complete human QA or visible approval.

After code merges or captain sweep merges complete:

- Inventory visible/recent Codex task threads and local Codex thread registry entries whose `cwd` belongs to Portfolio or a Portfolio worktree.
- Match active task threads against merged PRs, merged branch names, and removed worktrees.
- Archive task threads only when their scoped work has merged, been superseded, or is clearly a completed read-only helper.
- Keep the active integration captain lane visible unless Vambah explicitly asks to close it.
- Back up Codex local state before directly editing the thread registry for records that cannot be archived through the Codex app tool.
- Include archived thread names/counts, kept-active tasks, backup path, and ambiguous tasks left alone in the captain cleanup report.
