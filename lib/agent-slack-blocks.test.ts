import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  decodeSlackActionValue,
  encodeSlackActionValue,
  mrkdwn,
  slackButton,
  truncateSlack,
} from '@/lib/agent-slack-blocks'

describe('agent slack block helpers', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('round-trips Slack action payloads through button-safe JSON values', () => {
    const value = {
      action: 'insight.draft_autoresearch',
      contentId: 'content-1',
      agentKey: 'research-source-register',
      note: 'Theme: Agentic Operating System\nScore: 87',
    }

    expect(decodeSlackActionValue(encodeSlackActionValue(value))).toMatchObject(value)
  })

  it('rejects missing, malformed, or action-less Slack action values', () => {
    expect(decodeSlackActionValue(undefined)).toBeNull()
    expect(decodeSlackActionValue('{not json')).toBeNull()
    expect(decodeSlackActionValue(JSON.stringify({ contentId: 'content-1' }))).toBeNull()
  })

  it('wires optional confirmation copy without changing the encoded action value', () => {
    const button = slackButton({
      label: 'Draft AutoResearch',
      actionId: 'agent_insight_draft_autoresearch',
      style: 'primary',
      value: {
        action: 'insight.draft_autoresearch',
        contentId: 'content-1',
        agentKey: 'research-source-register',
        note: 'Create a proposed research task.',
      },
      confirmText: 'Create a proposed Agent Ops research task?',
    })

    expect(button).toMatchObject({
      type: 'button',
      action_id: 'agent_insight_draft_autoresearch',
      style: 'primary',
      confirm: {
        title: { type: 'plain_text', text: 'Confirm action', emoji: true },
        confirm: { type: 'plain_text', text: 'Confirm', emoji: true },
        deny: { type: 'plain_text', text: 'Cancel', emoji: true },
      },
    })
    expect(button.confirm?.text).toEqual({
      type: 'mrkdwn',
      text: 'Create a proposed Agent Ops research task?',
    })
    expect(decodeSlackActionValue(button.value)).toMatchObject({
      action: 'insight.draft_autoresearch',
      contentId: 'content-1',
      agentKey: 'research-source-register',
    })

    expect(slackButton({ label: 'Open detail', actionId: 'open_detail', url: 'https://example.test' }).confirm).toBeUndefined()
  })

  it('applies Slack text limits consistently', () => {
    expect(truncateSlack('abcdefghij', 5)).toBe('abcd\u2026')
    expect(truncateSlack(' short ', 10)).toBe('short')
    expect(mrkdwn('x'.repeat(3005))).toEqual({ type: 'mrkdwn', text: 'x'.repeat(3000) })
  })
  it('rejects old and mismatched hosted cards and sanitizes replay envelopes', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'staging')
    vi.stubEnv('APP_ENV', 'staging')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('VERCEL_URL', 'staging.example.test')
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://production.example.test')
    const encoded = encodeSlackActionValue({ action: 'work.assign', workItemId: 'work-1' })
    const value = JSON.parse(encoded)
    expect(decodeSlackActionValue(encoded)).toMatchObject({ sourceEnvironment: 'staging', sourceOrigin: 'https://staging.example.test' })
    expect(decodeSlackActionValue(JSON.stringify({ ...value, sourceEnvironment: 'production' }))).toBeNull()
    expect(decodeSlackActionValue(JSON.stringify({ ...value, sourceOrigin: 'https://evil.example.test' }))).toBeNull()
    expect(decodeSlackActionValue(JSON.stringify({ action: 'work.assign', workItemId: 'work-1' }))).toBeNull()
    expect(decodeSlackActionValue(JSON.stringify({ ...value, credentials: 'discard' }))).not.toHaveProperty('credentials')
    expect(decodeSlackActionValue(JSON.stringify({ ...value, contactId: '123' }))).toBeNull()
    vi.stubEnv('APP_ENV', 'production')
    expect(decodeSlackActionValue(encoded)).toBeNull()
  })

})
