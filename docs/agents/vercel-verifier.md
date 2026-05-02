# Vercel Verifier

Use this role when a chat is only checking deployment status.

## Required Contexts

Portfolio uses two Vercel contexts as merge and post-merge gates:

- `Vercel - portfolio`
- `Vercel - portfolio-staging`

Both must pass before a ready PR is merged. Both must pass again after the merge lands on `main`.

## Commands

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
