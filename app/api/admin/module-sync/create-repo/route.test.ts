import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  isPortfolioPathRegistered: vi.fn(),
  from: vi.fn(),
  supabaseAdmin: { from: vi.fn() } as { from: ReturnType<typeof vi.fn> } | null,
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/module-sync-db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/module-sync-db')>('@/lib/module-sync-db')
  return {
    ...actual,
    isPortfolioPathRegistered: mocks.isPortfolioPathRegistered,
  }
})

vi.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return mocks.supabaseAdmin
  },
}))

import { POST } from './route'

function makeRequest(body?: string) {
  return new NextRequest('http://localhost/api/admin/module-sync/create-repo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function mockInsert(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  return { insert, select, single }
}

describe('POST /api/admin/module-sync/create-repo', () => {
  const originalToken = process.env.GITHUB_TOKEN
  const originalRepo = process.env.GITHUB_REPO

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'info').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.isPortfolioPathRegistered.mockResolvedValue(false)
    mocks.supabaseAdmin = { from: mocks.from }
    process.env.GITHUB_TOKEN = 'test-github-token'
    process.env.GITHUB_REPO = 'acme/Portfolio'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = originalToken
    if (originalRepo === undefined) delete process.env.GITHUB_REPO
    else process.env.GITHUB_REPO = originalRepo
  })

  it('requires admin auth before checking GitHub config', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(JSON.stringify({ portfolioPath: 'lib/new' })))

    expect(response.status).toBe(401)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a blank token and an invalid GITHUB_REPO', async () => {
    process.env.GITHUB_TOKEN = '   '
    const missingToken = await POST(makeRequest(JSON.stringify({ portfolioPath: 'lib/new' })))
    expect(missingToken.status).toBe(503)
    expect(await missingToken.json()).toEqual({
      error: 'GITHUB_TOKEN is not configured. Required for creating repos.',
    })

    process.env.GITHUB_TOKEN = 'test-github-token'
    process.env.GITHUB_REPO = 'owner/repo/extra'
    const invalidRepo = await POST(makeRequest(JSON.stringify({ portfolioPath: 'lib/new' })))
    expect(invalidRepo.status).toBe(503)
    expect(await invalidRepo.json()).toEqual({
      error: 'GITHUB_REPO is not set or invalid. Use owner/repo.',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON, a blank path, and a path that is already registered', async () => {
    const invalid = await POST(makeRequest('not-json'))
    const blank = await POST(makeRequest(JSON.stringify({ portfolioPath: '  ' })))
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toEqual({ error: 'Invalid JSON body' })
    expect(blank.status).toBe(400)
    expect(await blank.json()).toEqual({ error: 'Missing portfolioPath in body' })

    mocks.isPortfolioPathRegistered.mockResolvedValue(true)
    const registered = await POST(makeRequest(JSON.stringify({ portfolioPath: 'lib/new' })))
    expect(registered.status).toBe(400)
    expect(await registered.json()).toEqual({
      error: 'This portfolio path is already registered as a module (code-defined or custom).',
    })
    expect(mocks.isPortfolioPathRegistered).toHaveBeenCalledWith('lib/new')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('stops when the derived repo already exists', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, { name: 'My-Module' }))

    const response = await POST(makeRequest(JSON.stringify({ portfolioPath: 'packages/My Module' })))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Repository already exists; choose another name.' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/acme/My-Module',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-github-token' }) })
    )
  })

  it('maps a non-404 existence check to 502 or 400', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(503, { message: 'unavailable' }))
    const server = await POST(makeRequest(JSON.stringify({ portfolioPath: 'lib/new' })))
    expect(server.status).toBe(502)
    expect(await server.json()).toEqual({ error: 'unavailable' })

    vi.mocked(fetch).mockResolvedValueOnce(new Response('nope', { status: 403 }))
    const client = await POST(makeRequest(JSON.stringify({ portfolioPath: 'lib/new' })))
    expect(client.status).toBe(400)
    expect(await client.json()).toEqual({ error: 'GitHub API error: 403' })
  })

  it('falls back from an org create to a user create and saves the module', async () => {
    const insert = mockInsert({
      data: {
        id: 'mod-1',
        name: 'Display',
        portfolio_path: 'lib/new',
        spun_off_repo_url: 'https://github.com/acme/custom-repo',
      },
      error: null,
    })
    mocks.from.mockReturnValue(insert)
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(404, { message: 'not an org' }))
      .mockResolvedValueOnce(jsonResponse(404, { message: 'missing' }))
      .mockResolvedValueOnce(jsonResponse(201, { html_url: ' https://github.com/acme/custom-repo ' }))

    const response = await POST(makeRequest(JSON.stringify({
      portfolioPath: 'lib/new',
      repoName: ' custom-repo ',
      name: ' Display ',
      description: ' A module ',
    })))

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      module: {
        id: 'mod-1',
        name: 'Display',
        portfolio_path: 'lib/new',
        spun_off_repo_url: 'https://github.com/acme/custom-repo',
      },
    })
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('https://api.github.com/orgs/acme/repos')
    expect(vi.mocked(fetch).mock.calls[2][0]).toBe('https://api.github.com/user/repos')
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[2][1]?.body))).toEqual({
      name: 'custom-repo',
      description: 'A module',
      private: false,
    })
    expect(insert.insert).toHaveBeenCalledWith({
      name: 'Display',
      portfolio_path: 'lib/new',
      spun_off_repo_url: 'https://github.com/acme/custom-repo',
      created_by: 'admin-user-1',
    })
  })

  it('uses a fixed message for 422 and builds a URL when GitHub omits one', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(404, {}))
      .mockResolvedValueOnce(jsonResponse(422, { message: 'name exists' }))
    const invalid = await POST(makeRequest(JSON.stringify({ portfolioPath: 'lib/new' })))
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toEqual({ error: 'Repository already exists or name invalid.' })

    const insert = mockInsert({
      data: { id: 'mod-2', name: 'new', portfolio_path: 'lib/new', spun_off_repo_url: 'https://github.com/acme/new' },
      error: null,
    })
    mocks.from.mockReturnValue(insert)
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(404, {}))
      .mockResolvedValueOnce(jsonResponse(201, {}))
    const created = await POST(makeRequest(JSON.stringify({ portfolioPath: 'lib/new', description: '   ' })))
    expect(created.status).toBe(201)
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({
      spun_off_repo_url: 'https://github.com/acme/new',
      name: 'new',
    }))
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body))).toEqual({
      name: 'new',
      private: false,
    })
  })

  it('reports a created repo when the module row cannot be saved', async () => {
    mocks.supabaseAdmin = null
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(404, {}))
      .mockResolvedValueOnce(jsonResponse(201, { clone_url: 'https://github.com/acme/new.git' }))
    const unconfigured = await POST(makeRequest(JSON.stringify({ portfolioPath: 'lib/new' })))
    expect(unconfigured.status).toBe(503)
    expect(await unconfigured.json()).toEqual({
      error: 'Server configuration error; repo was created but could not save module.',
    })

    mocks.supabaseAdmin = { from: mocks.from }
    mocks.from
      .mockReturnValueOnce(mockInsert({ data: null, error: { message: 'first' } }))
      .mockReturnValueOnce(mockInsert({ data: null, error: { message: 'second' } }))
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(404, {}))
      .mockResolvedValueOnce(jsonResponse(201, { html_url: 'https://github.com/acme/new' }))
    const failed = await POST(makeRequest(JSON.stringify({ portfolioPath: 'lib/new' })))
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({
      error: 'Repository was created on GitHub but saving the module failed. You can add the module manually with the same path and repo URL.',
      repoUrl: 'https://github.com/acme/new',
    })
    expect(mocks.from).toHaveBeenCalledTimes(2)
  })
})
