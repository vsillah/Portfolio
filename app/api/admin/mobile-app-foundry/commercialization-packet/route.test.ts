import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

import { POST } from './route'

const backlogRecord = {
  id: 'speech-practice-coach',
  title: 'Speech Practice Coach',
  audience: 'People preparing for public speaking moments',
  job_to_be_done: 'Practice a speech, get structured feedback, and track improvement.',
  trend_sources: ['App Store public speaking category'],
  competitors: ['Orai'],
  popularity_score: 88,
  score_breakdown: {
    demand_signal: 25,
    monetization_path: 13,
    builder_fit: 20,
    build_velocity: 10,
    differentiation: 10,
    release_readiness: 10,
  },
  vambah_fit_summary: 'AI workbench utility with a coaching and access lens.',
  prototype_scope: ['speech prompt intake', 'practice scoring'],
  commercialization_path: ['paid coaching companion'],
  risks: ['Avoid employment-outcome claims.'],
  human_gate: 'review_required',
}

function request(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/admin/mobile-app-foundry/commercialization-packet', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/admin/mobile-app-foundry/commercialization-packet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ backlog_record: backlogRecord }) as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns a read-only commercialization packet and markdown', async () => {
    const response = await POST(request({
      backlog_record: backlogRecord,
      generated_at: '2026-06-19T12:00:00.000Z',
      commercialization_input: {
        validation_status: 'validated',
        prototype_url: 'https://example.com/prototype',
        demo_evidence: ['Simulator smoke passed.'],
      },
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      mode: 'read_only',
      packet: {
        id: 'commercialization-packet:speech-practice-coach:v1',
        mode: 'read_only',
        validation_status: 'validated',
        prototype_url: 'https://example.com/prototype',
        demo_evidence: ['Simulator smoke passed.'],
        side_effects: {
          invites_testers: false,
          submits_to_store: false,
          changes_pricing: false,
          publishes_public_claims: false,
        },
      },
      markdown: expect.stringContaining('# Speech Practice Coach Commercialization Packet'),
      side_effects: {
        invites_testers: false,
        submits_to_store: false,
      },
    })
  })

  it('rejects invalid validation status', async () => {
    const response = await POST(request({
      backlog_record: backlogRecord,
      commercialization_input: { validation_status: 'submitted' },
    }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid validation_status' })
  })

  it('rejects incomplete backlog records', async () => {
    const response = await POST(request({ backlog_record: { id: 'missing-fields' } }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'backlog_record with id, title, audience, job_to_be_done, and vambah_fit_summary is required',
    })
  })
})
