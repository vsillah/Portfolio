# Vercel Deployment Runbook

Use this runbook when the integration captain or autopilot is waiting on Vercel after a PR, merge, or redeploy.

## Required Contexts

Portfolio deployment is only complete when both contexts pass:

- `Vercel – portfolio`
- `Vercel – portfolio-staging`

Run the watcher before merge for the PR head SHA and after merge for the merge SHA or `main`.

```bash
npm run deploy:watch:once -- --ref <pr-head-sha> --trace
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

## Premium Plan Guidance

Upgrading Vercel is worth considering when deploy waiting becomes an operating bottleneck, especially because Portfolio builds both production and staging contexts for the same PR or merge.

Upgrade is a good call if any of these become common:

- staging or production regularly queues for more than 8 minutes,
- PR review is blocked by build concurrency,
- autopilot needs reliable overnight merge/deploy verification,
- multiple agents are shipping branches in parallel,
- deployment visibility becomes more valuable than the marginal subscription cost.

Do not treat an upgrade as a substitute for the watcher. The watcher remains the source of truth for whether autopilot can proceed.
