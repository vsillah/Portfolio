import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import {
  buildWarmOutreachSourceInventoryPacket,
  type WarmOutreachSourceInventoryRows,
} from '@/lib/warm-outreach-source-inventory'
import { evaluateWarmOutreachReadiness } from '@/lib/warm-outreach-relationship-intelligence'
import { buildWarmManualSocialHandoff } from '@/lib/warm-outreach-manual-social-handoff'

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

const meeting = {
  id: 'meeting-1',
  contact_submission_id: 42,
  meeting_type: 'discovery',
  meeting_date: '2026-08-19T00:00:00Z',
  structured_notes: { summary: 'Discussed nonprofit operations.' },
  key_decisions: [],
  created_at: '2026-08-19T00:00:00Z',
}

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/outreach/leads/42/manual-social-handoff', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function buildHandoffRows(contactCommunications: WarmOutreachSourceInventoryRows['contactCommunications'] = []) {
  const rows: WarmOutreachSourceInventoryRows = {
    contactSubmission: lead,
    contactCommunications,
    outreachQueue: [],
    emailMessages: [],
    meetingSummaries: [meeting],
    actionTasks: [],
  }
  const packet = buildWarmOutreachSourceInventoryPacket({
    contactId: 42,
    objective: 'Record manual LinkedIn, Facebook, or phone-contact handoff evidence from Portfolio.',
    preferredChannel: 'linkedin',
    rows,
  })
  const readiness = evaluateWarmOutreachReadiness(packet)
  return buildWarmManualSocialHandoff({ packet, readiness, evidenceRows: contactCommunications })
}

function setupRows(initialContactCommunications: Record<string, unknown>[] = []) {
  let contactCommunications = [...initialContactCommunications]
  const inserts: Record<string, unknown>[] = []

  mocks.from.mockImplementation((table: string) => {
    if (table === 'contact_submissions') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: lead, error: null })),
          })),
        })),
      }
    }

    if (table === 'contact_communications') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: contactCommunications, error: null })),
            })),
          })),
        })),
        insert: vi.fn((payload: Record<string, unknown>) => {
          inserts.push(payload)
          const row = {
            id: 'manual-communication-1',
            ...payload,
          }
          contactCommunications = [row, ...contactCommunications]
          return {
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: row, error: null })),
            })),
          }
        }),
      }
    }

    const tableRows: Record<string, unknown[]> = {
      outreach_queue: [],
      email_messages: [],
      meeting_records: [meeting],
      meeting_action_tasks: [],
    }
    if (table in tableRows) {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: tableRows[table], error: null })),
            })),
          })),
        })),
      }
    }

    throw new Error(`Unexpected table: ${table}`)
  })

  return { inserts }
}

describe('POST /api/admin/outreach/leads/[id]/manual-social-handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('records redacted Portfolio-local manual evidence without provider execution', async () => {
    const { inserts } = setupRows()
    const handoff = buildHandoffRows()
    const linkedin = handoff.channels.find((channel) => channel.channel === 'linkedin')
    expect(linkedin).toBeTruthy()

    const response = await POST(request({
      channel: 'linkedin',
      messageVersionKey: linkedin!.idempotency.messageVersionKey,
      manualHandoffKey: linkedin!.idempotency.manualHandoffKey,
      manualEvidenceKey: linkedin!.idempotency.manualEvidenceKey,
      operatorNote: 'Copied manually. Do not store anna@example.com or 555-0100 or https://linkedin.com/in/anna.',
    }), { params: Promise.resolve({ id: '42' }) })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toMatchObject({
      outcome: 'recorded',
      duplicatePrevented: false,
      evidence: {
        status: 'manual_sent_recorded',
        contactId: '42',
        channel: 'linkedin',
        manualEvidenceKey: linkedin!.idempotency.manualEvidenceKey,
        privacyBoundary: {
          storesRawMessageBody: false,
          storesRawContactDetails: false,
          storesScreenshot: false,
          storesProviderIdentifiers: false,
        },
        executionBoundary: {
          providerCallsEnabled: false,
          externalSendEnabled: false,
          linkedinApiEnabled: false,
          externalRequests: [],
        },
      },
      executionBoundary: {
        providerCallsEnabled: false,
        externalSendEnabled: false,
        linkedinApiCalled: false,
        facebookApiCalled: false,
        phoneAccessCalled: false,
        smsDeliveryEnabled: false,
        gmailDraftCreated: false,
        slackDispatchEnabled: false,
        n8nDispatchEnabled: false,
        externalRequests: [],
      },
    })
    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toMatchObject({
      contact_submission_id: 42,
      channel: 'linkedin',
      direction: 'outbound',
      message_type: 'manual',
      source_system: 'manual',
      source_id: linkedin!.idempotency.manualEvidenceKey,
      status: 'sent',
      body: 'Manual outreach evidence recorded in Portfolio. Raw message body redacted.',
    })
    const metadata = inserts[0].metadata as Record<string, unknown>
    expect(metadata).toMatchObject({
      version: 'warm-outreach-manual-social-evidence/v1',
      status: 'manual_sent_recorded',
      contact_submission_id: 42,
      channel: 'linkedin',
      message_version_key: linkedin!.idempotency.messageVersionKey,
      manual_handoff_key: linkedin!.idempotency.manualHandoffKey,
      manual_evidence_key: linkedin!.idempotency.manualEvidenceKey,
      provider_calls_enabled: false,
      external_send_enabled: false,
      linkedin_api_called: false,
      facebook_api_called: false,
      phone_access_called: false,
      sms_delivery_enabled: false,
      gmail_draft_created: false,
      slack_dispatch_enabled: false,
      n8n_dispatch_enabled: false,
      raw_message_body_stored: false,
      raw_contact_details_stored: false,
      screenshot_stored: false,
      provider_identifiers_stored: false,
      external_requests: [],
    })
    expect(metadata.operator_note).toContain('[redacted-email]')
    expect(metadata.operator_note).toContain('[redacted-phone]')
    expect(metadata.operator_note).toContain('[redacted-url]')
    expect(JSON.stringify(inserts[0])).not.toContain('anna@example.com')
    expect(JSON.stringify(inserts[0])).not.toContain('555-0100')
    expect(JSON.stringify(inserts[0])).not.toContain('linkedin.com/in/anna')
    expect(json.manualSocialHandoff.channels.find((channel: { channel: string }) => channel.channel === 'linkedin')).toMatchObject({
      state: 'manual_sent_recorded',
      durableEvidence: {
        status: 'manual_sent_recorded',
      },
      evidenceLock: {
        locked: true,
      },
    })
  })

  it('returns existing evidence and does not insert a duplicate for the same contact channel message version', async () => {
    const handoff = buildHandoffRows()
    const facebook = handoff.channels.find((channel) => channel.channel === 'facebook')!
    const existing = {
      id: 'manual-facebook-1',
      contact_submission_id: 42,
      channel: 'chat',
      direction: 'outbound',
      message_type: 'manual',
      source_system: 'manual',
      source_id: facebook.idempotency.manualEvidenceKey,
      status: 'sent',
      sent_at: '2026-09-02T13:00:00.000Z',
      metadata: {
        version: 'warm-outreach-manual-social-evidence/v1',
        status: 'manual_sent_recorded',
        contact_submission_id: 42,
        channel: 'facebook',
        manual_channel: 'facebook',
        message_version_key: facebook.idempotency.messageVersionKey,
        manual_handoff_key: facebook.idempotency.manualHandoffKey,
        manual_evidence_key: facebook.idempotency.manualEvidenceKey,
        operator_note: 'Recorded from Facebook manually.',
        recorded_at: '2026-09-02T13:00:00.000Z',
        provider_calls_enabled: false,
        external_send_enabled: false,
        linkedin_api_called: false,
        facebook_api_called: false,
        phone_access_called: false,
        sms_delivery_enabled: false,
        gmail_draft_created: false,
        slack_dispatch_enabled: false,
        n8n_dispatch_enabled: false,
        raw_message_body_stored: false,
        raw_contact_details_stored: false,
        screenshot_stored: false,
        provider_identifiers_stored: false,
        external_requests: [],
      },
    }
    const { inserts } = setupRows([existing])

    const response = await POST(request({
      channel: 'facebook',
      messageVersionKey: facebook.idempotency.messageVersionKey,
      manualHandoffKey: facebook.idempotency.manualHandoffKey,
      manualEvidenceKey: facebook.idempotency.manualEvidenceKey,
      operatorNote: 'Second click should not insert.',
    }), { params: Promise.resolve({ id: '42' }) })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.outcome).toBe('existing')
    expect(json.duplicatePrevented).toBe(true)
    expect(json.evidence).toMatchObject({
      status: 'manual_sent_recorded',
      channel: 'facebook',
      manualEvidenceKey: facebook.idempotency.manualEvidenceKey,
    })
    expect(inserts).toHaveLength(0)
  })
})
