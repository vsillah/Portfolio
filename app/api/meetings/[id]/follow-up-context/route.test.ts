import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { GET } from './route'

function singleQuery<T>(result: { data: T; error: { message: string } | null }) {
  const single = vi.fn(async () => result)
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  return { select, eq, single }
}

function taskQuery<T>(result: { data: T; error: { message: string } | null }) {
  const eq = vi.fn(async () => result)
  const select = vi.fn(() => ({ eq }))
  return { select, eq }
}

describe('GET /api/meetings/[id]/follow-up-context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('returns meeting context with an explicit context-only handoff contract', async () => {
    const meetingQuery = singleQuery({
      data: {
        id: 'meeting-1',
        meeting_type: 'discovery',
        meeting_date: '2026-06-03T14:00:00.000Z',
        duration_minutes: 45,
        attendees: ['client@example.com'],
        next_meeting_type: 'implementation review',
        next_meeting_agenda: 'Confirm next workflow lane.',
        client_project_id: 'project-1',
        calendly_event_uri: null,
      },
      error: null,
    })
    const projectQuery = singleQuery({
      data: {
        id: 'project-1',
        client_name: 'Client Person',
        client_email: 'client@example.com',
        client_company: 'Client Co',
        project_name: 'Client AI Ops',
        slack_channel: '#client-ai-ops',
        project_status: 'active',
      },
      error: null,
    })
    const tasksQuery = taskQuery({
      data: [
        { status: 'pending' },
        { status: 'in_progress' },
        { status: 'complete' },
      ],
      error: null,
    })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'meeting_records') return { select: meetingQuery.select }
      if (table === 'client_projects') return { select: projectQuery.select }
      if (table === 'meeting_action_tasks') return { select: tasksQuery.select }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(
      new NextRequest('http://localhost/api/meetings/meeting-1/follow-up-context') as never,
      { params: Promise.resolve({ id: 'meeting-1' }) },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      meeting: {
        id: 'meeting-1',
        next_meeting_type: 'implementation review',
      },
      task_summary: {
        pending: 1,
        in_progress: 1,
        complete: 1,
        total: 3,
      },
      handoff: {
        version: 'inbound-outreach-handoff/v1',
        intent: 'meeting_follow_up_context',
        next_action: 'schedule_follow_up',
        approval_boundary: 'context_handoff_only_no_send_no_auto_approval',
        human_review_required: true,
        source_refs: {
          source_type: 'meeting',
          client_project_id: 'project-1',
          meeting_record_id: 'meeting-1',
        },
      },
    })
  })
})
