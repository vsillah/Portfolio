import { describe, expect, it, vi } from 'vitest'
import {
  campaignContentPlanSlots,
  defaultAuthorizationDueAt,
  deriveDueStatus,
  dueGateWindow,
  getCalendarTemplate,
  normalizeAuthorizationStatus,
  normalizeCalendarChannel,
  normalizeCampaignPhase,
  normalizeCalendarTemplateKey,
  normalizeDueStatus,
  recommendCalendarTemplates,
} from './social-content-calendar'

describe('social-content-calendar helpers', () => {
  it('derives due status at reminder and overdue boundaries', () => {
    const now = new Date('2026-06-24T10:00:00.000Z')

    expect(deriveDueStatus('2026-06-25T10:00:00.001Z', now)).toBe('planned')
    expect(deriveDueStatus('2026-06-25T10:00:00.000Z', now)).toBe('due_soon')
    expect(deriveDueStatus('2026-06-24T12:00:00.000Z', now)).toBe('due_now')
    expect(deriveDueStatus('2026-06-24T08:00:00.000Z', now)).toBe('due_now')
    expect(deriveDueStatus('2026-06-24T07:59:59.999Z', now)).toBe('past_due')
    expect(deriveDueStatus('not-a-date', now)).toBe('planned')
  })

  it('selects due-gate windows only inside the 24h authorization reminder range', () => {
    const now = new Date('2026-06-24T10:00:00.000Z')

    expect(dueGateWindow('2026-06-25T10:00:00.001Z', now)).toBeNull()
    expect(dueGateWindow('2026-06-25T10:00:00.000Z', now)).toBe('24h')
    expect(dueGateWindow('2026-06-24T12:00:00.001Z', now)).toBe('24h')
    expect(dueGateWindow('2026-06-24T12:00:00.000Z', now)).toBe('2h')
    expect(dueGateWindow('2026-06-24T08:00:00.000Z', now)).toBe('2h')
    expect(dueGateWindow('2026-06-24T07:59:59.999Z', now)).toBeNull()
    expect(dueGateWindow('invalid-date', now)).toBeNull()
  })

  it('sets authorization due time 24 hours before the scheduled publish intent', () => {
    expect(defaultAuthorizationDueAt('2026-06-25T15:30:00.000Z')).toBe('2026-06-24T15:30:00.000Z')
    expect(defaultAuthorizationDueAt('not-a-date')).toBeNull()
  })

  it('generates four pending campaign slots with safe defaults and fallback spacing', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-24T10:00:00.000Z'))

    try {
      const slots = campaignContentPlanSlots({
        name: 'Summer AI Readiness',
        starts_at: '2026-07-01T00:00:00.000Z',
        ends_at: '2026-07-01T00:00:00.000Z',
      })

      expect(slots.map((slot) => slot.campaign_phase)).toEqual(['tease', 'teach', 'proof', 'offer'])
      expect(slots).toEqual(expect.arrayContaining([
        expect.objectContaining({
          channel: 'linkedin',
          title: 'Tease: Summer AI Readiness',
          authorization_status: 'pending',
          autonomy_eligible: false,
          metadata: expect.objectContaining({
            generated_from: 'campaign_content_plan',
            template_key: 'whisper_to_shout',
            campaign_fit_summary: 'Whisper-to-shout launch is the selected planning arc for "Summer AI Readiness".',
            milestone_rationale: expect.objectContaining({
              summary: expect.stringContaining('Tease milestone for LinkedIn'),
              source_labels: expect.arrayContaining(['HubSpot social calendar template']),
            }),
            external_execution_enabled: false,
          }),
        }),
      ]))

      const scheduledTimes = slots.map((slot) => new Date(slot.scheduled_for).getTime())
      expect(scheduledTimes[1] - scheduledTimes[0]).toBe(3 * 86_400_000)
      expect(scheduledTimes[2] - scheduledTimes[1]).toBe(3 * 86_400_000)
      expect(scheduledTimes[3] - scheduledTimes[2]).toBe(3 * 86_400_000)
      slots.forEach((slot) => {
        expect(slot.authorization_due_at).toBe(defaultAuthorizationDueAt(slot.scheduled_for))
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('normalizes invalid enum-like values to safe defaults', () => {
    expect(normalizeCalendarChannel('not-a-channel')).toBe('linkedin')
    expect(normalizeCampaignPhase('launch')).toBe('tease')
    expect(normalizeDueStatus('late')).toBe('planned')
    expect(normalizeAuthorizationStatus('approved')).toBe('pending')
    expect(normalizeCalendarTemplateKey('random')).toBe('whisper_to_shout')
  })

  it('generates source-backed milestones for a YouTube video release template', () => {
    const slots = campaignContentPlanSlots(
      {
        name: 'Agent Ops Video Launch',
        starts_at: '2026-07-01T00:00:00.000Z',
        ends_at: '2026-07-21T00:00:00.000Z',
      },
      { templateKey: 'youtube_video_release' },
    )

    expect(getCalendarTemplate('youtube_video_release')).toMatchObject({
      label: 'YouTube video release',
      goal_types: expect.arrayContaining(['youtube_release']),
    })
    expect(slots.map((slot) => slot.channel)).toEqual([
      'linkedin',
      'youtube_shorts',
      'thumbnail',
      'youtube_shorts',
    ])
    expect(slots[2]).toEqual(expect.objectContaining({
      campaign_phase: 'proof',
      title: 'Thumbnail and title: Agent Ops Video Launch',
      metadata: expect.objectContaining({
        template_key: 'youtube_video_release',
        milestone_key: 'thumbnail_title_package',
        campaign_fit_summary: 'YouTube video release is the selected planning arc for "Agent Ops Video Launch".',
        milestone_rationale: expect.objectContaining({
          summary: expect.stringContaining('Proof milestone for Thumbnail'),
          timing: expect.stringContaining('7 day lead time'),
          required_inputs: expect.arrayContaining(['thumbnail_reference', 'title_variants']),
          approval_gates: expect.arrayContaining(['thumbnail_review']),
          source_labels: expect.arrayContaining(['YouTube creator optimization guidance']),
        }),
        source_labels: expect.arrayContaining(['YouTube creator optimization guidance']),
        required_assets: expect.arrayContaining(['thumbnail_reference', 'title_variants']),
        approval_gates: expect.arrayContaining(['thumbnail_review']),
        source_urls: expect.arrayContaining([
          'https://www.youtube.com/creators/grow/optimize-your-content/',
        ]),
      }),
    }))
  })

  it('uses template relative positions across a valid campaign window', () => {
    const slots = campaignContentPlanSlots(
      {
        name: 'Short Form Sprint',
        starts_at: '2026-07-01T00:00:00',
        ends_at: '2026-07-11T00:00:00',
      },
      { templateKey: 'short_form_series' },
    )
    const scheduledDates = slots.map((slot) => new Date(slot.scheduled_for))

    expect(scheduledDates.map((date) => [
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
    ])).toEqual([
      [2026, 6, 2, 10],
      [2026, 6, 4, 10],
      [2026, 6, 7, 10],
      [2026, 6, 10, 10],
    ])
    expect(scheduledDates.map((date) => date.getTime())).toEqual(
      [...scheduledDates].map((date) => date.getTime()).sort((a, b) => a - b),
    )
    expect(slots.map((slot) => slot.channel)).toEqual([
      'linkedin',
      'instagram_reels',
      'tiktok',
      'instagram_reels',
    ])
    expect(slots[1]).toEqual(expect.objectContaining({
      title: 'Hook batch: Short Form Sprint',
      metadata: expect.objectContaining({
        template_key: 'short_form_series',
        milestone_key: 'hook_batch',
        recommended_lead_time_days: 7,
        required_assets: ['hook_variants', 'script', 'safe_area_notes'],
        approval_gates: ['script_review', 'visual_review'],
      }),
    }))
  })

  it('recommends calendar templates from campaign goal signals', () => {
    const youtubeRecommendations = recommendCalendarTemplates({
      name: 'YouTube Authority Video Launch',
      description: 'Prepare a thumbnail-led creator video release for the Agent Ops framework.',
      campaign_type: 'bonus_credit',
    })

    expect(youtubeRecommendations[0]).toEqual(expect.objectContaining({
      key: 'youtube_video_release',
      score: expect.any(Number),
      matched_terms: expect.arrayContaining(['youtube', 'video', 'thumbnail', 'creator']),
      reasons: expect.arrayContaining([
        'YouTube language calls for video-led milestones.',
      ]),
    }))

    const proofRecommendations = recommendCalendarTemplates({
      name: 'Client-safe proof drop',
      description: 'Turn shipped project evidence and results into a case study without exposing private client details.',
      campaign_type: 'win_money_back',
    })

    expect(proofRecommendations[0]).toEqual(expect.objectContaining({
      key: 'case_study_proof_drop',
      matched_terms: expect.arrayContaining(['case study', 'proof', 'client', 'shipped', 'result', 'evidence']),
    }))
    expect(proofRecommendations.map((recommendation) => recommendation.key)).toContain('whisper_to_shout')
  })
})
