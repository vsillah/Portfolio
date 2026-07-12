import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  inFilter: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

describe('GET /api/admin/social-content/calibration-library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.limit.mockResolvedValue({
      data: [
        {
          id: 'social-history-1',
          platform: 'linkedin',
          status: 'published',
          post_text: 'A small business does not need another AI demo. It needs the work to get lighter.',
          cta_text: 'What work should AI remove first?',
          hashtags: ['#AIProduct'],
          topic_extracted: { topic: 'AI should reduce operator burden' },
          rag_context: {
            engagement: {
              latest_score: 81,
              recommendation_label: 'high signal',
              mapped_theme: 'operator burden',
              latest: {
                comments: 4,
                shares: 2,
                reactions: 37,
                capturedAt: '2026-07-01T12:00:00.000Z',
              },
            },
          },
          content_pillar: 'AI and product management',
          target_platforms: ['linkedin'],
          published_at: '2026-06-30T12:00:00.000Z',
          updated_at: '2026-07-01T12:00:00.000Z',
          created_at: '2026-06-29T12:00:00.000Z',
        },
      ],
      error: null,
    })
    mocks.order.mockReturnValue({ limit: mocks.limit })
    mocks.inFilter.mockReturnValue({ order: mocks.order })
    mocks.select.mockReturnValue({ in: mocks.inFilter })
    mocks.from.mockReturnValue({ select: mocks.select })
  })

  it('returns reusable LinkedIn calibration references without side effects', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/calibration-library?platform=linkedin'))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toMatchObject({
      source: 'approved_calibration_library',
      counts: {
        portfolio_history: 1,
        static_references: 4,
        total: 5,
      },
      side_effects: {
        provider_generation: false,
        publish: false,
        schedule: false,
        external_post: false,
      },
    })
    expect(json.references).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'portfolio-social-social-history-1',
        platform: 'linkedin',
        source_type: 'portfolio_content_history',
        engagement_signal: expect.stringContaining('Engagement score 81'),
        provenance: '/admin/social-content/social-history-1',
      }),
      expect.objectContaining({
        id: 'linkedin-builder-insight-production-readiness',
        platform: 'linkedin',
        source_type: 'voice_guide_reference',
        provenance: 'docs/linkedin-voice.md',
      }),
      expect.objectContaining({
        id: 'linkedin-governed-agent-work',
        platform: 'linkedin',
        source_type: 'operator_approved_pattern',
      }),
    ]))
    expect(mocks.from).toHaveBeenCalledWith('social_content_queue')
    expect(mocks.inFilter).toHaveBeenCalledWith('status', ['published', 'approved'])
  })

  it('requires admin auth before exposing calibration references', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/calibration-library'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns an empty set for unsupported platforms', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/calibration-library?platform=tiktok'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      references: [],
      source: 'approved_calibration_library',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('can return only static references when history is disabled', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/calibration-library?platform=linkedin&include_history=false'))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.counts).toEqual({
      portfolio_history: 0,
      static_references: 4,
      total: 4,
    })
    expect(json.references).toEqual(expect.not.arrayContaining([
      expect.objectContaining({ source_type: 'portfolio_content_history' }),
    ]))
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('prioritizes operator-marked gold-standard history references', async () => {
    mocks.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'social-history-regular',
          platform: 'linkedin',
          status: 'published',
          post_text: 'A regular approved history reference.',
          topic_extracted: { topic: 'Regular history' },
          rag_context: {},
          content_pillar: 'AI and product management',
          target_platforms: ['linkedin'],
          published_at: '2026-07-02T12:00:00.000Z',
          updated_at: '2026-07-02T12:00:00.000Z',
          created_at: '2026-07-02T12:00:00.000Z',
        },
        {
          id: 'social-history-gold',
          platform: 'linkedin',
          status: 'published',
          post_text: 'A marked gold-standard post that should guide Shaka revisions.',
          topic_extracted: { topic: 'Gold standard history' },
          rag_context: {
            content_calibration: {
              reference_curation: {
                gold_standard: true,
                reason: 'This sounded like Vambah and had strong conversation quality.',
              },
            },
          },
          content_pillar: 'AI and product management',
          target_platforms: ['linkedin'],
          published_at: '2026-06-20T12:00:00.000Z',
          updated_at: '2026-06-20T12:00:00.000Z',
          created_at: '2026-06-20T12:00:00.000Z',
        },
      ],
      error: null,
    })

    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/calibration-library?platform=linkedin'))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.references[0]).toMatchObject({
      id: 'portfolio-social-social-history-gold',
      curation_status: 'gold_standard',
      label: expect.stringContaining('Gold standard'),
      engagement_signal: expect.stringContaining('Operator marked as a reusable gold-standard post.'),
      why_it_worked: expect.stringContaining('strong conversation quality'),
    })
    expect(json.references[1]).toMatchObject({
      id: 'portfolio-social-social-history-regular',
      curation_status: 'portfolio_history',
    })
  })
})
