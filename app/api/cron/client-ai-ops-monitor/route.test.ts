import { beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('client AI Ops monitor cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.N8N_INGEST_SECRET = 'n8n-secret'
    process.env.CRON_SECRET = 'cron-secret'
    mocks.from.mockReturnValue(roadmapQuery([]))
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
})
