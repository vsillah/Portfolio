import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: vi.fn() },
}))
vi.mock('@/lib/agent-work-items', () => ({
  createAgentWorkItem: vi.fn(),
}))
vi.mock('@/lib/llm-dispatch', () => ({
  generateJsonCompletion: vi.fn(),
}))
vi.mock('@/lib/open-brain', () => ({
  getOpenBrainSnapshot: vi.fn(),
}))
import { generateJsonCompletion } from '@/lib/llm-dispatch'
import { getOpenBrainSnapshot } from '@/lib/open-brain'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildSocialTopicCoverageReport,
  candidateKey,
  collectSocialTopicSignals,
  discoverSocialTopicCandidates,
  SocialTopicCoverageError,
  type SocialTopicSourceReceipt,
  type SourceSignal,
  type TopicTriggerCandidate,
} from './social-topic-backlog'

function receipt(
  sourceId: string,
  productId: SocialTopicSourceReceipt['product_ids'][number],
): SocialTopicSourceReceipt {
  return {
    receipt_id: `receipt:${sourceId}`,
    source_id: sourceId,
    source_kind: 'amadutown_product',
    approval_status: 'approved',
    approved_at: '2026-10-09T12:00:00.000Z',
    approved_by: 'public_catalog_state',
    privacy_classification: 'public_safe',
    provenance: `public_catalog:products:${sourceId}`,
    summary_sha256: 'a'.repeat(64),
    product_ids: [productId],
    raw_content_included: false,
  }
}

function signal(sourceId: string, productId: SocialTopicSourceReceipt['product_ids'][number]): SourceSignal {
  const sourceReceipt = receipt(sourceId, productId)
  return {
    id: sourceId,
    type: 'portfolio_work',
    kind: 'amadutown_product',
    label: productId,
    summary: `Approved ${productId} summary.`,
    date: '2026-10-09T12:00:00.000Z',
    sensitivity: 'public_safe',
    receipt: sourceReceipt,
    product_ids: [productId],
  }
}

function candidate(overrides: Partial<TopicTriggerCandidate> = {}): TopicTriggerCandidate {
  const sourceReceipt = receipt('products:agentified', 'agentified')
  return {
    id: 'model-output-id',
    title: 'The operating lesson behind Agentified',
    triggering_event: 'An approved public product summary is ready.',
    source_type: 'portfolio_work',
    source_label: 'Agentified',
    source_ids: ['products:agentified'],
    why_vambah_can_speak: 'The product record is approved and public.',
    brand_goal: 'Keep product coverage recurring.',
    content_angle: 'Explain the operating choice.',
    suggested_hook: 'The product started with a constraint.',
    audience: 'Operators',
    sensitivity: 'public_safe',
    evidence_summary: 'Approved product summary.',
    claim_boundaries: ['Verify performance claims.'],
    source_receipts: [sourceReceipt],
    product_ids: ['agentified'],
    priority_score: 70,
    priority_tier: 'medium',
    priority_reasons: ['Required product coverage: Agentified'],
    dedupe_fingerprint: 'b'.repeat(64),
    ...overrides,
  }
}

describe('social topic source coverage', () => {
  it('fails closed with actionable blockers when a required product receipt is absent', () => {
    const report = buildSocialTopicCoverageReport([
      signal('prototype:dark-castle-chess', 'dark_castle_chess'),
      signal('service:accelerated', 'accelerated'),
    ], '2026-10-09T12:00:00.000Z')

    expect(report.status).toBe('blocked')
    expect(report.products).toEqual(expect.arrayContaining([
      expect.objectContaining({ product_id: 'dark_castle_chess', status: 'ready' }),
      expect.objectContaining({ product_id: 'accelerated', status: 'ready' }),
      expect.objectContaining({
        product_id: 'agentified',
        status: 'blocked',
        blocker: expect.stringContaining('Approve at least one privacy-safe Agentified summary'),
      }),
    ]))
  })

  it('reports ready only when all recurring product receipts are present', () => {
    const report = buildSocialTopicCoverageReport([
      signal('prototype:dark-castle-chess', 'dark_castle_chess'),
      signal('service:accelerated', 'accelerated'),
      signal('publication:agentified', 'agentified'),
    ], '2026-10-09T12:00:00.000Z')

    expect(report.status).toBe('ready')
    expect(report.blockers).toEqual([])
    expect(report.source_receipt_count).toBe(3)
  })

  it('reports a source collector failure instead of silently treating the scan as complete', () => {
    const report = buildSocialTopicCoverageReport([
      signal('prototype:dark-castle-chess', 'dark_castle_chess'),
      signal('service:accelerated', 'accelerated'),
      signal('publication:agentified', 'agentified'),
    ], '2026-10-09T12:00:00.000Z', [{
      source_group: 'meeting_summaries',
      status: 'blocked',
      receipt_count: 0,
      blocker: '[source_collection_failed:meeting_summaries] Restore read access and retry.',
    }])

    expect(report.status).toBe('blocked')
    expect(report.blockers).toContain('[source_collection_failed:meeting_summaries] Restore read access and retry.')
    expect(report.products.every((product) => product.status === 'ready')).toBe(true)
  })

  it('uses the receipt-bound fingerprint instead of a model-generated candidate id', () => {
    const first = candidate({ id: 'first-model-id' })
    const second = candidate({ id: 'different-model-id' })

    expect(candidateKey(first)).toBe(candidateKey(second))
    expect(candidateKey(first)).toMatch(/^topic-[a-f0-9]{40}$/)
  })
})

const RAW_EMAIL = 'jane.operator@example.com'
const RAW_PHONE = '404-555-0199'
const RAW_URL = 'https://internal.example.com/clients/acme?token=raw-token'
const REDACTED_CONTACT = `Contact ${RAW_EMAIL} or ${RAW_PHONE}. Notes at ${RAW_URL}.`

function queryResult(data: unknown, error: unknown = null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data, error }),
  }
  return chain
}

function catalogRow(id: string, title: string, description: string) {
  return {
    id,
    title,
    description,
    updated_at: '2026-10-09T12:00:00.000Z',
    created_at: '2026-10-01T12:00:00.000Z',
    publication_date: '2026-10-01T12:00:00.000Z',
  }
}

function approvedMeeting(id: string, summary: string, extras: Record<string, unknown> = {}) {
  return {
    id,
    meeting_type: 'Product review',
    meeting_date: '2026-10-08',
    created_at: '2026-10-08T12:00:00.000Z',
    social_topic_summary: {
      status: 'approved',
      title: 'Approved meeting summary',
      summary,
      privacy_classification: 'client_safe_summary',
      provenance: `meeting_records:${id}:structured_notes.social_topic_summary`,
      approved_at: '2026-10-09T12:00:00.000Z',
      approved_by: 'admin-1',
      product_ids: [],
      ...extras,
    },
  }
}

describe('social topic signal collection gates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getOpenBrainSnapshot).mockResolvedValue({ proposals: [] } as never)
  })

  function stubSources(input: {
    meetings?: unknown
    meetingError?: unknown
    ownedMedia?: unknown[]
    prototypes?: unknown[]
    products?: unknown[]
    publications?: unknown[]
    services?: unknown[]
  }) {
    const tables: Record<string, { data: unknown; error: unknown }> = {
      meeting_records: {
        data: input.meetings ?? [],
        error: input.meetingError ?? null,
      },
      social_content_research_packets: { data: input.ownedMedia ?? [], error: null },
      app_prototypes: { data: input.prototypes ?? [], error: null },
      products: { data: input.products ?? [], error: null },
      publications: { data: input.publications ?? [], error: null },
      services: { data: input.services ?? [], error: null },
    }
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      const result = tables[table]
      if (!result) throw new Error(`Unexpected source table ${table}`)
      return queryResult(result.data, result.error) as never
    })
  }

  it('redacts contact details and drops unapproved, private, or unprovenanced sources', async () => {
    vi.mocked(getOpenBrainSnapshot).mockResolvedValue({
      proposals: [
        {
          id: 'proposal-private',
          status: 'approved',
          proposedMemory: {
            kind: 'fact',
            title: 'Private tier',
            body: 'PRIVATE_TIER_BODY',
            privacyTier: 'private',
            confidence: 1,
            sourceIds: ['source-private'],
          },
          sourceIds: ['source-private'],
          reviewedAt: '2026-10-09T12:00:00.000Z',
          reviewedBy: 'admin-1',
        },
        {
          id: 'proposal-unprovenanced',
          status: 'approved',
          proposedMemory: {
            kind: 'fact',
            title: 'Missing provenance',
            body: 'NO_PROVENANCE_BODY',
            privacyTier: 'client_safe',
            confidence: 1,
            sourceIds: [],
          },
          sourceIds: [],
          reviewedAt: '2026-10-09T12:00:00.000Z',
          reviewedBy: 'admin-1',
        },
      ],
    } as never)
    stubSources({
      meetings: [
        approvedMeeting('meeting-redact', `Dark Castle Chess review. ${REDACTED_CONTACT}`),
        {
          id: 'meeting-unapproved',
          meeting_type: 'Private meeting',
          meeting_date: '2026-10-08',
          created_at: '2026-10-08T12:00:00.000Z',
          social_topic_summary: { status: 'draft', summary: 'SECRET_UNAPPROVED must stay out of discovery.' },
        },
        approvedMeeting('meeting-no-approver', 'DROP_ME_MISSING_APPROVER', { approved_by: '' }),
      ],
      ownedMedia: [{
        id: 'packet-draft-receipt',
        title: 'Owned media',
        status: 'approved',
        pattern_packet: {
          topic_source_receipt: {
            source_kind: 'owned_media_summary',
            status: 'draft',
            approved_summary: 'LEAK_UNAPPROVED_OWNED_MEDIA',
          },
        },
      }],
      prototypes: [{
        id: 'prototype-empty',
        title: 'ONLY_EMPTY_PROTOTYPE',
        description: '   ',
        production_stage: 'Production',
        updated_at: '2026-10-09T12:00:00.000Z',
      }],
      products: [catalogRow('product-unaccelerated', 'Unaccelerated workshop', 'A public workshop note about a different offer.')],
      publications: [catalogRow('book-dcc', 'dark-castle-chess field notes', 'Public book notes.')],
      services: [catalogRow('service-accelerated', 'Accelerated', 'A public operating course.')],
    })

    const { signals } = await collectSocialTopicSignals()
    const serialized = JSON.stringify(signals)

    expect(serialized).not.toContain(RAW_EMAIL)
    expect(serialized).not.toContain(RAW_PHONE)
    expect(serialized).not.toContain('raw-token')
    expect(serialized).not.toContain('/clients/acme')
    expect(serialized).toContain('[email redacted]')
    expect(serialized).toContain('[phone redacted]')
    expect(serialized).toContain('https://internal.example.com/[private-path-redacted]')
    expect(serialized).not.toContain('SECRET_UNAPPROVED')
    expect(serialized).not.toContain('PRIVATE_TIER_BODY')
    expect(serialized).not.toContain('NO_PROVENANCE_BODY')
    expect(serialized).not.toContain('DROP_ME_MISSING_APPROVER')
    expect(serialized).not.toContain('LEAK_UNAPPROVED_OWNED_MEDIA')
    expect(serialized).not.toContain('ONLY_EMPTY_PROTOTYPE')
    expect(signals.find((signal) => signal.id === 'meeting:meeting-redact')?.product_ids).toEqual(['dark_castle_chess'])
    expect(signals.find((signal) => signal.id === 'publications:book-dcc')?.product_ids).toEqual(['dark_castle_chess'])
    expect(signals.find((signal) => signal.id === 'services:service-accelerated')?.product_ids).toEqual(['accelerated'])
    expect(signals.find((signal) => signal.id === 'products:product-unaccelerated')?.product_ids).toEqual([])
    expect(signals.every((signal) => signal.receipt.raw_content_included === false)).toBe(true)
  })

  it('blocks a failed source scan without leaking the database error or calling the model', async () => {
    stubSources({
      meetingError: { message: 'relation secret_meetings is missing' },
      prototypes: [catalogRow('prototype-dcc', 'Dark Castle Chess', 'Public learning gates.')],
      products: [catalogRow('product-agentified', 'Agentified', 'Public agent systems book.')],
      services: [catalogRow('service-accelerated', 'Accelerated', 'Public operating course.')],
    })

    const collected = await collectSocialTopicSignals()
    const meetingCollection = collected.sourceCollections.find((collection) => collection.source_group === 'meeting_summaries')

    expect(meetingCollection).toMatchObject({
      status: 'blocked',
      receipt_count: 0,
      blocker: expect.stringContaining('[source_collection_failed:meeting_summaries]'),
    })
    expect(JSON.stringify(collected)).not.toContain('secret_meetings')
    expect(collected.signals.map((signal) => signal.id)).toEqual(expect.arrayContaining([
      'app_prototype:prototype-dcc',
      'products:product-agentified',
      'services:service-accelerated',
    ]))

    await expect(discoverSocialTopicCandidates({ actorId: 'admin-1' })).rejects.toBeInstanceOf(SocialTopicCoverageError)
    expect(generateJsonCompletion).not.toHaveBeenCalled()
  })

  it('drops invented source ids, redacts model text, and still covers required products', async () => {
    stubSources({
      meetings: [approvedMeeting('meeting-redact', REDACTED_CONTACT)],
      prototypes: [catalogRow('prototype-dcc', 'Dark Castle Chess', 'Public learning gates.')],
      products: [catalogRow('product-agentified', 'Agentified', 'Public agent systems book.')],
      services: [catalogRow('service-accelerated', 'Accelerated', 'Public operating course.')],
    })
    vi.mocked(generateJsonCompletion).mockResolvedValue({
      provider: 'openai',
      model: 'gpt-4o-mini',
      content: JSON.stringify({
        candidates: [
          {
            id: 'invented-only',
            title: 'Private angle from an invented source',
            triggering_event: 'This cites a source the scan never approved.',
            source_type: 'meeting',
            source_label: 'Invented',
            source_ids: ['raw:secret-source'],
            why_vambah_can_speak: 'This should never be saved.',
            brand_goal: 'Should be dropped.',
            content_angle: 'Should be dropped.',
            suggested_hook: 'Should be dropped.',
            audience: 'Operators',
            sensitivity: 'public_safe',
            evidence_summary: 'SECRET_INVENTED_SOURCE',
            claim_boundaries: [],
          },
          {
            id: 'approval-gates',
            title: 'Approval gates create trust',
            triggering_event: `Follow up with ${RAW_EMAIL}`,
            source_type: 'not-a-real-source',
            source_label: 'Approved meeting summary',
            source_ids: ['meeting:meeting-redact', 'raw:secret-source'],
            why_vambah_can_speak: `Call ${RAW_PHONE} for the unpublished detail`,
            brand_goal: 'Show the gate.',
            content_angle: 'Approval stays visible.',
            suggested_hook: 'Start with the gate.',
            audience: 'Operators',
            sensitivity: 'public_safe',
            evidence_summary: RAW_URL,
            claim_boundaries: ['Do not add private participant names.'],
          },
          {
            id: 'approval-gates-duplicate',
            title: 'Approval gates create trust',
            triggering_event: 'Duplicate of the same approved source.',
            source_type: 'meeting',
            source_label: 'Approved meeting summary',
            source_ids: ['meeting:meeting-redact'],
            why_vambah_can_speak: 'Same fingerprint as the first usable candidate.',
            brand_goal: 'Show the gate.',
            content_angle: 'Approval stays visible.',
            suggested_hook: 'Start with the gate.',
            audience: 'Operators',
            sensitivity: 'public_safe',
            evidence_summary: 'Duplicate.',
            claim_boundaries: [],
          },
        ],
      }),
    } as never)

    const { packet } = await discoverSocialTopicCandidates({ actorId: 'admin-1' })
    const prompt = vi.mocked(generateJsonCompletion).mock.calls[0]?.[0]?.userPrompt ?? ''
    const serialized = JSON.stringify(packet)
    const meetingCandidate = packet.candidates.find((candidate) => candidate.id === 'approval-gates')

    expect(prompt).not.toContain(RAW_EMAIL)
    expect(prompt).not.toContain(RAW_PHONE)
    expect(prompt).not.toContain('raw-token')
    expect(prompt).toContain('[email redacted]')
    expect(serialized).not.toContain(RAW_EMAIL)
    expect(serialized).not.toContain(RAW_PHONE)
    expect(serialized).not.toContain('raw-token')
    expect(serialized).not.toContain('raw:secret-source')
    expect(serialized).not.toContain('SECRET_INVENTED_SOURCE')
    expect(serialized).not.toContain('Private angle from an invented source')
    expect(meetingCandidate).toMatchObject({
      source_type: 'portfolio_work',
      source_ids: ['meeting:meeting-redact'],
      sensitivity: 'client_safe_summary',
      triggering_event: 'Follow up with [email redacted]',
      evidence_summary: 'https://internal.example.com/[private-path-redacted]',
    })
    expect(meetingCandidate?.why_vambah_can_speak).toContain('[phone redacted]')
    expect(meetingCandidate?.priority_reasons).toContain('Client-safe summary requires final privacy review')
    expect(packet.candidates.filter((candidate) => candidate.title === 'Approval gates create trust')).toHaveLength(1)
    expect(packet.candidates.map((candidate) => candidate.product_ids).flat()).toEqual(expect.arrayContaining([
      'dark_castle_chess',
      'accelerated',
      'agentified',
    ]))
  })

  it('rejects an unreadable model payload before saving candidates', async () => {
    stubSources({
      prototypes: [catalogRow('prototype-dcc', 'Dark Castle Chess', 'Public learning gates.')],
      products: [catalogRow('product-agentified', 'Agentified', 'Public agent systems book.')],
      services: [catalogRow('service-accelerated', 'Accelerated', 'Public operating course.')],
    })
    vi.mocked(generateJsonCompletion).mockResolvedValue({
      provider: 'openai',
      model: 'gpt-4o-mini',
      content: 'not-json',
    } as never)

    await expect(discoverSocialTopicCandidates({ actorId: null })).rejects.toThrow('Topic discovery returned invalid JSON')
  })
})
