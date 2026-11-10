import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn(), verifyAdmin: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (result: { error?: unknown } | null) => Boolean(result && typeof result === 'object' && 'error' in result),
}))

import { GET, PUT } from './route'
import { SOCIAL_VISUAL_BACKLOG_QA_FIXTURE, SOCIAL_VISUAL_BACKLOG_QA_ID } from '@/lib/social-visual-contract-recovery'

const savedCopyRecovery = {
  summary: 'This saved copy has no current deterministic visual review contract.',
  recovery_action: 'Review this record’s saved Copy gate and evidence before a separate visual contract is prepared. Rendering and external actions remain blocked.',
}

const originalEnv = { VERCEL_ENV: process.env.VERCEL_ENV, NODE_ENV: process.env.NODE_ENV }

function restoreEnv() {
  if (originalEnv.VERCEL_ENV === undefined) delete process.env.VERCEL_ENV
  else process.env.VERCEL_ENV = originalEnv.VERCEL_ENV
  if (originalEnv.NODE_ENV === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalEnv.NODE_ENV
}

afterEach(() => {
  restoreEnv()
  mocks.from.mockReset()
  mocks.verifyAdmin.mockReset()
})

function backlogRequest(query = `qa_fixture=${SOCIAL_VISUAL_BACKLOG_QA_FIXTURE}`, method = 'GET') {
  return new NextRequest(`http://localhost/api/admin/social-content/${SOCIAL_VISUAL_BACKLOG_QA_ID}?${query}`, {
    method,
    body: method === 'PUT' ? JSON.stringify({ post_text: 'mutate the saved copy' }) : undefined,
  })
}

describe('GET saved-copy visual backlog fixture', () => {
  it('projects the missing contract locally without a database read or admin session', async () => {
    delete process.env.VERCEL_ENV
    process.env.NODE_ENV = 'test'
    const response = await GET(backlogRequest(), { params: { id: SOCIAL_VISUAL_BACKLOG_QA_ID } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.fixture).toBe(true)
    expect(body.fixture_state).toBe('missing')
    expect(body.item.id).toBe(SOCIAL_VISUAL_BACKLOG_QA_ID)
    expect(body.item.post_text).toBe('')
    expect(body.item.rag_context.external_execution_enabled).toBe(false)
    expect(body.item.rag_context.platform_draft_enabled).toBe(false)
    expect(body.item.deterministic_visual_render).toMatchObject({
      state: 'blocked',
      code: 'candidate_missing',
      can_render: false,
      provider_calls_enabled: false,
      ...savedCopyRecovery,
    })
    expect(body.integration_note).toContain('No database row')
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
  })

  it('does not replace the channel-native video fixture that shares this record id', async () => {
    delete process.env.VERCEL_ENV
    process.env.NODE_ENV = 'test'
    const response = await GET(backlogRequest('qa_fixture=channel_native_video_v2'), { params: { id: SOCIAL_VISUAL_BACKLOG_QA_ID } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ fixture: true, fixture_state: 'repository_bound_review' })
    expect(body.item.rag_context.qa_fixture).toMatchObject({ read_only: true, kind: 'channel_native_video_review' })
    expect(body.item.rag_context.approved_video_packet.provider).toBe('none')
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
  })

  it.each([
    ['preview', 'test', `qa_fixture=${SOCIAL_VISUAL_BACKLOG_QA_FIXTURE}`],
    [undefined, 'production', `qa_fixture=${SOCIAL_VISUAL_BACKLOG_QA_FIXTURE}`],
    [undefined, 'test', 'qa_fixture=not-the-recovery-fixture'],
  ] as const)('requires admin auth when hosted=%s node=%s query=%s', async (vercelEnv, nodeEnv, query) => {
    if (vercelEnv === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = vercelEnv
    process.env.NODE_ENV = nodeEnv
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await GET(backlogRequest(query), { params: { id: SOCIAL_VISUAL_BACKLOG_QA_ID } })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: 'Unauthorized' })
    expect(mocks.verifyAdmin).toHaveBeenCalledOnce()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('keeps PUT behind admin auth even when the local read fixture is enabled', async () => {
    delete process.env.VERCEL_ENV
    process.env.NODE_ENV = 'test'
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await PUT(backlogRequest(`qa_fixture=${SOCIAL_VISUAL_BACKLOG_QA_FIXTURE}`, 'PUT'), { params: { id: SOCIAL_VISUAL_BACKLOG_QA_ID } })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: 'Unauthorized' })
    expect(mocks.verifyAdmin).toHaveBeenCalledOnce()
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
