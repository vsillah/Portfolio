import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const MEETING_ID = '11111111-1111-4111-8111-111111111111'
const PACKET_ID = '22222222-2222-4222-8222-222222222222'
const APPROVED_AT = '2026-10-11T10:00:00.000Z'
const REQUIRED_FIELDS = 'An approved privacy-safe summary, provenance, product identity, lifecycle stage, title, and source are required.'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  persistApprovedSourceProjections: vi.fn(),
  collectLiveSocialTopicCoverage: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/social-topic-source-receipts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/social-topic-source-receipts')>()
  return {
    ...actual,
    persistApprovedSourceProjections: mocks.persistApprovedSourceProjections,
  }
})

vi.mock('@/lib/social-topic-source-coverage', () => ({
  collectLiveSocialTopicCoverage: mocks.collectLiveSocialTopicCoverage,
}))

import { POST } from './route'

function post(body: unknown) {
  return new NextRequest('http://localhost/api/admin/social-content/source-summaries', {
    method: 'POST',
    headers: {
      authorization: 'Bearer admin-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

function approvedBody(overrides: Record<string, unknown> = {}) {
  return {
    source_kind: 'open_brain_approved_projection',
    source_id: 'proposal-1',
    approved_summary: 'A privacy-safe summary of the learning mode decision.',
    title: 'Learning mode insight',
    provenance: 'open_brain:proposal-1',
    product_identity: 'dark_castle_chess',
    privacy_classification: 'public_safe',
    lifecycle_stage: 'insight',
    approval_status: 'approved',
    ...overrides,
  }
}

function installMeeting(options: {
  read?: { data: unknown; error: { message: string } | null }
  updateError?: { message: string } | null
} = {}) {
  const update = vi.fn((payload: unknown) => ({
    eq: vi.fn().mockResolvedValue({ error: options.updateError ?? null }),
    payload,
  }))
  mocks.from.mockImplementation((table: string) => {
    if (table !== 'meeting_records') throw new Error(`unexpected table ${table}`)
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve(options.read ?? {
            data: { id: MEETING_ID, structured_notes: { existing_note: 'keep' } },
            error: null,
          }),
        }),
      }),
      update,
    }
  })
  return update
}

function installPacket(options: {
  read?: { data: unknown; error: { message: string } | null }
  updateError?: { message: string } | null
} = {}) {
  const statusEq = vi.fn().mockResolvedValue({ error: options.updateError ?? null })
  const update = vi.fn(() => ({
    eq: vi.fn(() => ({ eq: statusEq })),
  }))
  mocks.from.mockImplementation((table: string) => {
    if (table !== 'social_content_research_packets') throw new Error(`unexpected table ${table}`)
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve(options.read ?? {
            data: {
              id: PACKET_ID,
              status: 'approved',
              pattern_packet: { existing_pattern: true },
            },
            error: null,
          }),
        }),
      }),
      update,
    }
  })
  return { update, statusEq }
}

describe('POST /api/admin/social-content/source-summaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(APPROVED_AT))
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.persistApprovedSourceProjections.mockResolvedValue([])
    mocks.collectLiveSocialTopicCoverage.mockResolvedValue({
      status: 'ready',
      generated_at: APPROVED_AT,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requires an admin session before reading or writing a source', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(post(approvedBody()))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.persistApprovedSourceProjections).not.toHaveBeenCalled()
    expect(mocks.collectLiveSocialTopicCoverage).not.toHaveBeenCalled()
  })

  it('rejects a recurring-priority change that is not explicitly approved', async () => {
    const response = await POST(post(approvedBody({
      recurring_priority: { enabled: true, approval_status: 'pending', order: 1 },
    })))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Recurring-priority changes require explicit approved metadata.',
    })
    expect(mocks.persistApprovedSourceProjections).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it.each([
    ['draft approval', { approval_status: 'draft' }],
    ['private classification', { privacy_classification: 'private' }],
    ['public catalog lifecycle', { lifecycle_stage: 'publicly_cataloged' }],
    ['in-development lifecycle', { lifecycle_stage: 'in_development' }],
    ['unknown source kind', { source_kind: 'raw_transcript' }],
    ['blank summary', { approved_summary: '   ' }],
    ['missing title', { title: '' }],
  ])('rejects %s before any write', async (_label, overrides) => {
    const response = await POST(post(approvedBody(overrides)))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: REQUIRED_FIELDS })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.persistApprovedSourceProjections).not.toHaveBeenCalled()
  })

  it('rejects a body that is not JSON', async () => {
    const response = await POST(new NextRequest('http://localhost/api/admin/social-content/source-summaries', {
      method: 'POST',
      headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
      body: '{',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: REQUIRED_FIELDS })
    expect(mocks.persistApprovedSourceProjections).not.toHaveBeenCalled()
  })

  it.each(['meeting_summary', 'owned_media_summary'] as const)(
    'requires a UUID for %s',
    async (sourceKind) => {
      const response = await POST(post(approvedBody({
        source_kind: sourceKind,
        source_id: 'not-a-uuid',
      })))

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Meeting and owned-media source ids must be UUIDs.',
      })
      expect(mocks.from).not.toHaveBeenCalled()
    },
  )

  it('returns not found when the meeting source is missing', async () => {
    installMeeting({ read: { data: null, error: null } })

    const response = await POST(post(approvedBody({
      source_kind: 'meeting_summary',
      source_id: MEETING_ID,
    })))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Meeting source not found.' })
    expect(mocks.persistApprovedSourceProjections).not.toHaveBeenCalled()
  })

  it('hides a meeting read failure behind a closed code', async () => {
    installMeeting({ read: { data: null, error: { message: 'relation secret_meetings is missing' } } })

    const response = await POST(post(approvedBody({
      source_kind: 'meeting_summary',
      source_id: MEETING_ID,
    })))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'meeting_summary_source_read_failed' })
    expect(JSON.stringify(body)).not.toContain('secret_meetings')
    expect(mocks.persistApprovedSourceProjections).not.toHaveBeenCalled()
  })

  it('does not persist a receipt when the meeting projection write fails', async () => {
    installMeeting({ updateError: { message: 'column secret_notes is missing' } })

    const response = await POST(post(approvedBody({
      source_kind: 'meeting_summary',
      source_id: MEETING_ID,
    })))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'meeting_summary_projection_failed' })
    expect(JSON.stringify(body)).not.toContain('secret_notes')
    expect(mocks.persistApprovedSourceProjections).not.toHaveBeenCalled()
    expect(mocks.collectLiveSocialTopicCoverage).not.toHaveBeenCalled()
  })

  it('stores a redacted meeting receipt and an explicitly approved priority', async () => {
    const update = installMeeting()

    const response = await POST(post(approvedBody({
      source_kind: 'meeting_summary',
      source_id: MEETING_ID,
      approved_summary: 'Email me at person@example.com or 202-555-0198.',
      product_identity: 'Dark-Castle-Chess preview',
      evidence_url: 'https://example.com/evidence',
      approval_reference: 'review-42',
      recurring_priority: { enabled: true, approval_status: 'approved', order: 0 },
    })))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith({
      structured_notes: {
        existing_note: 'keep',
        social_topic_summary: {
          status: 'approved',
          title: 'Learning mode insight',
          summary: 'Email me at person@example.com or 202-555-0198.',
          privacy_classification: 'public_safe',
          provenance: 'open_brain:proposal-1',
          product_ids: ['Dark-Castle-Chess preview'],
          approved_at: APPROVED_AT,
          approved_by: 'admin-user',
          raw_content_included: false,
          recurring_priority: {
            approval_status: 'approved',
            enabled: true,
            order: Number.MAX_SAFE_INTEGER,
            approved_at: APPROVED_AT,
            approved_by: 'admin-user',
          },
        },
      },
    })
    expect(mocks.persistApprovedSourceProjections).toHaveBeenCalledTimes(1)
    const [projection] = mocks.persistApprovedSourceProjections.mock.calls[0][0]
    expect(projection).toMatchObject({
      source_group: 'meeting_summaries',
      source_kind: 'meeting_summary',
      source_id: MEETING_ID,
      product_identity: 'dark_castle_chess',
      lifecycle_stage: 'insight',
      approval_status: 'approved',
      raw_content_included: false,
      evidence_url: 'https://example.com/evidence',
      approved_by: 'admin-user',
      approved_at: APPROVED_AT,
    })
    expect(projection.approved_summary).toContain('[email redacted]')
    expect(projection.approved_summary).toContain('[phone redacted]')
    expect(projection.approved_summary).not.toContain('person@example.com')
    expect(projection.metadata).toMatchObject({
      approval_reference: 'review-42',
      producer: 'social_content_approved_summary',
      recurring_priority: { enabled: true, order: Number.MAX_SAFE_INTEGER },
    })
    expect(mocks.collectLiveSocialTopicCoverage).toHaveBeenCalledWith({ persist: true })
    expect(body).toMatchObject({
      success: true,
      receipt: projection,
      reconciliation: { status: 'ready', generated_at: APPROVED_AT },
      candidate_creation: 'review_only',
      raw_content_included: false,
      side_effects: { publish: false, schedule: false, provider_call: false, external_send: false },
    })
  })

  it('refuses an owned-media summary until the research packet is approved', async () => {
    installPacket({
      read: {
        data: { id: PACKET_ID, status: 'draft', pattern_packet: {} },
        error: null,
      },
    })

    const response = await POST(post(approvedBody({
      source_kind: 'owned_media_summary',
      source_id: PACKET_ID,
    })))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'Approve the research packet before its summary can become a source receipt.',
    })
    expect(mocks.persistApprovedSourceProjections).not.toHaveBeenCalled()
  })

  it('returns not found when the owned-media packet is missing', async () => {
    installPacket({ read: { data: null, error: null } })

    const response = await POST(post(approvedBody({
      source_kind: 'owned_media_summary',
      source_id: PACKET_ID,
    })))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Owned-media source not found.' })
    expect(mocks.persistApprovedSourceProjections).not.toHaveBeenCalled()
  })

  it('hides an owned-media read failure behind a closed code', async () => {
    installPacket({ read: { data: null, error: { message: 'relation secret_packets is missing' } } })

    const response = await POST(post(approvedBody({
      source_kind: 'owned_media_summary',
      source_id: PACKET_ID,
    })))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'owned_media_source_read_failed' })
    expect(JSON.stringify(body)).not.toContain('secret_packets')
    expect(mocks.persistApprovedSourceProjections).not.toHaveBeenCalled()
  })

  it('keeps the owned-media write scoped to an approved packet', async () => {
    const { update, statusEq } = installPacket()

    const response = await POST(post(approvedBody({
      source_kind: 'owned_media_summary',
      source_id: PACKET_ID,
      privacy_classification: 'client_safe_summary',
      lifecycle_stage: 'preview_deployed',
    })))

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith({
      pattern_packet: {
        existing_pattern: true,
        topic_source_receipt: {
          status: 'approved',
          source_kind: 'owned_media_summary',
          approved_summary: 'A privacy-safe summary of the learning mode decision.',
          privacy_classification: 'client_safe_summary',
          provenance: 'open_brain:proposal-1',
          product_ids: ['dark_castle_chess'],
          approved_at: APPROVED_AT,
          approved_by: 'admin-user',
          raw_content_included: false,
          recurring_priority: null,
        },
      },
    })
    expect(statusEq).toHaveBeenCalledWith('status', 'approved')
    const [projection] = mocks.persistApprovedSourceProjections.mock.calls[0][0]
    expect(projection).toMatchObject({
      source_group: 'owned_media_summaries',
      source_kind: 'owned_media_summary',
      privacy_classification: 'client_safe_summary',
      lifecycle_stage: 'preview_deployed',
      metadata: { recurring_priority: null },
    })
  })

  it('does not persist a receipt when the owned-media projection write fails', async () => {
    installPacket({ updateError: { message: 'column secret_pattern is missing' } })

    const response = await POST(post(approvedBody({
      source_kind: 'owned_media_summary',
      source_id: PACKET_ID,
    })))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'owned_media_summary_projection_failed' })
    expect(JSON.stringify(body)).not.toContain('secret_pattern')
    expect(mocks.persistApprovedSourceProjections).not.toHaveBeenCalled()
  })

  it('maps a convex product record onto operational records without a source-table write', async () => {
    const response = await POST(post(approvedBody({
      source_kind: 'convex_approved_product_record',
      source_id: 'convex-product-1',
      lifecycle_stage: 'production_deployed',
      recurring_priority: { enabled: false, approval_status: 'approved', order: 2 },
    })))

    expect(response.status).toBe(200)
    expect(mocks.from).not.toHaveBeenCalled()
    const [projection] = mocks.persistApprovedSourceProjections.mock.calls[0][0]
    expect(projection).toMatchObject({
      source_group: 'operational_records',
      source_kind: 'convex_approved_product_record',
      source_id: 'convex-product-1',
      lifecycle_stage: 'production_deployed',
      metadata: {
        recurring_priority: {
          approval_status: 'approved',
          enabled: false,
          order: 2,
          approved_at: APPROVED_AT,
          approved_by: 'admin-user',
        },
      },
    })
  })

  it('keeps a saved receipt when live coverage refresh fails', async () => {
    mocks.collectLiveSocialTopicCoverage.mockRejectedValue(
      new Error('coverage_scan_persist_failed:relation secret_scans is missing'),
    )

    const response = await POST(post(approvedBody()))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.reconciliation).toBeNull()
    expect(body.success).toBe(true)
    expect(JSON.stringify(body)).not.toContain('secret_scans')
    expect(mocks.persistApprovedSourceProjections).toHaveBeenCalledTimes(1)
    const [projection] = mocks.persistApprovedSourceProjections.mock.calls[0][0]
    expect(projection.source_group).toBe('codex_insights')
  })

  it('does not refresh coverage when receipt persistence fails', async () => {
    mocks.persistApprovedSourceProjections.mockRejectedValue('database unavailable')

    const response = await POST(post(approvedBody({
      source_kind: 'supabase_approved_product_record',
      source_id: 'supabase-product-1',
    })))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Approved summary projection failed' })
    expect(mocks.collectLiveSocialTopicCoverage).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
