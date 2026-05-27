import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getOpenBrainSnapshot: vi.fn(),
  supabaseFrom: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/open-brain', () => ({
  getOpenBrainSnapshot: mocks.getOpenBrainSnapshot,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.supabaseFrom,
  },
}))

import { GET } from './route'

function makeRequest() {
  return new Request('http://localhost/api/admin/agents/open-brain', {
    headers: { authorization: 'Bearer token' },
  })
}

describe('GET /api/admin/agents/open-brain', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getOpenBrainSnapshot.mockResolvedValue({
      generatedAt: '2026-05-10T12:00:00.000Z',
      service: { available: true, storage: 'local_jsonl' },
      overview: { sources: 3, memories: 1, pendingProposals: 2 },
    })
    mocks.supabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.getOpenBrainSnapshot).not.toHaveBeenCalled()
  })

  it('returns the sanitized Open Brain snapshot', async () => {
    const response = await GET(makeRequest() as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.objectContaining({
      generatedAt: '2026-05-10T12:00:00.000Z',
      overview: expect.objectContaining({ sources: 3 }),
    }))
    expect(mocks.supabaseFrom).toHaveBeenCalledWith('agent_run_events')
  })

  it('passes recent decision trust frames into the Open Brain snapshot', async () => {
    mocks.supabaseFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({
              data: [
                {
                  run_id: 'run-trust',
                  event_type: 'agent_decision_trust_recorded',
                  severity: 'warning',
                  message: 'Decision trust recorded.',
                  occurred_at: '2026-05-27T12:00:00.000Z',
                  metadata: {
                    decision_id: 'decision-payment',
                    agent_key: 'chief-of-staff',
                    decision_type: 'spend',
                    objective: 'Create a payment checkpoint.',
                    selected_candidate: 'make_vendor_payment',
                    candidates_considered: ['make_vendor_payment'],
                    trust_signals: ['Agent Ops source run linked'],
                    risk_signals: ['Payment or spend authority requested'],
                    missing_evidence: ['Human approval decision'],
                    scores: {
                      relationshipTrust: 0.57,
                      decisionRisk: 0.72,
                      evidenceCompleteness: 0.6,
                    },
                    recommended_gate: 'human_review',
                    approval_type: 'payment_make_vendor_payment',
                    reversibility: 'hard',
                  },
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    })

    await GET(makeRequest() as never)

    expect(mocks.getOpenBrainSnapshot).toHaveBeenCalledWith(undefined, {
      decisionTrustFrames: [
        expect.objectContaining({
          run_id: 'run-trust',
          decision_id: 'decision-payment',
          recommended_gate: 'human_review',
        }),
      ],
    })
  })
})
