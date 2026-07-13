import { describe, expect, it } from 'vitest'
import {
  evaluateOpenBrainRagRetrievalQa,
  formatOpenBrainRagRetrievalQaReport,
  type OpenBrainRagRetrievalQaQuery,
} from './open-brain-rag-retrieval-qa'
import type { OpenBrainRagProjectionDocument } from './open-brain'

const queries: OpenBrainRagRetrievalQaQuery[] = [
  {
    id: 'projection-boundary',
    question: 'How should public-safe personality corpus context reach agents and RAG?',
    expectedTerms: ['personality corpus', 'public-safe', 'agent context', 'rag'],
    forbiddenTerms: ['Anthropic_chat_data', 'ChatGPT export'],
  },
]

function document(overrides: Partial<OpenBrainRagProjectionDocument> = {}): OpenBrainRagProjectionDocument {
  return {
    id: 'open-brain-rag:memory-1',
    title: 'Approve personality corpus projection',
    text: 'The public-safe personality corpus can be used as agent context and RAG projection input. Raw private exports remain local only.',
    metadata: {
      openBrainMemoryId: 'memory-1',
      openBrainSourceIds: ['personality-corpus:public-safe'],
      privacyTier: 'public_safe',
      sourceHash: 'hash-1',
      projectionVersion: 'open-brain-rag-projection-v1',
      deletionKey: 'open-brain:memory-1',
      rollbackKey: 'open-brain:hash-1',
    },
    ...overrides,
  }
}

describe('Open Brain RAG retrieval QA', () => {
  it('passes public-safe projection documents with complete metadata and expected retrieval terms', () => {
    const report = evaluateOpenBrainRagRetrievalQa({
      generatedAt: '2026-07-13T12:00:00.000Z',
      documents: [document()],
      queries,
    })

    expect(report.status).toBe('pass')
    expect(report.overview).toEqual(expect.objectContaining({
      documentCount: 1,
      passedQueries: 1,
      metadataFailures: 0,
      privacyFailures: 0,
      pineconeWriteStatus: 'blocked_pending_approval',
    }))
    expect(report.results[0]).toEqual(expect.objectContaining({
      status: 'pass',
      topDocumentId: 'open-brain-rag:memory-1',
      matchedTerms: ['personality corpus', 'public-safe', 'agent context', 'rag'],
      forbiddenHits: [],
    }))
  })

  it('fails when metadata is incomplete or projection text leaks private-looking material', () => {
    const report = evaluateOpenBrainRagRetrievalQa({
      documents: [document({
        text: 'Contact me at private@example.com with API_KEY=secret. public-safe personality corpus agent context rag.',
        metadata: {
          ...document().metadata,
          sourceHash: '',
          deletionKey: '',
        },
      })],
      queries,
    })

    expect(report.status).toBe('fail')
    expect(report.metadataFindings).toEqual(expect.arrayContaining([
      'open-brain-rag:memory-1: missing source hash',
      'open-brain-rag:memory-1: missing deletion key',
    ]))
    expect(report.privacyFindings).toEqual(expect.arrayContaining([
      'open-brain-rag:memory-1: email_address detected in projection text',
      'open-brain-rag:memory-1: secret_like_value detected in projection text',
    ]))
  })

  it('reports a cutover blocker when no approved public-safe projection documents exist', () => {
    const report = evaluateOpenBrainRagRetrievalQa({
      documents: [],
      queries,
    })

    expect(report.status).toBe('fail')
    expect(report.results[0]).toEqual(expect.objectContaining({
      status: 'fail',
      topDocumentId: null,
      note: 'No public-safe Open Brain RAG projection documents are available.',
    }))
    expect(report.recommendations[0]).toBe('Approve at least one public-safe Open Brain memory before staging Open Brain projection content for RAG.')
  })

  it('formats a markdown packet for review without including raw source bodies beyond projection text checks', () => {
    const report = evaluateOpenBrainRagRetrievalQa({
      generatedAt: '2026-07-13T12:00:00.000Z',
      documents: [document()],
      queries,
    })
    const markdown = formatOpenBrainRagRetrievalQaReport(report)

    expect(markdown).toContain('# Open Brain RAG Retrieval QA Packet')
    expect(markdown).toContain('Status: `pass`')
    expect(markdown).toContain('Pinecone write status: `blocked_pending_approval`')
    expect(markdown).toContain('projection-boundary')
  })
})
