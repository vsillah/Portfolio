# Vercel Deployment AutoResearch

Use this workflow to turn Vercel build/deployment performance work into bounded
research proposals with a visible approval gate.

## Operating Model

V1 is planning and approval only. It does not run autonomous experiments, merge
branches, or change hosted Vercel settings.

```bash
npm run deploy:metrics -- --json
npm run deploy:research:plan
npm run deploy:research:plan -- --json
```

The planner uses the current deployment metrics scorecard to propose focused
experiments. A proposal becomes actionable only after it is routed into Agent
Coordination as a pending `vercel_deployment_research_proposal` approval.

## Approval Gate

Approval packets must include:

- proposal title,
- hypothesis,
- expected impact,
- scorecard baseline,
- touched files or hosted settings,
- risk level,
- rollback path,
- explicit approval question.

Approving a proposal authorizes only the next scoped research action. It does
not authorize merge, production deployment, or Vercel hosted configuration
changes. Rejected proposals are marked blocked in Agent Coordination.

## Notifications

Proposal-ready notifications are event-driven. There is no schedule.

- Destination: Slack Agent Ops via `SLACK_AGENT_OPS_WEBHOOK_URL`.
- Trigger: first creation of a pending Vercel AutoResearch approval.
- Idempotency: the approval metadata records whether Slack was sent or skipped,
  so resubmitting the same proposal does not spam Slack.
- Fallback: if the webhook is absent, the approval still appears in Agent
  Coordination and the notification is marked skipped.

## Boundaries

- Agent Ops owns traces, artifacts, and approval state.
- Agent Coordination is the visible review surface.
- Integration Captain still owns merge and deployment sequencing.
- Technology Bakeoff owns vendor, runtime, or provider promotion decisions.
- Open Brain may receive approved summaries later, but it is not the execution
  engine, approval source of truth, or notification service.
- Vercel project settings, env vars, build commands, ignored build steps,
  branch protection, domains, log drains, and provider integrations remain
  separate production-config approval gates.
