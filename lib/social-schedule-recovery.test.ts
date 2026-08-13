import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/agent-run', () => ({ recordAgentEvent: vi.fn() }))

import {
  buildScheduleRecoveryProjection,
  resolveSocialScheduleRecovery,
  type ScheduleRecoveryWorkItem,
  type SocialScheduleRecoveryRepository,
} from './social-schedule-recovery'

const priorSchedule = '2026-08-10T14:00:00.000Z'

function recoveryItem(overrides: Partial<ScheduleRecoveryWorkItem> = {}): ScheduleRecoveryWorkItem {
  return {
    id: 'recovery-1',
    status: 'queued',
    owner_agent_key: 'chief-of-staff',
    active_run_id: 'run-1',
    source_type: 'social_content_scheduled_publish_recovery',
    source_id: 'social-1',
    blocker_summary: null,
    metadata: {
      recovery_kind: 'stale_schedule',
      recovery_action: 'reschedule_reconfirm_or_cancel',
      blocker: 'Scheduled time is outside the automatic publish safety window.',
      scheduled_for: priorSchedule,
    },
    created_at: '2026-08-11T14:00:00.000Z',
    updated_at: '2026-08-11T14:00:00.000Z',
    completed_at: null,
    ...overrides,
  }
}

function repository(overrides: Partial<SocialScheduleRecoveryRepository> = {}) {
  const repo: SocialScheduleRecoveryRepository = {
    readContent: vi.fn(async () => ({ id: 'social-1', status: 'scheduled', scheduled_for: priorSchedule })),
    readRecoveryItems: vi.fn(async () => [recoveryItem()]),
    readPublishRows: vi.fn(async () => [
      { id: 'publish-1', status: 'pending', error_message: 'stale blocker' },
      { id: 'publish-2', status: 'failed', error_message: 'stale blocker' },
    ]),
    updateContent: vi.fn(async () => true),
    updatePublishes: vi.fn(async () => true),
    resolveWorkItem: vi.fn(async () => true),
    recordResolutionEvent: vi.fn(async () => undefined),
    ...overrides,
  }
  return repo
}

describe('social schedule recovery', () => {
  it('projects one canonical stale recovery with the required decision context', () => {
    expect(buildScheduleRecoveryProjection([recoveryItem()], 'social-1')).toEqual({
      state: 'action_required',
      work_item_id: 'recovery-1',
      owner: 'chief-of-staff',
      stale_reason: 'Scheduled time is outside the automatic publish safety window.',
      prior_scheduled_for: priorSchedule,
      next_action: 'Choose a future schedule and reconfirm publication intent, or cancel this scheduled publication.',
      automatic_publication_blocked: true,
    })
  })

  it('reschedules and reconfirms without any provider side effect', async () => {
    const repo = repository()
    const result = await resolveSocialScheduleRecovery({
      repository: repo,
      contentId: 'social-1',
      workItemId: 'recovery-1',
      action: 'reschedule_reconfirm',
      scheduledFor: '2026-08-20T14:00:00.000Z',
      reconfirmPublicationIntent: true,
      actorId: 'admin-1',
      now: new Date('2026-08-13T14:00:00.000Z'),
    })

    expect(repo.updateContent).toHaveBeenCalledWith({
      contentId: 'social-1',
      expectedStatus: 'scheduled',
      expectedScheduledFor: priorSchedule,
      status: 'scheduled',
      scheduledFor: '2026-08-20T14:00:00.000Z',
    })
    expect(repo.updatePublishes).toHaveBeenCalledWith({
      ids: ['publish-1', 'publish-2'],
      status: 'pending',
      errorMessage: null,
    })
    expect(repo.resolveWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      status: 'deployed',
      metadata: expect.objectContaining({
        schedule_recovery_resolution: expect.objectContaining({
          action: 'reschedule_reconfirm',
          provider_called: false,
          published: false,
        }),
      }),
    }))
    expect(result.side_effects).toEqual({ provider_call: false, publish: false, external_schedule: false })
  })

  it('cancels the scheduled intent while retaining the content and publish rows', async () => {
    const repo = repository()
    const result = await resolveSocialScheduleRecovery({
      repository: repo,
      contentId: 'social-1',
      workItemId: 'recovery-1',
      action: 'cancel_scheduled_publication',
      actorId: 'admin-1',
      now: new Date('2026-08-13T14:00:00.000Z'),
    })

    expect(repo.updateContent).toHaveBeenCalledWith(expect.objectContaining({
      status: 'approved',
      scheduledFor: null,
    }))
    expect(repo.updatePublishes).toHaveBeenCalledWith(expect.objectContaining({
      ids: ['publish-1', 'publish-2'],
      status: 'skipped',
      errorMessage: expect.stringContaining('Scheduled publication cancelled'),
    }))
    expect(repo.resolveWorkItem).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }))
    expect(result.side_effects.publish).toBe(false)
  })

  it('returns an idempotent result for an exact replay and rejects a different decision', async () => {
    const completed = recoveryItem({
      status: 'deployed',
      completed_at: '2026-08-13T14:00:00.000Z',
      metadata: {
        ...recoveryItem().metadata,
        schedule_recovery_resolution: {
          action: 'reschedule_reconfirm',
          scheduled_for: '2026-08-20T14:00:00.000Z',
        },
      },
    })
    const repo = repository({ readRecoveryItems: vi.fn(async () => [completed]) })

    await expect(resolveSocialScheduleRecovery({
      repository: repo,
      contentId: 'social-1',
      workItemId: 'recovery-1',
      action: 'reschedule_reconfirm',
      scheduledFor: '2026-08-20T14:00:00.000Z',
      reconfirmPublicationIntent: true,
      actorId: 'admin-1',
    })).resolves.toMatchObject({ ok: true, idempotent: true })
    expect(repo.updateContent).not.toHaveBeenCalled()

    await expect(resolveSocialScheduleRecovery({
      repository: repo,
      contentId: 'social-1',
      workItemId: 'recovery-1',
      action: 'reschedule_reconfirm',
      scheduledFor: '2026-08-21T14:00:00.000Z',
      reconfirmPublicationIntent: true,
      actorId: 'admin-1',
    })).rejects.toMatchObject({
      code: 'recovery_already_resolved',
      status: 409,
    })

    await expect(resolveSocialScheduleRecovery({
      repository: repo,
      contentId: 'social-1',
      workItemId: 'recovery-1',
      action: 'cancel_scheduled_publication',
      actorId: 'admin-1',
    })).rejects.toMatchObject({
      code: 'recovery_already_resolved',
      status: 409,
    })
  })

  it('completes an interrupted cancellation without rewriting the canonical rows', async () => {
    const repo = repository({
      readContent: vi.fn(async () => ({ id: 'social-1', status: 'approved', scheduled_for: null })),
      readPublishRows: vi.fn(async () => [
        {
          id: 'publish-1',
          status: 'skipped',
          error_message: 'Scheduled publication cancelled by admin-1 at 2026-08-13T14:00:00.000Z.',
        },
      ]),
    })

    await expect(resolveSocialScheduleRecovery({
      repository: repo,
      contentId: 'social-1',
      workItemId: 'recovery-1',
      action: 'cancel_scheduled_publication',
      actorId: 'admin-1',
      now: new Date('2026-08-13T14:01:00.000Z'),
    })).resolves.toMatchObject({ ok: true, action: 'cancel_scheduled_publication' })
    expect(repo.updateContent).not.toHaveBeenCalled()
    expect(repo.updatePublishes).not.toHaveBeenCalled()
    expect(repo.resolveWorkItem).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }))
  })

  it('fails closed when linked recovery records are ambiguous', async () => {
    const repo = repository({
      readRecoveryItems: vi.fn(async () => [recoveryItem(), recoveryItem({ id: 'recovery-2' })]),
    })

    await expect(resolveSocialScheduleRecovery({
      repository: repo,
      contentId: 'social-1',
      workItemId: 'recovery-1',
      action: 'cancel_scheduled_publication',
      actorId: 'admin-1',
    })).rejects.toMatchObject({
      code: 'ambiguous_recovery_items',
      status: 409,
    })
    expect(repo.updateContent).not.toHaveBeenCalled()
  })
})
