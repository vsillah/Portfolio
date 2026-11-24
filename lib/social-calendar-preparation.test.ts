import { describe, expect, it } from 'vitest'
import { projectSocialCalendarPreparation } from './social-calendar-preparation'

describe('projectSocialCalendarPreparation', () => {
  const socialContentId = 'f966123f-05eb-48ec-a7c2-970afce642ef'

  it('projects an authorized, version-bound preparation as ready without granting execution authority', () => {
    expect(projectSocialCalendarPreparation({
      id: '669f6c22-d373-4423-bf7c-77661c484302',
      social_content_id: socialContentId,
      authorization_status: 'authorized',
      due_status: 'due_soon',
      scheduled_for: '2026-10-17T17:30:20.321Z',
      metadata: {
        publish_preparation: {
          status: 'ready',
          prepared_at: '2026-10-17T22:05:40.33184Z',
          content_version: 'sha256:e6fc9ae4',
          social_content_id: socialContentId,
          reused_existing_approved_packet: true,
          action: 'reuse_existing_approved_social_content_package',
        },
      },
    }, socialContentId)).toEqual(expect.objectContaining({
      calendar_item_id: '669f6c22-d373-4423-bf7c-77661c484302',
      social_content_id: socialContentId,
      state: 'ready',
      authorization_status: 'authorized',
      due_status: 'due_soon',
      reused_existing_approved_packet: true,
    }))
  })

  it('fails closed when the preparation is not bound to the requested Social Content row', () => {
    expect(projectSocialCalendarPreparation({
      id: 'calendar-1',
      social_content_id: socialContentId,
      authorization_status: 'authorized',
      due_status: 'due_now',
      scheduled_for: '2026-10-17T17:30:20.321Z',
      metadata: {
        publish_preparation: {
          status: 'ready',
          prepared_at: '2026-10-17T22:05:40.33184Z',
          content_version: 'sha256:e6fc9ae4',
          social_content_id: 'different-content',
          reused_existing_approved_packet: true,
        },
      },
    }, socialContentId)).toEqual(expect.objectContaining({
      state: 'pending',
      reused_existing_approved_packet: false,
    }))
  })

  it('does not project a calendar row for another Social Content item', () => {
    expect(projectSocialCalendarPreparation({
      id: 'calendar-1',
      social_content_id: 'different-content',
      authorization_status: 'authorized',
      due_status: 'due_now',
      scheduled_for: '2026-10-17T17:30:20.321Z',
      metadata: {},
    }, socialContentId)).toBeNull()
  })

  it('blocks rejected, expired, and cancelled calendar rows', () => {
    const rows = [
      { authorization_status: 'rejected', due_status: 'due_now' },
      { authorization_status: 'expired', due_status: 'due_now' },
      { authorization_status: 'pending', due_status: 'cancelled' },
    ]

    for (const row of rows) {
      expect(projectSocialCalendarPreparation({
        id: 'calendar-1',
        social_content_id: socialContentId,
        scheduled_for: '2026-10-17T17:30:20.321Z',
        metadata: {
          publish_preparation: {
            status: 'ready',
            prepared_at: '2026-10-17T22:05:40.33184Z',
            content_version: 'sha256:e6fc9ae4',
            social_content_id: socialContentId,
            reused_existing_approved_packet: true,
          },
        },
        ...row,
      }, socialContentId)).toEqual(expect.objectContaining({
        state: 'blocked',
        reused_existing_approved_packet: false,
      }))
    }
  })

  it('stays pending when an authorized preparation is missing its version or prepared time', () => {
    expect(projectSocialCalendarPreparation({
      id: 'calendar-1',
      social_content_id: socialContentId,
      authorization_status: 'authorized',
      due_status: 'due_now',
      scheduled_for: '2026-10-17T17:30:20.321Z',
      metadata: {
        publish_preparation: {
          status: 'ready',
          prepared_at: '   ',
          content_version: 'sha256:e6fc9ae4',
          social_content_id: socialContentId,
          reused_existing_approved_packet: true,
        },
      },
    }, socialContentId)).toEqual(expect.objectContaining({
      state: 'pending',
      prepared_at: null,
      content_version: 'sha256:e6fc9ae4',
      reused_existing_approved_packet: false,
    }))

    expect(projectSocialCalendarPreparation({
      id: 'calendar-1',
      social_content_id: socialContentId,
      authorization_status: 'authorized',
      due_status: 'due_now',
      scheduled_for: '2026-10-17T17:30:20.321Z',
      metadata: {
        publish_preparation: {
          status: 'ready',
          prepared_at: '2026-10-17T22:05:40.33184Z',
          content_version: '  ',
          social_content_id: socialContentId,
        },
      },
    }, socialContentId)).toEqual(expect.objectContaining({
      state: 'pending',
      prepared_at: '2026-10-17T22:05:40.33184Z',
      content_version: null,
      reused_existing_approved_packet: false,
    }))
  })
})
