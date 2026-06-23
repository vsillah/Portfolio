import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  insertSingle: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import {
  buildSocialResearchRunPlan,
  runSocialContentResearchCollection,
} from './social-content-research-run'

describe('social-content-research-run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.insertSingle.mockResolvedValue({
      data: {
        id: 'packet-1',
        source_url: 'https://youtube.com/watch?v=abc',
        platform: 'youtube',
        title: 'Free research packet',
        outlier_score: 42,
      },
      error: null,
    })
    mocks.from.mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: mocks.insertSingle,
        })),
      })),
    })
  })

  it('builds a free-first plan before paid scraper fallback', () => {
    const plan = buildSocialResearchRunPlan([
      { url: 'https://youtube.com/watch?v=abc', label: 'Reference video' },
    ])

    expect(plan).toHaveLength(1)
    expect(plan[0]).toMatchObject({
      recommended_method: 'free_first_recorded_evidence',
      actor_id: 'pintostudio/youtube-transcript-scraper',
    })
    expect(plan[0].free_first_steps.join(' ')).toContain('Codex/browser/public page review')
  })

  it('stores recorded public evidence without paid scraper side effects', async () => {
    const result = await runSocialContentResearchCollection({
      mode: 'recorded_evidence',
      evidenceItems: [
        {
          source_url: 'https://youtube.com/watch?v=abc',
          platform: 'youtube',
          title: 'Free research packet',
          hook_transcript: 'The opening hook explains the promise.',
          metrics: { views: 1000, likes: 50 },
          retrieval_method: 'codex_browser',
        },
      ],
      actorId: 'admin-1',
      actorLabel: 'admin@example.com',
      triggerSource: 'test',
    })

    expect(result).toMatchObject({
      ok: true,
      mode: 'recorded_evidence',
      packets: [{ id: 'packet-1' }],
      side_effects: {
        apify_collection: false,
        estimated_scraper_cost_usd: 0,
        publish: false,
      },
    })
    expect(mocks.from).toHaveBeenCalledWith('social_content_research_packets')
    expect(mocks.insertSingle).toHaveBeenCalled()
  })

  it('blocks Apify mode without explicit cost confirmation', async () => {
    await expect(runSocialContentResearchCollection({
      mode: 'apify',
      sources: [{ url: 'https://youtube.com/watch?v=abc' }],
      triggerSource: 'test',
    })).rejects.toThrow('confirm_apify_cost=true')
  })
})
