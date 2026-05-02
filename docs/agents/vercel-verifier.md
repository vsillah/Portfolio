# Vercel Verifier

Use this role when a chat is only checking deployment status.

## Required Contexts

Portfolio uses two Vercel contexts as merge and post-merge gates:

- `Vercel – portfolio`
- `Vercel – portfolio-staging`

Both must pass before a ready PR is merged. Both must pass again after the merge lands on `main`.

## Commands

Autopilot watcher:

```bash
npm run deploy:watch -- --ref main
npm run deploy:watch -- --ref <merge-sha> --timeout 900 --interval 30
npm run deploy:watch:once -- --ref <pr-head-sha>
```

The watcher exits `0` when both required Vercel contexts pass, `1` when either
context fails, and `2` when the contexts are still pending at timeout. Use the
watcher as the default integration-captain gate before falling back to manual
inspection.

For PR checks:

```bash
gh pr checks <number>
gh pr view <number> --json number,isDraft,mergeStateStatus,statusCheckRollup,url
```

For `main` status:

```bash
gh api repos/:owner/:repo/commits/main/status --jq '.state as $state | "combined_state=\($state)", (.statuses[] | [.context,.state,.target_url,.updated_at] | @tsv)'
```

## Reporting

Report:

- PR number or `main`
- each Vercel context and state
- target URL
- timestamp
- whether the result is merge-ready, post-merge verified, pending, failed, or blocked

Do not call a deployment complete while either required context is pending.

## Pending Thresholds

- Under 8 minutes: continue polling unless a context has failed.
- 8-15 minutes: inspect the Vercel target URL or run `vercel ls <project> --scope vsillahs-projects`.
- Over 15 minutes: treat as blocked until the deployment is inspected or re-run.
