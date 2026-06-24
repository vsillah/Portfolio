import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  runSocialContentResearchCollection: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/social-content-research-run', () => ({
  runSocialContentResearchCollection: mocks.runSocialContentResearchCollection,
}))

import { POST } from './route'

describe('/api/admin/social-content/intelligence/research-runs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1', email: 'admin@example.com' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.runSocialContentResearchCollection.mockResolvedValue({
      ok: true,
      mode: 'recorded_evidence',
      packets: [{ id: 'packet-1' }],
      side_effects: {
        apify_collection: false,
        estimated_scraper_cost_usd: 0,
        publish: false,
      },
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(new NextRequest('http://localhost/api/admin/social-content/intelligence/research-runs', {
      method: 'POST',
    }))

    expect(response.status).toBe(401)
    expect(mocks.runSocialContentResearchCollection).not.toHaveBeenCalled()
  })

  it('stores free recorded public evidence as the default executable path', async () => {
    const response = await POST(new NextRequest('http://localhost/api/admin/social-content/intelligence/research-runs', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'recorded_evidence',
        evidence_items: [
          {
            source_url: 'https://youtube.com/watch?v=abc',
            platform: 'youtube',
            title: 'Outlier research process',
            hook_transcript: 'The first 30 seconds make the promise clear.',
            retrieval_method: 'codex_browser',
          },
        ],
      }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.runSocialContentResearchCollection).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'recorded_evidence',
      actorId: 'admin-1',
      actorLabel: 'admin@example.com',
      triggerSource: 'admin_social_content_intelligence_recorded_evidence',
      evidenceItems: [
        expect.objectContaining({
          source_url: 'https://youtube.com/watch?v=abc',
          retrieval_method: 'codex_browser',
        }),
      ],
    }))
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      packets: [{ id: 'packet-1' }],
      side_effects: {
        apify_collection: false,
        estimated_scraper_cost_usd: 0,
      },
    })
  })

  it('normalizes recorded evidence fields before invoking the collector', async () => {
    const response = await POST(new NextRequest('http://localhost/api/admin/social-content/intelligence/research-runs', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'recorded_evidence',
        evidence_items: [
          {
            source_url: ' https://example.com/public-post ',
            platform: 'unsupported-network',
            title: '  Public pattern  ',
            pattern_status: 'copy_source',
            pattern_packet: {
              hook_structure: 'Start with the customer tension.',
            },
          },
        ],
      }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.runSocialContentResearchCollection).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'recorded_evidence',
      evidenceItems: [
        expect.objectContaining({
          source_url: 'https://example.com/public-post',
          platform: 'other',
          title: 'Public pattern',
          pattern_status: 'needs_brand_translation',
          retrieval_method: 'codex_browser',
          pattern_packet: {
            hook_structure: 'Start with the customer tension.',
          },
        }),
      ],
    }))
  })

  it('rejects recorded evidence requests without evidence items', async () => {
    const response = await POST(new NextRequest('http://localhost/api/admin/social-content/intelligence/research-runs', {
      method: 'POST',
      body: JSON.stringify({ mode: 'recorded_evidence' }),
    }))

    expect(response.status).toBe(400)
    expect(mocks.runSocialContentResearchCollection).not.toHaveBeenCalled()
  })

  it('passes the Apify cost confirmation flag only when explicit', async () => {
    mocks.runSocialContentResearchCollection.mockResolvedValueOnce({
      ok: true,
      mode: 'apify',
      packets: [],
      side_effects: { apify_collection: true, estimated_scraper_cost_usd: 'variable' },
    })

    const response = await POST(new NextRequest('http://localhost/api/admin/social-content/intelligence/research-runs', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'apify',
        confirm_apify_cost: true,
        sources: [{ url: 'https://youtube.com/watch?v=abc' }],
      }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.runSocialContentResearchCollection).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'apify',
      confirmApifyCost: true,
      triggerSource: 'admin_social_content_intelligence_apify_confirmed',
    }))
  })
})
