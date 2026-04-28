import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetCurrentSession = vi.fn()

vi.mock('@/lib/auth', () => ({
  getCurrentSession: () => mockGetCurrentSession(),
}))

import { useOutreachGeneration } from './useOutreachGeneration'

describe('useOutreachGeneration', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    mockGetCurrentSession.mockResolvedValue({ access_token: 'test-token' })
    mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ triggered: false, error: 'Could not generate the draft. Please try again.' }),
    })
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends a trimmed meeting_record_id when starting generation', async () => {
    const { result, unmount } = renderHook(() =>
      useOutreachGeneration({
        leadId: 42,
        leadName: 'Jane Doe',
        messagesCount: 0,
      }),
    )

    await act(async () => {
      await result.current.start('email_follow_up', 'email', '  meeting-123  ')
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/outreach/leads/42/generate',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({
          channel: 'email',
          templateKey: 'email_follow_up',
          meeting_record_id: 'meeting-123',
        }),
      }),
    )

    unmount()
  })

  it('retries with the same meeting_record_id, template, and channel', async () => {
    const { result, unmount } = renderHook(() =>
      useOutreachGeneration({
        leadId: 42,
        leadName: 'Jane Doe',
        messagesCount: 0,
      }),
    )

    await act(async () => {
      await result.current.start('linkedin_cold_outreach', 'linkedin', 'meeting-abc')
    })

    expect(result.current.state).toBe('failed')

    await act(async () => {
      await result.current.retry()
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch).toHaveBeenLastCalledWith(
      '/api/admin/outreach/leads/42/generate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          channel: 'linkedin',
          templateKey: 'linkedin_cold_outreach',
          meeting_record_id: 'meeting-abc',
        }),
      }),
    )

    unmount()
  })
})
