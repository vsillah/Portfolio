import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn((result: { error?: string } | null) => Boolean(result && typeof result === 'object' && 'error' in result)),
}))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.verifyAdmin, isAuthError: mocks.isAuthError }))
import { GET } from './route'
import { DARK_CASTLE_PRODUCTION_RECOVERY_QA_FIXTURE, DARK_CASTLE_SOCIAL_CONTENT_ID, DARK_CASTLE_VISUAL_QA_ID } from '@/lib/social-approved-visual-contract'

const originalNodeEnv = process.env.NODE_ENV
const originalVercelEnv = process.env.VERCEL_ENV

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV
  else process.env.VERCEL_ENV = originalVercelEnv
  mocks.from.mockReset()
  mocks.verifyAdmin.mockReset()
})

async function expectAdminRequired(url: string, id: string) {
  mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
  const response = await GET(new NextRequest(url), { params: { id } })
  expect(response.status).toBe(401)
  expect(await response.json()).toEqual({ error: 'Unauthorized' })
  expect(mocks.verifyAdmin).toHaveBeenCalledOnce()
  expect(mocks.from).not.toHaveBeenCalled()
}

describe('GET Dark Castle visual contract review fixture', () => {
  it('projects the exact production record missing-contract state locally without a database read or write', async () => {
    const request = new NextRequest(`http://localhost/api/admin/social-content/${DARK_CASTLE_SOCIAL_CONTENT_ID}?qa_fixture=${DARK_CASTLE_PRODUCTION_RECOVERY_QA_FIXTURE}`)
    const response = await GET(request, { params: { id: DARK_CASTLE_SOCIAL_CONTENT_ID } })
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.fixture).toBe(true)
    expect(body.fixture_state).toBe('missing')
    expect(body.item.id).toBe(DARK_CASTLE_SOCIAL_CONTENT_ID)
    expect(body.item.rag_context.qa_fixture.read_only).toBe(true)
    expect(body.item.deterministic_visual_render.state).toBe('blocked')
    expect(body.item.deterministic_visual_render.provider_calls_enabled).toBe(false)
    expect(body.item.deterministic_visual_render.recovery_action).not.toMatch(/localhost|fixture|local visual-contract gate/i)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
  })
  it.each(['current', 'missing', 'stale', 'mismatch'] as const)('projects %s without a database write', async (state) => {
    const request = new NextRequest(`http://localhost/api/admin/social-content/${DARK_CASTLE_VISUAL_QA_ID}?qa_state=${state}`)
    const response = await GET(request, { params: { id: DARK_CASTLE_VISUAL_QA_ID } })
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.fixture).toBe(true)
    expect(body.fixture_state).toBe(state)
    expect(body.item.rag_context.qa_fixture.read_only).toBe(true)
    expect(body.item.deterministic_visual_render.state).toBe(state === 'current' ? 'current' : 'blocked')
    expect(body.item.deterministic_visual_render.provider_calls_enabled).toBe(false)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
  })

  it('requires an admin before reading a hosted or production request', async () => {
    process.env.VERCEL_ENV = 'preview'
    await expectAdminRequired(
      `http://localhost/api/admin/social-content/${DARK_CASTLE_VISUAL_QA_ID}?qa_state=current`,
      DARK_CASTLE_VISUAL_QA_ID,
    )
    mocks.verifyAdmin.mockClear()
    process.env.VERCEL_ENV = 'production'
    await expectAdminRequired(
      `http://localhost/api/admin/social-content/${DARK_CASTLE_SOCIAL_CONTENT_ID}?qa_fixture=${DARK_CASTLE_PRODUCTION_RECOVERY_QA_FIXTURE}`,
      DARK_CASTLE_SOCIAL_CONTENT_ID,
    )
    mocks.verifyAdmin.mockClear()
    delete process.env.VERCEL_ENV
    process.env.NODE_ENV = 'production'
    await expectAdminRequired(
      `http://localhost/api/admin/social-content/${DARK_CASTLE_VISUAL_QA_ID}`,
      DARK_CASTLE_VISUAL_QA_ID,
    )
  })

  it('does not treat a mismatched fixture name as the read-only recovery projection', async () => {
    delete process.env.VERCEL_ENV
    process.env.NODE_ENV = 'test'
    await expectAdminRequired(
      `http://localhost/api/admin/social-content/${DARK_CASTLE_SOCIAL_CONTENT_ID}?qa_fixture=not-the-recovery-fixture`,
      DARK_CASTLE_SOCIAL_CONTENT_ID,
    )
  })

  it('keeps an unknown review state on the current non-executable candidate', async () => {
    delete process.env.VERCEL_ENV
    process.env.NODE_ENV = 'test'
    const response = await GET(
      new NextRequest(`http://localhost/api/admin/social-content/${DARK_CASTLE_VISUAL_QA_ID}?qa_state=publish`),
      { params: { id: DARK_CASTLE_VISUAL_QA_ID } },
    )
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.fixture_state).toBe('current')
    expect(body.item.deterministic_visual_render).toMatchObject({ state: 'current', can_render: false, provider_calls_enabled: false })
    expect(Object.values(body.item.deterministic_visual_render.review_contract.external_actions)).toEqual([false, false, false, false, false])
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
  })
})
