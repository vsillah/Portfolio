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
npm run deploy:metrics -- --json
```

Use the metrics report to distinguish:

- queue time: Vercel concurrency pressure before the build starts,
- build time: actual project build duration,
- total time: end-to-end wait from deployment creation to ready.

The default metrics thresholds are:

- queue watch: 5 minutes,
- queue blocked: 10 minutes,
- build watch: 8 minutes,
- build blocked: 15 minutes.

The script prints `Deployment Timing Findings` when any recent deployment crosses
those thresholds. Treat `blocked` findings as a deployment gate until the
deployment is inspected in Vercel or rerun. Treat repeated `watch` findings as
operating debt to discuss in the captain sweep, not as automatic permission to
change production deployment settings.

Useful focused variants:

```bash
npm run deploy:metrics -- --projects portfolio --limit 10
npm run deploy:metrics -- --projects portfolio-staging --limit 10 --json
npm run deploy:metrics -- --queue-watch 240 --queue-blocked 600
```

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

Live `portfolio-staging` setting as of 2026-05-08:

- `previewDeploymentsDisabled: true`

This setting is stronger than an Ignored Build Step. The ignored-build command
still creates and queues a deployment before Vercel can evaluate the command,
which does not remove the queue bottleneck. Disabling staging preview
deployments prevents routine PR branches from entering the staging project queue
at all.

Apply this only to `portfolio-staging`, not to `portfolio`, because the main
project still needs PR previews. Do not disable staging previews if GitHub
branch protection requires `Vercel – portfolio-staging` to pass on PR branches.
As of 2026-05-08, GitHub `main` branch protection is not enforcing required
status checks, so this rule is owned by integration-captain policy rather than
GitHub.

## Premium Plan Guidance

Upgrading Vercel is worth considering when deploy waiting becomes an operating bottleneck, especially because Portfolio builds both production and staging contexts for the same PR or merge.

Upgrade is a good call if any of these become common:

- staging or production regularly queues for more than 8 minutes,
- PR review is blocked by build concurrency,
- autopilot needs reliable overnight merge/deploy verification,
- multiple agents are shipping branches in parallel,
- deployment visibility becomes more valuable than the marginal subscription cost.

Do not treat an upgrade as a substitute for the watcher. The watcher remains the source of truth for whether autopilot can proceed.

## Safe Instrumentation Notes

Allowed without a production deployment config change:

- read-only `vercel ls` deployment timing snapshots,
- read-only GitHub commit status polling through `deploy:watch`,
- structured console logs in new or touched API routes when they do not print
  secrets, customer records, lead records, private notes, raw request bodies, or
  payment data,
- local JSON output from `deploy:metrics -- --json` for captain review.

Approval gate before changing:

- Vercel project settings, build commands, ignored build steps, preview
  deployment settings, environment variables, domains, or protection settings,
- branch protection requirements tied to Vercel contexts,
- log drains or third-party monitoring integrations that export production
  runtime data.

If a production config change appears necessary, stop with the proposed setting,
scope, rollback path, and evidence from `deploy:watch` or `deploy:metrics`
before applying it.
