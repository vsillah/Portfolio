import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getSocialCarouselSlidesPrompt: vi.fn(),
  renderCarousel: vi.fn(),
  recordOpenAICost: vi.fn(),
  startAgentRun: vi.fn(),
  recordAgentStep: vi.fn(),
  recordAgentEvent: vi.fn(),
  endAgentRun: vi.fn(),
  markAgentRunFailed: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
  storageFrom: vi.fn(),
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/system-prompts', () => ({
  getSocialCarouselSlidesPrompt: mocks.getSocialCarouselSlidesPrompt,
}))

vi.mock('@/lib/carousel', () => ({
  renderCarousel: mocks.renderCarousel,
}))

vi.mock('@/lib/cost-calculator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cost-calculator')>()
  return {
    ...actual,
    recordOpenAICost: mocks.recordOpenAICost,
  }
})

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentStep: mocks.recordAgentStep,
  recordAgentEvent: mocks.recordAgentEvent,
  endAgentRun: mocks.endAgentRun,
  markAgentRunFailed: mocks.markAgentRunFailed,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
    storage: {
      from: mocks.storageFrom,
    },
  },
}))

import { POST } from './route'
import { evaluateSocialCarouselGenerationBudget } from '@/lib/social-carousel-generation'

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/social-content/social-1/convert-to-carousel', {
    method: 'POST',
  })
}

describe('POST /api/admin/social-content/[id]/convert-to-carousel', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.unstubAllGlobals()
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-key' }

    mocks.verifyAdmin.mockResolvedValue({
      user: { id: 'admin-user-1' },
      isAdmin: true,
    })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getSocialCarouselSlidesPrompt.mockResolvedValue('Create carousel slides as JSON.')
    mocks.startAgentRun.mockResolvedValue({ id: 'agent-run-1' })
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })
    mocks.endAgentRun.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
    mocks.recordOpenAICost.mockResolvedValue(undefined)
    mocks.single.mockResolvedValue({
      data: {
        post_text: 'Automation should reduce burden, not add work.',
        topic_extracted: {
          topic: 'Practical automation',
          key_insight: 'Technology should make work lighter.',
          personal_tie_in: 'Operators need tools that meet reality.',
        },
        hormozi_framework: { hook: 'reduce burden' },
        hashtags: ['AI', 'Automation'],
      },
      error: null,
    })
    mocks.eq.mockReturnValue({ single: mocks.single })
    mocks.select.mockReturnValue({ eq: mocks.eq })
    mocks.updateEq.mockResolvedValue({ error: null })
    mocks.update.mockReturnValue({ eq: mocks.updateEq })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'social_content_queue') {
        return {
          select: mocks.select,
          update: mocks.update,
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })
    mocks.renderCarousel.mockResolvedValue({
      pngBuffers: [Buffer.from('slide-1'), Buffer.from('slide-2'), Buffer.from('slide-3')],
      pdfBuffer: Buffer.from('pdf'),
    })
    mocks.upload.mockResolvedValue({ error: null })
    mocks.getPublicUrl.mockImplementation((fileName: string) => ({
      data: { publicUrl: `https://cdn.example.com/${fileName}` },
    }))
    mocks.storageFrom.mockReturnValue({
      upload: mocks.upload,
      getPublicUrl: mocks.getPublicUrl,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  it('requires admin auth before fetching content or starting a trace', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(), { params: { id: 'social-1' } })

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('converts to carousel, records budget metadata, links cost, and returns agentRunId', async () => {
    const slides = [
      { slideNumber: 1, heading: 'Reduce burden', body: 'Start with the real workflow.' },
      { slideNumber: 2, heading: 'Find the drag', body: 'Name what costs time.' },
      { slideNumber: 3, heading: 'Build lighter', body: 'Automate the repeatable work.' },
    ]
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        usage: { prompt_tokens: 200, completion_tokens: 400, total_tokens: 600 },
        choices: [{ message: { content: JSON.stringify({ slides }) } }],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const response = await POST(makeRequest(), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      content_format: 'carousel',
      carousel_slides: slides,
      carousel_slide_urls: [
        'https://cdn.example.com/carousels/social-1/slide_01.png',
        'https://cdn.example.com/carousels/social-1/slide_02.png',
        'https://cdn.example.com/carousels/social-1/slide_03.png',
      ],
      carousel_pdf_url: 'https://cdn.example.com/carousels/social-1/carousel.pdf',
      slide_count: 3,
      agentRunId: 'agent-run-1',
    })
    expect(mocks.startAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentKey: 'manual-admin',
        runtime: 'manual',
        kind: 'social_carousel_generation',
        triggerSource: 'admin:social_convert_to_carousel',
        triggeredByUserId: 'admin-user-1',
      }),
    )
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        stepKey: 'budget_check',
        metadata: expect.objectContaining({
          operation: 'social_carousel_generation',
          social_content_id: 'social-1',
          budget_status: 'allowed',
        }),
      }),
    )
    expect(mocks.recordOpenAICost).toHaveBeenCalledWith(
      expect.any(Object),
      'gpt-4o',
      { type: 'social_content_queue', id: 'social-1' },
      expect.objectContaining({
        operation: 'social_carousel_generation',
        budget_status: 'allowed',
      }),
      'agent-run-1',
    )
    expect(mocks.endAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        status: 'completed',
        outcome: expect.objectContaining({
          social_content_id: 'social-1',
          slide_count: 3,
        }),
      }),
    )
  })

  it('marks the trace failed and returns a safe message when budget blocks conversion', async () => {
    mocks.single.mockResolvedValue({
      data: {
        post_text: 'x'.repeat(1_000_000),
        topic_extracted: {},
        hormozi_framework: {},
        hashtags: [],
      },
      error: null,
    })
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const response = await POST(makeRequest(), { params: { id: 'social-1' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        'This carousel conversion is over the current Agent Ops budget limit. Shorten the post or reduce the carousel prompt size before retrying.',
      agentRunId: 'agent-run-1',
    })
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        stepKey: 'budget_check',
        status: 'failed',
      }),
    )
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith(
      'agent-run-1',
      expect.stringContaining('Estimated cost'),
      expect.objectContaining({
        operation: 'social_carousel_generation',
        social_content_id: 'social-1',
      }),
    )
  })

  it('evaluates normal carousel prompts within the manual budget', () => {
    const decision = evaluateSocialCarouselGenerationBudget({
      systemPrompt: 'Create carousel slides.',
      userMessage: 'Short post.',
    })

    expect(decision.status).toBe('allowed')
    expect(decision.rule.key).toBe('llm_manual_per_call')
    expect(decision.estimatedCostUsd).toBeGreaterThan(0)
  })
})
