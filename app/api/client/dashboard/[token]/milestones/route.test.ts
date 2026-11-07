import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  read: vi.fn(),
  review: vi.fn(),
  pay: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/app/api/proposals/[id]/milestones/route', () => ({
  GET: mocks.read,
  POST: mocks.review,
}))

vi.mock('@/app/api/proposals/[id]/accept/route', () => ({
  POST: mocks.pay,
}))

import { GET, POST } from './route'

const TOKEN = 'a'.repeat(32)
const SHORT_TOKEN = 'a'.repeat(31)
const PROPOSAL_ID = '11111111-1111-4111-8111-111111111111'
const ACCESS_CODE = 'B'.repeat(48)

function request(token: string, body?: unknown, raw?: string) {
  return new NextRequest(`http://localhost/api/client/dashboard/${token}/milestones`, {
    method: body !== undefined || raw !== undefined ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(raw !== undefined ? { body: raw } : {}),
  })
}

function params(token: string) {
  return { params: Promise.resolve({ token }) }
}

function mockAccess(access: unknown, proposal: unknown) {
  mocks.from.mockImplementation((table: string) => {
    if (table === 'client_dashboard_access') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: access, error: access ? null : null }),
            }),
          }),
        }),
      }
    }
    if (table === 'proposals') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: proposal, error: proposal ? null : { message: 'missing' } }),
          }),
        }),
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
}

describe('/api/client/dashboard/[token]/milestones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.read.mockResolvedValue(NextResponse.json({ enabled: true }))
    mocks.review.mockResolvedValue(NextResponse.json({ ok: true }))
    mocks.pay.mockResolvedValue(NextResponse.json({ checkout: true }))
    mockAccess(
      { milestone_proposal_id: PROPOSAL_ID },
      { access_code: ACCESS_CODE },
    )
  })

  it('rejects short dashboard tokens before looking up access', async () => {
    const response = await GET(request(SHORT_TOKEN), params(SHORT_TOKEN))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid link' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.read).not.toHaveBeenCalled()
  })

  it('hides inactive or unlinked milestone dashboards as disabled', async () => {
    mockAccess(null, { access_code: ACCESS_CODE })

    const response = await GET(request(TOKEN), params(TOKEN))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ enabled: false })
    expect(mocks.read).not.toHaveBeenCalled()
  })

  it('rejects tokens whose proposal has no issued access code', async () => {
    mockAccess({ milestone_proposal_id: PROPOSAL_ID }, { access_code: null })

    const response = await GET(request(TOKEN), params(TOKEN))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Review unavailable' })
    expect(mocks.read).not.toHaveBeenCalled()
  })

  it('forwards GET with the proposal access code', async () => {
    const response = await GET(request(TOKEN), params(TOKEN))

    expect(response.status).toBe(200)
    expect(mocks.read).toHaveBeenCalledTimes(1)
    const forwarded = mocks.read.mock.calls[0][0] as NextRequest
    expect(forwarded.headers.get('x-proposal-access')).toBe(ACCESS_CODE)
    await expect(mocks.read.mock.calls[0][1].params).resolves.toEqual({ id: PROPOSAL_ID })
    expect(mocks.review).not.toHaveBeenCalled()
    expect(mocks.pay).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON on POST after the token resolves', async () => {
    const response = await POST(request(TOKEN, undefined, '{not-json'), params(TOKEN))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request' })
    expect(mocks.review).not.toHaveBeenCalled()
    expect(mocks.pay).not.toHaveBeenCalled()
  })

  it('rejects unknown dashboard milestone actions', async () => {
    const response = await POST(request(TOKEN, { action: 'configure' }), params(TOKEN))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid action' })
    expect(mocks.review).not.toHaveBeenCalled()
    expect(mocks.pay).not.toHaveBeenCalled()
  })

  it('forwards accept and reject bodies to the proposal review handler', async () => {
    const body = { action: 'accept', note: 'Looks good' }
    const response = await POST(request(TOKEN, body), params(TOKEN))

    expect(response.status).toBe(200)
    expect(mocks.review).toHaveBeenCalledTimes(1)
    const forwarded = mocks.review.mock.calls[0][0] as NextRequest
    expect(forwarded.headers.get('x-proposal-access')).toBe(ACCESS_CODE)
    await expect(forwarded.json()).resolves.toEqual(body)
    expect(mocks.pay).not.toHaveBeenCalled()
  })

  it('rewrites pay actions to the second-milestone accept payload', async () => {
    const documentIdentity = {
      revision: '22222222-2222-4222-8222-222222222222',
      pdf_url: null,
      contract_pdf_url: null,
    }
    const response = await POST(
      request(TOKEN, { action: 'pay', document_identity: documentIdentity, milestone: 9 }),
      params(TOKEN),
    )

    expect(response.status).toBe(200)
    expect(mocks.pay).toHaveBeenCalledTimes(1)
    const forwarded = mocks.pay.mock.calls[0][0] as NextRequest
    expect(forwarded.headers.get('x-proposal-access')).toBe(ACCESS_CODE)
    await expect(forwarded.json()).resolves.toEqual({
      milestone: 2,
      document_identity: documentIdentity,
    })
    expect(mocks.review).not.toHaveBeenCalled()
  })
})
