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

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/outreach/batch-review', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function listQuery(data: unknown[], error: { message: string } | null = null) {
  const limit = vi.fn(() => Promise.resolve({ data, error }))
  const order = vi.fn(() => ({ limit }))
  const inFilter = vi.fn(() => ({ data, error, order, limit }))
  const select = vi.fn(() => ({ in: inFilter }))
  return { select, in: inFilter, order, limit }
}

function setupRows(rows: TableRows) {
  mocks.from.mockImplementation((table: string) => {
    if (table in rows) {
      const result = rows[table]
      if (Array.isArray(result)) return listQuery(result)
      return listQuery(result.data, result.error)
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

  it('records a draft-only creation receipt without writes or provider calls', async () => {
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

    const response = await POST(request({
      action: 'create_gmail_draft_records',
      contact_ids: [42],
      preferred_channel: 'email',
    }))

    expect(response.status).toBe(200)
    const json = await response.json()
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
        action: 'create_gmail_draft_records',
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
      providerDraftId: null,
      externalRequests: [],
    })
  })

  it('rejects unsupported batch actions before draft state changes', async () => {
    const response = await POST(request({ action: 'send_gmail_batch', contact_ids: [42] }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Unsupported warm batch review action.',
    })
  })

  it('does not call writes, rpc, or provider-style operations', async () => {
    const writes = {
      insert: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      rpc: vi.fn(),
    }
    setupRows({
      contact_submissions: [warmLead],
      contact_communications: [],
      outreach_queue: [],
      email_messages: [],
      meeting_records: [],
      meeting_action_tasks: [],
    })

    await POST(request({ contact_ids: [42] }))

    expect(writes.insert).not.toHaveBeenCalled()
    expect(writes.update).not.toHaveBeenCalled()
    expect(writes.upsert).not.toHaveBeenCalled()
    expect(writes.delete).not.toHaveBeenCalled()
    expect(writes.rpc).not.toHaveBeenCalled()
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
