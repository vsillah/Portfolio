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

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/social-content/social-1', {
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
      item: { updated_at: '2026-09-08T12:00:00.000Z', id: 'social-1', rag_context: { source: 'agent_ops_social_outreach_goal' } },
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

type QueryCall = {
  table: string
  mode: 'single' | 'maybe' | 'list'
  filters: Array<[string, unknown]>
  orders: Array<[string, boolean | undefined]>
  limit: number | null
}

function getRequest() {
  return new NextRequest('http://localhost/api/admin/social-content/social-9')
}

describe('GET /api/admin/social-content/[id]', () => {
  const calls: QueryCall[] = []
  const tables: Record<string, { data: unknown; error: { message: string } | null }> = {}

  function resetTables() {
    calls.length = 0
    for (const key of Object.keys(tables)) delete tables[key]
    tables.social_content_queue = { data: null, error: { message: 'missing' } }
    tables.meeting_records = { data: null, error: null }
    tables.social_content_publishes = { data: null, error: null }
    tables.agent_work_items = { data: [], error: null }
    tables.heygen_config = { data: [], error: null }
    tables.video_generation_jobs = { data: null, error: null }
  }

  function query(table: string) {
    const filters: Array<[string, unknown]> = []
    const orders: Array<[string, boolean | undefined]> = []
    let limit: number | null = null
    const result = () => {
      if (table !== 'heygen_config') return tables[table] ?? { data: null, error: null }
      if (filters.some(([key, value]) => key === 'is_default' && value === true)) {
        return { data: tables.heygen_defaults?.data ?? [], error: null }
      }
      if (filters.some(([key, value]) => key === 'asset_type' && value === 'avatar')) {
        return { data: tables.heygen_avatars?.data ?? [], error: null }
      }
      if (filters.some(([key, value]) => key === 'asset_type' && value === 'voice')) {
        return { data: tables.heygen_voices?.data ?? [], error: null }
      }
      return { data: [], error: null }
    }
    const record = (mode: QueryCall['mode']) => {
      calls.push({ table, mode, filters: [...filters], orders: [...orders], limit })
      return result()
    }
    const chain = {
      select: () => chain,
      eq: (key: string, value: unknown) => {
        filters.push([key, value])
        return chain
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        orders.push([column, options?.ascending])
        return chain
      },
      limit: (value: number) => {
        limit = value
        return chain
      },
      range: () => chain,
      single: () => Promise.resolve(record('single')),
      maybeSingle: () => Promise.resolve(record('maybe')),
      then: (
        onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(record('list')).then(onFulfilled, onRejected),
    }
    return chain
  }

  function load(id = ' social-9 ') {
    return GET(getRequest(), { params: { id } })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    resetTables()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.from.mockImplementation((table: string) => query(table))
  })

  it('rejects a non-admin before reading the content row', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await load()

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns content not found and does not fan out when the row is missing or empty', async () => {
    const missing = await load('missing-id')
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'Content not found' })

    tables.social_content_queue = { data: null, error: null }
    const empty = await load('missing-id')
    expect(empty.status).toBe(404)
    expect(await empty.json()).toEqual({ error: 'Content not found' })
    expect(calls.map((call) => [call.table, call.filters])).toEqual([
      ['social_content_queue', [['id', 'missing-id']]],
      ['social_content_queue', [['id', 'missing-id']]],
    ])
  })

  it('projects the structured meeting title, decoded source, publishes, recovery, and HeyGen job', async () => {
    tables.social_content_queue = {
      data: {
        id: ' social-9 ',
        meeting_record_id: 'meet-1',
        platform: 'youtube',
        status: 'approved',
        video_url: 'https://cdn.example/stored.mp4',
        image_url: 'https://cdn.example/thumb.jpg',
        rag_context: {
          social_video_production: {
            version: 'social_video_production_v1',
            video_generation_job_id: ' job-7 ',
            selected_avatar_id: 'stored-avatar',
            selected_voice_id: 'stored-voice',
          },
        },
      },
      error: null,
    }
    tables.meeting_records = {
      data: {
        id: 'meet-1',
        raw_notes: '<https://app.read.ai/analytics/abc?x=1&amp;y=2|Slack Title >',
        structured_notes: { title: '  Board Review  ' },
      },
      error: null,
    }
    tables.social_content_publishes = {
      data: [{ id: 'pub-1', status: 'scheduled' }],
      error: null,
    }
    tables.agent_work_items = {
      data: [{
        id: 'work-1',
        status: 'proposed',
        owner_agent_key: null,
        active_run_id: null,
        source_type: 'social_content_scheduled_publish_recovery',
        source_id: ' social-9 ',
        blocker_summary: 'summary fallback',
        metadata: {
          recovery_kind: 'stale_schedule',
          recovery_action: 'reschedule_reconfirm_or_cancel',
          blocker: 'Window closed',
          scheduled_for: '2026-09-01T00:00:00.000Z',
        },
        created_at: '2026-09-01T00:00:00.000Z',
        updated_at: '2026-09-01T00:00:00.000Z',
        completed_at: null,
      }],
      error: null,
    }
    tables.heygen_defaults = {
      data: [
        { asset_type: 'avatar', asset_id: 'default-avatar' },
        { asset_type: 'voice', asset_id: 'default-voice' },
      ],
      error: null,
    }
    tables.video_generation_jobs = {
      data: {
        id: ' job-1 ',
        heygen_video_id: '   ',
        heygen_status: ' processing ',
        video_url: '',
        video_share_url: ' https://share.example/v ',
        thumbnail_url: '  ',
        avatar_id: ' job-avatar ',
        voice_id: ' job-voice ',
        broll_asset_ids: [' clip-1 ', ' ', 4, 'clip-2'],
        created_at: '2026-09-02T00:00:00.000Z',
        updated_at: '2026-09-02T00:00:00.000Z',
      },
      error: null,
    }

    const response = await load()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.item).toMatchObject({
      id: ' social-9 ',
      meeting_record: {
        id: 'meet-1',
        meeting_title: 'Board Review',
        source_url: 'https://app.read.ai/analytics/abc?x=1&y=2',
      },
      publishes: [{ id: 'pub-1', status: 'scheduled' }],
      schedule_recovery: {
        state: 'action_required',
        work_item_id: 'work-1',
        owner: 'Unassigned',
        stale_reason: 'Window closed',
        prior_scheduled_for: '2026-09-01T00:00:00.000Z',
        automatic_publication_blocked: true,
      },
      social_video_production: {
        status: 'processing',
        selectedAvatarId: 'job-avatar',
        selectedVoiceId: 'job-voice',
        selectedAvatarSource: 'job',
        selectedVoiceSource: 'job',
        finalVideoUrl: 'https://cdn.example/stored.mp4',
        thumbnailUrl: 'https://cdn.example/thumb.jpg',
        job: {
          id: 'job-1',
          heygenVideoId: null,
          heygenStatus: 'processing',
          videoUrl: null,
          videoShareUrl: 'https://share.example/v',
          thumbnailUrl: null,
          avatarId: 'job-avatar',
          voiceId: 'job-voice',
          brollAssetIds: [' clip-1 ', 'clip-2'],
        },
      },
    })
    expect(body.item.copy_revision).toBeUndefined()
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'social_content_queue',
        mode: 'single',
        filters: [['id', ' social-9 ']],
      }),
      expect.objectContaining({
        table: 'meeting_records',
        mode: 'single',
        filters: [['id', 'meet-1']],
      }),
      expect.objectContaining({
        table: 'social_content_publishes',
        mode: 'list',
        filters: [['content_id', ' social-9 ']],
        orders: [['created_at', true]],
      }),
      expect.objectContaining({
        table: 'agent_work_items',
        mode: 'list',
        filters: [
          ['source_type', 'social_content_scheduled_publish_recovery'],
          ['source_id', ' social-9 '],
        ],
        limit: 10,
      }),
      expect.objectContaining({
        table: 'video_generation_jobs',
        mode: 'maybe',
        filters: [['id', 'job-7']],
      }),
    ]))
  })

  it('uses the Slack title only when the structured title is empty and skips a missing meeting link', async () => {
    tables.social_content_queue = {
      data: {
        id: 'social-slack',
        meeting_record_id: 'meet-2',
        platform: 'linkedin',
        status: 'draft',
        rag_context: {},
      },
      error: null,
    }
    tables.meeting_records = {
      data: {
        id: 'meet-2',
        raw_notes: '<https://app.read.ai/analytics/slack| Slack Only Title >',
        structured_notes: { title: '' },
      },
      error: null,
    }

    const titled = await load('social-slack')
    expect((await titled.json()).item.meeting_record).toMatchObject({
      meeting_title: 'Slack Only Title',
      source_url: 'https://app.read.ai/analytics/slack',
    })

    tables.meeting_records = {
      data: {
        id: 'meet-2',
        raw_notes: '<https://app.read.ai/analytics/slack| Slack Only Title >',
        structured_notes: { title: '   ' },
      },
      error: null,
    }
    const whitespaceTitle = await load('social-slack')
    expect((await whitespaceTitle.json()).item.meeting_record.meeting_title).toBe('')

    tables.meeting_records = { data: null, error: { message: 'missing meeting' } }
    const missingMeeting = await load('social-slack')
    expect((await missingMeeting.json()).item.meeting_record).toBeNull()

    tables.social_content_queue = {
      data: { id: 'social-none', meeting_record_id: null, platform: 'linkedin', status: 'draft', rag_context: {} },
      error: null,
    }
    calls.length = 0
    const unlinked = await load('social-none')
    expect((await unlinked.json()).item.meeting_record).toBeNull()
    expect(calls.map((call) => call.table)).not.toContain('meeting_records')
  })

  it('returns an empty publish list, blocks duplicate recovery, and ignores a stale video version', async () => {
    tables.social_content_queue = {
      data: {
        id: 'social-dup',
        meeting_record_id: null,
        platform: 'youtube',
        status: 'approved',
        rag_context: {
          social_video_production: {
            version: 'social_video_production_v0',
            video_generation_job_id: 'job-should-not-load',
          },
        },
      },
      error: null,
    }
    tables.social_content_publishes = { data: null, error: null }
    const recovery = {
      status: 'proposed',
      owner_agent_key: 'captain',
      active_run_id: null,
      source_type: 'social_content_scheduled_publish_recovery',
      source_id: 'social-dup',
      blocker_summary: null,
      metadata: {
        recovery_kind: 'stale_schedule',
        recovery_action: 'reschedule_reconfirm_or_cancel',
      },
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z',
      completed_at: null,
    }
    tables.agent_work_items = {
      data: [
        { ...recovery, id: 'work-a' },
        { ...recovery, id: 'work-b' },
      ],
      error: null,
    }

    const response = await load('social-dup')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.item.publishes).toEqual([])
    expect(body.item.schedule_recovery).toMatchObject({
      state: 'blocked',
      work_item_id: null,
      owner: 'Integration Captain',
      automatic_publication_blocked: true,
    })
    expect(calls.map((call) => call.table)).not.toContain('video_generation_jobs')
  })

  it('ignores terminal or foreign recovery rows and only lets favorite assets fill a missing job', async () => {
    vi.stubEnv('HEYGEN_AVATAR_ID', '')
    vi.stubEnv('HEYGEN_VOICE_ID', '')
    tables.social_content_queue = {
      data: {
        id: 'social-fav',
        meeting_record_id: null,
        platform: 'linkedin',
        status: 'draft',
        rag_context: {},
      },
      error: null,
    }
    tables.agent_work_items = {
      data: [
        {
          id: 'work-done',
          status: 'merged',
          owner_agent_key: 'captain',
          active_run_id: null,
          source_type: 'social_content_scheduled_publish_recovery',
          source_id: 'social-fav',
          blocker_summary: 'done',
          metadata: {
            recovery_kind: 'stale_schedule',
            recovery_action: 'reschedule_reconfirm_or_cancel',
          },
          created_at: '2026-09-01T00:00:00.000Z',
          updated_at: '2026-09-01T00:00:00.000Z',
          completed_at: '2026-09-02T00:00:00.000Z',
        },
        {
          id: 'work-other',
          status: 'proposed',
          owner_agent_key: 'captain',
          active_run_id: null,
          source_type: 'social_content_scheduled_publish_recovery',
          source_id: 'someone-else',
          blocker_summary: 'other item',
          metadata: {
            recovery_kind: 'stale_schedule',
            recovery_action: 'reschedule_reconfirm_or_cancel',
          },
          created_at: '2026-09-01T00:00:00.000Z',
          updated_at: '2026-09-01T00:00:00.000Z',
          completed_at: null,
        },
      ],
      error: null,
    }
    tables.heygen_avatars = {
      data: [
        { asset_id: 'ignored-avatar', is_favorite: false },
        { asset_id: '   ', is_favorite: true },
        { asset_id: '  fav-avatar  ', is_favorite: true },
      ],
      error: null,
    }
    tables.heygen_voices = {
      data: [
        { asset_id: 'ignored-voice', is_favorite: false },
        { asset_id: 'fav-voice', is_favorite: true },
      ],
      error: null,
    }

    try {
      const response = await load('social-fav')
      const body = await response.json()

      expect(body.item.schedule_recovery).toBeNull()
      expect(body.item.social_video_production).toMatchObject({
        status: 'blocked',
        selectedAvatarId: '  fav-avatar  ',
        selectedAvatarSource: 'favorite_pool',
        selectedVoiceId: 'fav-voice',
        selectedVoiceSource: 'favorite',
        job: null,
      })
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('hides a recovery read failure instead of returning the database message', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    tables.social_content_queue = {
      data: { id: 'social-err', meeting_record_id: null, rag_context: {} },
      error: null,
    }
    tables.agent_work_items = { data: null, error: { message: 'permission denied for agent_work_items' } }

    try {
      const response = await load('social-err')

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Internal server error' })
    } finally {
      consoleError.mockRestore()
    }
  })
})
