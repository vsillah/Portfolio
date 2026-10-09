import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { GET, PUT } from './route'
import { POST as approve } from './approve/route'
import { PRACTITIONER_CONTENT_QA_ID } from '@/lib/social-practitioner-content-qa-fixture'

const route = `http://localhost/api/admin/social-content/${PRACTITIONER_CONTENT_QA_ID}`

describe('practitioner content preview fixture route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VERCEL_ENV', 'preview')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('serves the synthetic quality record without auth or database reads', async () => {
    const response = await GET(new NextRequest(route), { params: { id: PRACTITIONER_CONTENT_QA_ID } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      fixture: true,
      item: {
        id: PRACTITIONER_CONTENT_QA_ID,
        rag_context: {
          external_execution_enabled: false,
          practitioner_content_quality: {
            version: 'practitioner_evidence_v1',
            evidence_packet: { status: 'approved' },
            deterministic_visual: {
              system_version: 'amadutown_deterministic_v1',
              candidate: { status: 'in_review', renderer: 'html_svg' },
              art_direction_receipt: { provider: 'none', status: 'not_called' },
            },
          },
          content_calibration: {
            experiment_tags: { causal_claim_boundary: 'correlational_only' },
          },
        },
      },
    })
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('blocks fixture save and approval before auth or database access', async () => {
    const saveResponse = await PUT(new NextRequest(route, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ post_text: 'Changed' }),
    }), { params: { id: PRACTITIONER_CONTENT_QA_ID } })
    const approveResponse = await approve(new NextRequest(`${route}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }), { params: { id: PRACTITIONER_CONTENT_QA_ID } })

    expect(saveResponse.status).toBe(409)
    expect(approveResponse.status).toBe(409)
    expect(await saveResponse.json()).toMatchObject({ fixture: true, blocked: true })
    expect(await approveResponse.json()).toMatchObject({ fixture: true, blocked: true })
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
