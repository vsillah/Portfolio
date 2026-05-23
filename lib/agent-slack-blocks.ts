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
  approvalId?: string
  runId?: string
  workItemId?: string
  agentKey?: string
  note?: string
}

export function mrkdwn(text: string): SlackTextObject {
  return { type: 'mrkdwn', text: text.slice(0, 3000) }
}

export function plainText(text: string): SlackTextObject {
  return { type: 'plain_text', text: text.slice(0, 75), emoji: true }
}

export function encodeSlackActionValue(value: SlackAgentActionValue) {
  return JSON.stringify(value)
}

export function decodeSlackActionValue(value: string | undefined): SlackAgentActionValue | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as SlackAgentActionValue
    return parsed && typeof parsed.action === 'string' ? parsed : null
  } catch {
    return null
  }
}

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
