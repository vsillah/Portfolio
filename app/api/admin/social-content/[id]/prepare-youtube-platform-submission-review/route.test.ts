import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ verifyAdmin: vi.fn(), isAuthError: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.verifyAdmin, isAuthError: mocks.isAuthError }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { rpc: mocks.rpc } }))

import { POST } from './route'

const id = 'c12378f2-36de-4bf7-8c5d-0ce754e727eb'
const privacy = '865a4d78-90ba-420d-84ed-526c70dd720f'
const version = '2026-11-01T20:00:00Z'
const contentVersion = `sha256:${'a'.repeat(64)}`
const body = { expected_content_updated_at: version, privacy_decision_receipt_id: privacy,
  content_version: contentVersion, master_sha256: 'b'.repeat(64),
  thumbnail_sha256: 'c'.repeat(64), thumbnail_direction: 'C' }
const request = (data: Record<string, unknown>) => new NextRequest(`http://localhost/api/admin/social-content/${id}/prepare-youtube-platform-submission-review`,
  { method: 'POST', body: JSON.stringify(data), headers: { 'content-type': 'application/json' } })

describe('POST prepare-youtube-platform-submission-review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: '33333333-3333-4333-8333-333333333333' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.rpc.mockResolvedValue({ data: { work_item_id: '44444444-4444-4444-8444-444444444444', external_execution: false }, error: null })
  })

  it('binds all exact identities to the service-role RPC and returns the protected decision route', async () => {
    const response = await POST(request(body), { params: { id } })
    expect(mocks.rpc).toHaveBeenCalledWith('prepare_youtube_platform_submission_review', {
      p_social_content_id: id, p_expected_content_updated_at: version,
      p_privacy_decision_receipt_id: privacy, p_content_version: contentVersion,
      p_master_sha256: body.master_sha256, p_thumbnail_sha256: body.thumbnail_sha256,
      p_thumbnail_direction: 'C', p_triggered_by_user_id: '33333333-3333-4333-8333-333333333333',
      p_idempotency_key: `youtube-platform-submission-review:${id}:${privacy}:${contentVersion}:${version}`,
    })
    expect(await response.json()).toMatchObject({ external_execution: false,
      canonical_href: `/admin/social-content/${id}?step=submit&review=mobile&proposal=44444444-4444-4444-8444-444444444444#social-platform-submission-gate` })
  })

  it('rejects incomplete evidence before any RPC call', async () => {
    const response = await POST(request({ ...body, thumbnail_sha256: 'wrong' }), { params: { id } })
    expect(response.status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('requires admin authorization', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Admin access required', status: 403 })
    mocks.isAuthError.mockReturnValue(true)
    const response = await POST(request(body), { params: { id } })
    expect(response.status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('returns conflict for stale or mismatched evidence', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Immutable visual prerequisite receipt mismatch' } })
    const response = await POST(request(body), { params: { id } })
    expect(response.status).toBe(409)
  })
})
