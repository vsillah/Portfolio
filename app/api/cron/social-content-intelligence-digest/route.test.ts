import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildSocialContentDailyDigest: vi.fn(),
  createAgentWorkItem: vi.fn(),
}))

vi.mock('@/lib/social-content-daily-digest', () => ({
  buildSocialContentDailyDigest: mocks.buildSocialContentDailyDigest,
}))

vi.mock('@/lib/agent-work-items', () => ({
  createAgentWorkItem: mocks.createAgentWorkItem,
}))

import { GET, POST } from './route'

const digest = {
  generated_at: '2026-06-23T12:00:00.000Z',
  lookback_days: 5,
  retrieval_window_start: '2026-06-18T12:00:00.000Z',
  summary: {
    new_research_packets: 2,
    usable_patterns: 1,
    shaka_insights: 3,
    blocked_or_sensitive_items: 1,
  },
  strongest_patterns: [
    {
      packet_id: 'packet-1',
      title: 'Outlier approval gate video',
      source_url: 'https://youtube.com/watch?v=abc',
      platform: 'youtube',
      creator: 'Creator',
      outlier_score: 91,
      pattern_status: 'usable_framework',
      hook_structure: 'Open with the missed approval gate.',
      promise_value: 'Show where trust gets built.',
      thumbnail_pattern: 'High contrast proof frame.',
    },
  ],
  recommended_insights: [
    {
      work_item_id: 'work-1',
      title: 'Approval gates create trust',
      status: 'proposed',
      priority: 'high',
      triggering_event: 'A shipped review gate changed the work.',
      why_vambah_can_speak: 'Vambah built the system.',
      audience: 'operators',
      sensitivity: 'needs_review',
    },
  ],
  suggested_channel_lanes: [
    {
      work_item_id: 'work-1',
      insight_title: 'Approval gates create trust',
      channel: 'linkedin',
      label: 'LinkedIn',
      status: 'not_started',
      required_inputs: ['post text'],
    },
  ],
  thumbnail_opportunities: [],
  blocked_or_sensitive_items: [
    {
      type: 'shaka_insight',
      id: 'work-1',
      title: 'Approval gates create trust',
      reason: 'needs_review',
    },
  ],
  governance: {
    schedule_activation: 'approval_required',
    apify_collection: 'approval_required',
    drafting: 'approval_required',
    media_generation: 'approval_required',
    uploads: 'approval_required',
    publishing: 'approval_required',
  },
  side_effects: {
    provider_generation: false,
    upload: false,
    publish: false,
    schedule: false,
    external_post: false,
    apify_run: false,
  },
}

function getRequest(url = 'http://localhost/api/cron/social-content-intelligence-digest') {
  return new Request(url, {
    headers: { authorization: 'Bearer cron-secret' },
  })
}

function postRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/cron/social-content-intelligence-digest', {
    method: 'POST',
    headers: { authorization: 'Bearer cron-secret', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/cron/social-content-intelligence-digest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-23T12:30:00.000Z'))
    process.env.CRON_SECRET = 'cron-secret'
    delete process.env.N8N_INGEST_SECRET
    delete process.env.SOCIAL_CONTENT_INTELLIGENCE_DAILY_DIGEST_ENABLED
    mocks.buildSocialContentDailyDigest.mockResolvedValue(digest)
    mocks.createAgentWorkItem.mockResolvedValue({
      id: 'work-digest-review',
      title: 'Review Social Content Intelligence daily digest (2026-06-23)',
      status: 'queued',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requires cron auth before building the digest', async () => {
    const response = await GET(new Request('http://localhost/api/cron/social-content-intelligence-digest') as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.buildSocialContentDailyDigest).not.toHaveBeenCalled()
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
  })

  it('builds a disabled-by-default digest without creating a work item', async () => {
    const response = await GET(getRequest('http://localhost/api/cron/social-content-intelligence-digest?lookback_days=7&limit=10') as never)

    expect(response.status).toBe(200)
    expect(mocks.buildSocialContentDailyDigest).toHaveBeenCalledWith({
      lookbackDays: 7,
      limit: 10,
    })
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
    expect(await response.json()).toMatchObject({
      ok: true,
      activation: {
        enabled: false,
        manual_confirmed: false,
        executed: false,
        manual_confirmation: 'run_social_intelligence_daily_digest',
      },
      work_item: null,
      side_effects: {
        internal_work_item_created: false,
        apify_run: false,
        provider_generation: false,
        upload: false,
        schedule: false,
        publish: false,
        external_post: false,
      },
    })
  })

  it('creates an internal Shaka review work item only with manual confirmation', async () => {
    const response = await POST(postRequest({
      confirmation: 'run_social_intelligence_daily_digest',
      lookback_days: 5,
    }) as never)

    expect(response.status).toBe(200)
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Review Social Content Intelligence daily digest (2026-06-23)',
      priority: 'high',
      status: 'queued',
      ownerAgentKey: 'chief-of-staff',
      ownerRuntime: 'codex',
      source: {
        type: 'social_intelligence_daily_digest',
        id: '2026-06-23',
        label: 'Social Content Intelligence daily digest',
      },
      metadata: expect.objectContaining({
        digest,
        trigger_source: 'manual_social_content_intelligence_digest',
        side_effects: {
          internal_work_item_created: true,
          apify_run: false,
          provider_generation: false,
          upload: false,
          schedule: false,
          publish: false,
          external_post: false,
        },
      }),
      idempotencyKey: 'social-intelligence-daily-digest:2026-06-23:5',
    }))
    expect(await response.json()).toMatchObject({
      ok: true,
      activation: {
        enabled: false,
        manual_confirmed: true,
        executed: true,
      },
      work_item: { id: 'work-digest-review' },
      side_effects: {
        internal_work_item_created: true,
        apify_run: false,
        provider_generation: false,
        upload: false,
        schedule: false,
        publish: false,
        external_post: false,
      },
    })
  })
})
