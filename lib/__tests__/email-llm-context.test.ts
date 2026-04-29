/**
 * email-llm-context — Phase 2 metadata sibling
 *
 * The "with-metadata" wrapper is what the outreach generator uses to populate
 * outreach_queue.generation_inputs. This file pins down the metadata contract:
 *  - pineconeChars matches the RAG block length (or 0 when no block)
 *  - priorChatPresent reflects the chat fetcher result
 *  - pineconeBlockHash is null when no RAG, deterministic 12-char hex otherwise
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockBuildEmailRagQueryText = vi.fn()
const mockFetchRagContextForEmailQueryWithDiagnostics = vi.fn()
const mockFetchRecentSiteChatExcerptForLeadEmail = vi.fn()

const disabledRagDiag = {
  rag_query_chars: 14,
  skipped_reason: 'email_rag_disabled' as const,
  attempted: false,
  error_class: null,
  http_status: null,
  latency_ms: null,
  empty_response: false,
}

vi.mock('@/lib/rag-query', () => ({
  buildEmailRagQueryText: (...args: unknown[]) => mockBuildEmailRagQueryText(...args),
  fetchRagContextForEmailQueryWithDiagnostics: (...args: unknown[]) =>
    mockFetchRagContextForEmailQueryWithDiagnostics(...args),
}))

vi.mock('@/lib/lead-chat-excerpt', () => ({
  fetchRecentSiteChatExcerptForLeadEmail: (...args: unknown[]) =>
    mockFetchRecentSiteChatExcerptForLeadEmail(...args),
}))

const baseContact = {
  name: 'Test Lead',
  email: 't@example.com',
  company: 'Acme',
  industry: 'saas',
  job_title: null,
  employee_count: null,
  annual_revenue: null,
  location: null,
  interest_areas: null,
  interest_summary: null,
  rep_pain_points: null,
  quick_wins: null,
  ai_readiness_score: null,
  competitive_pressure_score: null,
  potential_recommendations_summary: null,
  website_tech_stack: null,
}

describe('appendPineconeAndChatContextWithMetadata', () => {
  beforeEach(() => {
    vi.resetModules()
    mockBuildEmailRagQueryText.mockReturnValue('rag-query-text')
    mockFetchRagContextForEmailQueryWithDiagnostics.mockReset()
    mockFetchRecentSiteChatExcerptForLeadEmail.mockReset()
  })

  it('returns 0 chars + null hash when neither RAG nor chat are available', async () => {
    mockFetchRagContextForEmailQueryWithDiagnostics.mockResolvedValue({
      block: null,
      diagnostics: disabledRagDiag,
    })
    mockFetchRecentSiteChatExcerptForLeadEmail.mockResolvedValue(null)
    const { appendPineconeAndChatContextWithMetadata } = await import(
      '../email-llm-context'
    )
    const { prompt, metadata } = await appendPineconeAndChatContextWithMetadata(
      'base prompt',
      { contact: baseContact, researchTextForRag: 'research' },
    )
    expect(prompt).toBe('base prompt')
    expect(metadata.pineconeChars).toBe(0)
    expect(metadata.priorChatPresent).toBe(false)
    expect(metadata.pineconeBlockHash).toBeNull()
    expect(metadata.ragSkippedReason).toBe('email_rag_disabled')
    expect(metadata.ragAttempted).toBe(false)
  })

  it('reports RAG length and a 12-char fingerprint when RAG returns a block', async () => {
    const ragBlock = 'Voice example A. Voice example B.'
    mockFetchRagContextForEmailQueryWithDiagnostics.mockResolvedValue({
      block: ragBlock,
      diagnostics: {
        rag_query_chars: 14,
        skipped_reason: null,
        attempted: true,
        error_class: null,
        http_status: 200,
        latency_ms: 12,
        empty_response: false,
      },
    })
    mockFetchRecentSiteChatExcerptForLeadEmail.mockResolvedValue(null)
    const { appendPineconeAndChatContextWithMetadata } = await import(
      '../email-llm-context'
    )
    const { metadata } = await appendPineconeAndChatContextWithMetadata(
      'base prompt',
      { contact: baseContact, researchTextForRag: 'research' },
    )
    expect(metadata.pineconeChars).toBe(ragBlock.length)
    expect(metadata.priorChatPresent).toBe(false)
    expect(metadata.pineconeBlockHash).not.toBeNull()
    expect(metadata.pineconeBlockHash!.length).toBe(12)
    expect(/^[0-9a-f]{12}$/.test(metadata.pineconeBlockHash!)).toBe(true)
    expect(metadata.ragAttempted).toBe(true)
    expect(metadata.ragLatencyMs).toBe(12)
  })

  it('the fingerprint is deterministic per RAG block', async () => {
    const ragBlock = 'stable-block'
    mockFetchRagContextForEmailQueryWithDiagnostics.mockResolvedValue({
      block: ragBlock,
      diagnostics: {
        rag_query_chars: 1,
        skipped_reason: null,
        attempted: true,
        error_class: null,
        http_status: 200,
        latency_ms: 1,
        empty_response: false,
      },
    })
    mockFetchRecentSiteChatExcerptForLeadEmail.mockResolvedValue(null)
    const { appendPineconeAndChatContextWithMetadata } = await import(
      '../email-llm-context'
    )
    const a = await appendPineconeAndChatContextWithMetadata('p', {
      contact: baseContact,
      researchTextForRag: 'r',
    })
    const b = await appendPineconeAndChatContextWithMetadata('p', {
      contact: baseContact,
      researchTextForRag: 'r',
    })
    expect(a.metadata.pineconeBlockHash).toBe(b.metadata.pineconeBlockHash)
  })

  it('flags priorChatPresent when chat excerpt is non-empty', async () => {
    mockFetchRagContextForEmailQueryWithDiagnostics.mockResolvedValue({
      block: null,
      diagnostics: disabledRagDiag,
    })
    mockFetchRecentSiteChatExcerptForLeadEmail.mockResolvedValue('chat excerpt body')
    const { appendPineconeAndChatContextWithMetadata } = await import(
      '../email-llm-context'
    )
    const { metadata } = await appendPineconeAndChatContextWithMetadata('p', {
      contact: baseContact,
      researchTextForRag: 'r',
    })
    expect(metadata.priorChatPresent).toBe(true)
  })

  it('back-compat wrapper delegates to the metadata helper', async () => {
    mockFetchRagContextForEmailQueryWithDiagnostics.mockResolvedValue({
      block: null,
      diagnostics: disabledRagDiag,
    })
    mockFetchRecentSiteChatExcerptForLeadEmail.mockResolvedValue(null)
    const { appendPineconeAndChatContextToSystemPrompt } = await import(
      '../email-llm-context'
    )
    const out = await appendPineconeAndChatContextToSystemPrompt('p', {
      contact: baseContact,
      researchTextForRag: 'r',
    })
    expect(out).toBe('p')
  })
})

describe('applyPriorOutreachHistorySentinel', () => {
  it('substitutes the bare {{prior_outreach_history}} placeholder', async () => {
    const { applyPriorOutreachHistorySentinel } = await import(
      '../email-llm-context'
    )
    const tpl = 'Top.\n{{prior_outreach_history}}\nBottom.'
    const out = applyPriorOutreachHistorySentinel(tpl, 'HISTORY_BLOCK')
    expect(out).toContain('HISTORY_BLOCK')
    expect(out).not.toContain('{{prior_outreach_history}}')
    expect(out.indexOf('Top.')).toBeLessThan(out.indexOf('HISTORY_BLOCK'))
    expect(out.indexOf('HISTORY_BLOCK')).toBeLessThan(out.indexOf('Bottom.'))
  })

  it('substitutes inside the block sentinel and keeps surrounding context', async () => {
    const { applyPriorOutreachHistorySentinel } = await import(
      '../email-llm-context'
    )
    const tpl =
      'Top.\n{{#prior_outreach_history}}\n## Heading\n{{prior_outreach_history}}\nReminder: do not repeat.\n{{/prior_outreach_history}}\nBottom.'
    const out = applyPriorOutreachHistorySentinel(tpl, 'HISTORY_BLOCK')
    expect(out).toContain('## Heading')
    expect(out).toContain('HISTORY_BLOCK')
    expect(out).toContain('Reminder: do not repeat.')
    expect(out).not.toContain('{{#prior_outreach_history}}')
    expect(out).not.toContain('{{/prior_outreach_history}}')
  })

  it('strips the wrapped block when value is null', async () => {
    const { applyPriorOutreachHistorySentinel } = await import(
      '../email-llm-context'
    )
    const tpl =
      'Top.\n{{#prior_outreach_history}}\n## Heading\n{{prior_outreach_history}}\n{{/prior_outreach_history}}\nBottom.'
    const out = applyPriorOutreachHistorySentinel(tpl, null)
    expect(out).not.toContain('Heading')
    expect(out).not.toContain('{{prior_outreach_history}}')
    expect(out).toContain('Top.')
    expect(out).toContain('Bottom.')
  })

  it('appends a default block at the end when sentinel is missing and value is non-empty', async () => {
    const { applyPriorOutreachHistorySentinel } = await import(
      '../email-llm-context'
    )
    const tpl = 'plain template, no sentinel'
    const out = applyPriorOutreachHistorySentinel(tpl, 'HISTORY_BLOCK')
    expect(out.startsWith(tpl)).toBe(true)
    expect(out).toContain('HISTORY_BLOCK')
  })

  it('is a no-op when sentinel is missing and value is null/empty', async () => {
    const { applyPriorOutreachHistorySentinel } = await import(
      '../email-llm-context'
    )
    const tpl = 'plain template, no sentinel'
    expect(applyPriorOutreachHistorySentinel(tpl, null)).toBe(tpl)
    expect(applyPriorOutreachHistorySentinel(tpl, '')).toBe(tpl)
    expect(applyPriorOutreachHistorySentinel(tpl, '   ')).toBe(tpl)
  })
})
