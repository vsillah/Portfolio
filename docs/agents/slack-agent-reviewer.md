# Slack Agent Reviewer

Use this role before merging changes to Slack slash commands, Slack webhooks, Slack sync, or Agent Ops Slack behavior.

## Review Priorities

Check these before merge:

- Slack request signatures fail closed outside local development.
- Slash commands answer inside Slack's response window.
- Slow work has an explicit user-visible path.
- The route does not rely on frozen Vercel background work for critical delivery.
- Command behavior is documented in tests.
- Errors are visible to the user or recorded in Agent Ops.

## Current Decision Standard

For `/api/slack/agent`, prefer this behavior:

- Fast command result: return directly in the initial Slack response.
- Slow command result: use a reliable delivery path. Acceptable v1 paths are Vercel `waitUntil` posting to Slack `response_url`, or creating/referencing an `agent_run` and returning a run/status link or ID.

Avoid the middle state where Slack receives an acknowledgement but the final result has no reliable delivery path.

## Required Tests

Slack route changes should usually test:

- invalid signature is rejected
- missing signing secret is rejected outside local development
- valid slash command dispatches expected text/user context
- fast result returns directly
- slow result returns a truthful status/run response
- any delayed delivery path is exercised if it exists

## Handoff Note

When reviewing a Slack PR, explicitly say whether the behavior is:

- sync-only
- durable async
- hybrid with run/status handoff
- unsafe/ambiguous
