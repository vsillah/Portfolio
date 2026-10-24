import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ from: vi.fn(), verifyAdmin: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.verifyAdmin, isAuthError: vi.fn() }))
import { GET } from './route'
import { DARK_CASTLE_PRODUCTION_RECOVERY_QA_FIXTURE, DARK_CASTLE_SOCIAL_CONTENT_ID, DARK_CASTLE_VISUAL_QA_ID } from '@/lib/social-approved-visual-contract'

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
})
