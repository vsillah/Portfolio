import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { buildKnowledgeIngestionPlan, splitKnowledgeText } from './knowledge-ingestion'
import type { KnowledgeSourceManifestEntry } from './knowledge-governance'

async function makeFixtureSource(text: string, overrides: Partial<KnowledgeSourceManifestEntry> = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-ingest-'))
  await fs.mkdir(path.join(root, 'docs'), { recursive: true })
  await fs.writeFile(path.join(root, 'docs', 'source.md'), text, 'utf8')

  const source: KnowledgeSourceManifestEntry = {
    sourceId: 'fixture-source',
    title: 'Fixture Source',
    sourceType: 'portfolio_doc',
    namespace: 'public_chatbot',
    privacyTier: 'public_safe',
    canonicalPathOrUrl: 'docs/source.md',
    intendedConsumers: ['test'],
    approvedForRag: true,
    ...overrides,
  }

  return { root, source }
}

describe('knowledge ingestion planner', () => {
  it('extracts approved manifest sources into deterministic chunks and metadata', async () => {
    const { root, source } = await makeFixtureSource('Alpha paragraph.\n\nBeta paragraph.')

    const first = await buildKnowledgeIngestionPlan({
      rootDir: root,
      manifest: [source],
      ingestRunId: 'run-1',
      chunkSizeChars: 200,
    })
    const second = await buildKnowledgeIngestionPlan({
      rootDir: root,
      manifest: [source],
      ingestRunId: 'run-1',
      chunkSizeChars: 200,
    })

    expect(first.ok).toBe(true)
    expect(first.chunkCount).toBe(1)
    expect(first.chunks[0].id).toBe(second.chunks[0].id)
    expect(first.chunks[0].metadata).toMatchObject({
      sourceId: 'fixture-source',
      title: 'Fixture Source',
      namespace: 'public_chatbot',
      privacyTier: 'public_safe',
      ingestRunId: 'run-1',
    })
    expect(first.metadataCompleteness.incompleteChunkCount).toBe(0)
  })

  it('skips unapproved sources unless explicitly included', async () => {
    const { root, source } = await makeFixtureSource('Useful source.', { approvedForRag: false })

    const plan = await buildKnowledgeIngestionPlan({ rootDir: root, manifest: [source] })

    expect(plan.chunkCount).toBe(0)
    expect(plan.skippedSources[0]).toMatchObject({
      sourceId: 'fixture-source',
      reason: 'source is not approved for RAG',
    })
  })

  it('blocks contact-like content in public namespaces', async () => {
    const { root, source } = await makeFixtureSource('Reach the client at person@example.com.')

    const plan = await buildKnowledgeIngestionPlan({ rootDir: root, manifest: [source] })

    expect(plan.ok).toBe(false)
    expect(plan.chunkCount).toBe(0)
    expect(plan.privacyViolations[0]).toContain('email_address')
  })

  it('creates overlapping chunks without losing text', () => {
    const sourceText = Array.from({ length: 40 }, (_, index) => `Sentence ${index + 1} carries useful context.`).join(' ')
    const chunks = splitKnowledgeText(sourceText, {
      chunkSizeChars: 220,
      chunkOverlapChars: 30,
    })

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.join(' ')).toContain('Sentence 1')
    expect(chunks.join(' ')).toContain('Sentence 40')
  })
})
