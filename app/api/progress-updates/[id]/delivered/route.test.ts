import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateProgressUpdateLogStatus: vi.fn(),
}))

vi.mock('@/lib/progress-update-templates', () => ({
  updateProgressUpdateLogStatus: mocks.updateProgressUpdateLogStatus,
}))

import { POST } from './route'

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/progress-updates/log-1/delivered', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/progress-updates/[id]/delivered', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateProgressUpdateLogStatus.mockResolvedValue(true)
  })

  it('rejects malformed delivery status', async () => {
    const response = await POST(
      request({ delivery_status: 'queued' }) as never,
      { params: Promise.resolve({ id: 'log-1' }) },
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'delivery_status must be "sent" or "failed"',
    })
  })

  it('passes agent_run_id through to the progress update log helper', async () => {
    const response = await POST(
      request({
        delivery_status: 'sent',
        agent_run_id: 'agent-run-1',
      }) as never,
      { params: Promise.resolve({ id: 'log-1' }) },
    )

    expect(response.status).toBe(200)
    expect(mocks.updateProgressUpdateLogStatus).toHaveBeenCalledWith(
      'log-1',
      'sent',
      undefined,
      'agent-run-1',
    )
    expect(await response.json()).toEqual({
      success: true,
      log_id: 'log-1',
      delivery_status: 'sent',
      agent_run_id: 'agent-run-1',
    })
  })
})
