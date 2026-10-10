import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: { error?: string }) => Boolean(value?.error),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { GET, PATCH } from './route'

function getRequest() {
  return new NextRequest('http://localhost/api/admin/contact-submissions/42/verified-tech-stack')
}

function patchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/contact-submissions/42/verified-tech-stack', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const params = { params: { id: '42' } }

describe('/api/admin/contact-submissions/[id]/verified-tech-stack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects non-admin callers before reading contact data', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const getResponse = await GET(getRequest(), params)
    const patchResponse = await PATCH(patchRequest({ technologies: [] }), params)

    expect(getResponse.status).toBe(401)
    expect(patchResponse.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects non-numeric ids', async () => {
    const response = await GET(getRequest(), { params: { id: 'abc' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid id' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the contact submission is missing', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'contact_submissions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'missing' } }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    })

    const response = await GET(getRequest(), params)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Not found' })
  })

  it('returns BuiltWith, latest audit, and verified stacks', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'contact_submissions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 42,
                  website_tech_stack: { technologies: [{ name: 'WordPress' }] },
                  client_verified_tech_stack: { technologies: [{ name: 'Next.js' }] },
                },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'diagnostic_audits') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { enriched_tech_stack: { technologies: [{ name: 'Shopify' }] } },
                  }),
                }),
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    })

    const response = await GET(getRequest(), params)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      contactSubmissionId: 42,
      builtwith: { technologies: [{ name: 'WordPress' }] },
      audit: { technologies: [{ name: 'Shopify' }] },
      verified: { technologies: [{ name: 'Next.js' }] },
    })
  })

  it('sanitizes PATCH technologies and drops nameless entries', async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({
      update: vi.fn().mockReturnValue({ eq: updateEq }),
    })

    const response = await PATCH(
      patchRequest({
        technologies: [
          { name: '  ' },
          null,
          { foo: 'bar' },
          { name: 'React' },
          { name: ' Next.js ', tag: ' next ', categories: ['web', 2, ''], parent: '  ' },
        ],
      }),
      params,
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.verified.technologies).toEqual([
      { name: 'React' },
      { name: 'Next.js', tag: 'next', categories: ['web'] },
    ])
    expect(body.verified.resolved_by).toBe('admin-1')
    expect(updateEq).toHaveBeenCalledWith('id', 42)
    expect(mocks.from).toHaveBeenCalledWith('contact_submissions')
  })

  it('clears the verified stack when clear is true', async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq: updateEq })
    mocks.from.mockReturnValue({ update })

    const response = await PATCH(patchRequest({ clear: true, technologies: [{ name: 'React' }] }), params)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, verified: null })
    expect(update).toHaveBeenCalledWith({ client_verified_tech_stack: null })
  })

  it('rejects a non-object PATCH body', async () => {
    const response = await PATCH(patchRequest(null), params)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid body' })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
