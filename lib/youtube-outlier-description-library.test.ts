import { describe, expect, it } from 'vitest'
import { buildLinkedInYoutubeReviewDrafts } from './social-content-intelligence'
import {
  YOUTUBE_DESCRIPTION_LIBRARY_VERSION,
  buildYouTubeOutlierDescriptionLibrary,
} from './youtube-outlier-description-library'

function packet(input: {
  id: string
  url?: string
  description: string
  title?: string
  score?: number
  publishedAt?: string
  platform?: string
  status?: string
  audienceSize?: number
}) {
  return {
    id: input.id,
    source_url: input.url ?? `https://youtube.com/watch?v=${input.id}`,
    platform: input.platform ?? 'youtube',
    creator_name: `Creator ${input.id}`,
    title: input.title ?? `AI license audit ${input.id}`,
    caption: `Internal campaign summary for ${input.id}.`,
    metrics: {
      published_at: input.publishedAt ?? '2026-10-01T12:00:00.000Z',
      follower_count: input.audienceSize ?? 42_000,
    },
    actor_metadata: {
      topics: ['ai licenses', 'audit calculator'],
      source_description: input.description,
      description_provenance: 'youtube_watch_short_description',
    },
    outlier_score: input.score ?? 82,
    pattern_packet: {
      topics: ['ai licenses', 'audit calculator'],
      promise_value: 'Measure AI adoption through operating evidence.',
    },
    pattern_status: input.status ?? 'usable_framework',
    retrieved_at: '2026-10-02T12:00:00.000Z',
  }
}

describe('YouTube outlier description library', () => {
  it('builds a source-linked structural library from fresh same-topic outliers', () => {
    const receipt = buildYouTubeOutlierDescriptionLibrary({
      generatedAt: '2026-10-17T12:00:00.000Z',
      targetTopics: ['AI licenses', 'audit calculator'],
      targetAudienceSize: 50_000,
      researchPackets: [
        packet({
          id: 'a',
          description: 'Are your AI licenses producing value?\n\nSee the calculator walkthrough and product screenshots.\n\nWhere is adoption stalling?',
        }),
        packet({
          id: 'b',
          description: 'Stop counting seats.\n\nThis case study compares license activity with measured outcomes.\n\nTell me what your team measures.',
          score: 91,
        }),
        packet({
          id: 'c',
          description: 'AI adoption needs operating proof.\n\nThe dashboard shows the calculation and supporting data.\n\nSubscribe for more product operating breakdowns.',
          score: 87,
        }),
      ],
    })

    expect(receipt).toMatchObject({
      version: YOUTUBE_DESCRIPTION_LIBRARY_VERSION,
      status: 'ready',
      library_entry_count: 3,
      blockers: [],
      recommended_structure: {
        length_band: 'short',
        proof_style: 'product_evidence',
      },
    })
    expect(receipt.sources).toHaveLength(3)
    expect(receipt.sources[0]).toMatchObject({
      source_url: expect.stringContaining('youtube.com/watch'),
      topic_matches: expect.arrayContaining(['licenses', 'audit', 'calculator']),
      description_fingerprint: expect.stringMatching(/^fnv1a:/),
      gate_decisions: expect.arrayContaining([
        expect.objectContaining({ gate: 'framework_approval', status: 'passed' }),
        expect.objectContaining({ gate: 'outlier_score', status: 'passed' }),
        expect.objectContaining({ gate: 'audience_band', status: 'passed' }),
      ]),
    })
    expect(receipt.recommended_structure.blueprint).toEqual(expect.arrayContaining([
      expect.stringContaining('first-party product example'),
    ]))
    expect(receipt.originality_boundary).toContain('Do not copy source wording')
    expect(JSON.stringify(receipt)).not.toContain('Are your AI licenses producing value?')
  })

  it('deduplicates canonical URLs and fails closed when the cohort is stale or too small', () => {
    const current = packet({
      id: 'current',
      url: 'https://youtube.com/watch?v=same&utm_source=test',
      description: 'A current AI license description with product proof.',
    })
    const duplicate = packet({
      id: 'duplicate',
      url: 'https://youtube.com/watch?v=same',
      description: 'A duplicate source description.',
      score: 70,
    })
    const stale = packet({
      id: 'stale',
      description: 'An old AI license description.',
      publishedAt: '2025-01-01T00:00:00.000Z',
    })

    const receipt = buildYouTubeOutlierDescriptionLibrary({
      generatedAt: '2026-10-17T12:00:00.000Z',
      targetTopics: ['AI licenses'],
      researchPackets: [current, duplicate, stale],
      minimumSourceCount: 2,
    })

    expect(receipt.status).toBe('unscored')
    expect(receipt.library_entry_count).toBe(1)
    expect(receipt.blockers).toEqual([
      'Only 1 fresh, attributable same-topic outlier description(s) qualified; 2 are required.',
    ])
    expect(receipt.recommended_structure.blueprint).toEqual([])
  })

  it('requires attributable YouTube descriptions, approved patterns, and matching audience bands', () => {
    const receipt = buildYouTubeOutlierDescriptionLibrary({
      generatedAt: '2026-10-17T12:00:00.000Z',
      targetTopics: ['AI licenses'],
      targetAudienceSize: 50_000,
      minimumSourceCount: 2,
      researchPackets: [
        packet({ id: 'wrong-platform', platform: 'linkedin', description: 'AI licenses proof.' }),
        packet({ id: 'unapproved', status: 'needs_brand_translation', description: 'AI licenses proof.' }),
        packet({ id: 'no-url', url: 'not-a-url', description: 'AI licenses proof.' }),
        packet({ id: 'wrong-band', audienceSize: 2_000_000, description: 'AI licenses proof.' }),
      ],
    })

    expect(receipt.status).toBe('unscored')
    expect(receipt.library_entry_count).toBe(0)
    expect(receipt.sources).toEqual([])
    expect(receipt.excluded_sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ source_id: 'unapproved', reason: 'Pattern has not been approved as a usable framework.' }),
      expect.objectContaining({ source_id: 'no-url', reason: 'Source URL is missing or is not attributable.' }),
      expect.objectContaining({ source_id: 'wrong-band', reason: expect.stringMatching(/audience/i) }),
    ]))
    expect(receipt.excluded_sources).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ source_id: 'wrong-platform' }),
    ]))
  })

  it('does not treat an internal packet caption as public YouTube description evidence', () => {
    const researchPacket = packet({ id: 'summary-only', description: 'Public description that is deliberately removed.' })
    researchPacket.actor_metadata.source_description = ''
    researchPacket.actor_metadata.description_provenance = ''

    const receipt = buildYouTubeOutlierDescriptionLibrary({
      generatedAt: '2026-10-17T12:00:00.000Z',
      targetTopics: ['AI licenses'],
      researchPackets: [researchPacket],
      minimumSourceCount: 2,
    })

    expect(receipt.sources).toEqual([])
    expect(receipt.excluded_sources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source_id: 'summary-only',
        reason: 'No separately proven public YouTube description was captured; the internal packet summary is not description evidence.',
        gate_decisions: expect.arrayContaining([
          expect.objectContaining({ gate: 'description_capture', status: 'failed' }),
          expect.objectContaining({ gate: 'outlier_score', status: 'not_evaluated' }),
        ]),
      }),
    ]))
  })

  it('attaches and applies the library receipt only to the YouTube draft', () => {
    const researchPackets = ['a', 'b', 'c'].map((id, index) => packet({
      id,
      score: 80 + index,
      description: index === 0
        ? 'Are AI licenses creating value?\n\nSee the product calculator.\n\nWhere would you start?'
        : `AI license audit ${id}.\n\nThe calculator dashboard shows product evidence.\n\nWhere is your proof?`,
    }))
    const drafts = buildLinkedInYoutubeReviewDrafts({
      generatedAt: '2026-10-17T12:00:00.000Z',
      youtubeDescriptionResearchPackets: researchPackets,
      insight: {
        title: 'Stop counting AI licenses',
        triggering_event: 'Teams are buying AI licenses without measuring adoption.',
        content_angle: 'Use an AI audit calculator to connect licenses to operating value.',
        topics: ['AI licenses', 'audit calculator'],
        approved_research_patterns: researchPackets,
      },
    })

    expect(drafts.youtube.fields.description_outlier_evidence).toMatchObject({
      status: 'ready',
      library_entry_count: 3,
      sources: expect.arrayContaining([
        expect.objectContaining({ source_url: expect.stringContaining('youtube.com/watch') }),
      ]),
    })
    expect(drafts.youtube.fields.description).toContain('Where does your own AI workflow lose trust')
    expect(drafts.linkedin.fields).not.toHaveProperty('description_outlier_evidence')
    expect(drafts.youtube.side_effects).toEqual({
      provider_generation: false,
      upload: false,
      publish: false,
      schedule: false,
      external_post: false,
    })
  })
})
