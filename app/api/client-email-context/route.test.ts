import { beforeEach, describe, expect, it, vi } from 'vitest'

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

type QueryResult<T> = {
  data: T
  error: { message: string } | null
}

function request(email = 'LEAD@Example.com') {
  return new Request(`http://localhost/api/client-email-context?email=${encodeURIComponent(email)}`, {
    headers: { authorization: 'Bearer admin-token' },
  })
}

function maybeSingleQuery<T>(result: QueryResult<T>) {
  const maybeSingle = vi.fn(async () => result)
  const limit = vi.fn(() => ({ maybeSingle }))
  const order = vi.fn(() => ({ limit }))
  const eq = vi.fn(() => ({ order, limit }))
  const select = vi.fn(() => ({ eq }))

  return { select, eq, order, limit, maybeSingle }
}

function limitQuery<T>(result: QueryResult<T>) {
  const limit = vi.fn(async () => result)
  const order = vi.fn(() => ({ limit }))
  const eq = vi.fn(() => ({ order }))
  const select = vi.fn(() => ({ eq }))

  return { select, eq, order, limit }
}

function taskQuery<T>(result: QueryResult<T>) {
  const limit = vi.fn(async () => result)
  const order = vi.fn(() => ({ limit }))
  const statusIn = vi.fn(() => ({ order }))
  const idIn = vi.fn(() => ({ in: statusIn }))
  const select = vi.fn(() => ({ in: idIn }))

  return { select, idIn, statusIn, order, limit }
}

describe('GET /api/client-email-context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('falls back to lead context and normalizes interest areas for lead-only inboxes', async () => {
    const clientProjectQuery = maybeSingleQuery({ data: null, error: null })
    const leadQuery = maybeSingleQuery({
      data: {
        id: 42,
        name: 'Lead Person',
        email: 'lead@example.com',
        company: 'Lead Co',
        interest_summary: null,
        interest_areas: ['AI ops', '', '  ', 'Automation', 123],
        message: 'Need help operationalizing follow-up.',
        created_at: '2026-06-01T00:00:00.000Z',
      },
      error: null,
    })
    const meetingsQuery = limitQuery({
      data: [
        {
          id: 'meeting-1',
          meeting_type: 'discovery',
          meeting_date: '2026-06-03T14:00:00.000Z',
          structured_notes: { summary: 'Lead wants faster reply drafting.' },
          key_decisions: ['Use Gmail draft workflow'],
        },
      ],
      error: null,
    })
    const tasksQuery = taskQuery({
      data: [
        {
          title: 'Send recap',
          owner: 'Vambah',
          due_date: '2026-06-05',
          status: 'pending',
          completed_at: null,
        },
        {
          title: 'Confirm budget',
          owner: null,
          due_date: null,
          status: 'complete',
          completed_at: '2026-06-04T00:00:00.000Z',
        },
      ],
      error: null,
    })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') return { select: clientProjectQuery.select }
      if (table === 'contact_submissions') return { select: leadQuery.select }
      if (table === 'meeting_records') return { select: meetingsQuery.select }
      if (table === 'meeting_action_tasks') return { select: tasksQuery.select }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(request() as never)

    expect(response.status).toBe(200)
    expect(clientProjectQuery.eq).toHaveBeenCalledWith('client_email', 'lead@example.com')
    expect(leadQuery.eq).toHaveBeenCalledWith('email', 'lead@example.com')
    expect(tasksQuery.idIn).toHaveBeenCalledWith('meeting_record_id', ['meeting-1'])
    expect(await response.json()).toMatchObject({
      found: true,
      source_type: 'lead',
      project: {
        id: null,
        lead_id: 42,
        client_name: 'Lead Person',
        client_email: 'lead@example.com',
        client_company: 'Lead Co',
        service_interest: 'AI ops, Automation',
        initial_message: 'Need help operationalizing follow-up.',
      },
      last_meeting: {
        meeting_type: 'discovery',
        summary: 'Lead wants faster reply drafting.',
        key_decisions: ['Use Gmail draft workflow'],
      },
      action_items: {
        pending: [{ title: 'Send recap', owner: 'Vambah', due_date: '2026-06-05' }],
        recently_completed: [{ title: 'Confirm budget', completed_at: '2026-06-04T00:00:00.000Z' }],
      },
      handoff: {
        version: 'inbound-outreach-handoff/v1',
        intent: 'lead_reply_context',
        next_action: 'review_lead_reply_for_outreach',
        approval_boundary: 'context_handoff_only_no_send_no_auto_approval',
        human_review_required: true,
        source_refs: {
          source_type: 'lead',
          lead_id: 42,
        },
        target_surface: '/admin/outreach?tab=leads&id=42',
      },
    })
  })

  it('prefers the lead interest summary when both summary and areas are present', async () => {
    const clientProjectQuery = maybeSingleQuery({ data: null, error: null })
    const leadQuery = maybeSingleQuery({
      data: {
        id: 43,
        name: 'Summary Lead',
        email: 'summary@example.com',
        company: null,
        interest_summary: 'AI ops readiness and internal automation',
        interest_areas: ['Should not win'],
        message: 'Can you help?',
        created_at: '2026-06-02T00:00:00.000Z',
      },
      error: null,
    })
    const meetingsQuery = limitQuery({ data: [], error: null })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') return { select: clientProjectQuery.select }
      if (table === 'contact_submissions') return { select: leadQuery.select }
      if (table === 'meeting_records') return { select: meetingsQuery.select }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(request('summary@example.com') as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      found: true,
      source_type: 'lead',
      project: {
        lead_id: 43,
        service_interest: 'AI ops readiness and internal automation',
      },
      last_meeting: null,
      action_items: null,
      handoff: {
        intent: 'lead_reply_context',
        source_refs: {
          source_type: 'lead',
          lead_id: 43,
        },
      },
    })
    expect(mocks.from).not.toHaveBeenCalledWith('meeting_action_tasks')
  })

  it('returns project context when optional plan, meeting, and task rows are absent', async () => {
    const clientProjectQuery = maybeSingleQuery({
      data: {
        id: 'project-1',
        client_name: 'Client Person',
        client_email: 'client@example.com',
        client_company: 'Client Co',
        project_name: 'Client AI Ops',
        project_status: 'active',
        current_phase: 'implementation',
        product_purchased: 'AI Ops Sprint',
        slack_channel: '#client-ai-ops',
        project_start_date: '2026-06-01',
        estimated_end_date: '2026-07-01',
      },
      error: null,
    })
    const planQuery = maybeSingleQuery({ data: null, error: null })
    const meetingQuery = maybeSingleQuery({ data: null, error: null })
    const tasksQuery = {
      limit: vi.fn(async () => ({ data: [], error: null })),
      order: vi.fn(),
      statusIn: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
    }
    tasksQuery.order.mockReturnValue({ limit: tasksQuery.limit })
    tasksQuery.statusIn.mockReturnValue({ order: tasksQuery.order })
    tasksQuery.eq.mockReturnValue({ in: tasksQuery.statusIn })
    tasksQuery.select.mockReturnValue({ eq: tasksQuery.eq })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') return { select: clientProjectQuery.select }
      if (table === 'onboarding_plans') return { select: planQuery.select }
      if (table === 'meeting_records') return { select: meetingQuery.select }
      if (table === 'meeting_action_tasks') return { select: tasksQuery.select }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(request('client@example.com') as never)

    expect(response.status).toBe(200)
    expect(planQuery.maybeSingle).toHaveBeenCalled()
    expect(meetingQuery.maybeSingle).toHaveBeenCalled()
    expect(await response.json()).toMatchObject({
      found: true,
      source_type: 'client_project',
      project: {
        id: 'project-1',
        client_name: 'Client Person',
        client_email: 'client@example.com',
        client_company: 'Client Co',
        project_name: 'Client AI Ops',
        project_status: 'active',
        current_phase: 'implementation',
        product_purchased: 'AI Ops Sprint',
        slack_channel: '#client-ai-ops',
        project_start_date: '2026-06-01',
        estimated_end_date: '2026-07-01',
      },
      milestones: null,
      last_meeting: null,
      action_items: null,
      handoff: {
        version: 'inbound-outreach-handoff/v1',
        intent: 'client_reply_context',
        next_action: 'draft_client_reply',
        approval_boundary: 'context_handoff_only_no_send_no_auto_approval',
        human_review_required: true,
        source_refs: {
          source_type: 'client_project',
          client_project_id: 'project-1',
          lead_id: null,
        },
        target_surface: '/admin/email-center',
      },
    })
  })
})
