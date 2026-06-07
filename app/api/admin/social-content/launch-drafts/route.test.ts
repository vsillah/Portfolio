import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  selectForLookup: vi.fn(),
  contains: vi.fn(),
  insert: vi.fn(),
  selectAfterInsert: vi.fn(),
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

import { POST } from './route'

function makeRequest(body: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/admin/social-content/launch-drafts', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/admin/social-content/launch-drafts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.contains.mockResolvedValue({ data: [], error: null })
    mocks.selectAfterInsert.mockResolvedValue({
      data: [
        {
          id: 'social-1',
          rag_context: { launch_draft_asset_id: 'p0-linkedin-flagship-agentic-operating-system' },
        },
      ],
      error: null,
    })
    mocks.selectForLookup.mockReturnValue({ contains: mocks.contains })
    mocks.insert.mockReturnValue({ select: mocks.selectAfterInsert })
    mocks.from.mockReturnValue({
      select: mocks.selectForLookup,
      insert: mocks.insert,
    })
  })

  it('requires admin auth before checking existing social drafts', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('seeds missing launch drafts as draft-only social content rows', async () => {
    const response = await POST(makeRequest({
      asset_ids: ['p0-linkedin-flagship-agentic-operating-system'],
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      summary: { requested: 1, inserted: 1, existing: 0 },
      inserted: [{
        id: 'social-1',
        assetId: 'p0-linkedin-flagship-agentic-operating-system',
        href: '/admin/social-content/social-1',
      }],
    })
    expect(mocks.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        platform: 'linkedin',
        status: 'draft',
        post_text: expect.stringContaining('Anyone can launch an agent now.'),
        rag_context: expect.objectContaining({
          source: 'agentic_sales_outreach_launch_draft',
          launch_draft_asset_id: 'p0-linkedin-flagship-agentic-operating-system',
          approval_required_for: expect.arrayContaining(['publish', 'outbound_send']),
        }),
      }),
    ])
  })

  it('returns existing seeded rows instead of duplicating them', async () => {
    mocks.contains.mockResolvedValue({
      data: [{
        id: 'existing-social-1',
        rag_context: { launch_draft_asset_id: 'p0-linkedin-flagship-agentic-operating-system' },
      }],
      error: null,
    })

    const response = await POST(makeRequest({
      asset_ids: ['p0-linkedin-flagship-agentic-operating-system'],
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      summary: { requested: 1, inserted: 0, existing: 1 },
      existing: [{
        id: 'existing-social-1',
        assetId: 'p0-linkedin-flagship-agentic-operating-system',
        href: '/admin/social-content/existing-social-1',
      }],
    })
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('rejects unknown asset ids before writing rows', async () => {
    const response = await POST(makeRequest({ asset_ids: ['unknown-asset'] }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Unknown launch draft asset id',
      invalidAssetIds: ['unknown-asset'],
    })
    expect(mocks.insert).not.toHaveBeenCalled()
  })
})
