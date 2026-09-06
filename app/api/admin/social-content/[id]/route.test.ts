import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
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

import { PUT } from './route'
import { socialCopyVersion, withSocialCopyRevision } from '@/lib/social-copy-revision'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/social-content/social-1', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PUT /api/admin/social-content/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.single.mockResolvedValue({
      data: { id: 'social-1', rag_context: { source: 'agent_ops_social_outreach_goal' } },
      error: null,
    })
    mocks.select.mockReturnValue({ eq: mocks.eq, single: mocks.single })
    mocks.eq.mockReturnValue({ select: mocks.select, single: mocks.single })
    mocks.update.mockReturnValue({ eq: mocks.eq })
    mocks.from.mockReturnValue({ update: mocks.update, select: mocks.select })
  })

  it('allows Agent Ops calibration feedback to be saved in rag_context', async () => {
    const ragContext = {
      source: 'agent_ops_social_outreach_goal',
      content_calibration: {
        status: 'ready_for_draft_review',
        operator_feedback: {
          triggering_event: 'A recent operator review showed the hook needed clearer authority.',
          prior_post_excerpt: 'A prior post about practical AI adoption.',
          success_examples: [
            {
              source_label: 'LinkedIn post about practical AI adoption',
              post_excerpt: 'A small business owner does not need another dashboard.',
              engagement_signal: 'Strong comments from operators.',
              why_it_worked: 'It opened with a concrete operating burden.',
            },
          ],
          engagement_signal: 'Strong comments from operators.',
          audience_context: 'Small business owners carrying operational load.',
          revision_request: 'Make the hook more concrete.',
          claim_boundaries: 'Do not mention private client data.',
          updated_at: '2026-05-28T04:30:00.000Z',
        },
      },
    }

    const response = await PUT(request({ rag_context: ragContext, unknown: 'ignored' }) as never, {
      params: { id: 'social-1' },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      item: { id: 'social-1', rag_context: { source: 'agent_ops_social_outreach_goal' } },
    })
    expect(mocks.from).toHaveBeenCalledWith('social_content_queue')
    expect(mocks.update).toHaveBeenCalledWith({ rag_context: ragContext })
    expect(mocks.eq).toHaveBeenCalledWith('id', 'social-1')
  })

  it('still rejects empty update payloads', async () => {
    const response = await PUT(request({ unknown: 'ignored' }) as never, {
      params: { id: 'social-1' },
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'No valid fields to update' })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('blocks copy approval when Context is not approved', async () => {
    mocks.single.mockResolvedValueOnce({
      data: { id: 'social-1', status: 'draft', rag_context: null },
      error: null,
    })

    const response = await PUT(request({ status: 'approved' }) as never, {
      params: { id: 'social-1' },
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual(expect.objectContaining({
      error: 'Social Content lifecycle prerequisite blocked.',
      lifecycle_step: 'copy',
      missing_prerequisite: 'context',
    }))
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('blocks prompt leakage when approving copy through the review gate', async () => {
    mocks.single.mockResolvedValueOnce({
      data: {
        id: 'social-1',
        status: 'draft',
        post_text: 'Clean draft before edit.',
        rag_context: {
          goal_id: 'goal-1',
          platform: 'linkedin',
          pass_to_human: true,
        },
      },
      error: null,
    })

    const response = await PUT(request({
      status: 'approved',
      post_text: 'User prompt: Rewrite as final social copy. Do not include this instruction.',
    }) as never, {
      params: { id: 'social-1' },
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual(expect.objectContaining({
      error: 'Final copy quality gate blocked prompt leakage before human approval.',
      current_gate: 'final_copy_quality',
      revision_state: 'revision_needed',
    }))
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('blocks leaked final copy from replacing an already approved item', async () => {
    mocks.single.mockResolvedValueOnce({
      data: {
        id: 'social-1',
        status: 'approved',
        post_text: 'Approved clean copy.',
        rag_context: {
          goal_id: 'goal-1',
          platform: 'linkedin',
          pass_to_human: true,
        },
      },
      error: null,
    })

    const response = await PUT(request({
      post_text: 'Captain QA block: tool output follows. externalRequests: []',
    }) as never, {
      params: { id: 'social-1' },
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual(expect.objectContaining({
      error: 'Final copy quality gate blocked prompt leakage before human approval.',
      current_gate: 'final_copy_quality',
      revision_state: 'revision_needed',
    }))
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('blocks section-gate visual approval when Context is not approved', async () => {
    mocks.single.mockResolvedValueOnce({
      data: { id: 'social-1', status: 'draft', rag_context: {} },
      error: null,
    })

    const response = await PUT(request({
      rag_context: {
        section_gate_reviews: {
          visual_assets: { status: 'approved' },
        },
      },
    }) as never, {
      params: { id: 'social-1' },
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual(expect.objectContaining({
      error: 'Social Content lifecycle prerequisite blocked.',
      lifecycle_step: 'visuals',
      missing_prerequisite: 'context',
    }))
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('allows copy approval after Context evidence is present', async () => {
    const currentItem = {
      id: 'social-1',
      status: 'draft',
      rag_context: {
        goal_id: 'goal-1',
        platform: 'linkedin',
        pass_to_human: true,
      },
    }
    const updatedItem = { ...currentItem, status: 'approved', reviewed_by: 'admin-1' }
    mocks.single
      .mockResolvedValueOnce({ data: currentItem, error: null })
      .mockResolvedValueOnce({ data: updatedItem, error: null })

    const response = await PUT(request({ status: 'approved' }) as never, {
      params: { id: 'social-1' },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ item: updatedItem })
    expect(mocks.update).toHaveBeenCalledWith({
      status: 'approved',
      reviewed_by: 'admin-1',
    })
  })

  it('returns 404 when a gated update cannot load the current item', async () => {
    mocks.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })

    const response = await PUT(request({ status: 'approved' }) as never, {
      params: { id: 'social-1' },
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Content not found' })
    expect(mocks.update).not.toHaveBeenCalled()
  })
})


describe('calendar copy revision producer and manual consumer', () => {
  const seed = { id: 'social-1', status: 'draft', post_text: 'A concrete first draft.', updated_at: '2026-09-06T12:00:00.000Z', rag_context: { source: 'social_content_calendar_authorization', pass_to_human: true, goal_id: 'fixture-goal' } }
  function repository() {
    let row: Record<string, unknown> = structuredClone(seed)
    let failWrite = false
    let raceWrite = false
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.from.mockImplementation(() => {
      let patch: Record<string, unknown> | undefined
      const filters: Array<[string, unknown]> = []
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters.push([key, value]); return query },
        update: (value: Record<string, unknown>) => { patch = value; return query },
        single: async () => {
          if (!patch) return { data: structuredClone(row), error: null }
          if (failWrite) return { data: null, error: { message: 'mock write failed' } }
          if (raceWrite) row = { ...row, updated_at: '2026-09-06T20:00:00.000Z' }
          if (filters.some(([key, value]) => row[key] !== value)) return { data: null, error: { code: 'PGRST116' } }
          row = { ...row, ...patch }
          return { data: structuredClone(row), error: null }
        },
      }
      return query
    })
    return {
      reload: () => withSocialCopyRevision(structuredClone(row) as typeof seed),
      fail: () => { failWrite = true },
      race: () => { raceWrite = true },
    }
  }
  const put = (body: unknown) => PUT(request(body), { params: { id: 'social-1' } })

  it('persists optional feedback, reloads blocked, dedupes rejection and returns a new manual review version', async () => {
    const repo = repository()
    const version = socialCopyVersion(seed)
    const rejection = { status: 'rejected', expected_copy_version: version, rag_context: { content_calibration: { operator_feedback: { revision_request: 'Name the concrete handoff.' } } } }
    expect((await put(rejection)).status).toBe(200)
    const received = repo.reload()
    expect(received).toMatchObject({ status: 'rejected', copy_revision: { state: 'blocked', worker: 'not_configured', feedback: 'Name the concrete handoff.' } })
    expect((await put(rejection)).status).toBe(200)
    expect(repo.reload().rag_context).toEqual(received.rag_context)
    const response = await put({ status: 'draft', post_text: 'At the meeting, the owner recorded the next handoff.', expected_copy_version: version })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ item: { status: 'draft', copy_revision: { state: 'ready', worker: 'not_configured' } } })
    expect(repo.reload()).toMatchObject({ copy_revision: { state: 'ready' } })
    expect((await put({ status: 'rejected', expected_copy_version: version })).status).toBe(409)
  })

  it('keeps the persisted rejection blocked after a failed revision save', async () => {
    const repo = repository()
    await put({ status: 'rejected', expected_copy_version: socialCopyVersion(seed) })
    repo.fail()
    expect((await put({ status: 'draft', post_text: 'A changed version that cannot be saved.', expected_copy_version: socialCopyVersion(seed) })).status).toBe(500)
    expect(repo.reload()).toMatchObject({ post_text: seed.post_text, copy_revision: { state: 'blocked' } })
  })

  it('rejects concurrent overwrite of the current row instead of claiming the revision was saved', async () => {
    const repo = repository()
    await put({ status: 'rejected', expected_copy_version: socialCopyVersion(seed) })
    repo.race()
    expect((await put({ status: 'draft', post_text: 'A racing revision.', expected_copy_version: socialCopyVersion(seed) })).status).toBe(409)
    expect(repo.reload()).toMatchObject({ post_text: seed.post_text, status: 'rejected' })
  })
})
