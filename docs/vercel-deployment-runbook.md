# Vercel Deployment Runbook

Use this runbook when the integration captain or autopilot is waiting on Vercel after a PR, merge, or redeploy.

## Required Contexts

Portfolio deployment is only complete when both contexts pass:

- `Vercel – portfolio`
- `Vercel – portfolio-staging`

Run the watcher before merge for the PR head SHA and after merge for the merge SHA or `main`.

```bash
npm run deploy:watch:once -- --ref <pr-head-sha> --contexts "Vercel – portfolio" --trace
npm run deploy:watch -- --ref <merge-sha> --timeout 900 --interval 30 --trace
npm run deploy:watch -- --ref main --timeout 900 --interval 30 --trace
```

Use `--trace` for integration-captain and autopilot runs so the deployment watcher output appears in Agent Operations as an `agent_ops_deployment_watch` trace and artifact. Omit `--trace` only for scratch/local checks that should not write operational history.

## Decision Thresholds

- `success`: proceed.
- `failed`: stop the merge/deploy flow and inspect Vercel logs.
- `pending` under 8 minutes: keep polling.
- `pending` for 8-15 minutes: inspect Vercel directly before assuming the build is healthy.
- `pending` over 15 minutes: treat as blocked until inspected or rerun.

Direct inspection commands:

```bash
vercel ls portfolio --scope vsillahs-projects
vercel ls portfolio-staging --scope vsillahs-projects
vercel inspect <deployment-url> --scope vsillahs-projects
```

For queue/build timing evidence, run:

```bash
npm run deploy:metrics
```

Use the metrics report to distinguish:

- queue time: Vercel concurrency pressure before the build starts,
- build time: actual project build duration,
- total time: end-to-end wait from deployment creation to ready.

## Queue Reduction Policy

Portfolio currently has two Vercel projects attached to the same GitHub repo:

- `portfolio`
- `portfolio-staging`

This is useful for production/staging parity, but it can double preview-build
pressure when every PR branch creates deployments in both projects. If staging
preview builds repeatedly delay integration, prefer this rollout:

1. Keep `portfolio` preview deployments as the routine pre-merge PR gate.
2. Keep both `portfolio` and `portfolio-staging` production deployments as the post-merge gate.
3. Stop `portfolio-staging` from building routine PR preview branches.
4. Require an explicit staging preview or equivalent staging smoke only when a PR touches staging env handling, n8n integration behavior, Vercel config, or release gates.

Recommended `portfolio-staging` Ignored Build Step once the gate is updated:

```bash
[ "$VERCEL_ENV" = "preview" ] && exit 0 || exit 1
```

Vercel semantics: exit `0` cancels the build; exit `1` continues the build.
Apply this only to `portfolio-staging`, not to `portfolio`, because the main
project still needs PR previews.

Do not apply the ignore rule if GitHub branch protection requires
`Vercel – portfolio-staging` to pass on PR branches. In that case, skipped
staging previews may leave otherwise mergeable PRs blocked or unstable. As of
2026-05-08, GitHub `main` branch protection is not enforcing required status
checks, so this rule is owned by integration-captain policy rather than GitHub.

## Premium Plan Guidance

Upgrading Vercel is worth considering when deploy waiting becomes an operating bottleneck, especially because Portfolio builds both production and staging contexts for the same PR or merge.

Upgrade is a good call if any of these become common:

- staging or production regularly queues for more than 8 minutes,
- PR review is blocked by build concurrency,
- autopilot needs reliable overnight merge/deploy verification,
- multiple agents are shipping branches in parallel,
- deployment visibility becomes more valuable than the marginal subscription cost.

Do not treat an upgrade as a substitute for the watcher. The watcher remains the source of truth for whether autopilot can proceed.
