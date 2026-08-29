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

import { GET } from './route'

type TableRows = Record<string, unknown[]>

const selectedColumns = new Map<string, string>()

function request(url = 'http://localhost/api/admin/outreach/leads/42/relationship-packet') {
  return new NextRequest(url)
}

function singleQuery(table: string, data: unknown | null) {
  return {
    select: vi.fn((columns: string) => {
      selectedColumns.set(table, columns)
      return {
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data,
              error: data ? null : { message: 'not found' },
            }),
          ),
        })),
      }
    }),
  }
}

function listQuery(table: string, data: unknown[]) {
  const limit = vi.fn(() => Promise.resolve({ data, error: null }))
  const order = vi.fn(() => ({ limit }))
  const eq = vi.fn(() => ({ order }))
  const select = vi.fn((columns: string) => {
    selectedColumns.set(table, columns)
    return { eq }
  })
  return { select, eq, order, limit }
}

function setupRows(rows: TableRows) {
  mocks.from.mockImplementation((table: string) => {
    if (table === 'contact_submissions') {
      return singleQuery(table, rows.contact_submissions?.[0] ?? null)
    }

    if (table in rows) {
      return listQuery(table, rows[table] ?? [])
    }

    throw new Error(`Unexpected table: ${table}`)
  })
}

const lead = {
  id: 42,
  name: 'Anna Berin',
  email: 'anna@example.com',
  company: 'MENTOR Rhode Island',
  industry: 'Nonprofit',
  lead_source: 'warm_referral',
  outreach_status: 'not_contacted',
  do_not_contact: false,
  removed_at: null,
  phone_number: '555-0100',
  linkedin_url: 'https://linkedin.com/in/anna',
  facebook_profile_url: 'https://facebook.com/anna',
  relationship_strength: 'strong',
  warm_source_detail: 'Prior community introduction',
  created_at: '2026-08-20T00:00:00Z',
}

describe('GET /api/admin/outreach/leads/[id]/relationship-packet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectedColumns.clear()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('returns a relationship packet from local Portfolio rows only', async () => {
    setupRows({
      contact_submissions: [lead],
      contact_communications: [
        {
          id: 'comm-1',
          contact_submission_id: 42,
          channel: 'email',
          direction: 'inbound',
          message_type: 'reply',
          subject: 'Re: intro',
          body: 'raw private body must not be selected or returned',
          source_system: 'manual',
          source_id: 'manual-1',
          status: 'replied',
          sent_at: '2026-08-21T00:00:00Z',
          metadata: {},
          created_at: '2026-08-21T00:00:00Z',
        },
      ],
      outreach_queue: [
        {
          id: 'queue-1',
          contact_submission_id: 42,
          channel: 'email',
          subject: 'Draft',
          sequence_step: 1,
          status: 'draft',
          created_at: '2026-08-22T00:00:00Z',
        },
      ],
      email_messages: [
        {
          id: 'email-1',
          contact_submission_id: 42,
          email_kind: 'reply',
          channel: 'email',
          direction: 'inbound',
          status: 'replied',
          subject: 'Re: intro',
          body_preview: 'private preview must not be selected or returned',
          source_system: 'manual',
          source_id: 'email-source-1',
          created_at: '2026-08-22T00:00:00Z',
        },
      ],
      meeting_records: [
        {
          id: 'meeting-1',
          contact_submission_id: 42,
          meeting_type: 'discovery',
          meeting_date: '2026-08-19T00:00:00Z',
          structured_notes: { summary: 'Discussed nonprofit operations.' },
          transcript: 'raw transcript must not be selected or returned',
          created_at: '2026-08-19T00:00:00Z',
        },
      ],
      meeting_action_tasks: [
        {
          id: 'task-1',
          contact_submission_id: 42,
          meeting_record_id: 'meeting-1',
          title: 'Send follow-up packet',
          status: 'pending',
          due_date: '2026-08-25',
          created_at: '2026-08-19T00:00:00Z',
        },
      ],
    })

    const response = await GET(request(), { params: Promise.resolve({ id: '42' }) })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.packet).toMatchObject({
      version: 'warm-outreach-relationship/v1',
      contactId: 42,
      contactName: 'Anna Berin',
      suppression: {
        doNotContact: false,
        unsubscribed: false,
      },
      channelCapabilities: {
        email: expect.objectContaining({
          available: true,
          supportsExternalSend: false,
          manualOnly: false,
        }),
        linkedin: expect.objectContaining({
          available: true,
          supportsExternalSend: false,
        }),
        facebook: expect.objectContaining({
          available: true,
          supportsExternalSend: false,
          manualOnly: true,
        }),
        phone_contact: expect.objectContaining({
          available: true,
          supportsExternalSend: false,
          manualOnly: true,
        }),
      },
    })
    expect(json.readiness).toMatchObject({
      humanReviewRequired: true,
      approvalBoundary: 'draft_only_no_external_send',
    })
    expect(json.smsReadiness).toMatchObject({
      version: 'warm-outreach-sms-readiness/v1',
      contactId: '42',
      channel: 'phone_contact',
      state: 'manual_review_required',
      phoneReadiness: {
        present: true,
        source: 'contact_submissions.phone_number',
        rawPhoneReturned: false,
      },
      consentAndSuppression: {
        status: 'clear_for_manual_review',
        checks: expect.arrayContaining([
          expect.objectContaining({ key: 'phone_present', status: 'passed' }),
          expect.objectContaining({ key: 'opt_out', status: 'review_required' }),
          expect.objectContaining({ key: 'manual_only', status: 'review_required' }),
        ]),
      },
      draft: {
        templateFamily: 'referral_common_connection',
        maxRecommendedCharacters: 240,
      },
      approval: {
        state: 'not_reviewed',
        recordsManualReadinessOnly: true,
        smsDeliveryEnabled: false,
        providerCallsEnabled: false,
        externalSendEnabled: false,
        genericProceedAccepted: false,
      },
      operatingLoop: {
        version: 'warm-outreach-sms-manual-loop/v1',
        manualEvidence: {
          requiredFields: ['timestamp', 'channel', 'operator_note'],
          channel: 'manual_sms',
          storesRawSmsBody: false,
          storesPhoneNumber: false,
          requiresScreenshot: false,
        },
        responseOutcomes: expect.arrayContaining([
          expect.objectContaining({ outcome: 'no_response_yet', suppressesFutureSms: false }),
          expect.objectContaining({ outcome: 'interested', followUpDraftNeeded: true }),
          expect.objectContaining({ outcome: 'stop_opt_out', suppressesFutureSms: true }),
          expect.objectContaining({ outcome: 'wrong_number', suppressesFutureSms: true }),
        ]),
        externalProviderCallsEnabled: false,
        smsDeliveryEnabled: false,
        genericProceedAccepted: false,
      },
      providerReadiness: {
        version: 'warm-outreach-sms-provider-readiness/v1',
        state: 'consent_or_suppression_not_satisfied',
        provider: {
          configured: false,
          enabled: false,
          providerCallsEnabled: false,
          smsDeliveryEnabled: false,
        },
        consentAndSuppression: {
          status: 'needs_evidence',
          suppressionPrecedence: true,
          checks: expect.arrayContaining([
            expect.objectContaining({ key: 'known_relationship_basis', status: 'passed' }),
            expect.objectContaining({ key: 'phone_provenance', status: 'blocked' }),
            expect.objectContaining({ key: 'permission_consent_note', status: 'blocked' }),
            expect.objectContaining({ key: 'audit_timestamp', status: 'blocked' }),
          ]),
        },
        eligibility: {
          humanApprovedDraftCreation: false,
          futureExplicitSendAuthorization: false,
          liveProviderSend: false,
        },
        authorizationBoundary: {
          currentPerRecipientApprovalRequired: true,
          providerFlagRequired: true,
          providerFlagEnabled: false,
          genericProceedAccepted: false,
          sendRouteImplemented: false,
          externalSendEnabled: false,
        },
        setupReadiness: {
          version: 'warm-outreach-sms-provider-setup-readiness/v1',
          state: 'recipient_evidence_required',
          selectedPath: {
            candidateKey: null,
            selectionStatus: 'not_selected',
          },
          configurationValidation: {
            credentialsRead: false,
            environmentVariablesChanged: false,
            providerSettingsChanged: false,
            featureFlagEnabled: false,
            requiredEnvironment: expect.arrayContaining([
              expect.objectContaining({
                key: 'SMS_PROVIDER_ADAPTER',
                status: 'missing',
                rawValueReturned: false,
              }),
              expect.objectContaining({
                key: 'ENABLE_WARM_SMS_PROVIDER_EXECUTION',
                status: 'disabled_verified',
                rawValueReturned: false,
              }),
            ]),
          },
          operatorPath: {
            blockedByProviderSetup: expect.arrayContaining([
              'Provider API calls',
              'Live SMS delivery',
            ]),
            requiredBeforeAnyLiveSend: expect.arrayContaining([
              'Current per-recipient approval matched to contact, SMS channel, message version, and idempotency key',
            ]),
          },
          executionBoundary: {
            providerCallsEnabled: false,
            smsDeliveryEnabled: false,
            credentialsRead: false,
            environmentChanges: false,
            featureFlagEnabled: false,
            routeImplemented: false,
          },
        },
        activationReadiness: {
          version: 'warm-outreach-sms-provider-activation-readiness/v1',
          state: 'consent_or_suppression_required',
          providerSummary: {
            selectionStatus: 'not_selected',
            configurationStatus: 'not_reviewed',
            credentialsRead: false,
            environmentChanges: false,
          },
          capabilitySummary: {
            verified: 0,
            total: 6,
            status: 'gaps_remain',
          },
          consentPrerequisites: {
            required: true,
            met: false,
            phoneProvenanceVerified: false,
            permissionDocumented: false,
            auditTimestampValid: false,
          },
          sendAuthority: {
            genericProceedAccepted: false,
            currentPerRecipientApprovalRequired: true,
            requiredApproval: 'authorize_warm_sms_send_for_specific_recipient',
            liveSendEnabled: false,
          },
          idempotencyModel: {
            status: 'contract_only',
            implemented: false,
            namespace: 'warm-sms-send:v1',
            recordBeforeProviderAttempt: true,
          },
          auditEvidence: {
            status: 'incomplete',
            storesRawPhone: false,
            storesRawMessageBody: false,
          },
          executionBoundary: {
            activationEnabled: false,
            providerCallsEnabled: false,
            smsDeliveryEnabled: false,
            routeImplemented: false,
            featureFlagEnabled: false,
          },
        },
      },
      executionBoundary: {
        manualOnly: true,
        smsProviderConfigured: false,
        smsProviderCalls: false,
        smsDelivery: false,
        phoneImport: false,
        slackDispatch: false,
        gmailAction: false,
        n8nDispatch: false,
        productionDataMutation: false,
      },
    })
    expect(json.executionBoundary).toEqual({
      source: 'local_portfolio_rows',
      readOnly: true,
      providerCalls: false,
      createsDraft: false,
      externalSend: false,
      n8nDispatch: false,
      slackAction: false,
      responseMonitoring: false,
    })
    expect(json.responseMonitoring).toMatchObject({
      version: 'warm-outreach-response-monitoring/v1',
      contactId: 42,
      status: 'manual_response_captured',
      mode: 'manual',
      providerCaptureReadiness: {
        version: 'warm-outreach-provider-response-capture-readiness/v1',
        state: 'manual_capture_ready',
        slackAlertReadiness: {
          dispatchEnabled: false,
          slackActionEnabled: false,
          route: '/admin/contacts/[id]',
        },
      },
      operatorDecisionPaths: expect.arrayContaining([
        expect.objectContaining({
          key: 'capture_response',
          externalActionEnabled: false,
        }),
        expect.objectContaining({
          key: 'review_reply_draft',
          state: 'pending_human_qa',
        }),
        expect.objectContaining({
          key: 'suppression_proposal',
          description: expect.stringContaining('does not mutate suppression directly'),
        }),
      ]),
      executionBoundary: {
        localRowsOnly: true,
        providerPollingEnabled: false,
        externalMonitoringEnabled: false,
        externalSendEnabled: false,
      },
    })
    expect(json.responseMonitoring.providerCaptureReadiness.supportedClassifications.map(
      (item: { key: string }) => item.key,
    )).toEqual([
      'interested',
      'question',
      'referral',
      'objection',
      'not_now',
      'unsubscribe_do_not_contact',
      'negative_sensitive',
      'ambiguous',
    ])
    expect(json.responseMonitoring.providerCaptureReadiness.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'gmail',
          providerIngestionEnabled: false,
          providerPollingEnabled: false,
          externalActionEnabled: false,
        }),
      ]),
    )
    expect(json.sendReadiness).toMatchObject({
      version: 'warm-outreach-send-readiness/v1',
      contactId: 42,
      executionBoundary: {
        gmailEmailSend: false,
        linkedinAction: false,
        providerExecution: false,
        externalMonitoring: false,
        gmailDraftCreation: false,
        outcomeTracking: false,
      },
    })
    expect(json.sendReadiness.modes.warm_1_to_1).toHaveLength(4)
    expect(json.sendReadiness.modes.warm_1_to_many).toHaveLength(4)
    expect(json.sendReadiness.modes.warm_1_to_1[0].sendAuthority).toMatchObject({
      version: 'warm-outreach-send-authority/v1',
      mode: 'warm_1_to_1',
      externalSendApproved: false,
      externalSendEnabled: false,
      providerExecutionEnabled: false,
      gmailDraftCreationEnabled: false,
      schedulingEnabled: false,
      outcomeTrackingEnabled: false,
    })
    expect(json.sendReadiness.modes.warm_1_to_1[0].sendAuthority.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'target_source_provenance' }),
        expect.objectContaining({ key: 'human_approval', status: 'future_gate' }),
        expect.objectContaining({ key: 'provider_capability' }),
        expect.objectContaining({ key: 'response_follow_up', status: 'future_gate' }),
      ]),
    )
    expect(JSON.stringify(json)).not.toContain('raw private body')
    expect(JSON.stringify(json)).not.toContain('private preview')
    expect(JSON.stringify(json)).not.toContain('raw transcript')
  })

  it('uses production-shaped Gmail draft evidence from outreach_queue generation_inputs for send approval readiness', async () => {
    setupRows({
      contact_submissions: [lead],
      contact_communications: [],
      outreach_queue: [
        {
          id: 'queue-production-shaped',
          contact_submission_id: 42,
          channel: 'email',
          subject: 'Warm follow-up',
          sequence_step: 1,
          status: 'draft',
          thread_id: 'gmail-thread-production-shaped',
          message_id: 'gmail-message-production-shaped',
          sent_at: null,
          generation_inputs: {
            gmail_draft_creation: {
              draft_id: 'gmail-draft-production-shaped',
              thread_id: 'gmail-thread-production-shaped',
              message_id: 'gmail-message-production-shaped',
              created_at: '2026-08-28T12:00:00.000Z',
              connected_as: 'vambah@amadutown.com',
              required_sender: 'vambah@amadutown.com',
              authorization: 'create_gmail_draft_for_recipient',
              authorized_by: 'admin-user',
              provider: 'gmail_user_oauth',
              provider_action: 'drafts.create',
              idempotency_key: 'warm-outreach:gmail-draft:v1:queue-production-shaped:42:email',
              external_send_blocked: true,
            },
          },
          created_at: '2026-08-28T12:00:00.000Z',
        },
      ],
      email_messages: [],
      meeting_records: [
        {
          id: 'meeting-1',
          contact_submission_id: 42,
          meeting_type: 'discovery',
          meeting_date: '2026-08-19T00:00:00Z',
          structured_notes: { summary: 'Discussed nonprofit operations.' },
          created_at: '2026-08-19T00:00:00Z',
        },
      ],
      meeting_action_tasks: [
        {
          id: 'task-1',
          contact_submission_id: 42,
          meeting_record_id: 'meeting-1',
          title: 'Send follow-up packet',
          status: 'pending',
          due_date: '2026-08-25',
          task_category: 'follow_up',
          outreach_queue_id: 'queue-production-shaped',
          created_at: '2026-08-19T00:00:00Z',
        },
      ],
    })

    const response = await GET(request(), { params: Promise.resolve({ id: '42' }) })

    expect(response.status).toBe(200)
    expect(selectedColumns.get('outreach_queue')).toContain('generation_inputs')
    const json = await response.json()
    const emailReadiness = json.sendReadiness.modes.warm_1_to_1.find(
      (item: { channel: string }) => item.channel === 'email',
    )
    expect(emailReadiness).toMatchObject({
      state: 'provider_gate_required',
      emailSendLifecycle: {
        state: 'blocked_before_provider_activation',
        realRecipientRolloutReadiness: {
          state: 'ready_for_send_request',
          eligibleForSendApprovalRequest: true,
          canBuildSlackApprovalPayload: true,
          requirements: {
            draftEvidence: {
              state: 'tracked',
              draftId: 'gmail-draft-production-shaped',
            },
            senderMatch: {
              state: 'matched',
              requiredSender: 'vambah@amadutown.com',
              connectedAs: 'vambah@amadutown.com',
            },
            provider: {
              state: 'configured',
            },
            authorization: {
              state: 'missing',
            },
            submittedEvidence: {
              state: 'missing',
            },
          },
          executionBoundary: {
            slackDispatch: false,
            gmailSend: false,
            providerCalls: false,
          },
        },
      },
    })
    expect(json.executionBoundary).toMatchObject({
      readOnly: true,
      providerCalls: false,
      createsDraft: false,
      externalSend: false,
      slackAction: false,
    })
  })

  it('returns 404 when the lead does not exist', async () => {
    setupRows({
      contact_submissions: [],
    })

    const response = await GET(request(), { params: Promise.resolve({ id: '42' }) })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Lead not found' })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('keeps do-not-contact leads blocked in readiness', async () => {
    setupRows({
      contact_submissions: [{ ...lead, do_not_contact: true }],
      contact_communications: [],
      outreach_queue: [],
      email_messages: [],
      meeting_records: [],
      meeting_action_tasks: [],
    })

    const response = await GET(request(), { params: Promise.resolve({ id: '42' }) })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.packet.suppression.doNotContact).toBe(true)
    expect(json.readiness).toMatchObject({
      status: 'blocked',
      blockers: expect.arrayContaining(['Contact is marked do not contact in Portfolio.']),
    })
    expect(json.smsReadiness).toMatchObject({
      state: 'blocked',
      consentAndSuppression: {
        status: 'blocked',
      },
      providerReadiness: {
        state: 'consent_or_suppression_not_satisfied',
        consentAndSuppression: {
          status: 'suppressed',
          suppressionPrecedence: true,
        },
        activationReadiness: {
          state: 'consent_or_suppression_required',
          executionBoundary: {
            activationEnabled: false,
            providerCallsEnabled: false,
            smsDeliveryEnabled: false,
          },
        },
      },
      executionBoundary: {
        smsDelivery: false,
        smsProviderCalls: false,
      },
    })
  })

  it('keeps removed leads blocked in readiness', async () => {
    setupRows({
      contact_submissions: [{ ...lead, removed_at: '2026-08-22T00:00:00Z' }],
      contact_communications: [],
      outreach_queue: [],
      email_messages: [],
      meeting_records: [],
      meeting_action_tasks: [],
    })

    const response = await GET(request(), { params: Promise.resolve({ id: '42' }) })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.packet.suppression.removedAt).toBe('2026-08-22T00:00:00Z')
    expect(json.readiness.blockers).toContain('Contact was removed from outreach.')
  })

  it('keeps unsubscribed local rows blocked in readiness', async () => {
    setupRows({
      contact_submissions: [lead],
      contact_communications: [
        {
          id: 'comm-1',
          contact_submission_id: 42,
          direction: 'inbound',
          channel: 'email',
          message_type: 'reply',
          subject: 'Unsubscribe',
          status: 'sent',
          metadata: { unsubscribed: true },
        },
      ],
      outreach_queue: [],
      email_messages: [],
      meeting_records: [],
      meeting_action_tasks: [],
    })

    const response = await GET(request(), { params: Promise.resolve({ id: '42' }) })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.packet.suppression.unsubscribed).toBe(true)
    expect(json.readiness).toMatchObject({
      status: 'blocked',
      blockers: expect.arrayContaining(['Contact is unsubscribed.']),
    })
  })

  it('makes missing source categories explicit without inventing evidence', async () => {
    setupRows({
      contact_submissions: [lead],
      contact_communications: [],
      outreach_queue: [],
      email_messages: [],
      meeting_records: [],
      meeting_action_tasks: [],
    })

    const response = await GET(request(), { params: Promise.resolve({ id: '42' }) })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.packet.relationshipBasis).toContain('limited local relationship evidence')
    expect(json.packet.sourceInventory.sourceStatus).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: 'meeting_records', status: 'missing' }),
        expect.objectContaining({ sourceType: 'meeting_action_tasks', status: 'missing' }),
        expect.objectContaining({ sourceType: 'outreach_queue/contact_communications', status: 'missing' }),
        expect.objectContaining({ sourceType: 'email_messages/contact_communications', status: 'missing' }),
      ]),
    )
  })

  it('uses manual-only capability for Facebook and phone-contact preferred channels', async () => {
    setupRows({
      contact_submissions: [{ ...lead, email: null, linkedin_url: null }],
      contact_communications: [],
      outreach_queue: [],
      email_messages: [],
      meeting_records: [],
      meeting_action_tasks: [],
    })

    const response = await GET(
      request('http://localhost/api/admin/outreach/leads/42/relationship-packet?preferred_channel=facebook'),
      { params: Promise.resolve({ id: '42' }) },
    )

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.packet.preferredChannel).toBe('facebook')
    expect(json.readiness).toMatchObject({
      selectedChannel: 'facebook',
      warnings: expect.arrayContaining([
        'Facebook outreach remains manual-only; no DM provider action is enabled.',
      ]),
    })
    expect(json.packet.channelCapabilities.phone_contact).toMatchObject({
      available: true,
      manualOnly: true,
      supportsExternalSend: false,
    })
  })

  it('keeps SMS readiness blocked when no phone number is present', async () => {
    setupRows({
      contact_submissions: [{ ...lead, phone_number: null }],
      contact_communications: [],
      outreach_queue: [],
      email_messages: [],
      meeting_records: [
        {
          id: 'meeting-1',
          contact_submission_id: 42,
          meeting_type: 'discovery',
          meeting_date: '2026-08-19T00:00:00Z',
          created_at: '2026-08-19T00:00:00Z',
        },
      ],
      meeting_action_tasks: [],
    })

    const response = await GET(
      request('http://localhost/api/admin/outreach/leads/42/relationship-packet?preferred_channel=phone_contact'),
      { params: Promise.resolve({ id: '42' }) },
    )

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.packet.channelCapabilities.phone_contact).toMatchObject({
      available: false,
      manualOnly: true,
      supportsExternalSend: false,
    })
    expect(json.smsReadiness).toMatchObject({
      state: 'blocked',
      phoneReadiness: {
        present: false,
        source: 'missing',
      },
      consentAndSuppression: {
        blockers: expect.arrayContaining([
          'No phone number is present in the Portfolio contact record.',
        ]),
      },
      recoveryStep: 'No phone number is present in the Portfolio contact record.',
      executionBoundary: {
        smsDelivery: false,
        smsProviderCalls: false,
      },
    })
  })

  it('does not call write or provider-style operations while building the packet', async () => {
    const writes = {
      insert: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      rpc: vi.fn(),
    }
    setupRows({
      contact_submissions: [lead],
      contact_communications: [],
      outreach_queue: [],
      email_messages: [],
      meeting_records: [],
      meeting_action_tasks: [],
    })

    await GET(request(), { params: Promise.resolve({ id: '42' }) })

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
})
