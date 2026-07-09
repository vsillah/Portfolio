import { describe, expect, it } from 'vitest'
import {
  getSocialContentCalibrationReferenceById,
  listSocialContentCalibrationReferences,
  socialContentHistoryReferenceFromRow,
} from './social-content-calibration-library'

describe('social content calibration library', () => {
  it('treats omitted, null, and all platform filters as unrestricted', () => {
    const unfiltered = listSocialContentCalibrationReferences()
    const explicitAll = listSocialContentCalibrationReferences({ platform: 'all' })
    const uppercaseAll = listSocialContentCalibrationReferences({ platform: 'ALL' })
    const nullPlatform = listSocialContentCalibrationReferences({ platform: null })

    expect(unfiltered.length).toBeGreaterThan(0)
    expect(explicitAll).toEqual(unfiltered)
    expect(uppercaseAll).toEqual(unfiltered)
    expect(nullPlatform).toEqual(unfiltered)
  })

  it('normalizes supported platform filters and rejects unsupported platforms', () => {
    const unfiltered = listSocialContentCalibrationReferences()

    expect(listSocialContentCalibrationReferences({ platform: 'LinkedIn' })).toEqual(unfiltered)
    expect(listSocialContentCalibrationReferences({ platform: 'tiktok' })).toEqual([])
  })

  it('returns a fresh array so callers cannot reorder the shared reference list', () => {
    const firstRead = listSocialContentCalibrationReferences()
    const removed = firstRead.pop()

    expect(removed?.id).toBeTruthy()
    expect(listSocialContentCalibrationReferences()).toHaveLength(firstRead.length + 1)
  })

  it('finds references by stable id and returns null for missing ids', () => {
    expect(getSocialContentCalibrationReferenceById('linkedin-governed-agent-work')).toMatchObject({
      id: 'linkedin-governed-agent-work',
      platform: 'linkedin',
      source_type: 'operator_approved_pattern',
    })
    expect(getSocialContentCalibrationReferenceById('missing-reference')).toBeNull()
  })

  it('turns approved LinkedIn history into bounded calibration references', () => {
    const separator = ' \u00b7 '
    const reference = socialContentHistoryReferenceFromRow({
      id: 'social-1',
      status: 'published',
      platform: null,
      target_platforms: ['linkedin'],
      post_text: [
        'Agentic work needs a visible approval gate.',
        '',
        'The useful pattern is not more output. It is evidence, owner, and decision state in one place.',
      ].join('\n'),
      topic_extracted: {
        topic: 'Governed agent work',
      },
      content_pillar: null,
      rag_context: {
        engagement: {
          latest_score: 87,
          recommendation_label: 'Reuse pattern',
          mapped_theme: 'approval visibility',
          latest: {
            comments: 3,
            reposts: 2,
            likes: 19,
            capturedAt: '2026-07-03T14:30:00.000Z',
          },
        },
        source_provenance_checklist: [
          'Only reuse public-safe operating principles.',
          'Do not mention private client details.',
          'This third note should not be copied into claim boundaries.',
        ],
      },
      published_at: '2026-07-02T12:00:00.000Z',
      updated_at: '2026-07-01T12:00:00.000Z',
      created_at: '2026-06-30T12:00:00.000Z',
    })

    expect(reference).toMatchObject({
      id: 'portfolio-social-social-1',
      platform: 'linkedin',
      label: `Portfolio history${separator}Governed agent work${separator}2026-07-02`,
      source_type: 'portfolio_content_history',
      content_pillar: 'Governed agent work',
      post_excerpt: expect.stringContaining('Agentic work needs a visible approval gate.'),
      engagement_signal: `Engagement score 87${separator}Reuse pattern${separator}3 comment(s)${separator}2 share/repost signal(s)${separator}19 reaction(s)${separator}Captured 2026-07-03`,
      why_it_worked: 'This was already approved in Portfolio Social Content and moved through the LinkedIn publish path with mapped theme: approval visibility',
      provenance: '/admin/social-content/social-1',
    })
    expect(reference?.claim_boundaries).toEqual([
      'Reuse as a voice and structure reference only.',
      'Do not copy private source details unless they are already public-safe in this draft.',
      'Only reuse public-safe operating principles.',
      'Do not mention private client details.',
    ])
  })

  it('rejects history rows that are not safe LinkedIn calibration inputs', () => {
    expect(socialContentHistoryReferenceFromRow({
      id: 'draft-1',
      status: 'draft',
      platform: 'linkedin',
      post_text: 'Draft should not calibrate future posts.',
    })).toBeNull()

    expect(socialContentHistoryReferenceFromRow({
      id: 'instagram-1',
      status: 'approved',
      platform: 'instagram',
      target_platforms: ['tiktok'],
      post_text: 'Non-LinkedIn copy should not calibrate LinkedIn posts.',
    })).toBeNull()

    expect(socialContentHistoryReferenceFromRow({
      id: 'empty-1',
      status: 'approved',
      platform: 'linkedin',
      post_text: '   ',
    })).toBeNull()
  })
})
