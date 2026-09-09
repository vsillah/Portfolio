import { getSlackAgentSource, type SlackAgentEnvironment } from '@/lib/slack-agent-environment'

export type SlackTextObject = {
  type: 'mrkdwn' | 'plain_text'
  text: string
  emoji?: boolean
}

export type SlackBlock =
  | {
      type: 'section'
      text?: SlackTextObject
      fields?: SlackTextObject[]
      accessory?: SlackButtonElement
    }
  | {
      type: 'context'
      elements: SlackTextObject[]
    }
  | {
      type: 'actions'
      elements: SlackButtonElement[]
    }
  | {
      type: 'divider'
    }

export type SlackButtonElement = {
  type: 'button'
  text: SlackTextObject
  action_id: string
  value?: string
  url?: string
  style?: 'primary' | 'danger'
  confirm?: {
    title: SlackTextObject
    text: SlackTextObject
    confirm: SlackTextObject
    deny: SlackTextObject
  }
}

export type SlackCommandResponsePayload = {
  response_type: 'ephemeral' | 'in_channel'
  text: string
  blocks?: SlackBlock[]
}

export type SlackAgentActionValue = {
  action: string
  sourceEnvironment?: SlackAgentEnvironment
  sourceOrigin?: string
  schemaVersion?: string
  approvalId?: string
  runId?: string
  workItemId?: string
  agentKey?: string
  contentId?: string
  calendarItemId?: string
  commentId?: string
  contactId?: number
  outreachQueueId?: string
  messageVersionKey?: string
  sendQueueIdempotencyKey?: string
  note?: string
}

export function mrkdwn(text: string): SlackTextObject {
  return { type: 'mrkdwn', text: text.slice(0, 3000) }
}

export function plainText(text: string): SlackTextObject {
  return { type: 'plain_text', text: text.slice(0, 75), emoji: true }
}

export function encodeSlackActionValue(value: SlackAgentActionValue) {
  const { sourceEnvironment, sourceOrigin } = getSlackAgentSource()
  return JSON.stringify({ ...value, sourceEnvironment, sourceOrigin })
}

/** Invalid and legacy hosted cards require a fresh review; never infer their source. */
export function decodeSlackAgentActionValue(value: string | undefined): SlackAgentActionValue | null {
  if (!value || value.length > 3000) return null
  try {
    const source = getSlackAgentSource()
    const parsed = JSON.parse(value) as Record<string, unknown>
    if (!parsed || Array.isArray(parsed) || typeof parsed.action !== 'string' || !parsed.action.trim()) return null
    const legacyLocal = !source.hosted && parsed.sourceEnvironment === undefined && parsed.sourceOrigin === undefined
    if (!legacyLocal && (parsed.sourceEnvironment !== source.sourceEnvironment || parsed.sourceOrigin !== source.sourceOrigin)) return null
    const result: SlackAgentActionValue = { action: parsed.action, sourceEnvironment: source.sourceEnvironment, sourceOrigin: source.sourceOrigin }
    const fields = ['schemaVersion', 'approvalId', 'runId', 'workItemId', 'agentKey', 'contentId', 'calendarItemId', 'commentId', 'outreachQueueId', 'messageVersionKey', 'sendQueueIdempotencyKey', 'note'] as const
    for (const field of fields) {
      if (parsed[field] !== undefined) {
        if (typeof parsed[field] !== 'string') return null
        result[field] = parsed[field]
      }
    }
    if (parsed.contactId !== undefined) {
      if (typeof parsed.contactId !== 'number' || !Number.isSafeInteger(parsed.contactId) || parsed.contactId <= 0) return null
      result.contactId = parsed.contactId
    }
    return result
  } catch {
    return null
  }
}

export const decodeSlackActionValue = decodeSlackAgentActionValue

export function slackButton(input: {
  label: string
  actionId: string
  value?: SlackAgentActionValue
  url?: string
  style?: 'primary' | 'danger'
  confirmText?: string
}): SlackButtonElement {
  return {
    type: 'button',
    text: plainText(input.label),
    action_id: input.actionId,
    value: input.value ? encodeSlackActionValue(input.value) : undefined,
    url: input.url,
    style: input.style,
    confirm: input.confirmText
      ? {
          title: plainText('Confirm action'),
          text: mrkdwn(input.confirmText),
          confirm: plainText('Confirm'),
          deny: plainText('Cancel'),
        }
      : undefined,
  }
}

export function truncateSlack(text: string | null | undefined, length = 220) {
  const value = (text ?? '').trim()
  if (value.length <= length) return value
  return `${value.slice(0, Math.max(0, length - 1)).trim()}…`
}
