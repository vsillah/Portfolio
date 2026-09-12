import { getSlackAgentSource } from '@/lib/slack-agent-environment'
import { mrkdwn, slackButton } from '@/lib/agent-slack-blocks'
import type { AgentSlackCommandResult } from '@/lib/agent-slack-command'

/** Called only after the normal signed command, actor, team and channel gates. */
export function buildSlackReceiptCanary(appId?: string | null): AgentSlackCommandResult {
  const blocked = (text: string): AgentSlackCommandResult => ({ responseType: 'ephemeral', text })
  const source = getSlackAgentSource()
  if (!source.hosted || process.env.SLACK_ACTION_RECEIPTS_ENABLED !== 'true' ||
    process.env.SLACK_ACTION_RECEIPTS_ENVIRONMENT !== source.sourceEnvironment) {
    return blocked('Receipt canary unavailable: receipt processing must already be enabled for this source.')
  }
  if (!/^A[A-Z0-9]{1,31}$/.test(appId ?? '')) return blocked('Receipt canary rejected: missing signed Slack app identity.')
  const text = `Receipt-only canary · ${source.sourceEnvironment}\nSigned command app ID: ${appId}\nSource: ${source.sourceOrigin}\nVerify that Slack identifies the sender as Portfolio Agent Ops before clicking. This records a receipt without changing approvals, work, or outreach. Slack card updates and provider actions are skipped.`
  return { responseType: 'ephemeral', text, blocks: [
    { type: 'section', text: mrkdwn(text) },
    { type: 'actions', elements: [slackButton({ label: 'Verify receipt', actionId: 'agent_canary_receipt',
      value: { action: 'canary.receipt', schemaVersion: 'receipt-canary-v1', canaryAppId: appId! } })] },
  ] }
}
