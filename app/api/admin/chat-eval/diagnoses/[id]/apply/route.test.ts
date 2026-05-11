import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  clearPromptCache: vi.fn(),
  from: vi.fn(),
  diagnosisSingle: vi.fn(),
  promptSingle: vi.fn(),
  insert: vi.fn(),
  historyUpdate: vi.fn(),
  diagnosisUpdate: vi.fn(),
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

import { POST } from './route'

const params = { params: Promise.resolve({ id: 'diagnosis-1' }) }

function request(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/admin/chat-eval/diagnoses/diagnosis-1/apply', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function setupSupabaseChains() {
  const diagnosisEq = vi.fn(() => ({ single: mocks.diagnosisSingle }))
  const diagnosisSelect = vi.fn(() => ({ eq: diagnosisEq }))

  const promptEqVersion = vi.fn(() => Promise.resolve({ data: null, error: null }))
  const promptEqPromptId = vi.fn(() => ({ eq: promptEqVersion }))
  mocks.historyUpdate.mockReturnValue({ eq: promptEqPromptId })

  const promptEqKey = vi.fn(() => ({ select: vi.fn(() => ({ single: mocks.promptSingle })) }))
  const promptUpdate = vi.fn(() => ({ eq: promptEqKey }))

  const diagnosisUpdateEq = vi.fn(() => Promise.resolve({ data: null, error: null }))
  mocks.diagnosisUpdate.mockReturnValue({ eq: diagnosisUpdateEq })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'error_diagnoses') {
      return {
        select: diagnosisSelect,
        update: mocks.diagnosisUpdate,
      }
    }
    if (table === 'system_prompts') return { update: promptUpdate }
    if (table === 'system_prompt_history') return { update: mocks.historyUpdate }
    if (table === 'fix_applications') return { insert: mocks.insert }
    throw new Error(`Unexpected table: ${table}`)
  })
}

describe('POST /api/admin/chat-eval/diagnoses/[id]/apply', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.diagnosisSingle.mockResolvedValue({
      data: {
        status: 'approved',
        recommendations: [
          {
            id: 'rec-approved',
            type: 'prompt',
            approved: true,
            changes: {
              target: 'system_prompt',
              old_value: 'Old prompt',
              new_value: 'New prompt',
              can_auto_apply: true,
            },
          },
          {
            id: 'rec-unapproved',
            type: 'prompt',
            approved: false,
            changes: {
              target: 'system_prompt',
              old_value: 'Old prompt',
              new_value: 'Unapproved prompt',
              can_auto_apply: true,
            },
          },
        ],
      },
      error: null,
    })
    mocks.promptSingle.mockResolvedValue({ data: { id: 'prompt-1', version: 3 }, error: null })
    mocks.insert.mockResolvedValue({ data: null, error: null })
    setupSupabaseChains()
  })

  it('rejects explicitly selected recommendations that were not approved', async () => {
    const response = await POST(
      request({ recommendation_ids: ['rec-unapproved'], auto_apply: true }) as never,
      params
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Only approved recommendations can be applied',
    })
    expect(mocks.from).not.toHaveBeenCalledWith('system_prompts')
    expect(mocks.clearPromptCache).not.toHaveBeenCalled()
  })

  it('applies an explicitly selected approved prompt recommendation', async () => {
    const response = await POST(
      request({ recommendation_ids: ['rec-approved'], auto_apply: true }) as never,
      params
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      applied: [
        {
          recommendation_id: 'rec-approved',
          status: 'applied',
          method: 'auto',
          changes: {
            target: 'chatbot',
            old_value: 'Old prompt',
            new_value: 'New prompt',
          },
        },
      ],
      instructions: [],
      summary: {
        total: 1,
        auto_applied: 1,
        requires_manual: 0,
      },
    })
    expect(mocks.clearPromptCache).toHaveBeenCalledWith('chatbot')
  })
})
