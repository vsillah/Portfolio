import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: null }))

import { buildWarmOutreachSourceInventory } from './warm-outreach-source-inventory'

type TableData = Record<string, unknown[] | Record<string, unknown> | null>

const baseContact = {
  id: 42,
  name: 'Amina Example',
  email: 'amina@example.com',
  company: 'Example Co',
  company_domain: 'example.com',
  job_title: 'Founder',
  industry: 'Operations',
  phone_number: null,
  linkedin_url: null,
  facebook_profile_url: null,
  message: null,
  lead_source: 'warm_google_contacts',
  relationship_strength: null,
  warm_source_detail: null,
  quick_wins: null,
  rep_pain_points: null,
  do_not_contact: false,
  removed_at: null,
  outreach_status: null,
}

function makeDb(tables: TableData, queried: string[] = []) {
  return {
    queried,
    from(table: string) {
      queried.push(table)
      const value = tables[table]
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        in() {
          return this
        },
        order() {
          return this
        },
        async limit(limit: number) {
          if (value && !Array.isArray(value) && 'error' in value) {
            return { data: null, error: value.error }
          }
          return {
            data: Array.isArray(value) ? value.slice(0, limit) : [],
            error: null,
          }
        },
        async maybeSingle() {
          if (value && !Array.isArray(value) && 'error' in value) {
            return { data: null, error: value.error }
          }
          return {
            data: Array.isArray(value) ? value[0] ?? null : value ?? null,
            error: null,
          }
        },
      }
    },
  }
}

function expectInventory(result: Awaited<ReturnType<typeof buildWarmOutreachSourceInventory>>) {
  expect('packet' in result).toBe(true)
  if (!('packet' in result)) throw new Error('Expected inventory packet')
  return result
}

describe('buildWarmOutreachSourceInventory', () => {
  it('returns source refs from local Portfolio tables without provider execution', async () => {
    const db = makeDb({
      contact_submissions: [{
        ...baseContact,
        linkedin_url: 'https://www.linkedin.com/in/amina',
        phone_number: '555-0100',
        message: 'Raw private lead note should stay out.',
        quick_wins: 'Raw private quick win should stay out.',
      }],
      contact_communications: [{
        id: 'comm-1',
        channel: 'email',
        direction: 'inbound',
        message_type: 'reply',
        subject: 'Private subject',
        source_system: 'gmail',
        source_id: 'gmail-1',
        status: 'received',
        sent_at: '2026-08-20T10:00:00Z',
        created_at: '2026-08-20T10:00:00Z',
      }],
      outreach_queue: [{
        id: 'outreach-1',
        channel: 'email',
        subject: 'Draft',
        sequence_step: 1,
        status: 'draft',
        reply_content: 'Raw reply content should stay out.',
        sent_at: null,
        replied_at: '2026-08-21T10:00:00Z',
        created_at: '2026-08-21T10:00:00Z',
      }],
      email_messages: [{
        id: 'email-1',
        channel: 'email',
        direction: 'outbound',
        status: 'draft',
        transport: 'gmail',
        source_system: 'outreach_queue',
        source_id: 'outreach-1',
        external_id: 'external-1',
        subject: 'Private email subject',
        sent_at: null,
        created_at: '2026-08-21T10:00:00Z',
      }],
      meeting_records: [{
        id: 'meeting-1',
        meeting_type: 'intro',
        meeting_date: '2026-08-19T10:00:00Z',
        structured_notes: { summary: 'Private structured meeting note' },
        raw_notes: 'Raw meeting note should stay out.',
        transcript: 'Raw transcript should stay out.',
      }],
      meeting_action_tasks: [{
        id: 'task-1',
        title: 'Private task title should stay out.',
        status: 'pending',
        due_date: '2026-08-25T10:00:00Z',
        task_category: 'follow_up',
        created_at: '2026-08-22T10:00:00Z',
      }],
    })

    const result = expectInventory(await buildWarmOutreachSourceInventory({
      contactId: 42,
      db,
    }))

    expect(result.status).toBe('ready')
    expect(result.providerCallsAttempted).toBe(false)
    expect(result.externalExecutionEnabled).toBe(false)
    expect(result.queriedTables).toEqual([
      'contact_submissions',
      'contact_communications',
      'outreach_queue',
      'email_messages',
      'meeting_records',
      'meeting_action_tasks',
    ])
    expect(db.queried).toEqual(result.queriedTables)
    expect(result.packet.sourceRefs.map((source) => source.sourceType)).toEqual(expect.arrayContaining([
      'portfolio_contact',
      'manual_note',
      'linkedin',
      'phone_contact',
      'contact_communication',
      'outreach_queue',
      'email_message',
      'meeting_record',
      'meeting_action_task',
    ]))
  })

  it('marks private source summaries as unsafe to mention without quoting raw material', async () => {
    const result = expectInventory(await buildWarmOutreachSourceInventory({
      contactId: 42,
      db: makeDb({
        contact_submissions: [{
          ...baseContact,
          message: 'Raw private note that must not leak.',
          phone_number: '555-0100',
        }],
        contact_communications: [{
          id: 'comm-1',
          channel: 'email',
          direction: 'inbound',
          message_type: 'reply',
          subject: 'Private message subject must not leak.',
          source_system: 'gmail',
          source_id: 'gmail-1',
          status: 'received',
          sent_at: null,
          created_at: '2026-08-20T10:00:00Z',
        }],
        outreach_queue: [],
        email_messages: [],
        meeting_records: [],
        meeting_action_tasks: [],
      }),
    }))

    const privateRefs = result.packet.sourceRefs.filter((source) => source.privateSource)
    expect(privateRefs.length).toBeGreaterThan(0)
    expect(privateRefs.every((source) => source.safeToMention === false)).toBe(true)
    expect(privateRefs.every((source) => source.avoidInDraftReason)).toBe(true)
    expect(JSON.stringify(result.packet.sourceRefs)).not.toContain('Raw private note')
    expect(JSON.stringify(result.packet.sourceRefs)).not.toContain('Private message subject')
  })

  it('keeps DNC and removed contacts hard blocked', async () => {
    const result = expectInventory(await buildWarmOutreachSourceInventory({
      contactId: 42,
      db: makeDb({
        contact_submissions: [{
          ...baseContact,
          do_not_contact: true,
          removed_at: '2026-08-20T10:00:00Z',
        }],
        contact_communications: [],
        outreach_queue: [],
        email_messages: [],
        meeting_records: [],
        meeting_action_tasks: [],
      }),
    }))

    expect(result.status).toBe('blocked')
    expect(result.readiness.status).toBe('blocked')
    expect(result.readiness.blockers).toContain('Contact is marked do not contact in Portfolio.')
    expect(result.readiness.blockers).toContain('Contact was removed from outreach.')
  })

  it('keeps Facebook and phone contacts manual-only with no draft/send capability', async () => {
    const result = expectInventory(await buildWarmOutreachSourceInventory({
      contactId: 42,
      db: makeDb({
        contact_submissions: [{
          ...baseContact,
          email: null,
          linkedin_url: null,
          facebook_profile_url: 'https://facebook.com/example',
          phone_number: '555-0100',
          lead_source: 'warm_facebook_friends',
        }],
        contact_communications: [],
        outreach_queue: [],
        email_messages: [],
        meeting_records: [],
        meeting_action_tasks: [],
      }),
    }))

    expect(result.packet.preferredChannel).toBe('facebook')
    expect(result.packet.channelCapabilities.facebook).toMatchObject({
      available: true,
      manualOnly: true,
      supportsExternalSend: false,
      supportsDraftCreation: false,
    })
    expect(result.packet.channelCapabilities.phone_contact).toMatchObject({
      available: true,
      manualOnly: true,
      supportsExternalSend: false,
      supportsDraftCreation: false,
    })
    expect(result.readiness.warnings).toContain('Facebook is manual-only; no DM draft or provider execution is enabled.')
  })

  it('does not enable response monitoring or provider behavior', async () => {
    const result = expectInventory(await buildWarmOutreachSourceInventory({
      contactId: 42,
      db: makeDb({
        contact_submissions: [{
          ...baseContact,
          linkedin_url: 'https://www.linkedin.com/in/amina',
        }],
        contact_communications: [],
        outreach_queue: [],
        email_messages: [{
          id: 'email-1',
          channel: 'email',
          direction: 'inbound',
          status: 'received',
          transport: 'gmail',
          source_system: 'gmail',
          source_id: 'gmail-1',
          external_id: 'external-1',
          subject: 'Private reply subject',
          sent_at: '2026-08-21T10:00:00Z',
          created_at: '2026-08-21T10:00:00Z',
        }],
        meeting_records: [],
        meeting_action_tasks: [],
      }),
    }))

    expect(result.packet.responseMonitoringPlan).toMatchObject({
      enabled: false,
      status: 'provider_gate_required',
      humanApprovalRequired: true,
      channels: ['email', 'linkedin'],
    })
    expect(result.packet.channelCapabilities.email?.supportsReplyMonitoring).toBe(false)
    expect(result.packet.channelCapabilities.linkedin?.supportsReplyMonitoring).toBe(false)
    expect(result.providerCallsAttempted).toBe(false)
    expect(result.externalExecutionEnabled).toBe(false)
  })
})
