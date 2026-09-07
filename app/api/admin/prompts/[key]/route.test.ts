import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  clearPromptCache: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/system-prompts', () => ({
  clearPromptCache: mocks.clearPromptCache,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { DELETE, GET, PUT } from './route'
import { SUPPORTED_OUTREACH_MODELS } from '@/lib/constants/llm-models'

function params(key: string) {
  return { params: Promise.resolve({ key }) }
}

function getRequest() {
  return new NextRequest('http://localhost/api/admin/prompts/chatbot')
}

function putRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/prompts/llm_judge', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function deleteRequest() {
  return new NextRequest('http://localhost/api/admin/prompts/chatbot', {
    method: 'DELETE',
  })
}

function promptLookup(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(result),
      }),
    }),
  }
}

describe('GET /api/admin/prompts/[key]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns the full prompt without history for non-admin callers', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)
    const prompt = {
      id: 'p-1',
      key: 'chatbot',
      prompt: 'secret system prompt',
      is_active: false,
    }
    mocks.from.mockReturnValue(
      promptLookup({ data: prompt, error: null }),
    )

    const response = await GET(getRequest(), params('chatbot'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ prompt, history: null })
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.from).toHaveBeenCalledWith('system_prompts')
  })

  it('includes recent history for admins', async () => {
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    const historyLimit = vi.fn().mockResolvedValue({
      data: [{ version: 2 }],
      error: null,
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'system_prompts') {
        return promptLookup({
          data: { id: 'p-1', key: 'chatbot' },
          error: null,
        })
      }
      if (table === 'system_prompt_history') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ limit: historyLimit }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(getRequest(), params('chatbot'))

    expect(response.status).toBe(200)
    expect(historyLimit).toHaveBeenCalledWith(10)
    expect(await response.json()).toEqual({
      prompt: { id: 'p-1', key: 'chatbot' },
      history: [{ version: 2 }],
    })
  })

  it('returns 404 when the prompt key is missing', async () => {
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.from.mockReturnValue(
      promptLookup({ data: null, error: { code: 'PGRST116' } }),
    )

    const response = await GET(getRequest(), params('missing'))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Prompt not found' })
  })
})

describe('PUT /api/admin/prompts/[key]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers before updating', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PUT(
      putRequest({ config: { model: 'gpt-4o-mini' } }),
      params('llm_judge'),
    )

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.clearPromptCache).not.toHaveBeenCalled()
  })

  it('rejects unsupported models for llm_judge', async () => {
    const response = await PUT(
      putRequest({ config: { model: 'not-a-real-model' } }),
      params('llm_judge'),
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain("Unsupported model 'not-a-real-model'")
    expect(body.error).toContain(SUPPORTED_OUTREACH_MODELS[0].id)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects unsupported models for outreach prompt keys', async () => {
    const response = await PUT(
      putRequest({ config: { model: 'gpt-5-secret' } }),
      params('email_cold_outreach'),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("Unsupported model 'gpt-5-secret'"),
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('skips the model whitelist for non-outreach prompt keys', async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { key: 'chatbot', config: { model: 'custom-model' } },
            error: null,
          }),
        }),
      }),
    })
    mocks.from.mockReturnValue({ update })

    const response = await PUT(
      putRequest({ config: { model: 'custom-model' } }),
      params('chatbot'),
    )

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith({
      updated_by: 'admin-1',
      config: { model: 'custom-model' },
    })
    expect(mocks.clearPromptCache).toHaveBeenCalledWith('chatbot')
  })

  it('allows a curated outreach model and clears the prompt cache', async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { key: 'llm_judge', config: { model: 'gpt-4o-mini' } },
            error: null,
          }),
        }),
      }),
    })
    mocks.from.mockReturnValue({ update })

    const response = await PUT(
      putRequest({ config: { model: 'gpt-4o-mini' }, is_active: false }),
      params('llm_judge'),
    )

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith({
      updated_by: 'admin-1',
      config: { model: 'gpt-4o-mini' },
      is_active: false,
    })
    expect(mocks.clearPromptCache).toHaveBeenCalledWith('llm_judge')
  })

  it('returns 404 when the prompt key is missing', async () => {
    mocks.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }),
        }),
      }),
    })

    const response = await PUT(putRequest({ name: 'Renamed' }), params('missing'))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Prompt not found' })
    expect(mocks.clearPromptCache).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/admin/prompts/[key]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers before deleting', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await DELETE(deleteRequest(), params('custom_prompt'))

    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it.each(['chatbot', 'voice_agent', 'llm_judge', 'diagnostic'])(
    'refuses to delete the core %s prompt',
    async (key) => {
      const response = await DELETE(deleteRequest(), params(key))

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Cannot delete core system prompts. Disable them instead.',
      })
      expect(mocks.from).not.toHaveBeenCalled()
    },
  )

  it('deletes a non-core prompt', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({
      delete: vi.fn().mockReturnValue({ eq }),
    })

    const response = await DELETE(deleteRequest(), params('email_follow_up'))

    expect(response.status).toBe(200)
    expect(mocks.from).toHaveBeenCalledWith('system_prompts')
    expect(eq).toHaveBeenCalledWith('key', 'email_follow_up')
    expect(await response.json()).toEqual({ success: true })
  })
})
