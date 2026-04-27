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
const mockFetchRagContextForEmailQuery = vi.fn()
const mockFetchRecentSiteChatExcerptForLeadEmail = vi.fn()

vi.mock('@/lib/rag-query', () => ({
  buildEmailRagQueryText: (...args: unknown[]) => mockBuildEmailRagQueryText(...args),
  fetchRagContextForEmailQuery: (...args: unknown[]) =>
    mockFetchRagContextForEmailQuery(...args),
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
    mockFetchRagContextForEmailQuery.mockReset()
    mockFetchRecentSiteChatExcerptForLeadEmail.mockReset()
  })

  it('returns 0 chars + null hash when neither RAG nor chat are available', async () => {
    mockFetchRagContextForEmailQuery.mockResolvedValue(null)
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
  })

  it('reports RAG length and a 12-char fingerprint when RAG returns a block', async () => {
    const ragBlock = 'Voice example A. Voice example B.'
    mockFetchRagContextForEmailQuery.mockResolvedValue(ragBlock)
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
  })

  it('the fingerprint is deterministic per RAG block', async () => {
    const ragBlock = 'stable-block'
    mockFetchRagContextForEmailQuery.mockResolvedValue(ragBlock)
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
    mockFetchRagContextForEmailQuery.mockResolvedValue(null)
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
    mockFetchRagContextForEmailQuery.mockResolvedValue(null)
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
