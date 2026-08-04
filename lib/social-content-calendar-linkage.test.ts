import { describe, expect, it, vi } from 'vitest'
import { syncCampaignCalendarForSocialContent } from './social-content-calendar-linkage'

function installCalendarAdmin({
  rows,
  readError = null,
  updateError = null,
  supportsOr = false,
}: {
  rows?: Array<Record<string, unknown>>
  readError?: { code?: string; message?: string } | null
  updateError?: { code?: string; message?: string } | null
  supportsOr?: boolean
}) {
  const updates: Array<{ payload: Record<string, unknown>; id: string }> = []
  const selectEq = vi.fn().mockResolvedValue({ data: rows ?? [], error: readError })
  const selectOr = vi.fn().mockResolvedValue({ data: rows ?? [], error: readError })
  const updateEq = vi.fn(async (column: string, id: string) => {
    updates[updates.length - 1].id = id
    return { data: null, error: updateError }
  })
  const update = vi.fn((payload: Record<string, unknown>) => {
    updates.push({ payload, id: '' })
    return { eq: updateEq }
  })
  const select = vi.fn(() => (supportsOr ? { eq: selectEq, or: selectOr } : { eq: selectEq }))
  const from = vi.fn(() => ({ select, update }))

  return {
    admin: { from },
    updates,
    from,
    selectEq,
    selectOr,
    update,
    updateEq,
  }
}

describe('syncCampaignCalendarForSocialContent', () => {
  it('records copy approval metadata without completing the calendar item', async () => {
    const { admin, updates } = installCalendarAdmin({
      rows: [{
        id: 'calendar-1',
        due_status: 'planned',
        metadata: {
          campaign_phase: 'tease',
          social_content_lifecycle: {
            existing: true,
          },
        },
      }],
    })

    const result = await syncCampaignCalendarForSocialContent({
      admin,
      socialContentId: 'social-1',
      event: {
        type: 'copy_approved',
        at: '2026-08-03T12:00:00.000Z',
        userId: 'admin-1',
      },
    })

    expect(result).toEqual({ matched: 1, updated: 1, skipped: false, error: null })
    expect(updates).toHaveLength(1)
    expect(updates[0].id).toBe('calendar-1')
    expect(updates[0].payload).toEqual({
      metadata: expect.objectContaining({
        campaign_phase: 'tease',
        social_content_id: 'social-1',
        social_content_lifecycle: expect.objectContaining({
          existing: true,
          social_content_status: 'approved',
          copy_review: {
            status: 'approved',
            approved_at: '2026-08-03T12:00:00.000Z',
            approved_by: 'admin-1',
          },
          updated_at: '2026-08-03T12:00:00.000Z',
        }),
      }),
    })
    expect(updates[0].payload).not.toHaveProperty('due_status')
  })

  it('records final platform submission approval without completing the calendar item', async () => {
    const { admin, updates } = installCalendarAdmin({
      rows: [{ id: 'calendar-1', metadata: null }],
    })

    const result = await syncCampaignCalendarForSocialContent({
      admin,
      socialContentId: 'social-1',
      event: {
        type: 'platform_submission_approved',
        at: '2026-08-03T13:00:00.000Z',
        userId: 'admin-1',
        platforms: ['linkedin'],
        submitAfterApproval: true,
      },
    })

    expect(result.updated).toBe(1)
    expect(updates[0].payload).toEqual({
      metadata: expect.objectContaining({
        social_content_id: 'social-1',
        social_content_lifecycle: expect.objectContaining({
          social_content_status: 'submission_approved_auto_submit_requested',
          platform_submission: {
            status: 'approved',
            approved_at: '2026-08-03T13:00:00.000Z',
            approved_by: 'admin-1',
            platforms: ['linkedin'],
            submit_after_approval: true,
          },
        }),
      }),
    })
    expect(updates[0].payload).not.toHaveProperty('due_status')
  })

  it('marks linked calendar items completed only after publication succeeds', async () => {
    const { admin, updates } = installCalendarAdmin({
      rows: [{ id: 'calendar-1', due_status: 'due_now', metadata: {} }],
    })

    const result = await syncCampaignCalendarForSocialContent({
      admin,
      socialContentId: 'social-1',
      event: {
        type: 'published',
        at: '2026-08-03T14:00:00.000Z',
        platforms: ['linkedin'],
        platformPostUrls: ['https://www.linkedin.com/feed/update/urn:li:share:1/'],
      },
    })

    expect(result).toEqual({ matched: 1, updated: 1, skipped: false, error: null })
    expect(updates[0].payload).toEqual({
      due_status: 'completed',
      metadata: expect.objectContaining({
        social_content_lifecycle: expect.objectContaining({
          social_content_status: 'published',
          published: {
            status: 'published',
            published_at: '2026-08-03T14:00:00.000Z',
            platforms: ['linkedin'],
            platform_post_urls: ['https://www.linkedin.com/feed/update/urn:li:share:1/'],
          },
        }),
      }),
    })
  })

  it('is a no-op when no calendar item is linked', async () => {
    const { admin, update } = installCalendarAdmin({ rows: [] })

    const result = await syncCampaignCalendarForSocialContent({
      admin,
      socialContentId: 'social-1',
      event: {
        type: 'copy_approved',
        at: '2026-08-03T12:00:00.000Z',
        userId: 'admin-1',
      },
    })

    expect(result).toEqual({ matched: 0, updated: 0, skipped: false, error: null })
    expect(update).not.toHaveBeenCalled()
  })

  it('can match imported calendar items by social content metadata', async () => {
    const { admin, selectEq, selectOr, updates } = installCalendarAdmin({
      supportsOr: true,
      rows: [{
        id: 'calendar-1',
        metadata: {
          platform_draft_handoff: {
            social_content_id: 'social-1',
          },
        },
      }],
    })

    const result = await syncCampaignCalendarForSocialContent({
      admin,
      socialContentId: 'social-1',
      event: {
        type: 'published',
        at: '2026-08-03T14:00:00.000Z',
        platforms: ['linkedin'],
        platformPostUrls: ['https://www.linkedin.com/feed/update/urn:li:share:1/'],
      },
    })

    expect(result).toEqual({ matched: 1, updated: 1, skipped: false, error: null })
    expect(selectEq).not.toHaveBeenCalled()
    expect(selectOr).toHaveBeenCalledWith([
      'social_content_id.eq.social-1',
      'metadata->>social_content_id.eq.social-1',
      'metadata->platform_draft_handoff->>social_content_id.eq.social-1',
    ].join(','))
    expect(updates[0].payload).toEqual({
      due_status: 'completed',
      metadata: expect.objectContaining({
        social_content_id: 'social-1',
        platform_draft_handoff: {
          social_content_id: 'social-1',
        },
      }),
    })
  })

  it('skips safely when the calendar table does not exist in older environments', async () => {
    const { admin, update } = installCalendarAdmin({
      readError: { code: 'PGRST205', message: 'Could not find the table' },
    })

    const result = await syncCampaignCalendarForSocialContent({
      admin,
      socialContentId: 'social-1',
      event: {
        type: 'copy_approved',
        at: '2026-08-03T12:00:00.000Z',
        userId: 'admin-1',
      },
    })

    expect(result).toEqual({ matched: 0, updated: 0, skipped: true, error: null })
    expect(update).not.toHaveBeenCalled()
  })
})
