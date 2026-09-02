import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  triggerLeadQualificationWebhook: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/n8n', () => ({
  triggerLeadQualificationWebhook: mocks.triggerLeadQualificationWebhook,
}))

import { POST } from './route'
import { rawScoreToTen } from '@/lib/scorecard'

function makeRequest(body: Record<string, unknown>, ip = 'scorecard-ip-default') {
  return new NextRequest('http://localhost/api/scorecard/submit', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  })
}

function lookupChain(existing: { id: number } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: existing, error: null })
  const limit = vi.fn().mockReturnValue({ maybeSingle })
  const eq = vi.fn().mockReturnValue({ limit })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq, limit, maybeSingle }
}

describe('POST /api/scorecard/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.triggerLeadQualificationWebhook.mockResolvedValue({ triggered: true })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects a missing or invalid email before writing', async () => {
    const missing = await POST(makeRequest({ name: 'Ada' }, 'scorecard-ip-invalid-missing'))
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'A valid email is required.' })

    const invalid = await POST(makeRequest({ email: 'not-an-email' }, 'scorecard-ip-invalid-format'))
    expect(invalid.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.triggerLeadQualificationWebhook).not.toHaveBeenCalled()
  })

  it('inserts a new scorecard lead with normalized email and answers', async () => {
    const lookup = lookupChain(null)
    const insertSingle = vi.fn().mockResolvedValue({ data: { id: 44 }, error: null })
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
    const insert = vi.fn().mockReturnValue({ select: insertSelect })
    mocks.from.mockReturnValue({ select: lookup.select, insert })

    const response = await POST(makeRequest({
      email: '  Ada@Example.COM ',
      name: '  Ada Lovelace ',
      score: 9,
      answers: { data: 'ready', team: 'pilot' },
    }, 'scorecard-ip-insert'))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(lookup.eq).toHaveBeenCalledWith('email', 'ada@example.com')
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        message: 'AI Readiness Scorecard',
        lead_source: 'website_form',
        full_report: JSON.stringify({ data: 'ready', team: 'pilot' }),
      }),
    ])
    expect(mocks.triggerLeadQualificationWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ada@example.com',
        submissionId: '44',
        source: 'scorecard',
        aiReadinessScore: rawScoreToTen(9),
      }),
    )
  })

  it('updates an existing contact instead of inserting a duplicate email', async () => {
    const lookup = lookupChain({ id: 7 })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq: updateEq })
    mocks.from.mockReturnValue({ select: lookup.select, update })

    const response = await POST(makeRequest({
      email: 'ada@example.com',
      name: 'Ada',
      answers: { data: 'integrated' },
    }, 'scorecard-ip-update'))

    expect(response.status).toBe(201)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ada',
        message: 'AI Readiness Scorecard',
        lead_source: 'website_form',
        full_report: JSON.stringify({ data: 'integrated' }),
      }),
    )
    expect(updateEq).toHaveBeenCalledWith('id', 7)
    expect(mocks.triggerLeadQualificationWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: '7', aiReadinessScore: 0 }),
    )
  })

  it('treats a unique-constraint race as success', async () => {
    const lookup = lookupChain(null)
    const insertSingle = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: '23503', message: 'missing column' } })
      .mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate' } })
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
    const insert = vi.fn().mockReturnValue({ select: insertSelect })
    mocks.from.mockReturnValue({ select: lookup.select, insert })

    const response = await POST(makeRequest({
      email: 'ada@example.com',
      answers: { data: 'ready' },
    }, 'scorecard-ip-race'))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(insert).toHaveBeenCalledTimes(2)
  })

  it('rate-limits repeated submits from the same IP', async () => {
    const ip = 'scorecard-ip-rate-limit'
    for (let i = 0; i < 5; i += 1) {
      const response = await POST(makeRequest({ email: 'not-an-email' }, ip))
      expect(response.status).toBe(400)
    }

    const limited = await POST(makeRequest({ email: 'ada@example.com' }, ip))
    expect(limited.status).toBe(429)
    await expect(limited.json()).resolves.toEqual({
      error: 'Too many requests. Please try again later.',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
