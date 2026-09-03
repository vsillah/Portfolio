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

type TableRows = Record<
  string,
  unknown[] | { data: unknown[]; error: { message: string } | null }
>

type InsertMock = {
  insert: ReturnType<typeof vi.fn>
  inserted: unknown[]
}

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/outreach/batch-review', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function listQuery(
  table: string,
  data: unknown[],
  error: { message: string } | null = null,
  insertMocks: Record<string, InsertMock> = {},
) {
  const limit = vi.fn(() => Promise.resolve({ data, error }))
  const order = vi.fn(() => ({ limit }))
  const inFilter = vi.fn(() => ({ data, error, order, limit }))
  const select = vi.fn(() => ({ in: inFilter }))
  const insert = vi.fn((payload: unknown[] | unknown) => {
    const payloadRows = Array.isArray(payload) ? payload : [payload]
    const inserted = payloadRows.map((row, index) => ({
      id: `${table}-created-${index + 1}`,
      ...(row as Record<string, unknown>),
      created_at: '2026-09-02T12:00:00.000Z',
    }))
    insertMocks[table] = { insert, inserted }
    return {
      select: vi.fn(() => Promise.resolve({ data: inserted, error: null })),
    }
  })
  return { select, in: inFilter, order, limit, insert }
}

function setupRows(rows: TableRows, insertMocks: Record<string, InsertMock> = {}) {
  mocks.from.mockImplementation((table: string) => {
    if (table in rows) {
      const result = rows[table]
      if (Array.isArray(result)) return listQuery(table, result, null, insertMocks)
      return listQuery(table, result.data, result.error, insertMocks)
    }
    throw new Error(`Unexpected table: ${table}`)
  })
}

const warmLead = {
  id: 42,
  name: 'Amina Example',
  email: 'amina@example.com',
  company: 'Example Ops',
  industry: 'Services',
  lead_source: 'warm_referral',
  outreach_status: 'not_contacted',
  do_not_contact: false,
  removed_at: null,
  phone_number: null,
  linkedin_url: null,
  facebook_profile_url: null,
  relationship_strength: 'strong',
  warm_source_detail: 'Prior meeting',
  created_at: '2026-08-20T00:00:00Z',
}

const weakLead = {
  id: 43,
  name: 'Kofi No Basis',
  email: 'kofi@example.com',
  company: 'Quiet Co',
  industry: 'Services',
  lead_source: 'warm_google_contacts',
  outreach_status: 'not_contacted',
  do_not_contact: false,
  removed_at: null,
  phone_number: null,
  linkedin_url: null,
  facebook_profile_url: null,
  relationship_strength: null,
  warm_source_detail: null,
  created_at: '2026-08-20T00:00:00Z',
}

describe('POST /api/admin/outreach/batch-review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('returns a local-only warm batch review for selected recipients', async () => {
    setupRows({
      contact_submissions: [warmLead],
      contact_communications: [],
      outreach_queue: [],
      email_messages: [],
      meeting_records: [
        {
          id: 'meeting-1',
          contact_submission_id: 42,
          meeting_type: 'discovery',
          meeting_date: '2026-08-19T00:00:00Z',
          structured_notes: { summary: 'Discussed operations.' },
          key_decisions: [],
          created_at: '2026-08-19T00:00:00Z',
        },
      ],
      meeting_action_tasks: [],
    })

    const response = await POST(request({ contact_ids: [42], cohort_label: 'August warm follow-up' }))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toMatchObject({
      mode: 'warm_1_to_many',
      cohort: {
        label: 'August warm follow-up',
        recipientCount: 1,
      },
      summary: {
        readyCount: 1,
        blockedCount: 0,
      },
      executionBoundary: {
        readOnly: true,
        providerCalls: false,
        createsDraft: false,
        externalSend: false,
        gmailDraft: false,
        linkedinAction: false,
        facebookAction: false,
        phoneAction: false,
        n8nDispatch: false,
        slackAction: false,
        responseMonitoring: false,
      },
      gmailDraftPlan: {
        version: 'warm-outreach-gmail-batch-draft-plan/v1',
        status: 'draft_creation_ready',
        currentCta: {
          key: 'create_gmail_draft_records',
          enabled: true,
        },
        summary: {
          selectedCount: 1,
          readyForLocalPlanningCount: 1,
          providerNotConnectedCount: 1,
          draftCreationEligibleCount: 1,
          draftCreatedCount: 0,
        },
        executionBoundary: {
          localPortfolioPlanOnly: true,
          createsOutreachQueueRows: false,
          createsGmailDrafts: false,
          gmailProviderCalls: false,
          gmailSend: false,
          slackDispatch: false,
          smsDelivery: false,
          n8nDispatch: false,
          productionDataMutation: false,
          genericApprovalAuthorizesSend: false,
        },
      },
      plannedDraftActions: {
        version: 'warm-planned-draft-actions/v1',
        currentCta: {
          key: 'open_draft_gate',
          label: 'Open draft gate',
          enabled: true,
          href: '#gmail-batch-draft-plan',
        },
        summary: {
          selectedCount: 1,
          gmailDraftPlanCount: 1,
          manualSocialHandoffCount: 0,
          relationshipReviewBlockerCount: 0,
          responseFollowUpCount: 0,
          parkedSmsCount: 0,
        },
        executionBoundary: {
          localPortfolioPlanOnly: true,
          reviewOnlyDraftActionPackets: true,
          createsOutreachQueueRows: false,
          createsGmailDrafts: false,
          gmailProviderCalls: false,
          socialProviderCalls: false,
          gmailSend: false,
          slackDispatch: false,
          smsDelivery: false,
          n8nDispatch: false,
          productionDataMutation: false,
          externalRequests: [],
        },
      },
    })
    expect(json.recipients[0]).toMatchObject({
      contactId: 42,
      contactName: 'Amina Example',
      status: 'ready_for_review',
      selectedChannel: 'email',
      promptTemplateKey: 'email_follow_up',
      suppressionStatus: 'clear',
      weakBasis: false,
      sendReadiness: {
        version: 'warm-outreach-send-readiness/v1',
        executionBoundary: {
          providerExecution: false,
          gmailDraftCreation: false,
          outcomeTracking: false,
        },
      },
    })
    expect(json.recipients[0].sendReadiness.modes.warm_1_to_many[0].sendAuthority).toMatchObject({
      version: 'warm-outreach-send-authority/v1',
      mode: 'warm_1_to_many',
      externalSendEnabled: false,
      providerExecutionEnabled: false,
      schedulingEnabled: false,
      outcomeTrackingEnabled: false,
    })
    expect(json.recipients[0].individualizedDraftPreview).toContain('Amina')
    expect(json.recipients[0].gmailDraftPlan).toMatchObject({
      status: 'ready_for_local_planning',
      nextAction: 'local_draft_planning',
      draftCreation: {
        status: 'provider_not_connected',
        actionEnabled: true,
        providerDraftId: null,
        externalRequests: [],
      },
      draftIntent: {
        channel: 'gmail',
        promptTemplateKey: 'email_follow_up',
        createsOutreachQueueRow: false,
        createsGmailDraft: false,
        callsProvider: false,
        externalSend: false,
      },
    })
    expect(json.recipients[0].plannedDraftAction).toMatchObject({
      kind: 'gmail_draft_plan',
      recommendedChannel: 'gmail',
      cta: {
        key: 'open_draft_gate',
        label: 'Open draft gate',
      },
      draftActionPacket: {
        reviewOnly: true,
        createsGmailDraft: false,
        callsProvider: false,
        externalRequests: [],
      },
    })
  })

  it('surfaces suppression and weak-basis blockers before any draft path', async () => {
    setupRows({
      contact_submissions: [warmLead, weakLead],
      contact_communications: [
        {
          id: 'comm-1',
          contact_submission_id: 42,
          direction: 'inbound',
          channel: 'email',
          status: 'unsubscribed',
          metadata: {},
          created_at: '2026-08-21T00:00:00Z',
        },
      ],
      outreach_queue: [],
      email_messages: [],
      meeting_records: [],
      meeting_action_tasks: [],
    })

    const response = await POST(request({ contact_ids: [42, 43] }))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.summary).toMatchObject({
      blockedCount: 2,
      weakBasisCount: 1,
      suppressionBlockedCount: 1,
    })
    expect(json.recipients.find((row: { contactId: number }) => row.contactId === 42)).toMatchObject({
      status: 'blocked',
      suppressionStatus: 'blocked',
    })
    expect(json.recipients.find((row: { contactId: number }) => row.contactId === 43)).toMatchObject({
      status: 'blocked',
      weakBasis: true,
    })
    expect(json.gmailDraftPlan).toMatchObject({
      status: 'blocked_review',
      currentCta: {
        key: 'resolve_blocked_rows',
        enabled: false,
      },
      summary: {
        blockedReviewCount: 2,
      },
    })
  })

  it('returns existing draft rows through deterministic review metadata', async () => {
    setupRows({
      contact_submissions: [warmLead],
      contact_communications: [],
      outreach_queue: [
        {
          id: 'queue-existing',
          contact_submission_id: 42,
          channel: 'email',
          status: 'draft',
          subject: 'Existing follow-up',
          generation_inputs: { template_key: 'email_follow_up' },
          created_at: '2026-08-22T00:00:00Z',
        },
      ],
      email_messages: [],
      meeting_records: [
        {
          id: 'meeting-1',
          contact_submission_id: 42,
          meeting_type: 'discovery',
          meeting_date: '2026-08-19T00:00:00Z',
          structured_notes: { summary: 'Discussed operations.' },
          created_at: '2026-08-19T00:00:00Z',
        },
      ],
      meeting_action_tasks: [],
    })

    const response = await POST(request({ contact_ids: [42], cohort_label: 'August warm follow-up' }))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.batchIdempotencyKey).toMatch(/^warm-outreach:batch-review:v1:/)
    expect(json.summary).toMatchObject({
      readyCount: 0,
      existingDraftCount: 1,
      blockedCount: 0,
    })
    expect(json.recipients[0]).toMatchObject({
      status: 'existing_draft',
      existingQueueId: 'queue-existing',
    })
    expect(json.recipients[0].draftIdempotencyKey).toMatch(/^warm-outreach:batch-draft:v1:/)
    expect(json.gmailDraftPlan).toMatchObject({
      status: 'approval_review_needed',
      currentCta: {
        key: 'review_approval_requests',
        enabled: true,
      },
      summary: {
        approvalRequiredCount: 1,
        draftAlreadyExistsCount: 1,
      },
    })
    expect(json.recipients[0].gmailDraftPlan).toMatchObject({
      status: 'approval_required',
      existingQueueId: 'queue-existing',
      draftCreation: {
        status: 'draft_already_exists',
        actionEnabled: false,
      },
    })
  })

  it('creates internal Gmail draft records without provider calls or sends', async () => {
    const insertMocks: Record<string, InsertMock> = {}
    setupRows({
      contact_submissions: [warmLead],
      contact_communications: [],
      outreach_queue: [],
      email_messages: [],
      meeting_records: [
        {
          id: 'meeting-1',
          contact_submission_id: 42,
          meeting_type: 'discovery',
          meeting_date: '2026-08-19T00:00:00Z',
          structured_notes: { summary: 'Discussed operations.' },
          key_decisions: [],
          created_at: '2026-08-19T00:00:00Z',
        },
      ],
      meeting_action_tasks: [],
    }, insertMocks)

    const response = await POST(request({
      action: 'create_gmail_draft_records',
      contact_ids: [42],
      preferred_channel: 'email',
    }))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(insertMocks.outreach_queue.insert).toHaveBeenCalledTimes(1)
    expect(insertMocks.outreach_queue.insert.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        contact_submission_id: 42,
        channel: 'email',
        status: 'draft',
        generation_model: 'portfolio-local-planner',
        generation_prompt_summary: 'planned_warm_gmail_draft_intent:no_provider',
        generation_inputs: expect.objectContaining({
          version: 'warm-planned-draft-execution/v1',
          template_key: 'email_follow_up',
          provider_calls_enabled: false,
          gmail_provider_draft_created: false,
          gmail_send_enabled: false,
          slack_dispatch_enabled: false,
          sms_delivery_enabled: false,
          social_provider_calls_enabled: false,
          n8n_dispatch_enabled: false,
          external_requests: [],
        }),
      }),
    ])
    expect(json.gmailDraftPlan).toMatchObject({
      status: 'draft_records_created',
      currentCta: {
        key: 'draft_records_created',
        enabled: false,
      },
      summary: {
        draftCreationEligibleCount: 0,
        draftCreatedCount: 1,
      },
      executionReceipt: {
        createdCount: 1,
        externalRequests: [],
      },
      executionBoundary: {
        createsOutreachQueueRows: false,
        createsGmailDrafts: false,
        gmailProviderCalls: false,
        gmailSend: false,
        slackDispatch: false,
        smsDelivery: false,
        n8nDispatch: false,
        productionDataMutation: false,
      },
    })
    expect(json.recipients[0].gmailDraftPlan.draftCreation).toMatchObject({
      status: 'draft_created',
      actionEnabled: false,
      localDraftRecordId: 'outreach_queue-created-1',
      providerDraftId: null,
      externalRequests: [],
    })
    expect(json.plannedDraftActions.executionReceipt).toMatchObject({
      action: 'create_planned_draft_handoff_records',
      createdCount: 1,
      gmailDraftRecordCount: 1,
      manualSocialHandoffTaskCount: 0,
      externalRequests: [],
    })
    expect(json.plannedDraftActions.rows[0]).toMatchObject({
      recordState: 'record_created',
      recordTable: 'outreach_queue',
      localRecordId: 'outreach_queue-created-1',
    })
  })

  it('creates manual-social handoff tasks without social provider actions', async () => {
    const insertMocks: Record<string, InsertMock> = {}
    setupRows({
      contact_submissions: [{
        ...warmLead,
        id: 44,
        name: 'Mariam Manual',
        email: null,
        linkedin_url: 'https://linkedin.example/mariam',
      }],
      contact_communications: [],
      outreach_queue: [],
      email_messages: [],
      meeting_records: [
        {
          id: 'meeting-44',
          contact_submission_id: 44,
          meeting_type: 'discovery',
          meeting_date: '2026-08-19T00:00:00Z',
          structured_notes: { summary: 'Discussed manual partner outreach.' },
          created_at: '2026-08-19T00:00:00Z',
        },
      ],
      meeting_action_tasks: [],
    }, insertMocks)

    const response = await POST(request({
      action: 'create_planned_draft_handoff_records',
      contact_ids: [44],
      preferred_channel: 'linkedin',
    }))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(insertMocks.meeting_action_tasks.insert).toHaveBeenCalledTimes(1)
    expect(insertMocks.meeting_action_tasks.insert.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        contact_submission_id: 44,
        task_category: 'outreach',
        status: 'pending',
        title: 'Manual linkedin handoff: Mariam Manual',
        external_id: expect.stringMatching(/^warm-outreach:manual-handoff-task:v1:/),
      }),
    ])
    expect(insertMocks.outreach_queue).toBeUndefined()
    expect(json.plannedDraftActions.executionReceipt).toMatchObject({
      createdCount: 1,
      gmailDraftRecordCount: 0,
      manualSocialHandoffTaskCount: 1,
      externalRequests: [],
    })
    expect(json.plannedDraftActions.rows[0]).toMatchObject({
      kind: 'manual_social_handoff',
      recommendedChannel: 'linkedin',
      recordState: 'record_created',
      recordTable: 'meeting_action_tasks',
      localRecordId: 'meeting_action_tasks-created-1',
      draftActionPacket: {
        createsGmailDraft: false,
        callsProvider: false,
        externalSend: false,
        slackDispatch: false,
        smsDelivery: false,
        n8nDispatch: false,
        externalRequests: [],
      },
    })
  })

  it('rejects unsupported batch actions before draft state changes', async () => {
    const response = await POST(request({ action: 'send_gmail_batch', contact_ids: [42] }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Unsupported warm batch review action.',
    })
  })

  it('keeps review mode read-only', async () => {
    const insertMocks: Record<string, InsertMock> = {}
    setupRows({
      contact_submissions: [warmLead],
      contact_communications: [],
      outreach_queue: [],
      email_messages: [],
      meeting_records: [],
      meeting_action_tasks: [],
    }, insertMocks)

    await POST(request({ contact_ids: [42] }))

    expect(insertMocks).toEqual({})
    expect(mocks.from).toHaveBeenCalledWith('contact_submissions')
    expect(mocks.from).toHaveBeenCalledWith('contact_communications')
    expect(mocks.from).toHaveBeenCalledWith('outreach_queue')
    expect(mocks.from).toHaveBeenCalledWith('email_messages')
    expect(mocks.from).toHaveBeenCalledWith('meeting_records')
    expect(mocks.from).toHaveBeenCalledWith('meeting_action_tasks')
  })

  it('fails closed when related relationship evidence cannot be loaded', async () => {
    setupRows({
      contact_submissions: [warmLead],
      contact_communications: [],
      outreach_queue: {
        data: [],
        error: { message: 'permission denied for table outreach_queue' },
      },
      email_messages: [],
      meeting_records: [],
      meeting_action_tasks: [],
    })

    const response = await POST(request({ contact_ids: [42] }))

    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json).toEqual({
      error: 'Unable to load warm outreach relationship evidence.',
      source: 'outreach_queue',
    })
    expect(JSON.stringify(json)).not.toContain('permission denied')
    expect(JSON.stringify(json)).not.toContain('recipients')
    expect(JSON.stringify(json)).not.toContain('warm_1_to_many')
  })

  it('rejects empty or oversized selections with a clear blocker', async () => {
    const empty = await POST(request({ contact_ids: [] }))
    expect(empty.status).toBe(400)
    await expect(empty.json()).resolves.toEqual({
      error: 'At least one selected lead is required for warm batch review.',
    })

    const oversized = await POST(request({ contact_ids: Array.from({ length: 51 }, (_, index) => index + 1) }))
    expect(oversized.status).toBe(400)
    await expect(oversized.json()).resolves.toEqual({
      error: 'Warm batch review is limited to 50 recipients at a time.',
    })
  })
})
