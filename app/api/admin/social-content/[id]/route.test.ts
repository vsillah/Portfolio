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

import { GET, PUT } from './route'
import { socialCopyVersion, withSocialCopyRevision } from '@/lib/social-copy-revision'
import {
  CHANNEL_EXPERIMENT_LINKEDIN_RECORD_IDS,
  CHANNEL_EXPERIMENT_YOUTUBE_RECORD_IDS,
} from '@/lib/channel-experiment-review'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/social-content/social-1', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function fixtureRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/social-content/deterministic-visual-binding-qa', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/admin/social-content/[id] practitioner QA fixture', () => {
  it('selects a bounded script-size state without reading shared data', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/practitioner-content-quality-qa', {
      headers: { 'x-portfolio-qa-script-size': 'over-cap' },
    }) as never, { params: { id: 'practitioner-content-quality-qa' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ fixture: true, fixture_state: 'ready', fixture_script_size: 'over-cap' })
    expect(body.item.post_text.split('\n\n')).toHaveLength(32)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('defaults unknown script-size input to the content-complete practitioner post', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/practitioner-content-quality-qa', {
      headers: { 'x-portfolio-qa-script-size': 'unbounded' },
    }) as never, { params: { id: 'practitioner-content-quality-qa' } })
    const body = await response.json()

    expect(body.fixture_script_size).toBe('complete')
    expect(body.item.post_text.length).toBeGreaterThanOrEqual(1800)
  })
})

describe('GET /api/admin/social-content/[id] channel experiment review fixture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it.each(CHANNEL_EXPERIMENT_YOUTUBE_RECORD_IDS)('returns %s without reading or mutating shared Social Content data', async (id) => {
    const response = await GET(new NextRequest(`http://localhost/api/admin/social-content/${id}?qa_fixture=channel_experiment_social_detail_v1`) as never, { params: { id } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ fixture: true, fixture_state: 'review_only_youtube_experiment' })
    expect(body.item).toMatchObject({ id, platform: 'youtube', target_platforms: ['youtube'] })
    expect(body.item.rag_context.qa_fixture).toMatchObject({ read_only: true, kind: 'channel_experiment_social_detail_review' })
    expect(body.item.rag_context.channel_experiment_review).toEqual(expect.objectContaining({
      title: expect.any(String),
      description: expect.any(String),
      opening_hook: expect.any(String),
      outline: expect.any(Array),
      thumbnail_brief: expect.any(String),
      evidence_lineage: expect.any(Array),
      product_proof_requirements: expect.any(Array),
      scores: expect.arrayContaining([expect.objectContaining({ label: 'Variant performance', value: null })]),
    }))
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it.each(CHANNEL_EXPERIMENT_LINKEDIN_RECORD_IDS)('returns ordinary LinkedIn control %s without reading or mutating shared data', async (id) => {
    const response = await GET(new NextRequest(`http://localhost/api/admin/social-content/${id}?qa_fixture=channel_experiment_social_detail_v1`) as never, { params: { id } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ fixture: true, fixture_state: 'review_only_linkedin_control' })
    expect(body.item).toMatchObject({ id, platform: 'linkedin', target_platforms: ['linkedin'] })
    expect(body.item.rag_context.qa_fixture).toMatchObject({ read_only: true, kind: 'channel_experiment_linkedin_control' })
    expect(body.item.rag_context.channel_experiment_review).toBeUndefined()
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })
})

describe('GET /api/admin/social-content/[id] stage review QA projection', () => {
  it('projects the missing asset-packet decision without reading or writing shared data', async () => {
    const id = '9817a689-0565-48ed-8c97-c2db40c1ec45'
    const response = await GET(new NextRequest(
      `http://localhost/api/admin/social-content/${id}?qa_fixture=social_campaign_review_assets_v1&stage_review_state=asset_packet`,
    ) as never, { params: { id } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ fixture: true, fixture_state: 'asset_packet_review_missing' })
    expect(body.item).toMatchObject({ id, status: 'approved' })
    expect(body.item.rag_context).toMatchObject({
      current_gate: 'asset_packet',
      latest_internal_decision_receipt_id: 'qa-copy-decision-receipt',
      qa_fixture: { read_only: true },
    })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })
})

describe('GET /api/admin/social-content/[id] channel-native video fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.single.mockResolvedValue({ data: null, error: { message: 'not found' } })
    mocks.select.mockReturnValue({ eq: mocks.eq })
    mocks.eq.mockReturnValue({ single: mocks.single })
    mocks.from.mockReturnValue({ select: mocks.select })
  })

  it.each([
    ['f966123f-05eb-48ec-a7c2-970afce642ef', 'jev-provider-none-review.mp4'],
    ['21c492c2-9279-4e08-afc9-49207935a681', 'dark-castle-provider-none-review.mp4'],
  ])('returns the read-only repository packet when %s is absent from the bound preview database', async (id, videoName) => {
    const response = await GET(new NextRequest(`http://localhost/api/admin/social-content/${id}`) as never, { params: { id } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ fixture: true, fixture_state: 'repository_bound_review' })
    expect(body.item.id).toBe(id)
    expect(body.item.rag_context.approved_video_packet.video_path).toContain(videoName)
    expect(body.item.rag_context.approved_video_packet.provider).toBe('none')
    expect(body.item.rag_context.qa_fixture).toMatchObject({ read_only: true, kind: 'channel_native_video_review' })
    expect(body.item.rag_context.side_effects).toEqual(expect.objectContaining({
      provider_generation: false,
      upload: false,
      platform_draft: false,
      schedule: false,
      publish: false,
      external_send: false,
    }))
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('binds Jev to the motion-graphics v2 receipt while leaving external execution closed', async () => {
    const id = 'f966123f-05eb-48ec-a7c2-970afce642ef'
    const response = await GET(new NextRequest(`http://localhost/api/admin/social-content/${id}`) as never, { params: { id } })
    const body = await response.json()
    const video = body.item.rag_context.approved_video_packet

    expect(video).toMatchObject({
      video_sha256: '191d1d99c00688aba025c13bfbace887c647e36cc67e47dcbaaa0902614ca92e',
      poster_sha256: '7709869d1d3f6d219128d5f47d0e5c3701c39a5079c4cf9378d2f958cd124a97',
      render_version: 'social_video_adaptation_local_render_v2',
      motion_profile: 'jev_decision_flow_v2',
      duration_seconds: 22,
      width: 1080,
      height: 1920,
      provider: 'none',
    })
    expect(body.item.rag_context.side_effects).toEqual(expect.objectContaining({
      provider_generation: false,
      upload: false,
      platform_draft: false,
      schedule: false,
      publish: false,
      external_send: false,
      credential_change: false,
      spending: false,
    }))
  })

  it('uses the explicit read-only Jev QA binding even when the shared row exists', async () => {
    const id = 'f966123f-05eb-48ec-a7c2-970afce642ef'
    mocks.single.mockResolvedValue({ data: { id, rag_context: { source_type: 'stale-shared-row' } }, error: null })
    const response = await GET(new NextRequest(`http://localhost/api/admin/social-content/${id}?qa_fixture=channel_native_video_v2`) as never, { params: { id } })
    const body = await response.json()

    expect(body).toMatchObject({ fixture: true, fixture_state: 'repository_bound_review' })
    expect(body.item.rag_context.approved_video_packet).toMatchObject({
      video_sha256: '191d1d99c00688aba025c13bfbace887c647e36cc67e47dcbaaa0902614ca92e',
      render_version: 'social_video_adaptation_local_render_v2',
    })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('projects the explicit missing-rights blocker without touching shared data', async () => {
    const id = 'f966123f-05eb-48ec-a7c2-970afce642ef'
    const response = await GET(new NextRequest(`http://localhost/api/admin/social-content/${id}?qa_fixture=channel_native_video_v2&video_package_state=blocked`) as never, { params: { id } })
    const body = await response.json()

    expect(body.fixture_state).toBe('repository_bound_review_blocked')
    expect(body.item.rag_context.social_video_review_fixture_state).toBe('blocked')
    expect(body.item.rag_context.social_video_review_rights_receipt_ids).not.toContain('rights:music:the-stream-v2:20261014')
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })
})

describe('PUT /api/admin/social-content/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.single.mockResolvedValue({
      data: { updated_at: '2026-09-08T12:00:00.000Z', id: 'social-1', rag_context: { source: 'agent_ops_social_outreach_goal' } },
      error: null,
    })
    mocks.select.mockReturnValue({ eq: mocks.eq, single: mocks.single })
    mocks.eq.mockReturnValue({ eq: mocks.eq, select: mocks.select, single: mocks.single })
    mocks.update.mockReturnValue({ eq: mocks.eq })
    mocks.from.mockReturnValue({ update: mocks.update, select: mocks.select })
  })

  it.each([
    ['approved', null],
    ['rejected', 'Use a stronger decision label.'],
  ] as const)('simulates a non-persistent fixture visual decision without shared data for %s', async (status, note) => {
    const response = await PUT(fixtureRequest({
      rag_context: {
        section_gate_reviews: {
          visual_assets: {
            status,
            note,
            decided_at: '2026-10-11T12:05:00.000Z',
          },
        },
      },
      qa_visual_recipe: {
        template: 'constraint_decision_result',
        visual_type: 'architecture',
        aspect_ratio: '1.91:1',
      },
    }) as never, { params: { id: 'deterministic-visual-binding-qa' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ fixture: true, persisted: false })
    expect(body.item.rag_context.section_gate_reviews.visual_assets).toMatchObject({ status, note })
    expect(body.item.image_url).toContain('/qa/social-content/deterministic-visual-binding.png')
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('keeps unrelated fixture mutations fail closed', async () => {
    const response = await PUT(fixtureRequest({ rag_context: { arbitrary: true } }) as never, {
      params: { id: 'deterministic-visual-binding-qa' },
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ fixture: true, blocked: true })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('blocks non-calendar release metadata erasure before any update', async () => {
    mocks.single.mockResolvedValueOnce({data:{id:'social-1',updated_at:'2026-09-08T12:00:00.000Z',rag_context:{source:'manual',platform_submission_gate:{status:'submitting'}}},error:null})
    const response=await PUT(request({rag_context:{platform_submission_gate:null}}) as never,{params:{id:'social-1'}})
    expect(response.status).toBe(409)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('preserves non-calendar release authority and uses version CAS', async () => {
    const gate={status:'approved',approved_fingerprint:'server'}
    mocks.single.mockResolvedValueOnce({data:{id:'social-1',updated_at:'2026-09-08T12:00:00.000Z',rag_context:{source:'manual',platform_submission_gate:gate}},error:null})
    const response=await PUT(request({rag_context:{platform_submission_gate:{status:'approved',approved_fingerprint:'forged'}}}) as never,{params:{id:'social-1'}})
    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith({rag_context:{source:'manual',platform_submission_gate:gate}})
    expect(mocks.eq).toHaveBeenCalledWith('updated_at','2026-09-08T12:00:00.000Z')
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
      item: expect.objectContaining({
        updated_at: '2026-09-08T12:00:00.000Z',
        id: 'social-1',
        rag_context: { source: 'agent_ops_social_outreach_goal' },
        deterministic_visual_render: expect.objectContaining({ state: 'blocked' }),
      }),
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
      data: { updated_at: '2026-09-08T12:00:00.000Z', id: 'social-1', status: 'draft', rag_context: null },
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
        updated_at: '2026-09-08T12:00:00.000Z',
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
        updated_at: '2026-09-08T12:00:00.000Z',
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
      data: { updated_at: '2026-09-08T12:00:00.000Z', id: 'social-1', status: 'draft', rag_context: {} },
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
      updated_at: '2026-09-08T12:00:00.000Z',
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
    expect(await response.json()).toEqual({
      item: expect.objectContaining({
        ...updatedItem,
        deterministic_visual_render: expect.objectContaining({ state: 'blocked' }),
      }),
    })
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
