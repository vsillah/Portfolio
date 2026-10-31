import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { TRACE_CONSENT_VERSION } from '@/lib/decision-traceability'

const mocks = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
import { POST } from './route'

const valid = {
  email: ' ADA@EXAMPLE.ORG ', consent: true, consentVersion: TRACE_CONSENT_VERSION,
  answers: { reason: 2, owner: 0, threshold: 1, evidence: 2 },
  attribution: { utm_source: 'linkedin', utm_campaign: 'dark-castle' },
  submissionKey: 'b893d345-9d11-4fb2-a0e4-544067cc129e',
}
const request = (body: unknown) => new NextRequest('http://localhost/api/decision-traceability', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })

describe('POST /api/decision-traceability', () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only'; mocks.from.mockReturnValue({ insert: mocks.insert }); mocks.insert.mockResolvedValue({ error: null }) })

  it('rejects invalid email, consent, stale disclosure, and incomplete scores before storage', async () => {
    for (const body of [{ ...valid, email: 'bad' }, { ...valid, consent: false }, { ...valid, consentVersion: 'old' }, { ...valid, answers: { reason: 2 } }]) {
      expect((await POST(request(body))).status).toBe(400)
    }
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('persists a minimal normalized record with consent and attribution', async () => {
    const response = await POST(request(valid))
    expect(response.status).toBe(201)
    expect(mocks.from).toHaveBeenCalledWith('decision_traceability_leads')
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ email: 'ada@example.org', score: 5, weakest_dimension: 'owner', consent_version: TRACE_CONSENT_VERSION, utm_source: 'linkedin', source_path: '/decision-traceability-scorecard' }))
    const row = mocks.insert.mock.calls[0][0]
    expect(row).not.toHaveProperty('answers')
    expect(row).not.toHaveProperty('ip_address')
  })

  it('handles duplicate submission without a second mutation and fails closed on persistence error', async () => {
    mocks.insert.mockResolvedValueOnce({ error: { code: '23505' } }).mockResolvedValueOnce({ error: { code: 'PGRST205' } })
    const duplicate = await POST(request(valid))
    expect(duplicate.status).toBe(200)
    expect((await duplicate.json()).status).toBe('duplicate')
    const failed = await POST(request(valid))
    expect(failed.status).toBe(503)
    expect((await failed.json()).status).toBeUndefined()
    expect(mocks.insert).toHaveBeenCalledTimes(2)
  })

  it('rejects unapproved attribution and bot fields', async () => {
    expect((await POST(request({ ...valid, attribution: { utm_source: 'linked/in?secret=1' } }))).status).toBe(400)
    expect((await POST(request({ ...valid, website: 'spam' }))).status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('does not fall back to anonymous persistence when the service key is absent', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect((await POST(request(valid))).status).toBe(503)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns a useful failure when persistence throws', async () => {
    mocks.insert.mockRejectedValueOnce(new Error('database unreachable'))
    const response = await POST(request(valid))
    expect(response.status).toBe(503)
    expect((await response.json()).error).toMatch(/could not save/)
  })
})
