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
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

const contact = {
  id: 42,
  name: 'Anna Berin',
  email: 'anna@example.com',
  do_not_contact: false,
  removed_at: null,
}

let existingResponse: Record<string, unknown> | null = null
let existingDraft: Record<string, unknown> | null = null
let existingTask: Record<string, unknown> | null = null
let insertedCommunications: Record<string, unknown>[] = []
let insertedTasks: Record<string, unknown>[] = []
let updatedOutreachRows: Record<string, unknown>[] = []

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/outreach/leads/42/responses', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function setupSupabase() {
  let commReadCount = 0

  mocks.from.mockImplementation((table: string) => {
    if (table === 'contact_submissions') {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: contact, error: null }),
          }),
        }),
      }
    }

    if (table === 'contact_communications') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => {
                  commReadCount += 1
                  return Promise.resolve({
                    data: commReadCount === 1 ? existingResponse : existingDraft,
                    error: null,
                  })
                },
              }),
            }),
          }),
        }),
        insert: (payload: Record<string, unknown>) => {
          insertedCommunications.push(payload)
          return {
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: `comm-${insertedCommunications.length}`,
                    source_id: payload.source_id,
                    metadata: payload.metadata,
                    created_at: '2026-08-26T12:00:00.000Z',
                  },
                  error: null,
                }),
            }),
          }
        },
      }
    }

    if (table === 'meeting_action_tasks') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: existingTask, error: null }),
          }),
        }),
        insert: (payload: Record<string, unknown>) => {
          insertedTasks.push(payload)
          return {
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: `task-${insertedTasks.length}` },
                  error: null,
                }),
            }),
          }
        },
      }
    }

    if (table === 'outreach_queue') {
      return {
        update: (payload: Record<string, unknown>) => {
          updatedOutreachRows.push(payload)
          return { eq: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) }
        },
      }
    }

    throw new Error(`Unexpected table: ${table}`)
  })
}

describe('POST /api/admin/outreach/leads/[id]/responses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    existingResponse = null
    existingDraft = null
    existingTask = null
    insertedCommunications = []
    insertedTasks = []
    updatedOutreachRows = []
    setupSupabase()
  })

  it('captures an interested response, creates a local reply draft and follow-up task, and performs no provider calls', async () => {
    const response = await POST(request({
      channel: 'email',
      responseText: 'Interested. Can we schedule a quick demo?',
      receivedAt: '2026-08-26T12:00:00.000Z',
    }), { params: { id: '42' } })

    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json.outcome).toBe('created')
    expect(json.decision.responseClass).toBe('interested')
    expect(json.executionBoundary).toMatchObject({
      providerIngestionEnabled: false,
      externalMonitoringEnabled: false,
      replySubmissionEnabled: false,
      externalSendEnabled: false,
      gmailDraftCreationEnabled: false,
      slackActionEnabled: false,
    })

    expect(insertedCommunications).toHaveLength(2)
    expect(insertedCommunications[0]).toMatchObject({
      direction: 'inbound',
      message_type: 'reply',
      status: 'replied',
      source_system: 'manual',
    })
    expect(insertedCommunications[1]).toMatchObject({
      direction: 'outbound',
      message_type: 'follow_up',
      status: 'draft',
      source_system: 'manual',
    })
    expect(insertedTasks).toHaveLength(1)
    expect(insertedTasks[0]).toMatchObject({
      contact_submission_id: 42,
      task_category: 'outreach',
      status: 'pending',
    })
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain('email_messages')
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain('gmail')
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain('slack')
  })

  it('returns the existing response for duplicate capture before writing drafts or tasks', async () => {
    existingResponse = {
      id: 'comm-existing',
      source_id: 'warm-outreach:reply:manual:existing',
      metadata: {},
    }

    const response = await POST(request({
      channel: 'email',
      responseText: 'Interested. Can we schedule a quick demo?',
      receivedAt: '2026-08-26T12:00:00.000Z',
    }), { params: { id: '42' } })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.outcome).toBe('existing')
    expect(json.responseCommunicationId).toBe('comm-existing')
    expect(insertedCommunications).toHaveLength(0)
    expect(insertedTasks).toHaveLength(0)
  })

  it('stores unsubscribe responses as suppression proposals pending human approval', async () => {
    const response = await POST(request({
      channel: 'linkedin',
      responseText: 'Please unsubscribe me and do not contact me again.',
    }), { params: { id: '42' } })

    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json.decision.responseClass).toBe('unsubscribe_or_do_not_contact')
    expect(json.suppressionProposal).toMatchObject({
      action: 'mark_do_not_contact',
      requiresHumanApproval: true,
    })
    expect(insertedCommunications[0].metadata).toMatchObject({
      lifecycle: 'warm_outreach_response',
      response_class: 'unsubscribe_or_do_not_contact',
      human_qa_required: true,
    })
  })
})
