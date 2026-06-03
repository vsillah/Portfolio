/**
 * Chatbot knowledge source configuration.
 * Ordered list of repo doc paths (relative to project root) and optional section titles.
 * The homepage chatbot fetches concatenated content from GET /api/knowledge or GET /api/knowledge/chatbot.
 *
 * On Vercel, doc files are not in the serverless bundle, so we rely on build-time embedded content
 * (lib/chatbot-knowledge-content.generated.ts from scripts/build-chatbot-knowledge.ts).
 * Locally, we fall back to reading from the filesystem when the generated file is missing.
 */

import { readFile } from 'fs/promises'
import path from 'path'

export interface ChatbotKnowledgeEntry {
  /** Path relative to project root (e.g. docs/user-help-guide.md) */
  path: string
  /** Optional section header shown before this doc's content (e.g. "User Help Guide") */
  sectionTitle?: string
}

export interface ChatbotKnowledgeBundle {
  body: string
  sources: Array<{
    id: string
    title: string
    kind: 'curated_repo_doc' | 'open_brain_rag_projection'
    path: string | null
    privacyTier: 'public_safe'
    sourceHash: string | null
    projectionVersion: string | null
  }>
  openBrain: {
    included: boolean
    documentCount: number
    excludedPrivateCount: number
    pineconeWriteStatus: 'blocked_pending_approval'
  }
}

/** Ordered list of docs included in chatbot knowledge (used for runtime fallback and by build script). */
export const CHATBOT_KNOWLEDGE_SOURCES: ChatbotKnowledgeEntry[] = [
  { path: 'docs/chatbot-products-and-services-overview.md', sectionTitle: 'What AmaduTown Offers (products and services)' },
  { path: 'docs/pricing-model.md', sectionTitle: 'Pricing Packages, Services, and Continuity Plans' },
  { path: 'docs/amadou-town-value-and-pricing-logic.md', sectionTitle: 'Value and Pricing Logic' },
  { path: 'docs/scheduling-consultation-overview.md', sectionTitle: 'Scheduling and Consultation Overview' },
  { path: 'docs/chatbot-campaigns-overview.md', sectionTitle: 'Active Promotions & Attraction Campaigns' },
  { path: 'docs/vambah-personality-public-safe.md', sectionTitle: 'Vambah Personality Corpus (public-safe)' },
  { path: 'docs/user-help-guide.md', sectionTitle: 'User Help Guide' },
  { path: 'docs/admin-sales-lead-pipeline-sop.md', sectionTitle: 'Admin & Sales Lead Pipeline (overview)' },
  { path: 'README.md', sectionTitle: 'Project overview' },
]

/**
 * Build concatenated markdown for the chatbot.
 * Uses embedded content from build script when available (production/Vercel); otherwise reads from filesystem (local dev).
 */
export async function getChatbotKnowledgeBody(
  options: { includeOpenBrainRagProjection?: boolean } = {},
): Promise<{ body: string } | { error: string; status: 404 | 500 }> {
  const bundle = await getChatbotKnowledgeBundle(options)
  if ('error' in bundle) return bundle
  return { body: bundle.body }
}

export async function getChatbotKnowledgeBundle(
  options: { includeOpenBrainRagProjection?: boolean } = {},
): Promise<ChatbotKnowledgeBundle | { error: string; status: 404 | 500 }> {
  try {
    const mod = await import('./chatbot-knowledge-content.generated')
    const body = mod.CHATBOT_KNOWLEDGE_BODY
    if (body && typeof body === 'string') {
      return appendOpenBrainProjection({
        body,
        sources: repoDocKnowledgeSources(),
        openBrain: emptyOpenBrainBundleMetadata(false),
      }, options)
    }
  } catch {
    // Generated file missing (e.g. dev without running build:knowledge) — fall back to fs
  }

  const cwd = process.cwd()
  const parts: string[] = []

  for (const entry of CHATBOT_KNOWLEDGE_SOURCES) {
    const absolutePath = path.join(cwd, entry.path)
    try {
      const content = await readFile(absolutePath, 'utf-8')
      const sectionHeader = entry.sectionTitle
        ? `## Source: ${entry.sectionTitle}\n\n`
        : `## Source: ${entry.path}\n\n`
      parts.push(sectionHeader + content.trim())
    } catch (err) {
      console.warn(`Chatbot knowledge: skipped ${entry.path}`, err instanceof Error ? err.message : err)
    }
  }

  if (parts.length === 0) {
    return { error: 'No knowledge sources could be read', status: 404 }
  }

  return appendOpenBrainProjection({
    body: parts.join('\n\n---\n\n'),
    sources: repoDocKnowledgeSources(),
    openBrain: emptyOpenBrainBundleMetadata(false),
  }, options)
}

function repoDocKnowledgeSources(): ChatbotKnowledgeBundle['sources'] {
  return CHATBOT_KNOWLEDGE_SOURCES.map((entry) => ({
    id: entry.path,
    title: entry.sectionTitle || entry.path,
    kind: 'curated_repo_doc',
    path: entry.path,
    privacyTier: 'public_safe',
    sourceHash: null,
    projectionVersion: null,
  }))
}

function emptyOpenBrainBundleMetadata(included: boolean): ChatbotKnowledgeBundle['openBrain'] {
  return {
    included,
    documentCount: 0,
    excludedPrivateCount: 0,
    pineconeWriteStatus: 'blocked_pending_approval',
  }
}

async function appendOpenBrainProjection(
  bundle: ChatbotKnowledgeBundle,
  options: { includeOpenBrainRagProjection?: boolean },
): Promise<ChatbotKnowledgeBundle> {
  if (!options.includeOpenBrainRagProjection) return bundle

  const { getOpenBrainSnapshot } = await import('./open-brain')
  const snapshot = await getOpenBrainSnapshot()
  const projection = snapshot.ragProjection
  if (projection.documents.length === 0) {
    return {
      ...bundle,
      openBrain: {
        included: true,
        documentCount: 0,
        excludedPrivateCount: projection.excludedPrivateCount,
        pineconeWriteStatus: projection.pineconeWriteStatus,
      },
    }
  }

  const openBrainSections = projection.documents.map((document) => [
    `## Source: Open Brain Public-Safe Memory - ${document.title}`,
    '',
    document.text.trim(),
    '',
    `- Open Brain memory id: \`${document.metadata.openBrainMemoryId}\``,
    `- Open Brain source ids: ${document.metadata.openBrainSourceIds.map((sourceId) => `\`${sourceId}\``).join(', ') || 'none'}`,
    `- Privacy tier: \`${document.metadata.privacyTier}\``,
    `- Source hash: \`${document.metadata.sourceHash}\``,
    `- Projection version: \`${document.metadata.projectionVersion}\``,
    `- Pinecone write status: \`${projection.pineconeWriteStatus}\``,
  ].join('\n'))

  return {
    body: [bundle.body, ...openBrainSections].join('\n\n---\n\n'),
    sources: [
      ...bundle.sources,
      ...projection.documents.map((document) => ({
        id: document.id,
        title: document.title,
        kind: 'open_brain_rag_projection' as const,
        path: null,
        privacyTier: document.metadata.privacyTier,
        sourceHash: document.metadata.sourceHash,
        projectionVersion: document.metadata.projectionVersion,
      })),
    ],
    openBrain: {
      included: true,
      documentCount: projection.documents.length,
      excludedPrivateCount: projection.excludedPrivateCount,
      pineconeWriteStatus: projection.pineconeWriteStatus,
    },
  }
}
