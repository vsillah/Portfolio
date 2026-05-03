import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  refreshRoadmapPhaseRollups: vi.fn(),
  projectRoadmapTaskToMeetingTask: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/client-ai-ops-roadmap-db', () => ({
  refreshRoadmapPhaseRollups: mocks.refreshRoadmapPhaseRollups,
  projectRoadmapTaskToMeetingTask: mocks.projectRoadmapTaskToMeetingTask,
}))

import { GET, POST } from './route'

function request(method: 'GET' | 'POST', token?: string) {
  return new Request('http://localhost/api/cron/client-ai-ops-monitor', {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

function roadmapQuery(data: unknown[]) {
  return {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockResolvedValue({ data, error: null }),
  }
}

function supabaseQueryResult(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'in', 'not', 'order', 'limit', 'insert']) {
    query[method] = vi.fn().mockReturnValue(query)
  }
  query.single = vi.fn().mockResolvedValue(result)
  query.maybeSingle = vi.fn().mockResolvedValue(result)
  query.then = (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return query as {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    not: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    then: Promise<typeof result>['then']
  }
}

function mockTableResponses(responses: Record<string, unknown[]>) {
  mocks.from.mockImplementation((table: string) => {
    const response = responses[table]?.shift()
    if (!response) throw new Error(`Unexpected table query: ${table}`)
    return response
  })
}

describe('client AI Ops monitor cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.N8N_INGEST_SECRET = 'n8n-secret'
    process.env.CRON_SECRET = 'cron-secret'
    mocks.from.mockReturnValue(roadmapQuery([]))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects requests without an accepted cron token', async () => {
    const response = await POST(request('POST', 'wrong') as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('accepts Vercel cron GET requests authenticated with CRON_SECRET', async () => {
    const response = await GET(request('GET', 'cron-secret') as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      checked: 0,
      reports_created: 0,
      followup_tasks_created: 0,
    })
    expect(mocks.from).toHaveBeenCalledWith('client_ai_ops_roadmaps')
  })

  it('keeps the n8n POST trigger path working', async () => {
    const response = await POST(request('POST', 'n8n-secret') as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, checked: 0 })
  })

  it('creates a monitoring report and follow-up task when roadmap data needs review', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-02T10:00:00Z'))

    const reportInsert = supabaseQueryResult({ data: { id: 'report-1' }, error: null })
    const followupInsert = supabaseQueryResult({ data: { id: 'followup-task-1', title: 'Review AI Ops monitoring findings' }, error: null })

    mockTableResponses({
      client_ai_ops_roadmaps: [
        roadmapQuery([
          {
            id: 'roadmap-1',
            client_project_id: 'project-1',
            title: 'Acme AI Ops',
            status: 'active',
          },
        ]),
      ],
      client_ai_ops_roadmap_tasks: [
        supabaseQueryResult({
          data: [
            { id: 'task-overdue', title: 'Finish client vault', status: 'pending', due_date: '2026-04-30T00:00:00Z' },
            { id: 'task-done', title: 'Completed task', status: 'complete', due_date: '2026-04-01T00:00:00Z' },
          ],
          error: null,
        }),
        supabaseQueryResult({ data: null, error: null }),
        followupInsert,
      ],
      client_ai_ops_roadmap_cost_items: [
        supabaseQueryResult({
          data: [{ id: 'cost-stale', pricing_state: 'stale', last_checked_at: null, label: 'Network switch' }],
          error: null,
        }),
      ],
      client_ai_ops_roadmap_reports: [
        supabaseQueryResult({ data: [], error: null }),
        reportInsert,
      ],
      client_ai_ops_roadmap_phases: [
        supabaseQueryResult({ data: { id: 'phase-1' }, error: null }),
      ],
    })

    const response = await POST(request('POST', 'cron-secret') as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      checked: 1,
      reports_created: 1,
      followup_tasks_created: 1,
    })
    expect(mocks.refreshRoadmapPhaseRollups).toHaveBeenCalledWith('roadmap-1')
    expect(reportInsert.insert).toHaveBeenCalledWith(expect.objectContaining({
      roadmap_id: 'roadmap-1',
      client_project_id: 'project-1',
      report_type: 'monitoring_summary',
      amadutown_actions: [
        'Review overdue roadmap task: Finish client vault',
        'Refresh pricing/source for: Network switch',
        'Generate monthly AI Ops report',
      ],
      monitoring_summary: {
        overdue_tasks: 1,
        stale_cost_items: 1,
        report_missing: true,
        checked_at: '2026-05-02T10:00:00.000Z',
      },
    }))
    expect(followupInsert.insert).toHaveBeenCalledWith(expect.objectContaining({
      roadmap_id: 'roadmap-1',
      phase_id: 'phase-1',
      task_key: 'monitoring-followup-2026-05-02',
      meeting_task_visible: true,
      metadata: {
        monitoring_summary: {
          overdue_tasks: 1,
          stale_cost_items: 1,
          report_missing: true,
          checked_at: '2026-05-02T10:00:00.000Z',
        },
      },
    }))
    expect(mocks.projectRoadmapTaskToMeetingTask).toHaveBeenCalledWith('project-1', expect.objectContaining({ id: 'followup-task-1' }))
  })

  it('reuses an existing daily follow-up instead of inserting a duplicate task', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-02T10:00:00Z'))

    mockTableResponses({
      client_ai_ops_roadmaps: [
        roadmapQuery([
          {
            id: 'roadmap-1',
            client_project_id: 'project-1',
            title: 'Acme AI Ops',
            status: 'active',
          },
        ]),
      ],
      client_ai_ops_roadmap_tasks: [
        supabaseQueryResult({ data: [], error: null }),
        supabaseQueryResult({ data: { id: 'existing-followup' }, error: null }),
      ],
      client_ai_ops_roadmap_cost_items: [
        supabaseQueryResult({ data: [], error: null }),
      ],
      client_ai_ops_roadmap_reports: [
        supabaseQueryResult({ data: [], error: null }),
        supabaseQueryResult({ data: { id: 'report-1' }, error: null }),
      ],
    })

    const response = await POST(request('POST', 'cron-secret') as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ reports_created: 1, followup_tasks_created: 0 })
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain('client_ai_ops_roadmap_phases')
    expect(mocks.projectRoadmapTaskToMeetingTask).toHaveBeenCalledWith('project-1', expect.objectContaining({
      id: 'existing-followup',
      title: 'Review AI Ops monitoring findings',
      status: 'pending',
      owner_type: 'amadutown',
      priority: 'high',
      meeting_task_visible: true,
    }))
  })
})
