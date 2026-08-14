import { describe, expect, it } from 'vitest'
import type { SocialContentItem, SocialContentPublish } from '@/lib/social-content'
import {
  derivePublicationProjection,
  formatPublicationDate,
  reconcilePublicationProjectionWithLifecycle,
} from '@/lib/social-publication-status'
import { deriveSocialContentLifecycleProjection } from '@/lib/social-content-lifecycle'

const item = (overrides: Partial<SocialContentItem> = {}) => ({
  status: 'approved',
  scheduled_for: null,
  updated_at: '2026-08-13T20:00:00.000Z',
  ...overrides,
}) as SocialContentItem

const publish = (overrides: Partial<SocialContentPublish> = {}) => ({
  platform: 'x',
  status: 'pending',
  platform_post_id: null,
  platform_post_url: null,
  error_message: null,
  published_at: null,
  updated_at: '2026-08-13T20:01:00.000Z',
  ...overrides,
}) as SocialContentPublish

const dateOptions = { locale: 'en-US', timeZone: 'America/New_York' }

describe('publication status projection', () => {
  it('explains a future schedule as hosted automation waiting, not provider submission', () => {
    const result = derivePublicationProjection({
      item: item({ status: 'scheduled', scheduled_for: '2026-08-15T13:00:00.000Z' }),
      publish: publish(),
      now: new Date('2026-08-13T20:00:00.000Z'),
      ...dateOptions,
    })

    expect(result).toMatchObject({
      state: 'scheduled',
      stateLabel: 'Scheduled',
      headline: 'Scheduled for Aug 15, 2026, 9:00 AM',
      owner: 'Portfolio hosted scheduler',
      waitingOnYou: 'No',
      rawStatus: 'pending',
    })
    expect(result.explanation).toContain('provider submission has not happened yet')
    expect(result.explanation).toContain('hosted scheduler runs hourly')
    expect(result.explanation).toContain('at or after Aug 15, 2026, 9:00 AM')
    expect(result.nextAction).toContain('next hosted scheduler run at or after')
    expect(result.explanation).not.toContain('pick up this post at the scheduled time')
  })

  it('fails closed when legacy queue and provider states are ambiguous', () => {
    const result = derivePublicationProjection({
      item: item({ status: 'published' }),
      publish: publish(),
      ...dateOptions,
    })

    expect(result.state).toBe('ambiguous')
    expect(result.headline).toBe('X status needs reconciliation')
    expect(result.explanation).toContain('provider publication evidence is missing')
  })

  it('surfaces provider failure reason and governed recovery', () => {
    const result = derivePublicationProjection({
      item: item({ status: 'scheduled', scheduled_for: '2026-08-15T13:00:00.000Z' }),
      publish: publish({ status: 'failed', error_message: 'Provider token expired.' }),
      ...dateOptions,
    })

    expect(result).toMatchObject({
      state: 'failed',
      headline: 'X submission failed',
      reason: 'Provider token expired.',
      waitingOnYou: 'Yes - review the failure and recovery action',
    })
    expect(result.nextAction).toContain('existing governed submission path')
  })

  it('requires provider evidence before projecting a confirmed publication', () => {
    const result = derivePublicationProjection({
      item: item({ status: 'published' }),
      publish: publish({
        status: 'published',
        platform_post_id: 'post-123',
        platform_post_url: 'https://x.com/amadutown/status/123',
        published_at: '2026-08-15T13:00:00.000Z',
      }),
      ...dateOptions,
    })

    expect(result).toMatchObject({
      state: 'published',
      headline: 'Published on X',
      publishedTime: 'Aug 15, 2026, 9:00 AM',
      permalink: 'https://x.com/amadutown/status/123',
      waitingOnYou: 'No',
    })
  })

  it('projects the schedule-recovery skipped marker as cancelled and preserves generic skipped', () => {
    const cancelled = derivePublicationProjection({
      item: item(),
      publish: publish({
        status: 'skipped',
        error_message: 'Scheduled publication cancelled by admin-1 at 2026-08-13T14:00:00.000Z.',
      }),
      ...dateOptions,
    })
    expect(cancelled).toMatchObject({
      state: 'cancelled',
      stateLabel: 'Cancelled',
      rawStatus: 'skipped',
    })

    const skipped = derivePublicationProjection({
      item: item(),
      publish: publish({ status: 'skipped', error_message: 'Excluded from this provider batch.' }),
      ...dateOptions,
    })
    expect(skipped).toMatchObject({
      state: 'skipped',
      stateLabel: 'Skipped',
      rawStatus: 'skipped',
    })
    expect(skipped.explanation).toContain('Excluded from this provider batch.')
  })

  it('blocks a scheduled provider projection when canonical lifecycle prerequisites are unresolved', () => {
    const projection = derivePublicationProjection({
      item: item({ status: 'scheduled', scheduled_for: '2026-08-15T13:00:00.000Z' }),
      publish: publish(),
      now: new Date('2026-08-13T20:00:00.000Z'),
      ...dateOptions,
    })
    const lifecycle = deriveSocialContentLifecycleProjection({
      item: {
        status: 'scheduled',
        target_platforms: ['x'],
        rag_context: {
          source_packet_path: 'docs/content-strategy/x-source-packet.md',
          platform: 'x',
        },
        publishes: [{ status: 'pending' }],
      },
      rawStates: {
        context: 'approved',
        copy: 'approved',
        visuals: 'pending',
        draft: 'approved',
        submit: 'approved',
        status: 'pending',
      },
    })

    expect(reconcilePublicationProjectionWithLifecycle({ projection, lifecycle })).toMatchObject({
      state: 'blocked',
      stateLabel: 'Blocked',
      headline: 'X publication blocked by Amina Visuals',
      owner: 'Amina',
      nextAction: 'Amina must complete the applicable visual, privacy, rights, and source-distance evidence.',
      waitingOnYou: 'No - Amina owns the next action',
    })
  })

  it('formats the same instant safely in the requested user timezone', () => {
    expect(formatPublicationDate('2026-08-15T13:00:00.000Z', dateOptions)).toBe('Aug 15, 2026, 9:00 AM')
    expect(formatPublicationDate('not-a-date', dateOptions)).toBeNull()
  })
})
