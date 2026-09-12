# Portfolio Agent Ops receipt canary

This checks signed Slack command and callback ingress, authorized actor/workspace/channel,
source isolation, durable receipt storage, and receipt processing. It creates no pending
approval and never executes approval, work, outreach, provider, billing, or credential actions.
It does not prove Slack card updates, provider delivery, or real approval execution.

## Before the live run

Captain review and deployment are required. This development lane has not sent a Slack
message, changed configuration, or run the canary against a live database.
Use the existing Portfolio Agent Ops `/agent` command in its already-authorized channel.
The existing receipt enablement/environment, actor/team/channel, source origin, and signing
configuration must already be valid. Missing configuration is a blocker, not permission to
change secrets, scopes, Slack settings, or Vercel variables.

## Operator steps

1. In the authorized Slack channel, choose the `/agent` command belonging to **Portfolio
   Agent Ops**, enter `canary`, and submit once.
2. Inspect the ephemeral card's actual Slack sender/app identity. Open the app's profile
   and confirm Portfolio Agent Ops. Record its non-secret app ID and compare it with
   `Signed command app ID` on the card. Also verify the displayed environment and source
   origin. Stop if the app is n8n Client Automation or any other app. The card's prose alone
   is not proof of its owner: the ID comes from Slack's signed `api_app_id`, not an app-name lookup.
3. Click **Verify receipt** once. The acknowledgement must include a Portfolio receipt
   trace URL. The first acknowledgement can say queued; that is not completion evidence.
4. Open the trace and refresh until it shows **Receipt verified** and **Slack update
   intentionally skipped**. The ephemeral card remains unchanged. A repeat click reuses
   the same receipt for that operator/message; it does not create another business action.
5. Save a privacy-safe desktop/mobile recording of this exact path, the observed app
   identity, deployment commit, receipt ID, and terminal state for captain/Human QA.
   Keep raw Slack payloads, response URLs, unrelated messages, and secrets out of artifacts.

## Read-only receipt evidence

Use the receipt ID from the acknowledgement with the captain's authorized read-only DB
tool. Replace the UUID placeholder below; do not insert fake approvals or alter rows.

```sql
select id, kind, status, current_step,
  metadata->>'state' as receipt_state,
  metadata->'envelope'->>'environment' as source_environment,
  metadata->'envelope'->'value'->>'action' as action,
  metadata->'envelope'->'value'->>'canaryAppId' as signed_app_id,
  outcome->'canonical'->>'actionStatus' as action_status,
  outcome->'canonical'->>'text' as result,
  outcome->>'delivery' as delivery
from agent_runs
where id = '<receipt-uuid>'::uuid and kind = 'slack_action_receipt';
```

Success: `status=completed`, `current_step=receipt_only`, `receipt_state=receipt_only`,
`action=canary.receipt`, `action_status=completed`, correct source/app ID, no-op result,
and `delivery` NULL. This proves the receipt path, not provider execution. If queued persists,
the captain should inspect the existing worker/recovery gate. `reconciliation_required`
requires inspection rather than repeated clicks. No delivery permission repair is needed
for a successful receipt-only canary.

## Implementation boundary

- `/api/slack/agent` verifies the normal signature, actor, team, and channel gates and
  returns this card inline. It never invokes the delayed response URL path for `canary`.
- `/api/slack/agent/actions` verifies the callback signature. The action requires the
  exact action ID/schema, matching signed app ID, valid source and normal authorization.
  Recognized real-record targeting fields are rejected.
- The normal receipt store writes only `agent_runs` receipt evidence. The worker executes
  a no-op result and terminates at `receipt_only` before Slack history/update APIs,
  response URLs, or any provider delivery. No migration or new environment variable is required.
- Ordinary ephemeral business-action cards remain blocked. Normal receipt delivery and
  approval behavior are unchanged.

Slack's [slash-command documentation](https://docs.slack.dev/interactivity/implementing-slash-commands/)
describes inline ephemeral responses and signed payload app identity. Its
[ephemeral-message reference](https://docs.slack.dev/reference/methods/chat.postEphemeral)
explains why ephemeral message timestamps cannot be used with `chat.update`.
