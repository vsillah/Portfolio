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
let linkedQueueRow: Record<string, unknown> | null = null
let queueUpdateError: { message: string } | null = null
let queueUpdateMatched = true
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
      const selectBuilder = {
        eq: () => selectBuilder,
        order: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
        maybeSingle: () => {
          commReadCount += 1
          return Promise.resolve({
            data: commReadCount === 1 ? existingResponse : existingDraft,
            error: null,
          })
        },
      }
      return {
        select: () => selectBuilder,
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
      const selectBuilder = {
        eq: () => selectBuilder,
        order: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
        maybeSingle: () => Promise.resolve({ data: existingTask, error: null }),
      }
      return {
        select: () => selectBuilder,
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
      const selectBuilder = {
        eq: () => selectBuilder,
        order: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
        single: () =>
          Promise.resolve({
            data: linkedQueueRow,
            error: linkedQueueRow ? null : { message: 'not found' },
          }),
      }
      return {
        select: () => selectBuilder,
        update: (payload: Record<string, unknown>) => {
          updatedOutreachRows.push(payload)
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: queueUpdateMatched ? { id: linkedQueueRow?.id ?? 'queue-1' } : null,
                      error: queueUpdateError,
                    }),
                }),
              }),
            }),
          }
        },
      }
    }

    if (table === 'email_messages' || table === 'meeting_records') {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
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
    linkedQueueRow = null
    queueUpdateError = null
    queueUpdateMatched = true
    insertedCommunications = []
    insertedTasks = []
    updatedOutreachRows = []
    setupSupabase()
  })

  it('captures an interested response, creates a local reply draft and follow-up task, and performs no provider calls', async () => {
    const response = await POST(request({
      channel: 'email',
      sourceType: 'manual',
      responseText: 'Interested. Can we schedule a quick demo?',
      receivedAt: '2026-08-26T12:00:00.000Z',
    }), { params: { id: '42' } })

    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json.outcome).toBe('created')
    expect(json.decision.responseClass).toBe('interested')
    expect(json.decision.interpretation.recommendedNextAction).toMatchObject({
      label: 'Review short next-step reply',
      priority: 'high',
      requiresNextTouchDecision: true,
    })
    expect(json.decision.approvalGate).toMatchObject({
      state: 'pending_human_reply_review',
    })
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
    expect(insertedCommunications[0].metadata).toMatchObject({
      response_class: 'interested',
      source_type: 'manual',
      source_label: 'Manual entry',
      source_provenance: expect.objectContaining({
        source_type: 'manual',
        capture_method: 'operator_manual_entry',
        source_system: 'manual',
        provider: 'manual',
        provider_polling_enabled: false,
        provider_ingestion_enabled: false,
        external_action_enabled: false,
      }),
      response_class_label: 'interested',
      recommended_next_action: expect.objectContaining({
        label: 'Review short next-step reply',
      }),
      next_touch_decision_required: true,
      approval_gate: expect.objectContaining({
        state: 'pending_human_reply_review',
      }),
      source_use_boundary: expect.objectContaining({
        portfolioLocalContextOnly: true,
        privateEvidencePolicy: 'summarize_private_sources_do_not_quote_raw',
      }),
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
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain('gmail')
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain('slack')
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain('n8n')
  })

  it('captures provider-shaped Gmail reply provenance without enabling provider ingestion', async () => {
    const response = await POST(request({
      channel: 'email',
      sourceType: 'gmail',
      responseText: 'Can you explain how this works with our team?',
      providerThreadId: 'gmail-thread-42',
      providerMessageId: 'gmail-message-99',
      sourceUrl: 'https://mail.google.com/mail/u/0/#inbox/gmail-thread-42',
    }), { params: { id: '42' } })

    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json.decision.responseClass).toBe('question')
    expect(json.sourceProvenance).toMatchObject({
      source_type: 'gmail',
      source_label: 'Gmail reply',
      capture_method: 'provider_shaped_manual_intake',
      source_system: 'manual',
      provider: 'gmail',
      provider_thread_id: 'gmail-thread-42',
      provider_message_id: 'gmail-message-99',
      provider_polling_enabled: false,
      provider_ingestion_enabled: false,
      external_action_enabled: false,
    })
    expect(insertedCommunications[0]).toMatchObject({
      direction: 'inbound',
      source_system: 'manual',
      source_id: 'warm-outreach:reply:gmail:gmail-thread-42:gmail-message-99',
    })
    expect(insertedCommunications[0].metadata).toMatchObject({
      source_type: 'gmail',
      source_label: 'Gmail reply',
      provider: 'gmail',
      provider_thread_id: 'gmail-thread-42',
      provider_message_id: 'gmail-message-99',
      source_url: 'https://mail.google.com/mail/u/0/#inbox/gmail-thread-42',
      execution_boundary: expect.objectContaining({
        providerIngestionEnabled: false,
        externalMonitoringEnabled: false,
        gmailDraftCreationEnabled: false,
        slackActionEnabled: false,
      }),
    })
    expect(insertedCommunications).toHaveLength(2)
    expect(insertedTasks).toHaveLength(1)
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain('gmail')
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain('slack')
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain('n8n')
  })

  it('rejects incompatible source and channel pairs before creating local rows', async () => {
    const response = await POST(request({
      channel: 'linkedin',
      sourceType: 'gmail',
      responseText: 'Can you explain how this works with our team?',
    }), { params: { id: '42' } })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'sourceType gmail must use channel email',
    })
    expect(insertedCommunications).toHaveLength(0)
    expect(insertedTasks).toHaveLength(0)
  })

  it('marks a linked outreach queue row replied before creating draft and task rows', async () => {
    linkedQueueRow = {
      id: 'queue-1',
      contact_submission_id: 42,
      channel: 'email',
      subject: 'Warm intro',
      status: 'sent',
      thread_id: 'thread-1',
      message_id: 'message-1',
    }

    const response = await POST(request({
      channel: 'email',
      outreachQueueId: 'queue-1',
      responseText: 'Interested. Can we schedule a quick demo?',
      receivedAt: '2026-08-26T12:00:00.000Z',
    }), { params: { id: '42' } })

    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json.outcome).toBe('created')
    expect(updatedOutreachRows).toEqual([
      {
        status: 'replied',
        replied_at: '2026-08-26T12:00:00.000Z',
        reply_content: 'Interested. Can we schedule a quick demo?',
      },
    ])
    expect(insertedCommunications).toHaveLength(2)
    expect(insertedTasks).toHaveLength(1)
  })

  it('fails closed before downstream draft or task rows when linked queue update fails', async () => {
    linkedQueueRow = {
      id: 'queue-1',
      contact_submission_id: 42,
      channel: 'email',
      subject: 'Warm intro',
      status: 'sent',
      thread_id: 'thread-1',
      message_id: 'message-1',
    }
    queueUpdateError = { message: 'update failed' }

    const response = await POST(request({
      channel: 'email',
      outreachQueueId: 'queue-1',
      responseText: 'Interested. Can we schedule a quick demo?',
      receivedAt: '2026-08-26T12:00:00.000Z',
    }), { params: { id: '42' } })

    expect(response.status).toBe(409)
    const json = await response.json()
    expect(json).toMatchObject({
      outcome: 'blocked_linked_queue_update_failed',
      error: 'Linked outreach queue row could not be marked replied. No response draft or follow-up task was created.',
      detail: 'update failed',
    })
    expect(updatedOutreachRows).toHaveLength(1)
    expect(insertedCommunications).toHaveLength(0)
    expect(insertedTasks).toHaveLength(0)
    expect(json.executionBoundary).toMatchObject({
      providerIngestionEnabled: false,
      externalMonitoringEnabled: false,
      replySubmissionEnabled: false,
      externalSendEnabled: false,
    })
  })

  it('returns the existing response and reuses local draft and task rows for duplicate capture', async () => {
    existingResponse = {
      id: 'comm-existing',
      source_id: 'warm-outreach:reply:manual:existing',
      metadata: {},
    }
    existingDraft = {
      id: 'comm-draft-existing',
      source_id: 'warm-outreach:reply-draft:existing',
      metadata: {},
    }
    existingTask = {
      id: 'task-existing',
    }

    const response = await POST(request({
      channel: 'email',
      responseText: 'Interested. Can we schedule a quick demo?',
      messageKey: 'thread-42-message-7',
      receivedAt: '2026-08-26T12:00:00.000Z',
    }), { params: { id: '42' } })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.outcome).toBe('existing')
    expect(json.responseCommunicationId).toBe('comm-existing')
    expect(json.replyDraftCommunicationId).toBe('comm-draft-existing')
    expect(json.replyDraftOutcome).toBe('existing')
    expect(json.followUpTask).toEqual({ outcome: 'existing', id: 'task-existing' })
    expect(insertedCommunications).toHaveLength(0)
    expect(insertedTasks).toHaveLength(0)
  })

  it('repairs a missing local reply draft once for an existing captured response', async () => {
    existingResponse = {
      id: 'comm-existing',
      source_id: 'warm-outreach:reply:manual:existing',
      metadata: {},
    }

    const response = await POST(request({
      channel: 'email',
      responseText: 'Interested. Can we schedule a quick demo?',
      messageKey: 'thread-42-message-8',
    }), { params: { id: '42' } })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.outcome).toBe('existing')
    expect(json.replyDraftOutcome).toBe('created')
    expect(insertedCommunications).toHaveLength(1)
    expect(insertedCommunications[0]).toMatchObject({
      direction: 'outbound',
      message_type: 'follow_up',
      status: 'draft',
      source_system: 'manual',
    })
    expect(insertedTasks).toHaveLength(1)
  })

  it('stores unsubscribe responses as suppression proposals pending human approval', async () => {
    const response = await POST(request({
      channel: 'linkedin',
      responseText: 'Please unsubscribe me and do not contact me again.',
    }), { params: { id: '42' } })

    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json.decision.responseClass).toBe('unsubscribe_do_not_contact')
    expect(json.suppressionProposal).toMatchObject({
      action: 'mark_do_not_contact',
      state: 'pending_human_approval',
      requiresHumanApproval: true,
    })
    expect(insertedCommunications[0].metadata).toMatchObject({
      lifecycle: 'warm_outreach_response',
      response_class: 'unsubscribe_do_not_contact',
      response_class_label: 'unsubscribe / do not contact',
      human_qa_required: true,
      approval_gate: expect.objectContaining({
        state: 'blocked_suppression_review',
      }),
    })
  })

  it('keeps ambiguous responses blocked with a recovery path and no provider side effects', async () => {
    const response = await POST(request({
      channel: 'email',
      responseText: 'Okay.',
    }), { params: { id: '42' } })

    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json.decision.responseClass).toBe('ambiguous')
    expect(json.decision.approvalGate).toMatchObject({
      state: 'blocked_uncertain_review',
      blockedExternalActions: expect.arrayContaining(['n8n_dispatch', 'provider_monitoring']),
    })
    expect(insertedCommunications[0].metadata).toMatchObject({
      approval_gate: expect.objectContaining({
        recoveryPath: expect.stringContaining('relationship packet'),
      }),
    })
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain('gmail')
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain('slack')
  })
})
