import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  generateAccessCode: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/proposal-access-code', () => ({
  generateAccessCode: mocks.generateAccessCode,
}))

import { POST } from './route'

const BASE_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/proposals/prop-1/generate-code', {
    method: 'POST',
  })
}

function params(id = 'prop-1') {
  return { params: Promise.resolve({ id }) }
}

function mockProposalCodeFlow({
  proposal,
  updateResults,
}: {
  proposal: { id: string } | null
  updateResults: Array<{ error: { code?: string; message?: string } | null }>
}) {
  const selectSingle = vi.fn().mockResolvedValue({
    data: proposal,
    error: proposal ? null : { message: 'not found' },
  })
  const selectEq = vi.fn().mockReturnValue({ single: selectSingle })
  const select = vi.fn().mockReturnValue({ eq: selectEq })

  let updateCall = 0
  const updateEq = vi.fn().mockImplementation(() => {
    const result = updateResults[updateCall] ?? { error: { message: 'unexpected' } }
    updateCall += 1
    return Promise.resolve(result)
  })
  const update = vi.fn().mockReturnValue({ eq: updateEq })

  mocks.from.mockImplementation((table: string) => {
    if (table !== 'proposals') throw new Error(`Unexpected table: ${table}`)
    return { select, update }
  })

  return { update, updateEq }
}

describe('POST /api/admin/proposals/[id]/generate-code', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    delete process.env.NEXT_PUBLIC_BASE_URL
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.generateAccessCode.mockReturnValue('ABCD23')
  })

  it('rejects unauthenticated requests before reading proposals', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.generateAccessCode).not.toHaveBeenCalled()
  })

  it('returns 404 when the proposal is missing', async () => {
    mockProposalCodeFlow({ proposal: null, updateResults: [] })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Proposal not found' })
    expect(mocks.generateAccessCode).not.toHaveBeenCalled()
  })

  it('retries on unique access_code collisions then succeeds', async () => {
    mocks.generateAccessCode
      .mockReturnValueOnce('DUP001')
      .mockReturnValueOnce('UNIQUE2')

    const { update, updateEq } = mockProposalCodeFlow({
      proposal: { id: 'prop-1' },
      updateResults: [
        { error: { code: '23505', message: 'duplicate' } },
        { error: null },
      ],
    })

    process.env.NEXT_PUBLIC_BASE_URL = 'https://amadutown.com'

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      access_code: 'UNIQUE2',
      shareable_link: 'https://amadutown.com/proposal/UNIQUE2',
    })
    expect(mocks.generateAccessCode).toHaveBeenCalledTimes(2)
    expect(update).toHaveBeenCalledTimes(2)
    expect(update).toHaveBeenNthCalledWith(1, { access_code: 'DUP001' })
    expect(update).toHaveBeenNthCalledWith(2, { access_code: 'UNIQUE2' })
    expect(updateEq).toHaveBeenCalledWith('id', 'prop-1')
  })

  it('returns 500 when non-collision update errors occur', async () => {
    mockProposalCodeFlow({
      proposal: { id: 'prop-1' },
      updateResults: [{ error: { code: '42P01', message: 'relation missing' } }],
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to generate access code',
    })
  })

  it('returns 500 after exhausting unique-code retries', async () => {
    mocks.generateAccessCode.mockReturnValue('COLLIDE')
    mockProposalCodeFlow({
      proposal: { id: 'prop-1' },
      updateResults: Array.from({ length: 5 }, () => ({
        error: { code: '23505', message: 'duplicate' },
      })),
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to generate unique access code',
    })
    expect(mocks.generateAccessCode).toHaveBeenCalledTimes(5)
  })

  it('falls back to request origin when NEXT_PUBLIC_BASE_URL is unset', async () => {
    mockProposalCodeFlow({
      proposal: { id: 'prop-1' },
      updateResults: [{ error: null }],
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      access_code: 'ABCD23',
      shareable_link: 'http://localhost/proposal/ABCD23',
    })
  })
})
