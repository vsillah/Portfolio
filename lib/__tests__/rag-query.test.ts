import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalEnv = { ...process.env }

async function importRagQuery() {
  vi.resetModules()
  return import('../rag-query')
}

function enableRagFetches() {
  process.env.EMAIL_RAG_ENABLED = 'true'
  process.env.N8N_DISABLE_OUTBOUND = 'false'
  process.env.MOCK_N8N = 'false'
  process.env.N8N_RAG_QUERY_WEBHOOK_URL = 'https://n8n.example.test/webhook/rag-query'
}

describe('rag-query', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    enableRagFetches()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  it('normalizes successful webhook responses and records success diagnostics', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ output: 'Voice-of-brand excerpt.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { fetchRagContextForEmailQueryWithDiagnostics } = await importRagQuery()
    const result = await fetchRagContextForEmailQueryWithDiagnostics('  query text  ')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://n8n.example.test/webhook/rag-query')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: 'query text' }),
    })
    expect(result.block).toBe('Voice-of-brand excerpt.')
    expect(result.diagnostics).toMatchObject({
      rag_query_chars: 'query text'.length,
      skipped_reason: null,
      attempted: true,
      error_class: null,
      http_status: null,
      empty_response: false,
    })
    expect(result.diagnostics.latency_ms).toEqual(expect.any(Number))
  })

  it('marks a successful but empty normalized response as empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify('   '), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const { fetchRagContextForEmailQueryWithDiagnostics } = await importRagQuery()
    const result = await fetchRagContextForEmailQueryWithDiagnostics('query')

    expect(result.block).toBeNull()
    expect(result.diagnostics).toMatchObject({
      attempted: true,
      error_class: null,
      empty_response: true,
    })
  })

  it('records HTTP failures without surfacing webhook response bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response('upstream unavailable', { status: 502 }),
      ),
    )

    const { fetchRagContextForEmailQueryWithDiagnostics } = await importRagQuery()
    const result = await fetchRagContextForEmailQueryWithDiagnostics('query')

    expect(result.block).toBeNull()
    expect(result.diagnostics).toMatchObject({
      attempted: true,
      error_class: 'http',
      http_status: 502,
      empty_response: false,
    })
  })

  it('classifies invalid JSON as parse telemetry with an empty response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{not-json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const { fetchRagContextForEmailQueryWithDiagnostics } = await importRagQuery()
    const result = await fetchRagContextForEmailQueryWithDiagnostics('query')

    expect(result.block).toBeNull()
    expect(result.diagnostics).toMatchObject({
      attempted: true,
      error_class: 'parse',
      empty_response: true,
    })
  })

  it('classifies AbortError failures as timeouts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new DOMException('Timed out', 'AbortError')),
    )

    const { fetchRagContextForEmailQueryWithDiagnostics } = await importRagQuery()
    const result = await fetchRagContextForEmailQueryWithDiagnostics('query')

    expect(result.block).toBeNull()
    expect(result.diagnostics).toMatchObject({
      attempted: true,
      error_class: 'timeout',
      http_status: null,
    })
  })

  it('classifies non-abort fetch failures as network errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new Error('socket hang up')),
    )

    const { fetchRagContextForEmailQueryWithDiagnostics } = await importRagQuery()
    const result = await fetchRagContextForEmailQueryWithDiagnostics('query')

    expect(result.block).toBeNull()
    expect(result.diagnostics).toMatchObject({
      attempted: true,
      error_class: 'network',
      http_status: null,
    })
  })

  it('short-circuits with explicit skip reasons before issuing a webhook request', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
    const { fetchRagContextForEmailQueryWithDiagnostics } = await importRagQuery()

    process.env.EMAIL_RAG_ENABLED = 'false'
    await expect(fetchRagContextForEmailQueryWithDiagnostics(' query ')).resolves.toMatchObject({
      block: null,
      diagnostics: {
        rag_query_chars: 'query'.length,
        skipped_reason: 'email_rag_disabled',
        attempted: false,
      },
    })

    process.env.EMAIL_RAG_ENABLED = 'true'
    process.env.N8N_DISABLE_OUTBOUND = 'true'
    await expect(fetchRagContextForEmailQueryWithDiagnostics('query')).resolves.toMatchObject({
      diagnostics: {
        skipped_reason: 'n8n_outbound_disabled',
        attempted: false,
      },
    })

    process.env.N8N_DISABLE_OUTBOUND = 'false'
    process.env.MOCK_N8N = 'true'
    await expect(fetchRagContextForEmailQueryWithDiagnostics('query')).resolves.toMatchObject({
      diagnostics: {
        skipped_reason: 'mock_n8n_enabled',
        attempted: false,
      },
    })

    process.env.MOCK_N8N = 'false'
    await expect(fetchRagContextForEmailQueryWithDiagnostics('   ')).resolves.toMatchObject({
      diagnostics: {
        rag_query_chars: 0,
        skipped_reason: 'empty_query',
        attempted: false,
      },
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
