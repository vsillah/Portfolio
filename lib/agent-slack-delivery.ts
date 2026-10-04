import type { SlackBlock } from './agent-slack-blocks'
import type { getSlackAgentDeliveryConfig } from './slack-agent-environment'

export type SlackDeliveryResult = {
  sent: boolean
  reason: string | null
  mode: 'bot' | 'none'
  uncertain?: boolean
  channel?: string | null
  ts?: string | null
}

export async function postToSlack(text: string, blocks: SlackBlock[], config: ReturnType<typeof getSlackAgentDeliveryConfig>): Promise<SlackDeliveryResult> {
  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ channel: config.channel, text, blocks, unfurl_links: false, unfurl_media: false }),
      signal: AbortSignal.timeout(10_000),
    })
    const body = await response.json().catch(() => null) as { ok?: boolean; error?: string; channel?: string; ts?: string } | null
    if (response.ok && body?.ok === true && body.channel === config.channel && typeof body.ts === 'string' && /^\d+\.\d+$/.test(body.ts)) {
      return { sent: true, reason: null, mode: 'bot', channel: body.channel, ts: body.ts }
    }
    // Only a definite Slack validation/auth rejection proves no message was accepted. Everything
    // else needs reconciliation, including malformed success and transport errors.
    const definiteRejections = new Set(['invalid_auth', 'not_authed', 'account_inactive', 'token_revoked', 'channel_not_found', 'not_in_channel', 'is_archived', 'invalid_arguments', 'no_text', 'msg_too_long', 'invalid_blocks', 'restricted_action', 'missing_scope', 'ratelimited'])
    const uncertain = body?.ok !== false || !definiteRejections.has(body.error ?? '')
    return { sent: false, uncertain, reason: uncertain ? 'Slack delivery is uncertain; reconcile the bot receipt before retrying.' : 'Slack rejected the notification; delivery can be retried.', mode: 'bot' }
  } catch {
    return { sent: false, uncertain: true, reason: 'Slack delivery is uncertain; reconcile the bot receipt before retrying.', mode: 'bot' }
  }
}
