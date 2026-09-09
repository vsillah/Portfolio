import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { SMS_DISCLOSURE, SMS_DISCLOSURE_VERSION } from '@/lib/contact-sms-consent'
const mocks = vi.hoisted(() => ({ from: vi.fn(), webhook: vi.fn(), auth: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/n8n', () => ({ triggerLeadQualificationWebhook: mocks.webhook }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.auth, isAuthError: (r: object) => 'error' in r }))
import { POST, GET } from './route'
const request = (overrides = {}) => new NextRequest('http://localhost/api/contact', { method: 'POST', body: JSON.stringify({
  name: 'Synthetic Visitor', email: 'visitor@example.test', message: 'Synthetic inquiry', ...overrides,
}) })
const selected = { mobilePhone: '(202) 555-0123', smsConsent: true, smsDisclosureVersion: SMS_DISCLOSURE_VERSION }
let records: Map<string, Record<string, unknown>>
let upsert: ReturnType<typeof vi.fn>
let update: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.clearAllMocks()
  records = new Map()
  upsert = vi.fn(async (record, options) => {
    expect(options).toEqual({ onConflict: 'evidence_key', ignoreDuplicates: true })
    if (!records.has(record.evidence_key)) records.set(record.evidence_key, record)
    return { error: null }
  })
  update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
  const lookup = { select: () => ({ eq: () => ({ limit: () => ({ single: async () => ({ data: { id: 7 }, error: null }) }) }) }), update }
  mocks.from.mockImplementation((table) => {
    if (table === 'contact_submissions') return lookup
    if (table === 'contact_sms_consent_evidence') return { upsert }
    throw new Error('Unexpected table')
  })
  mocks.webhook.mockResolvedValue({ triggered: false })
  mocks.auth.mockResolvedValue({ error: 'Unauthorized', status: 401 })
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('External request prohibited') }))
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
describe('public SMS evidence capture', () => {
  it.each([{}, { mobilePhone: 'bad' }, { mobilePhone: '+12025550123', smsConsent: false }])('keeps normal inquiry optional without recording phone: %j', async (fields) => {
    expect((await POST(request(fields))).status).toBe(201)
    expect(upsert).not.toHaveBeenCalled()
    expect(JSON.stringify(update.mock.calls)).not.toContain('phone')
  })
  it.each(['', '123', '++12025550123', '+11111111111', '2025550123 ext 2', {}, null])('rejects checked invalid phone %j before persistence', async (mobilePhone) => {
    const response = await POST(request({ ...selected, mobilePhone }))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ field: 'mobilePhone' })
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it.each(['true', 1, null])('rejects non-boolean consent %j', async (smsConsent) => {
    expect((await POST(request({ ...selected, smsConsent }))).status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it.each([undefined, 'old', 'attacker-version', 'amadutown-sms-2026-09-09-v1'])('rejects stale/tampered disclosure %j', async (smsDisclosureVersion) => {
    expect((await POST(request({ ...selected, smsDisclosureVersion }))).status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('stores server disclosure and pending state; does not expose consent or forward it to automation', async () => {
    const response = await POST(request({ ...selected, captured_at: '1900-01-01', send_eligible: true, source_route: '/fake', disclosure_text: 'fake', program: 'fake' }))
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ success: true, id: 7 })
    expect(upsert.mock.calls[0][0]).toMatchObject({ normalized_phone: '+12025550123', submitted_phone: '(202) 555-0123', affirmative_selection: true, disclosure_text: SMS_DISCLOSURE, disclosure_version: SMS_DISCLOSURE_VERSION, source_route: '/#contact', send_eligible: false, capture_state: 'pending_verification', inquiry_id: 7 })
    expect(upsert.mock.calls[0][0]).not.toHaveProperty('captured_at')
    expect(JSON.stringify(mocks.webhook.mock.calls)).not.toMatch(/phone|smsConsent|disclosure|evidence_key/i)
    expect(update.mock.calls[0][0]).not.toHaveProperty('normalized_phone')
  })
  it('deduplicates retries and formatting changes without mutating the first evidence', async () => {
    await Promise.all([POST(request(selected)), POST(request(selected))])
    const original = [...records.values()][0]
    await POST(request({ ...selected, mobilePhone: '+1 202 555 0123' }))
    await POST(request({ smsConsent: false }))
    expect(records.size).toBe(1)
    expect([...records.values()][0]).toBe(original)
  })
  it('never updates phone, enrollment, or suppression when the same email submits another phone', async () => {
    await POST(request(selected))
    await POST(request({ ...selected, mobilePhone: '+12025550124', unsubscribed: false, do_not_contact: false, sms_enrolled: true }))
    expect(records.size).toBe(2)
    for (const [payload] of update.mock.calls) expect(Object.keys(payload).sort()).toEqual(['lead_source', 'message', 'name'])
    for (const record of records.values()) expect(record.send_eligible).toBe(false)
  })
  it('reports partial save, permits retry, and does not leak a database failure', async () => {
    upsert.mockResolvedValueOnce({ error: { details: 'secret +12025550123' } })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await POST(request(selected))
    expect(response.status).toBe(503)
    expect(await response.text()).toContain('Your inquiry was saved')
    expect(mocks.webhook).not.toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
    expect((await POST(request(selected))).status).toBe(201)
  })
  it('keeps #955 public listing denial before any data access', async () => {
    expect((await GET(new NextRequest('http://localhost/api/contact'))).status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
