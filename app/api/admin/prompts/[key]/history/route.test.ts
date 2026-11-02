import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
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

import { GET, POST } from './route'

function params(key = 'llm_judge') {
  return { params: Promise.resolve({ key }) }
}

function makeGet(key = 'llm_judge') {
  return new NextRequest(`http://localhost/api/admin/prompts/${key}/history`)
}

function makePost(body: unknown, key = 'llm_judge') {
  return new NextRequest(`http://localhost/api/admin/prompts/${key}/history`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function thenable(result: { data: unknown; error: unknown }) {
  const api: Record<string, any> = {}
  const self = () => api
  api.select = vi.fn(self)
  api.update = vi.fn((payload?: unknown) => {
    api._lastUpdate = payload
    return api
  })
  api.eq = vi.fn(self)
  api.order = vi.fn(self)
  api.single = vi.fn(async () => result)
  api.then = (
    resolve: (value: { data: unknown; error: unknown }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return api
}

describe('GET /api/admin/prompts/[key]/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGet(), params())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the prompt key does not exist', async () => {
    const prompts = thenable({ data: null, error: { message: 'missing' } })
    mocks.from.mockReturnValue(prompts)

    const response = await GET(makeGet('missing_key'), params('missing_key'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Prompt not found' })
  })

  it('returns history ordered by version descending', async () => {
    const historyRows = [
      { id: 'h2', prompt_id: 'p1', version: 2, prompt: 'v2' },
      { id: 'h1', prompt_id: 'p1', version: 1, prompt: 'v1' },
    ]
    const prompts = thenable({ data: { id: 'p1' }, error: null })
    const history = thenable({ data: historyRows, error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'system_prompts') return prompts
      if (table === 'system_prompt_history') return history
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeGet(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ history: historyRows })
    expect(history.eq).toHaveBeenCalledWith('prompt_id', 'p1')
    expect(history.order).toHaveBeenCalledWith('version', { ascending: false })
  })
})

describe('POST /api/admin/prompts/[key]/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication before rolling back', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makePost({ version: 1 }), params())

    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a missing or non-numeric version', async () => {
    const missing = await POST(makePost({}), params())
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({
      error: 'Version number is required',
    })

    const stringVersion = await POST(makePost({ version: '1' }), params())
    expect(stringVersion.status).toBe(400)

    const zero = await POST(makePost({ version: 0 }), params())
    expect(zero.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the requested history version is missing', async () => {
    const prompts = thenable({ data: { id: 'p1' }, error: null })
    const history = thenable({ data: null, error: { message: 'missing' } })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'system_prompts') return prompts
      if (table === 'system_prompt_history') return history
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makePost({ version: 9 }), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Version not found' })
  })

  it('restores prompt text and config from the selected version', async () => {
    const promptSelect = thenable({ data: { id: 'p1' }, error: null })
    const promptUpdate = thenable({
      data: { key: 'llm_judge', prompt: 'old text', config: { model: 'gpt-4o' } },
      error: null,
    })
    const history = thenable({
      data: {
        prompt: 'old text',
        config: { model: 'gpt-4o' },
        version: 1,
      },
      error: null,
    })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'system_prompts') {
        return {
          select: promptSelect.select,
          update: (payload: unknown) => promptUpdate.update(payload),
        }
      }
      if (table === 'system_prompt_history') return history
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makePost({ version: 1 }), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      prompt: { key: 'llm_judge', prompt: 'old text', config: { model: 'gpt-4o' } },
      message: 'Rolled back to version 1',
    })
    expect(promptUpdate.update).toHaveBeenCalledWith({
      prompt: 'old text',
      config: { model: 'gpt-4o' },
      updated_by: 'admin-1',
    })
    expect(history.eq).toHaveBeenCalledWith('prompt_id', 'p1')
    expect(history.eq).toHaveBeenCalledWith('version', 1)
  })
})
