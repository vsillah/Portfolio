import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { updateEmailMessageFromResendWebhook } from './email-messages'

type SelectResult = { data: unknown; error: { message: string } | null }
type UpdateResult = { error: { message: string } | null }

function createSelectBuilder(result: SelectResult) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  return { select, eq, maybeSingle }
}

function createUpdateBuilder(result: UpdateResult) {
  const eq = vi.fn().mockResolvedValue(result)
  const update = vi.fn((_payload: Record<string, unknown>) => ({ eq }))
  return { update, eq }
}

describe('updateEmailMessageFromResendWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ignores unknown resend event types without querying the database', async () => {
    const result = await updateEmailMessageFromResendWebhook({
      externalId: 'em_1',
      resendEventType: 'email.unknown',
    })

    expect(result).toEqual({ updated: false, ignored: true })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns not-updated when matching external_id is not found', async () => {
    const selectBuilder = createSelectBuilder({ data: null, error: null })
    mocks.from.mockReturnValueOnce(selectBuilder)

    const result = await updateEmailMessageFromResendWebhook({
      externalId: 'missing_email',
      resendEventType: 'email.delivered',
    })

    expect(result).toEqual({ updated: false, ignored: false })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('returns not-updated when row lookup returns an error', async () => {
    const selectBuilder = createSelectBuilder({
      data: null,
      error: { message: 'lookup failed' },
    })
    mocks.from.mockReturnValueOnce(selectBuilder)

    const result = await updateEmailMessageFromResendWebhook({
      externalId: 'em_2',
      resendEventType: 'email.delivered',
    })

    expect(result).toEqual({ updated: false, ignored: false })
  })

  it('maps status and merges metadata when update succeeds', async () => {
    const selectBuilder = createSelectBuilder({
      data: { id: 'row_1', metadata: { previous: 'value' } },
      error: null,
    })
    const updateBuilder = createUpdateBuilder({ error: null })

    const queue = [selectBuilder, updateBuilder]
    mocks.from.mockImplementation(() => {
      const next = queue.shift()
      if (!next) throw new Error('Unexpected supabaseAdmin.from call')
      return next
    })

    const result = await updateEmailMessageFromResendWebhook({
      externalId: 'em_3',
      resendEventType: 'email.delivered',
      eventCreatedAt: '2026-04-18T10:00:00.000Z',
    })

    expect(result).toEqual({ updated: true, ignored: false })
    expect(updateBuilder.update).toHaveBeenCalledWith({
      status: 'delivered',
      metadata: {
        previous: 'value',
        last_resend_event: 'email.delivered',
        last_resend_event_at: '2026-04-18T10:00:00.000Z',
      },
    })
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'row_1')
  })

  it('maps email.suppressed to failed and stamps fallback timestamp', async () => {
    const selectBuilder = createSelectBuilder({
      data: { id: 'row_2', metadata: [] },
      error: null,
    })
    const updateBuilder = createUpdateBuilder({ error: null })

    const queue = [selectBuilder, updateBuilder]
    mocks.from.mockImplementation(() => {
      const next = queue.shift()
      if (!next) throw new Error('Unexpected supabaseAdmin.from call')
      return next
    })

    const result = await updateEmailMessageFromResendWebhook({
      externalId: 'em_4',
      resendEventType: 'email.suppressed',
    })

    expect(result).toEqual({ updated: true, ignored: false })
    const payload = updateBuilder.update.mock.calls[0][0] as {
      status: string
      metadata: Record<string, unknown>
    }
    expect(payload.status).toBe('failed')
    expect(payload.metadata.last_resend_event).toBe('email.suppressed')
    expect(typeof payload.metadata.last_resend_event_at).toBe('string')
  })

  it('returns not-updated when update fails', async () => {
    const selectBuilder = createSelectBuilder({
      data: { id: 'row_3', metadata: {} },
      error: null,
    })
    const updateBuilder = createUpdateBuilder({ error: { message: 'write failed' } })

    const queue = [selectBuilder, updateBuilder]
    mocks.from.mockImplementation(() => {
      const next = queue.shift()
      if (!next) throw new Error('Unexpected supabaseAdmin.from call')
      return next
    })

    const result = await updateEmailMessageFromResendWebhook({
      externalId: 'em_5',
      resendEventType: 'email.opened',
    })

    expect(result).toEqual({ updated: false, ignored: false })
  })
})
