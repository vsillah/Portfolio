import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(), isAuthError: vi.fn(), from: vi.fn(),
  select: vi.fn(), eq: vi.fn(), single: vi.fn(), rpc: vi.fn(),
}))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.verifyAdmin, isAuthError: mocks.isAuthError }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from, rpc: mocks.rpc } }))

import { POST } from './route'

const request = () => new NextRequest('http://localhost/api/admin/social-content/content-1/prepare-copy-review', { method: 'POST' })
const call = () => POST(request(), { params: { id: 'content-1' } })

describe('POST initial Social Content copy-review preparation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'operator-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.single.mockResolvedValue({ data: { id: 'content-1', updated_at: '2026-10-28T12:00:00Z' }, error: null })
    mocks.eq.mockReturnValue({ single: mocks.single })
    mocks.select.mockReturnValue({ eq: mocks.eq })
    mocks.from.mockReturnValue({ select: mocks.select })
    mocks.rpc.mockResolvedValue({ data: {
      work_item_id: 'work-1', current_gate: 'copy_review', next_gate: 'visual_review',
      external_execution: false, idempotent_replay: false,
    }, error: null })
  })

  it('requires an authenticated admin before reading content', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)
    expect((await call()).status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('binds the RPC to the persisted item version and returns the canonical queue route', async () => {
    const response = await call()
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('prepare_social_content_copy_review', {
      p_social_content_id: 'content-1',
      p_expected_content_updated_at: '2026-10-28T12:00:00Z',
      p_triggered_by_user_id: 'operator-1',
    })
    await expect(response.json()).resolves.toMatchObject({
      canonical_href: '/admin/social-content/content-1?step=copy&review=mobile&proposal=work-1#social-copy-gate',
      external_execution: false,
    })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('returns an idempotent replay without a second route write', async () => {
    mocks.rpc.mockResolvedValue({ data: {
      work_item_id: 'work-1', current_gate: 'copy_review', external_execution: false,
      idempotent_replay: true,
    }, error: null })
    const response = await call()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ packet: { idempotent_replay: true } })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  it.each([
    'Persisted source receipt identity is missing',
    'Persisted privacy receipt version mismatch',
    'Exactly one linked calendar identity is required; found 2',
    'Social Content version mismatch; reload before preparation',
    'An existing Decision Queue packet is stale or already bound to another gate',
    'Social Content current gate must be copy_review',
    'Linked calendar review metadata is malformed',
    'Linked calendar item is already completed or cancelled',
  ])('fails closed with actionable conflict: %s', async message => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message } })
    const response = await call()
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: message })
  })

  it.each([
    { data: null, error: { message: 'permission denied for table social_content_queue' } },
    { data: null, error: null },
  ])('returns a safe not-found response without preparing %#', async result => {
    mocks.single.mockResolvedValue(result)
    const response = await call()
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Social Content item not found.' })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it.each([
    'Social Content version did not advance during packet preparation',
    'Social Content version changed after packet binding',
    'database unavailable',
  ])('keeps internal preparation failures on the server-error path: %s', async message => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message } })
    const response = await call()
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: message })
  })

  it('uses a closed message when preparation returns neither a packet nor an error', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    const response = await call()
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to prepare the copy-review packet.' })
  })

  it('rejects an incomplete RPC result rather than linking to an unbound review', async () => {
    mocks.rpc.mockResolvedValue({ data: { external_execution: false }, error: null })
    const response = await call()
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Copy-review preparation returned an incomplete packet binding.',
    })
  })

  it.each([
    { work_item_id: 'work-1', current_gate: 'visual_review', external_execution: false },
    { work_item_id: 'work-1', current_gate: 'copy_review', external_execution: true },
    { work_item_id: 'work-1', current_gate: 'copy_review' },
    { work_item_id: 12, current_gate: 'copy_review', external_execution: false },
    { work_item_id: '', current_gate: 'copy_review', external_execution: false },
  ])('rejects an unbound copy-review packet %#', async packet => {
    mocks.rpc.mockResolvedValue({ data: packet, error: null })
    const response = await call()
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Copy-review preparation returned an incomplete packet binding.',
    })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })
})
