import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { notifyOutreachDraftReady } from './slack-outreach-notification'

const BASE_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

describe('notifyOutreachDraftReady', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    restoreEnv()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    restoreEnv()
  })

  it('is a no-op when the webhook URL is missing or not https', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    delete process.env.SLACK_OUTREACH_DRAFT_WEBHOOK_URL
    await expect(
      notifyOutreachDraftReady({
        contactId: 42,
        channel: 'email',
        templateKey: 'email_follow_up',
        queueId: 'queue-1',
      }),
    ).resolves.toBe(false)

    process.env.SLACK_OUTREACH_DRAFT_WEBHOOK_URL = 'http://example.com/webhook'
    await expect(
      notifyOutreachDraftReady({
        contactId: 42,
        channel: 'email',
        templateKey: 'email_follow_up',
        queueId: 'queue-1',
      }),
    ).resolves.toBe(false)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts a Slack review message with lead, template, queue, channel, and review URL', async () => {
    process.env.SLACK_OUTREACH_DRAFT_WEBHOOK_URL = 'https://hooks.slack.test/outreach'
    process.env.NEXT_PUBLIC_BASE_URL = 'https://amadutown.test/'
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      notifyOutreachDraftReady({
        contactId: 42,
        contactName: ' Jane Doe ',
        contactEmail: ' jane@example.com ',
        channel: 'linkedin',
        templateKey: 'linkedin_cold_outreach',
        queueId: 'queue-uuid-1',
      }),
    ).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledWith('https://hooks.slack.test/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.any(String),
    })
    const [, init] = fetchMock.mock.calls[0]
    const payload = JSON.parse(String(init.body)) as { text: string }
    expect(payload.text).toContain('*New LinkedIn draft ready for review*')
    expect(payload.text).toContain('*Contact:* Jane Doe | jane@example.com (lead #42)')
    expect(payload.text).toContain('*Template:* linkedin_cold_outreach')
    expect(payload.text).toContain('*Queue ID:* queue-uuid-1')
    expect(payload.text).toContain('*Review:* https://amadutown.test/admin/outreach?contactId=42')
  })

  it('returns false when Slack rejects the webhook response', async () => {
    process.env.SLACK_OUTREACH_DRAFT_WEBHOOK_URL = 'https://hooks.slack.test/outreach'
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('nope', { status: 500 })),
    )

    await expect(
      notifyOutreachDraftReady({
        contactId: 42,
        channel: 'email',
        templateKey: null,
        queueId: 'queue-1',
      }),
    ).resolves.toBe(false)
  })

  it('returns false when fetch throws instead of bubbling to the caller', async () => {
    process.env.SLACK_OUTREACH_DRAFT_WEBHOOK_URL = 'https://hooks.slack.test/outreach'
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    await expect(
      notifyOutreachDraftReady({
        contactId: 42,
        channel: 'email',
        templateKey: null,
        queueId: 'queue-1',
      }),
    ).resolves.toBe(false)
  })
})
