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

import { POST } from './route'
import { ACCELERATED_MODULE0_DRAFT_MARKER } from '@/lib/accelerated-module0-video-draft'

function makeRequest(body: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/admin/video-generation/course-packets/module-0/import-draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockExistingDraft(data: Array<Record<string, unknown>>, error: unknown = null) {
  const limit = vi.fn().mockResolvedValue({ data, error })
  const order = vi.fn(() => ({ limit }))
  const neq = vi.fn(() => ({ order }))
  const eq = vi.fn(() => ({ neq }))
  const select = vi.fn(() => ({ eq }))
  return { select, eq, neq, order, limit }
}

function mockTemplate(data: Record<string, unknown> | null, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error })
  const eqStatus = vi.fn(() => ({ maybeSingle }))
  const eqKey = vi.fn(() => ({ eq: eqStatus }))
  const select = vi.fn(() => ({ eq: eqKey }))
  return { select, eqKey, eqStatus, maybeSingle }
}

function mockInsert(data: Record<string, unknown> | null, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error })
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  return { insert, select, single }
}

describe('POST /api/admin/video-generation/course-packets/module-0/import-draft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('reuses an existing active Module 0 draft without provider side effects', async () => {
    const existingBuilder = mockExistingDraft([
      {
        id: 'draft-existing',
        title: 'Accelerated Module 0: Why Accelerated Exists',
        status: 'pending',
        custom_prompt: ACCELERATED_MODULE0_DRAFT_MARKER,
      },
    ])
    mocks.from.mockReturnValueOnce(existingBuilder)

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.reused).toBe(true)
    expect(body.draft.id).toBe('draft-existing')
    expect(body.side_effects).toMatchObject({
      heygen: false,
      elevenlabs: false,
      render: false,
      upload: false,
      publish: false,
      apify: false,
    })
  })

  it('inserts a deterministic pending manual draft with script intelligence metadata', async () => {
    const existingBuilder = mockExistingDraft([])
    const templateBuilder = mockTemplate({
      id: 'template-accelerated',
      key: 'accelerated_lesson',
      name: 'Accelerated lesson',
      description: 'Lesson template.',
      source_type: 'seeded',
      source_urls: [],
      outline: {
        pain_point: 'Show why speed without judgment creates more noise.',
        cta: 'Ask the learner to complete the worksheet.',
      },
      status: 'active',
    })
    const insertBuilder = mockInsert({
      id: 'draft-new',
      title: 'Accelerated Module 0: Why Accelerated Exists',
      source: 'manual',
      status: 'pending',
      custom_prompt: ACCELERATED_MODULE0_DRAFT_MARKER,
      script_template_id: 'template-accelerated',
      script_scorecard: { blockers: [] },
    })

    mocks.from
      .mockReturnValueOnce(existingBuilder)
      .mockReturnValueOnce(templateBuilder)
      .mockReturnValueOnce(insertBuilder)

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.reused).toBe(false)
    expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Accelerated Module 0: Why Accelerated Exists',
      source: 'manual',
      status: 'pending',
      custom_prompt: ACCELERATED_MODULE0_DRAFT_MARKER,
      script_template_id: 'template-accelerated',
      script_outline: expect.objectContaining({
        pain_point: expect.stringContaining('polished artifacts'),
        cta: expect.stringContaining('Accelerated Workshop interest path'),
      }),
      script_scorecard: expect.objectContaining({
        blockers: [],
        overall_score: expect.any(Number),
      }),
      research_packet_ids: [],
    }))
    expect(body.side_effects.publish).toBe(false)
  })
})
