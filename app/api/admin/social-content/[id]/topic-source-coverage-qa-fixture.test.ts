import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  supabaseAdmin: { from: mocks.from },
}))

import { GET, PUT } from './route'
import { POST as approve } from './approve/route'
import { TOPIC_SOURCE_COVERAGE_QA_ID } from '@/lib/social-topic-source-coverage-qa-fixture'

const route = `http://localhost/api/admin/social-content/${TOPIC_SOURCE_COVERAGE_QA_ID}`

describe('topic source coverage preview fixture route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VERCEL_ENV', 'preview')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('serves receipt-backed ready coverage without auth or database reads', async () => {
    const response = await GET(new NextRequest(route), { params: { id: TOPIC_SOURCE_COVERAGE_QA_ID } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      fixture: true,
      fixture_state: 'ready',
      item: {
        id: TOPIC_SOURCE_COVERAGE_QA_ID,
        rag_context: {
          external_execution_enabled: false,
          qa_fixture: {
            kind: 'topic_source_coverage_preview',
            read_only: true,
          },
          content_calibration: {
            topic_trigger_packet: {
              coverage_report: {
                status: 'ready',
                products: [
                  { product_id: 'dark_castle_chess', status: 'ready' },
                  { product_id: 'accelerated', status: 'ready' },
                  { product_id: 'agentified', status: 'ready' },
                ],
                blockers: [],
              },
              candidates: [{ source_receipts: [{ source_id: 'publications:agentified' }] }],
            },
          },
        },
      },
    })
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('serves deterministic blocked source and product recovery states', async () => {
    const response = await GET(new NextRequest(route, {
      headers: { 'x-portfolio-topic-coverage-state': 'blocked' },
    }), { params: { id: TOPIC_SOURCE_COVERAGE_QA_ID } })
    const body = await response.json()
    const packet = body.item.rag_context.content_calibration.topic_trigger_packet

    expect(response.status).toBe(200)
    expect(body.fixture_state).toBe('blocked')
    expect(packet.coverage_report).toMatchObject({
      status: 'blocked',
      blockers: [
        expect.stringContaining('source_collection_failed:meeting_summaries'),
        expect.stringContaining('product_coverage_receipt_missing:agentified'),
      ],
    })
    expect(packet.coverage_report.products).toContainEqual(expect.objectContaining({
      product_id: 'agentified',
      status: 'blocked',
      receipt_ids: [],
    }))
    expect(packet.source_receipts).toEqual([])
    expect(packet.candidates[0].source_receipts).toEqual([])
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('blocks fixture save and approval before auth or database access', async () => {
    const saveResponse = await PUT(new NextRequest(route, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ post_text: 'Changed' }),
    }), { params: { id: TOPIC_SOURCE_COVERAGE_QA_ID } })
    const approveResponse = await approve(new NextRequest(`${route}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }), { params: { id: TOPIC_SOURCE_COVERAGE_QA_ID } })

    expect(saveResponse.status).toBe(409)
    expect(approveResponse.status).toBe(409)
    expect(await saveResponse.json()).toMatchObject({ fixture: true, blocked: true })
    expect(await approveResponse.json()).toMatchObject({ fixture: true, blocked: true })
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
