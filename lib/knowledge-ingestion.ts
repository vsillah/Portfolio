import fs from 'fs/promises'
import path from 'path'
import {
  KNOWLEDGE_TARGET_INDEX,
  LEGACY_PINECONE_INDEX,
  type KnowledgeChunkMetadata,
  type KnowledgeNamespace,
  type KnowledgeSourceManifestEntry,
  buildKnowledgeChunkMetadata,
  createKnowledgeChunkId,
  isPrivacyTierAllowed,
  validateKnowledgeSourceManifest,
} from './knowledge-governance'
import { KNOWLEDGE_SOURCE_MANIFEST } from './knowledge-source-manifest'

export interface KnowledgeIngestionChunk {
  id: string
  text: string
  metadata: KnowledgeChunkMetadata
}

export interface KnowledgeIngestionSkippedSource {
  sourceId: string
  title: string
  reason: string
}

export interface KnowledgeIngestionPlan {
  ok: boolean
  mode: 'shadow_plan'
  ingestRunId: string
  targetIndex: string
  legacyIndex: string
  chunks: KnowledgeIngestionChunk[]
  skippedSources: KnowledgeIngestionSkippedSource[]
  errors: string[]
  privacyViolations: string[]
  duplicateChunkCount: number
  sourceCount: number
  approvedSourceCount: number
  chunkCount: number
  namespaceCounts: Record<KnowledgeNamespace, number>
  metadataCompleteness: {
    completeChunkCount: number
    incompleteChunkCount: number
  }
}

export interface BuildKnowledgeIngestionPlanOptions {
  rootDir?: string
  manifest?: KnowledgeSourceManifestEntry[]
  ingestRunId?: string
  sourceIds?: string[]
  includeUnapproved?: boolean
  chunkSizeChars?: number
  chunkOverlapChars?: number
}

const PUBLIC_NAMESPACES: ReadonlySet<KnowledgeNamespace> = new Set(['public_chatbot', 'voice_story'])

const CONTACT_LIKE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'email_address', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { label: 'phone_number', pattern: /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/ },
  { label: 'ssn_like_value', pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
]

export async function buildKnowledgeIngestionPlan(
  options: BuildKnowledgeIngestionPlanOptions = {},
): Promise<KnowledgeIngestionPlan> {
  const rootDir = options.rootDir ?? process.cwd()
  const ingestRunId = options.ingestRunId ?? `knowledge-ingest-${new Date().toISOString()}`
  const chunkSizeChars = options.chunkSizeChars ?? 1800
  const chunkOverlapChars = options.chunkOverlapChars ?? 200
  const selectedSourceIds = new Set(options.sourceIds ?? [])
  const manifest = (options.manifest ?? KNOWLEDGE_SOURCE_MANIFEST).filter((source) =>
    selectedSourceIds.size ? selectedSourceIds.has(source.sourceId) : true,
  )
  const validation = validateKnowledgeSourceManifest(manifest)
  const chunks: KnowledgeIngestionChunk[] = []
  const skippedSources: KnowledgeIngestionSkippedSource[] = []
  const errors = [...validation.errors]
  const privacyViolations: string[] = []
  const seenChunkIds = new Set<string>()
  const namespaceCounts: Record<KnowledgeNamespace, number> = {
    public_chatbot: 0,
    voice_story: 0,
    sales_context: 0,
    internal_ops: 0,
    legacy_quarantine: 0,
  }
  let duplicateChunkCount = 0

  for (const source of manifest) {
    if (!source.approvedForRag && !options.includeUnapproved) {
      skippedSources.push(skip(source, 'source is not approved for RAG'))
      continue
    }

    if (source.namespace === 'legacy_quarantine') {
      skippedSources.push(skip(source, 'legacy quarantine is audit-only'))
      continue
    }

    let text: string
    try {
      text = await extractManifestSourceText(source, rootDir)
    } catch (error) {
      errors.push(`${source.sourceId}: ${error instanceof Error ? error.message : 'failed to extract source'}`)
      skippedSources.push(skip(source, 'extraction failed'))
      continue
    }

    const normalized = text.trim()
    if (!normalized) {
      errors.push(`${source.sourceId}: extracted text is empty`)
      skippedSources.push(skip(source, 'empty extraction'))
      continue
    }

    if (PUBLIC_NAMESPACES.has(source.namespace)) {
      const violation = findContactLikeViolation(normalized)
      if (violation) {
        const message = `${source.sourceId}: ${violation} detected in ${source.namespace}`
        privacyViolations.push(message)
        errors.push(message)
        skippedSources.push(skip(source, 'privacy violation in public namespace'))
        continue
      }

      if (!isPrivacyTierAllowed(source.privacyTier, 'public_safe')) {
        const message = `${source.sourceId}: ${source.privacyTier} exceeds public_safe`
        privacyViolations.push(message)
        errors.push(message)
        skippedSources.push(skip(source, 'privacy tier exceeds public route policy'))
        continue
      }
    }

    const sourceChunks = splitKnowledgeText(normalized, { chunkSizeChars, chunkOverlapChars })
    const chunkCount = sourceChunks.length

    sourceChunks.forEach((chunkText, chunkIndex) => {
      const metadata = buildKnowledgeChunkMetadata({
        source,
        chunkText,
        chunkIndex,
        chunkCount,
        ingestRunId,
      })
      const id = createKnowledgeChunkId({
        sourceId: source.sourceId,
        contentFingerprint: metadata.contentFingerprint,
        chunkIndex,
      })

      if (seenChunkIds.has(id)) {
        duplicateChunkCount += 1
        return
      }

      seenChunkIds.add(id)
      namespaceCounts[source.namespace] += 1
      chunks.push({ id, text: chunkText, metadata })
    })
  }

  const completeChunkCount = chunks.filter((chunk) => isCompleteChunkMetadata(chunk.metadata)).length
  const incompleteChunkCount = chunks.length - completeChunkCount

  return {
    ok: validation.ok && errors.length === 0 && privacyViolations.length === 0,
    mode: 'shadow_plan',
    ingestRunId,
    targetIndex: KNOWLEDGE_TARGET_INDEX,
    legacyIndex: LEGACY_PINECONE_INDEX,
    chunks,
    skippedSources,
    errors,
    privacyViolations,
    duplicateChunkCount,
    sourceCount: manifest.length,
    approvedSourceCount: manifest.filter((source) => source.approvedForRag).length,
    chunkCount: chunks.length,
    namespaceCounts,
    metadataCompleteness: {
      completeChunkCount,
      incompleteChunkCount,
    },
  }
}

export async function extractManifestSourceText(
  source: KnowledgeSourceManifestEntry,
  rootDir = process.cwd(),
): Promise<string> {
  if (/^https?:\/\//i.test(source.canonicalPathOrUrl)) {
    throw new Error('remote URL extraction is not enabled for governed ingestion')
  }

  if (source.canonicalPathOrUrl.startsWith('pinecone://')) {
    throw new Error('legacy Pinecone sources are audit-only')
  }

  const filePath = path.isAbsolute(source.canonicalPathOrUrl)
    ? source.canonicalPathOrUrl
    : path.join(rootDir, source.canonicalPathOrUrl)
  const ext = path.extname(filePath).toLowerCase()

  if (['.md', '.mdx', '.txt', '.csv', '.json'].includes(ext)) {
    return fs.readFile(filePath, 'utf8')
  }

  throw new Error(`unsupported source extension: ${ext || '(none)'}`)
}

export function splitKnowledgeText(
  text: string,
  options: { chunkSizeChars?: number; chunkOverlapChars?: number } = {},
): string[] {
  const chunkSizeChars = Math.max(options.chunkSizeChars ?? 1800, 200)
  const chunkOverlapChars = Math.min(Math.max(options.chunkOverlapChars ?? 200, 0), chunkSizeChars - 1)
  const normalized = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim()

  if (!normalized) return []
  if (normalized.length <= chunkSizeChars) return [normalized]

  const chunks: string[] = []
  let start = 0

  while (start < normalized.length) {
    const targetEnd = Math.min(start + chunkSizeChars, normalized.length)
    const end = findChunkBoundary(normalized, start, targetEnd)
    const chunk = normalized.slice(start, end).trim()
    if (chunk) chunks.push(chunk)
    if (end >= normalized.length) break
    start = Math.max(end - chunkOverlapChars, start + 1)
  }

  return chunks
}

function findChunkBoundary(text: string, start: number, targetEnd: number): number {
  if (targetEnd >= text.length) return text.length

  const boundaryWindow = text.slice(start, targetEnd)
  const paragraphBoundary = boundaryWindow.lastIndexOf('\n\n')
  if (paragraphBoundary > boundaryWindow.length * 0.5) return start + paragraphBoundary

  const sentenceBoundary = Math.max(
    boundaryWindow.lastIndexOf('. '),
    boundaryWindow.lastIndexOf('! '),
    boundaryWindow.lastIndexOf('? '),
  )
  if (sentenceBoundary > boundaryWindow.length * 0.5) return start + sentenceBoundary + 1

  const wordBoundary = boundaryWindow.lastIndexOf(' ')
  if (wordBoundary > boundaryWindow.length * 0.5) return start + wordBoundary

  return targetEnd
}

function findContactLikeViolation(text: string): string | null {
  return CONTACT_LIKE_PATTERNS.find(({ pattern }) => pattern.test(text))?.label ?? null
}

function isCompleteChunkMetadata(metadata: KnowledgeChunkMetadata): boolean {
  return Boolean(
    metadata.sourceId &&
      metadata.title &&
      metadata.sourceType &&
      metadata.namespace &&
      metadata.privacyTier &&
      metadata.canonicalPathOrUrl &&
      metadata.contentFingerprint &&
      Number.isInteger(metadata.chunkIndex) &&
      Number.isInteger(metadata.chunkCount) &&
      metadata.ingestRunId,
  )
}

function skip(source: KnowledgeSourceManifestEntry, reason: string): KnowledgeIngestionSkippedSource {
  return {
    sourceId: source.sourceId,
    title: source.title,
    reason,
  }
}
