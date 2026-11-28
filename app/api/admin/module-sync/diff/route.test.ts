import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getModuleEntryForDiff: vi.fn(),
  runModuleDiff: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/module-sync-db', () => ({
  getModuleEntryForDiff: mocks.getModuleEntryForDiff,
}))

vi.mock('@/lib/module-sync-diff', () => ({
  runModuleDiff: mocks.runModuleDiff,
}))

import { GET } from './route'

function makeRequest(moduleId?: string) {
  const url = new URL('http://localhost/api/admin/module-sync/diff')
  if (moduleId !== undefined) url.searchParams.set('module', moduleId)
  return new NextRequest(url)
}

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mod-1',
    portfolioPath: 'lib/module-sync',
    spunOffRepoUrl: 'https://github.com/acme/saved',
    suggestedSpunOffRepoUrl: 'https://github.com/acme/suggested',
    ...overrides,
  }
}

describe('GET /api/admin/module-sync/diff', () => {
  const originalToken = process.env.GITHUB_TOKEN

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    process.env.GITHUB_TOKEN = 'test-github-token'
    mocks.runModuleDiff.mockResolvedValue({ moduleId: 'mod-1', summary: { modified: 1 } })
  })

  afterEach(() => {
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = originalToken
  })

  it('requires admin auth before loading a module', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest('mod-1'))

    expect(response.status).toBe(401)
    expect(mocks.getModuleEntryForDiff).not.toHaveBeenCalled()
  })

  it('rejects a missing or blank module query', async () => {
    const missing = await GET(makeRequest())
    const blank = await GET(makeRequest('   '))

    expect(missing.status).toBe(400)
    expect(blank.status).toBe(400)
    expect(await blank.json()).toEqual({ error: 'Missing query parameter: module' })
    expect(mocks.getModuleEntryForDiff).not.toHaveBeenCalled()
  })

  it('keeps the raw module value in the unknown-module error', async () => {
    mocks.getModuleEntryForDiff.mockResolvedValue(null)

    const response = await GET(makeRequest(' mod-1'))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Unknown module:  mod-1' })
    expect(mocks.getModuleEntryForDiff).toHaveBeenCalledWith('mod-1')
    expect(mocks.runModuleDiff).not.toHaveBeenCalled()
  })

  it('diffs the saved repo URL and forwards the GitHub token', async () => {
    const saved = entry()
    mocks.getModuleEntryForDiff.mockResolvedValue(saved)

    const response = await GET(makeRequest('mod-1'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ moduleId: 'mod-1', summary: { modified: 1 } })
    expect(mocks.runModuleDiff).toHaveBeenCalledWith(saved, process.cwd(), 'test-github-token')
  })

  it('uses the suggested URL when no saved URL exists and still returns a diff error as 200', async () => {
    delete process.env.GITHUB_TOKEN
    const saved = entry({ spunOffRepoUrl: '' })
    mocks.getModuleEntryForDiff.mockResolvedValue(saved)
    mocks.runModuleDiff.mockResolvedValue({ error: 'repo missing', repoNotFound: true })

    const response = await GET(makeRequest('mod-1'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ error: 'repo missing', repoNotFound: true })
    expect(mocks.runModuleDiff).toHaveBeenCalledWith(
      { ...saved, spunOffRepoUrl: 'https://github.com/acme/suggested' },
      process.cwd(),
      undefined
    )
  })
})
