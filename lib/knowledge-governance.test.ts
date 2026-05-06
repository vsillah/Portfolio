import { describe, expect, it } from 'vitest'
import {
  buildKnowledgeChunkMetadata,
  createContentFingerprint,
  createKnowledgeChunkId,
  routePolicyFor,
  validateKnowledgeSourceManifest,
  type KnowledgeSourceManifestEntry,
} from './knowledge-governance'
import { KNOWLEDGE_SOURCE_MANIFEST } from './knowledge-source-manifest'

const validSource: KnowledgeSourceManifestEntry = {
  sourceId: 'source-1',
  title: 'Source One',
  sourceType: 'portfolio_doc',
  namespace: 'public_chatbot',
  privacyTier: 'public_safe',
  canonicalPathOrUrl: 'docs/source-one.md',
  intendedConsumers: ['public_chatbot'],
  approvedForRag: true,
}

describe('knowledge governance', () => {
  it('validates the repo-owned knowledge source manifest', () => {
    const result = validateKnowledgeSourceManifest(KNOWLEDGE_SOURCE_MANIFEST)

    expect(result.ok).toBe(true)
    expect(result.countsByNamespace.public_chatbot).toBeGreaterThan(0)
    expect(result.countsByNamespace.legacy_quarantine).toBe(1)
  })

  it('rejects duplicate source ids and missing required metadata', () => {
    const result = validateKnowledgeSourceManifest([
      validSource,
      {
        ...validSource,
        title: '',
        canonicalPathOrUrl: '',
      },
    ])

    expect(result.ok).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Duplicate knowledge sourceId: source-1.',
        'source-1 is missing title.',
        'source-1 is missing canonicalPathOrUrl.',
      ]),
    )
  })

  it('blocks private material from public namespaces', () => {
    const result = validateKnowledgeSourceManifest([
      {
        ...validSource,
        sourceId: 'private-public-source',
        namespace: 'public_chatbot',
        privacyTier: 'private',
      },
    ])

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('private-public-source cannot use private in public_chatbot.')
  })

  it('blocks excluded private sources from RAG approval', () => {
    const result = validateKnowledgeSourceManifest([
      {
        ...validSource,
        sourceId: 'excluded-source',
        sourceType: 'excluded_private',
        namespace: 'legacy_quarantine',
        privacyTier: 'private',
        approvedForRag: true,
      },
    ])

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('excluded-source is excluded_private and cannot be approved for RAG.')
  })

  it('creates stable content fingerprints and chunk ids', () => {
    const a = createContentFingerprint('  Hello   WORLD ')
    const b = createContentFingerprint('hello world')

    expect(a).toBe(b)
    expect(createKnowledgeChunkId({ sourceId: 'source-1', contentFingerprint: a, chunkIndex: 2 })).toBe(
      `source-1:${a}:2`,
    )
  })

  it('builds complete chunk metadata', () => {
    const metadata = buildKnowledgeChunkMetadata({
      source: validSource,
      chunkText: 'Chunk text',
      chunkIndex: 0,
      chunkCount: 2,
      ingestRunId: 'run-1',
    })

    expect(metadata).toMatchObject({
      sourceId: 'source-1',
      title: 'Source One',
      namespace: 'public_chatbot',
      privacyTier: 'public_safe',
      chunkIndex: 0,
      chunkCount: 2,
      ingestRunId: 'run-1',
    })
    expect(metadata.contentFingerprint).toHaveLength(64)
  })

  it('keeps public and outreach retrieval policies separated', () => {
    expect(routePolicyFor('public_chatbot').allowedNamespaces).toEqual(['public_chatbot'])
    expect(routePolicyFor('public_chatbot').maxPrivacyTier).toBe('public_safe')
    expect(routePolicyFor('outreach_email').allowedNamespaces).toEqual(['sales_context', 'voice_story'])
    expect(routePolicyFor('outreach_email').maxPrivacyTier).toBe('client_safe')
    expect(routePolicyFor('admin_internal').allowedNamespaces).toEqual(['internal_ops'])
  })
})
