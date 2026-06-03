import { describe, expect, it, vi } from 'vitest'

import { CHATBOT_KNOWLEDGE_SOURCES, getChatbotKnowledgeBody, getChatbotKnowledgeBundle } from '../chatbot-knowledge'
import { getOpenBrainSnapshot } from '../open-brain'

vi.mock('../open-brain', () => ({
  getOpenBrainSnapshot: vi.fn(async () => ({
    ragProjection: {
      version: 'open-brain-rag-projection-v1',
      documents: [
        {
          id: 'open-brain-rag:memory:public',
          title: 'Public-safe Open Brain profile',
          text: 'Approved public-safe Open Brain summary.',
          metadata: {
            openBrainMemoryId: 'memory:public',
            openBrainSourceIds: ['source:public'],
            privacyTier: 'public_safe',
            sourceHash: 'hash-public',
            projectionVersion: 'open-brain-rag-projection-v1',
            deletionKey: 'open-brain:memory:public',
            rollbackKey: 'open-brain:hash-public',
          },
        },
      ],
      eligibleMemoryCount: 1,
      excludedPrivateCount: 2,
      pineconeWriteStatus: 'blocked_pending_approval',
    },
  })),
}))

describe('chatbot knowledge corpus', () => {
  it('includes the public-safe personality corpus source', () => {
    expect(CHATBOT_KNOWLEDGE_SOURCES).toContainEqual({
      path: 'docs/vambah-personality-public-safe.md',
      sectionTitle: 'Vambah Personality Corpus (public-safe)',
    })
  })

  it('loads the personality corpus in the chatbot knowledge body', async () => {
    const result = await getChatbotKnowledgeBody()

    expect(result).toHaveProperty('body')
    if (!('body' in result)) return

    expect(result.body).toContain('## Source: Vambah Personality Corpus (public-safe)')
    expect(result.body).toContain('Source pack: `2026.05.03-d2eabc3d4b55`')
    expect(result.body).toContain('raw_private_content_included: false')
  })

  it('can append public-safe Open Brain RAG projections without exposing private records', async () => {
    const result = await getChatbotKnowledgeBundle({ includeOpenBrainRagProjection: true })

    expect(result).toHaveProperty('body')
    if ('error' in result) return

    expect(result.openBrain).toEqual({
      included: true,
      documentCount: 1,
      excludedPrivateCount: 2,
      pineconeWriteStatus: 'blocked_pending_approval',
    })
    expect(result.body).toContain('## Source: Open Brain Public-Safe Memory - Public-safe Open Brain profile')
    expect(result.body).toContain('Approved public-safe Open Brain summary.')
    expect(result.body).toContain('Pinecone write status: `blocked_pending_approval`')
    expect(result.body).not.toContain('source:private')
    expect(result.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'open-brain-rag:memory:public',
        kind: 'open_brain_rag_projection',
        privacyTier: 'public_safe',
        sourceHash: 'hash-public',
      }),
    ]))
  })

  it('tracks excluded private Open Brain records when no public-safe projection is available', async () => {
    vi.mocked(getOpenBrainSnapshot).mockResolvedValueOnce({
      ragProjection: {
        version: 'open-brain-rag-projection-v1',
        documents: [],
        eligibleMemoryCount: 0,
        excludedPrivateCount: 3,
        pineconeWriteStatus: 'blocked_pending_approval',
      },
    } as Awaited<ReturnType<typeof getOpenBrainSnapshot>>)

    const result = await getChatbotKnowledgeBundle({ includeOpenBrainRagProjection: true })

    expect(result).toHaveProperty('body')
    if ('error' in result) return

    expect(result.openBrain).toEqual({
      included: true,
      documentCount: 0,
      excludedPrivateCount: 3,
      pineconeWriteStatus: 'blocked_pending_approval',
    })
    expect(result.body).not.toContain('Open Brain Public-Safe Memory')
    expect(result.sources.every((source) => source.kind === 'curated_repo_doc')).toBe(true)
  })
})
