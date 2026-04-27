import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockRecordOpenAICost = vi.fn()
const mockRecordAnthropicCost = vi.fn()

vi.mock('@/lib/cost-calculator', () => ({
  recordOpenAICost: (...args: unknown[]) => mockRecordOpenAICost(...args),
  recordAnthropicCost: (...args: unknown[]) => mockRecordAnthropicCost(...args),
}))

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  vi.resetModules()
  mockRecordOpenAICost.mockReset()
  mockRecordAnthropicCost.mockReset()
  mockRecordOpenAICost.mockResolvedValue(undefined)
  mockRecordAnthropicCost.mockResolvedValue(undefined)
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('generateJsonCompletion — provider routing', () => {
  it('routes gpt-* models to OpenAI Chat Completions', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"foo":"bar"}' } }],
        usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { generateJsonCompletion } = await import('../llm-dispatch')
    const result = await generateJsonCompletion({
      model: 'gpt-4o-mini',
      systemPrompt: 'system',
      userPrompt: 'user',
      costContext: {
        reference: { type: 'contact', id: '99' },
        metadata: { operation: 'unit-test' },
      },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    const body = JSON.parse((init as { body: string }).body)
    expect(body.model).toBe('gpt-4o-mini')
    expect(body.response_format).toEqual({ type: 'json_object' })

    expect(result.provider).toBe('openai')
    expect(result.content).toBe('{"foo":"bar"}')
    expect(mockRecordOpenAICost).toHaveBeenCalledTimes(1)
    expect(mockRecordAnthropicCost).not.toHaveBeenCalled()
  })

  it('routes claude-* models to Anthropic Messages API and strips fences', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '```json\n{"hello":"world"}\n```' }],
        usage: { input_tokens: 5, output_tokens: 7 },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { generateJsonCompletion } = await import('../llm-dispatch')
    const result = await generateJsonCompletion({
      model: 'claude-3-5-haiku-20241022',
      systemPrompt: 'system',
      userPrompt: 'user',
      costContext: { reference: { type: 'contact', id: '1' } },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect((init as { headers: Record<string, string> }).headers['x-api-key']).toBe('sk-ant-test')

    expect(result.provider).toBe('anthropic')
    expect(result.content).toBe('{"hello":"world"}')
    expect(mockRecordAnthropicCost).toHaveBeenCalledTimes(1)
    expect(mockRecordOpenAICost).not.toHaveBeenCalled()
  })

  it('throws a clear error when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY
    const { generateJsonCompletion } = await import('../llm-dispatch')

    await expect(
      generateJsonCompletion({
        model: 'gpt-4o',
        systemPrompt: 's',
        userPrompt: 'u',
      }),
    ).rejects.toThrowError('OPENAI_API_KEY not configured')
  })

  it('throws a clear error when ANTHROPIC_API_KEY is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const { generateJsonCompletion } = await import('../llm-dispatch')

    await expect(
      generateJsonCompletion({
        model: 'claude-sonnet-4-20250514',
        systemPrompt: 's',
        userPrompt: 'u',
      }),
    ).rejects.toThrowError('ANTHROPIC_API_KEY not configured')
  })
})
