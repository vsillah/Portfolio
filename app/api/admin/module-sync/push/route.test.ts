import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getModuleEntryForDiff: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/module-sync-db', () => ({
  getModuleEntryForDiff: mocks.getModuleEntryForDiff,
}))

import { POST } from './route'

function makeRequest(body?: string) {
  return new NextRequest('http://localhost/api/admin/module-sync/push', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
}

function entry(overrides: Record<string, unknown> = {}) {
  return {
    portfolioPath: 'lib/module-sync',
    spunOffRepoUrl: 'https://github.com/acme/module-sync',
    suggestedSpunOffRepoUrl: 'https://github.com/acme/suggested',
    ...overrides,
  }
}

describe('POST /api/admin/module-sync/push', () => {
  const originalToken = process.env.GITHUB_TOKEN
  const originalRepo = process.env.GITHUB_REPO

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    process.env.GITHUB_TOKEN = 'test-github-token'
    process.env.GITHUB_REPO = 'vsillah/Portfolio'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = originalToken
    if (originalRepo === undefined) delete process.env.GITHUB_REPO
    else process.env.GITHUB_REPO = originalRepo
  })

  it('requires admin auth before reading GitHub config', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(JSON.stringify({ moduleId: 'mod-1' })))

    expect(response.status).toBe(401)
    expect(mocks.getModuleEntryForDiff).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a missing token and an invalid portfolio repo', async () => {
    delete process.env.GITHUB_TOKEN
    const missingToken = await POST(makeRequest(JSON.stringify({ moduleId: 'mod-1' })))
    expect(missingToken.status).toBe(503)
    expect(await missingToken.json()).toEqual({
      error: 'GITHUB_TOKEN is not configured. Add it to trigger the sync workflow.',
    })

    process.env.GITHUB_TOKEN = 'test-github-token'
    process.env.GITHUB_REPO = 'not a repo'
    const invalidRepo = await POST(makeRequest(JSON.stringify({ moduleId: 'mod-1' })))
    expect(invalidRepo.status).toBe(503)
    expect(await invalidRepo.json()).toEqual({
      error: 'GITHUB_REPO is not set or invalid. Use owner/repo (e.g. vsillah/Portfolio).',
    })
    expect(mocks.getModuleEntryForDiff).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON and a blank module id', async () => {
    const invalid = await POST(makeRequest('not-json'))
    const blank = await POST(makeRequest(JSON.stringify({ moduleId: '   ' })))

    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toEqual({ error: 'Invalid JSON body' })
    expect(blank.status).toBe(400)
    expect(await blank.json()).toEqual({ error: 'Missing moduleId in body' })
    expect(mocks.getModuleEntryForDiff).not.toHaveBeenCalled()
  })

  it('rejects an unknown module, a missing repo URL, and a non-GitHub URL', async () => {
    mocks.getModuleEntryForDiff.mockResolvedValueOnce(null)
    const unknown = await POST(makeRequest(JSON.stringify({ moduleId: 'missing' })))
    expect(unknown.status).toBe(404)
    expect(await unknown.json()).toEqual({ error: 'Unknown module: missing' })

    mocks.getModuleEntryForDiff.mockResolvedValueOnce(entry({
      spunOffRepoUrl: '  ',
      suggestedSpunOffRepoUrl: '',
    }))
    const noUrl = await POST(makeRequest(JSON.stringify({ moduleId: 'mod-1' })))
    expect(noUrl.status).toBe(400)
    expect(await noUrl.json()).toEqual({
      error: 'No spun-off repo URL configured for this module. Set GITHUB_REPO and save a URL (or use the prepopulated one).',
    })

    mocks.getModuleEntryForDiff.mockResolvedValueOnce(entry({
      spunOffRepoUrl: 'https://gitlab.com/acme/module-sync',
    }))
    const badUrl = await POST(makeRequest(JSON.stringify({ moduleId: 'mod-1' })))
    expect(badUrl.status).toBe(400)
    expect(await badUrl.json()).toEqual({ error: 'Spun-off repo URL is not a valid GitHub repo URL.' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('dispatches the workflow using the suggested URL when the saved URL is blank', async () => {
    mocks.getModuleEntryForDiff.mockResolvedValue(entry({
      spunOffRepoUrl: '',
      suggestedSpunOffRepoUrl: 'https://github.com/acme/suggested.git',
    }))

    const response = await POST(makeRequest(JSON.stringify({ moduleId: '  mod-1  ' })))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      message: 'Sync workflow triggered. It will run in the portfolio repo.',
      workflowUrl: 'https://github.com/vsillah/Portfolio/actions',
    })
    expect(mocks.getModuleEntryForDiff).toHaveBeenCalledWith('mod-1')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/vsillah/Portfolio/actions/workflows/sync-module-to-spinoff.yml/dispatches',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-github-token',
        }),
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            prefix: 'lib/module-sync',
            target_repo: 'acme/suggested',
            target_branch: 'main',
          },
        }),
      })
    )
  })

  it('maps GitHub failures to 502 for server errors and 400 otherwise', async () => {
    mocks.getModuleEntryForDiff.mockResolvedValue(entry())
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'workflow disabled' }), { status: 500 }))
      .mockResolvedValueOnce(new Response('not found in this repo', { status: 404 }))
      .mockResolvedValueOnce(new Response('', { status: 422 }))

    const serverError = await POST(makeRequest(JSON.stringify({ moduleId: 'mod-1' })))
    expect(serverError.status).toBe(502)
    expect(await serverError.json()).toEqual({ error: 'Failed to trigger workflow: workflow disabled' })

    const clientError = await POST(makeRequest(JSON.stringify({ moduleId: 'mod-1' })))
    expect(clientError.status).toBe(400)
    expect(await clientError.json()).toEqual({ error: 'Failed to trigger workflow: not found in this repo' })

    const empty = await POST(makeRequest(JSON.stringify({ moduleId: 'mod-1' })))
    expect(empty.status).toBe(400)
    expect(await empty.json()).toEqual({ error: 'Failed to trigger workflow: GitHub API returned 422' })
  })
})
