import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  clearPromptCache: vi.fn(),
  from: vi.fn(),
  diagnosisSingle: vi.fn(),
  updateSingle: vi.fn(),
  insert: vi.fn(),
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
  return new Request('http://localhost/api/admin/chat-eval/diagnoses/diagnosis-1/apply-prompt', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function setupSupabaseChains() {
  const diagnosisEq = vi.fn(() => ({ single: mocks.diagnosisSingle }))
  const diagnosisSelect = vi.fn(() => ({ eq: diagnosisEq }))
  const updateEq = vi.fn(() => ({ select: vi.fn(() => ({ single: mocks.updateSingle })) }))
  const update = vi.fn(() => ({ eq: updateEq }))

  mocks.from.mockImplementation((table: string) => {
    if (table === 'error_diagnoses') return { select: diagnosisSelect }
    if (table === 'system_prompts') return { update }
    if (table === 'fix_applications') return { insert: mocks.insert }
    throw new Error(`Unexpected table: ${table}`)
  })
}

describe('POST /api/admin/chat-eval/diagnoses/[id]/apply-prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.diagnosisSingle.mockResolvedValue({
      data: {
        status: 'approved',
        recommendations: [
          {
            id: 'rec-1',
            type: 'prompt',
            approved: true,
            changes: {
              target: 'system_prompt',
              old_value: 'Old prompt',
              new_value: 'New prompt',
            },
          },
        ],
      },
      error: null,
    })
    mocks.updateSingle.mockResolvedValue({ data: { id: 'prompt-1', key: 'chatbot' }, error: null })
    mocks.insert.mockResolvedValue({ data: null, error: null })
    setupSupabaseChains()
  })

  it('requires diagnosis approval before mutating prompts', async () => {
    mocks.diagnosisSingle.mockResolvedValue({
      data: {
        status: 'pending',
        recommendations: [
          {
            id: 'rec-1',
            type: 'prompt',
            approved: true,
            changes: { target: 'system_prompt', new_value: 'New prompt' },
          },
        ],
      },
      error: null,
    })

    const response = await POST(request({ recommendation_id: 'rec-1' }) as never, params)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Diagnosis must be approved before applying prompt fixes',
    })
    expect(mocks.clearPromptCache).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalledWith('system_prompts')
  })

  it('requires the selected prompt recommendation to be approved', async () => {
    mocks.diagnosisSingle.mockResolvedValue({
      data: {
        status: 'approved',
        recommendations: [
          {
            id: 'rec-1',
            type: 'prompt',
            approved: false,
            changes: { target: 'system_prompt', new_value: 'New prompt' },
          },
        ],
      },
      error: null,
    })

    const response = await POST(request({ recommendation_id: 'rec-1' }) as never, params)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Prompt recommendation must be approved before applying',
    })
    expect(mocks.clearPromptCache).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalledWith('system_prompts')
  })

  it('updates the mapped chatbot prompt after approval', async () => {
    const response = await POST(request({ recommendation_id: 'rec-1' }) as never, params)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      prompt: { id: 'prompt-1', key: 'chatbot' },
      message: 'Prompt "chatbot" updated successfully',
    })
    expect(mocks.clearPromptCache).toHaveBeenCalledWith('chatbot')
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      diagnosis_id: 'diagnosis-1',
      change_type: 'prompt',
      target_identifier: 'chatbot',
      application_method: 'auto',
      applied_by: 'admin-user',
    }))
  })
})
