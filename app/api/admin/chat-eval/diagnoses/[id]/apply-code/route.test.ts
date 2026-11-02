import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  diagnosisSingle: vi.fn(),
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

import { POST } from './route'

const params = { params: Promise.resolve({ id: 'diagnosis-1' }) }

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/chat-eval/diagnoses/diagnosis-1/apply-code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function codeRec(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-code',
    type: 'code',
    priority: 'high',
    description: 'Raise the retry cap',
    application_instructions: '',
    changes: {
      target: 'lib/retry.ts',
      old_value: 'retries = 1',
      new_value: 'retries = 3',
      can_auto_apply: false,
    },
    ...overrides,
  }
}

function wireDiagnosis(recommendations: unknown) {
  mocks.diagnosisSingle.mockResolvedValue({
    data: { recommendations, session_id: 'session-1' },
    error: null,
  })
  const diagnosisEq = vi.fn(() => ({ single: mocks.diagnosisSingle }))
  const diagnosisSelect = vi.fn(() => ({ eq: diagnosisEq }))
  mocks.from.mockImplementation((table: string) => {
    if (table === 'error_diagnoses') return { select: diagnosisSelect }
    if (table === 'fix_applications') return { insert: mocks.insert }
    throw new Error(`Unexpected table: ${table}`)
  })
  return { diagnosisEq, diagnosisSelect }
}

describe('POST /api/admin/chat-eval/diagnoses/[id]/apply-code', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.insert.mockResolvedValue({ data: null, error: null })
    wireDiagnosis([
      { id: 'rec-prompt', type: 'prompt', changes: { target: 'system_prompt' } },
      codeRec(),
    ])
  })

  it('requires admin auth before reading the diagnosis', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({}) as never, params)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the diagnosis is missing', async () => {
    mocks.diagnosisSingle.mockResolvedValue({ data: null, error: { message: 'missing' } })

    const response = await POST(request({}) as never, params)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Diagnosis not found' })
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('returns 404 when the selected recommendation is not a code change', async () => {
    const response = await POST(request({ recommendation_id: 'rec-prompt' }) as never, params)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Code recommendation not found' })
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('uses the first code recommendation when no id is supplied and never auto-applies', async () => {
    const response = await POST(request({}) as never, params)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.recommendation_id).toBe('rec-code')
    expect(body.can_auto_apply).toBe(false)
    expect(body.target_file).toBe('lib/retry.ts')
    expect(body.instructions).toContain('**File:** lib/retry.ts')
    expect(body.instructions).toContain('retries = 3')
    expect(mocks.insert).toHaveBeenCalledWith({
      diagnosis_id: 'diagnosis-1',
      change_type: 'code_file',
      target_identifier: 'lib/retry.ts',
      old_value: 'retries = 1',
      new_value: 'retries = 3',
      application_method: 'manual',
      applied_by: 'admin-user',
      verification_status: 'pending',
      verification_notes: 'Instructions generated, awaiting manual application',
    })
  })

  it('builds config instructions for any target path containing config, even when auto-apply is off', async () => {
    wireDiagnosis([
      codeRec({
        id: 'rec-config',
        application_instructions: 'custom steps that should be replaced',
        changes: {
          target: 'lib/config.ts',
          old_value: 'limit = 1',
          new_value: 'limit = 5',
          can_auto_apply: false,
        },
      }),
    ])

    const response = await POST(request({ recommendation_id: 'rec-config' }) as never, params)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.can_auto_apply).toBe(false)
    expect(body.instructions).toContain('1. Open the file: lib/config.ts')
    expect(body.instructions).toContain('Old: limit = 1')
    expect(body.instructions).toContain('New: limit = 5')
    expect(body.instructions).not.toContain('custom steps')
  })

  it('keeps the code template for an env file unless can_auto_apply is also true', async () => {
    wireDiagnosis([
      codeRec({
        changes: {
          target: '.env.local',
          old_value: 'A=1',
          new_value: 'A=2',
          can_auto_apply: false,
        },
      }),
    ])

    const blocked = await POST(request({}) as never, params)
    expect((await blocked.json()).instructions).toContain('**File:** .env.local')

    wireDiagnosis([
      codeRec({
        changes: {
          target: '.env.local',
          old_value: 'A=1',
          new_value: 'A=2',
          can_auto_apply: true,
        },
      }),
    ])
    const allowed = await POST(request({}) as never, params)
    const body = await allowed.json()
    expect(body.instructions).toContain('1. Open the file: .env.local')
    expect(body.can_auto_apply).toBe(false)
  })

  it('returns the thrown message when the recommendation has no changes payload', async () => {
    wireDiagnosis([{ id: 'rec-code', type: 'code' }])

    const response = await POST(request({}) as never, params)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toEqual(expect.any(String))
    expect(body.error.length).toBeGreaterThan(0)
    expect(mocks.insert).not.toHaveBeenCalled()
  })
})
