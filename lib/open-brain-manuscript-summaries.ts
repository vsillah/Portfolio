import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { homedir } from 'os'
import path from 'path'
import type { OpenBrainEventRecord, OpenBrainMemoryRecord, OpenBrainSourceRecord } from './open-brain'

const SOURCES_FILE = 'sources.json'
const MEMORIES_FILE = 'memories.json'
const EVENTS_FILE = 'events.json'
const DEFAULT_OPEN_BRAIN_HOME = path.join(homedir(), '.open-brain')
const DEFAULT_EXPORT_DIR = path.join(homedir(), '.open-brain', 'private-vault', 'manuscripts')
const SECRETISH_PATTERN =
  /(sk-[A-Za-z0-9_-]{12,}|github_pat_[A-Za-z0-9_]{12,}|[A-Za-z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD)[A-Za-z0-9_]*\s*[:=]\s*["']?[^"'\s,}]+)/gi

export interface ManuscriptChapterSummary {
  id: string
  sourceId: string
  sourceTitle: string
  sourcePath: string | null
  exportPath: string
  sequence: number
  heading: string
  title: string
  wordCount: number
  narrativeSignals: string[]
  motifs: string[]
  summary: string
  fingerprint: string
}

export interface ManuscriptSummaryTrace {
  status: 'recorded' | 'dry_run' | 'missing'
  reason: string | null
  openBrainHome: string
  exportDir: string
  memories: OpenBrainMemoryRecord[]
  events: OpenBrainEventRecord[]
  missingExports: Array<{
    sourceId: string
    title: string
    expectedCandidates: string[]
  }>
  overview: {
    sourcesObserved: number
    manuscriptsWithExports: number
    chaptersDetected: number
    memoriesRecorded: number
    eventsRecorded: number
    rawFullTextIncluded: false
  }
}

export interface RecordManuscriptSummariesOptions {
  openBrainHome?: string
  exportDir?: string
  write?: boolean
  generatedAt?: string
}

type GoogleDocPointer = {
  doc_id?: string
  resource_id?: string
  url?: string
}

export async function recordManuscriptChapterSummaries(
  options: RecordManuscriptSummariesOptions = {},
): Promise<ManuscriptSummaryTrace> {
  const openBrainHome = options.openBrainHome || process.env.OPEN_BRAIN_HOME || DEFAULT_OPEN_BRAIN_HOME
  const exportDir = options.exportDir || process.env.OPEN_BRAIN_MANUSCRIPT_EXPORT_DIR || DEFAULT_EXPORT_DIR
  const generatedAt = options.generatedAt || new Date().toISOString()
  const write = options.write === true
  const sources = await readJsonArray<OpenBrainSourceRecord>(path.join(openBrainHome, SOURCES_FILE))
  const manuscriptSources = sources.filter((source) => source.kind === 'creative_manuscript' && source.privacyTier === 'private')

  if (manuscriptSources.length === 0) {
    return emptyTrace({
      status: 'missing',
      reason: 'No private creative_manuscript Open Brain sources were found.',
      openBrainHome,
      exportDir,
    })
  }

  const missingExports: ManuscriptSummaryTrace['missingExports'] = []
  const chapterSummaries: ManuscriptChapterSummary[] = []

  for (const source of manuscriptSources) {
    const resolved = await resolveManuscriptTextPath(source, exportDir)
    if (!resolved.path) {
      missingExports.push({
        sourceId: source.id,
        title: source.title,
        expectedCandidates: resolved.candidates,
      })
      continue
    }

    const manuscriptText = await readFile(resolved.path, 'utf8')
    chapterSummaries.push(...summarizeManuscriptChapters(source, resolved.path, manuscriptText))
  }

  if (chapterSummaries.length === 0) {
    return {
      ...emptyTrace({
        status: 'missing',
        reason: missingExports.length > 0
          ? 'Private manuscript exports are missing. Export Google Docs as plain text before running with --write.'
          : 'No chapter headings were detected in available private manuscript exports.',
        openBrainHome,
        exportDir,
      }),
      missingExports,
      overview: {
        sourcesObserved: manuscriptSources.length,
        manuscriptsWithExports: 0,
        chaptersDetected: 0,
        memoriesRecorded: 0,
        eventsRecorded: 0,
        rawFullTextIncluded: false,
      },
    }
  }

  const memories = chapterSummaries.map((chapter) => chapterSummaryToMemory(chapter, generatedAt))
  const events = buildSummaryEvents(chapterSummaries, generatedAt)

  if (write) {
    await mkdir(openBrainHome, { recursive: true })
    await upsertMemories(path.join(openBrainHome, MEMORIES_FILE), memories)
    await upsertEvents(path.join(openBrainHome, EVENTS_FILE), events)
    return {
      status: 'recorded',
      reason: null,
      openBrainHome,
      exportDir,
      memories,
      events,
      missingExports,
      overview: {
        sourcesObserved: manuscriptSources.length,
        manuscriptsWithExports: unique(chapterSummaries.map((chapter) => chapter.sourceId)).length,
        chaptersDetected: chapterSummaries.length,
        memoriesRecorded: memories.length,
        eventsRecorded: events.length,
        rawFullTextIncluded: false,
      },
    }
  }

  return {
    status: 'dry_run',
    reason: null,
    openBrainHome,
    exportDir,
    memories,
    events,
    missingExports,
    overview: {
      sourcesObserved: manuscriptSources.length,
      manuscriptsWithExports: unique(chapterSummaries.map((chapter) => chapter.sourceId)).length,
      chaptersDetected: chapterSummaries.length,
      memoriesRecorded: 0,
      eventsRecorded: 0,
      rawFullTextIncluded: false,
    },
  }
}

export function summarizeManuscriptChapters(
  source: Pick<OpenBrainSourceRecord, 'id' | 'title' | 'path'>,
  exportPath: string,
  manuscriptText: string,
): ManuscriptChapterSummary[] {
  const chapters = splitIntoChapters(manuscriptText)
  return chapters.map((chapter, index) => {
    const title = deriveChapterTitle(chapter.heading, index + 1)
    const body = normalizeWhitespace(chapter.body)
    const narrativeSignals = extractNarrativeSignals(body)
    const motifs = extractMotifs(body)
    const wordCount = countWords(body)
    const id = `memory:creative-chapter:${slugify(source.id)}:chapter-${String(index + 1).padStart(3, '0')}`
    const summary = buildDeterministicChapterSummary({
      sourceTitle: source.title,
      chapterTitle: title,
      wordCount,
      narrativeSignals,
      motifs,
    })
    return {
      id,
      sourceId: source.id,
      sourceTitle: source.title,
      sourcePath: source.path,
      exportPath,
      sequence: index + 1,
      heading: sanitizeOpenBrainText(chapter.heading, 180),
      title: sanitizeOpenBrainText(title, 180),
      wordCount,
      narrativeSignals,
      motifs,
      summary,
      fingerprint: fingerprintOpenBrainRecord([
        'creative_chapter_summary',
        source.id,
        index + 1,
        chapter.heading,
        createHash('sha256').update(body).digest('hex'),
      ]),
    }
  })
}

async function resolveManuscriptTextPath(source: OpenBrainSourceRecord, exportDir: string) {
  const candidates: string[] = []
  const sourcePath = source.path || ''
  if (sourcePath.match(/\.(txt|md|markdown)$/i)) candidates.push(sourcePath)

  const pointer = sourcePath.endsWith('.gdoc') ? await readGoogleDocPointer(sourcePath) : null
  const docId = pointer?.doc_id || googleDocIdFromUrl(pointer?.url || '') || null
  if (docId) {
    candidates.push(path.join(exportDir, `${docId}.txt`))
    candidates.push(path.join(exportDir, `${docId}.md`))
  }

  const sourceSlug = slugify(source.id)
  candidates.push(path.join(exportDir, `${sourceSlug}.txt`))
  candidates.push(path.join(exportDir, `${sourceSlug}.md`))
  if (sourcePath) {
    const basename = path.basename(sourcePath, path.extname(sourcePath))
    candidates.push(path.join(exportDir, `${basename}.txt`))
    candidates.push(path.join(exportDir, `${basename}.md`))
  }

  const found = unique(candidates).find((candidate) => existsSync(candidate))
  return {
    path: found || null,
    candidates: unique(candidates),
  }
}

async function readGoogleDocPointer(filePath: string): Promise<GoogleDocPointer | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as GoogleDocPointer
  } catch {
    return null
  }
}

function googleDocIdFromUrl(url: string) {
  const match = url.match(/\/document\/d\/([^/]+)/)
  return match?.[1] || null
}

function splitIntoChapters(text: string) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const headings: Array<{ line: number; heading: string }> = []
  lines.forEach((line, index) => {
    if (isChapterHeading(line)) {
      headings.push({ line: index, heading: stripMarkdownHeading(line).trim() })
    }
  })

  if (headings.length === 0) {
    return [{
      heading: 'Full manuscript',
      body: text,
    }]
  }

  return headings.map((heading, index) => {
    const next = headings[index + 1]
    return {
      heading: heading.heading,
      body: lines.slice(heading.line + 1, next ? next.line : lines.length).join('\n'),
    }
  }).filter((chapter) => countWords(chapter.body) > 0)
}

function isChapterHeading(line: string) {
  const normalized = stripMarkdownHeading(line).trim()
  if (!normalized || normalized.length > 140) return false
  if (/chapter\s+beats?/i.test(normalized)) return false
  if (/chapter\s+\d+\s+(?:summary|detailed beats?)/i.test(normalized)) return false
  return /^(?:(?:part|book)\s+[a-z0-9ivxlcdm]+[\s:.-]+)?(?:chapter|chap\.?)\s+([0-9ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)(?:\s*[:.\-]\s*.+)?$/i.test(normalized)
    || /^(prologue|epilogue)(?:\s*[:.\-]\s*.+)?$/i.test(normalized)
}

function stripMarkdownHeading(line: string) {
  return line
    .replace(/^\s{0,3}#{1,6}\s+/, '')
    .trim()
    .replace(/^\*{1,3}(.+?)\*{1,3}$/g, '$1')
    .trim()
}

function deriveChapterTitle(heading: string, sequence: number) {
  const stripped = stripMarkdownHeading(heading)
  const titleMatch = stripped.match(/(?:chapter|chap\.?)\s+[0-9a-zivxlcdm]+(?:\s*[:.\-]\s*(.+))$/i)
    || stripped.match(/^(?:prologue|epilogue)(?:\s*[:.\-]\s*(.+))$/i)
  return titleMatch?.[1]?.trim() || stripped || `Chapter ${sequence}`
}

function chapterSummaryToMemory(chapter: ManuscriptChapterSummary, now: string): OpenBrainMemoryRecord {
  const body = sanitizeOpenBrainText([
    `Private chapter-level summary for ${chapter.sourceTitle}.`,
    `Position: ${chapter.sequence}. Working title: ${chapter.title}.`,
    `Approximate length: ${chapter.wordCount} words.`,
    `Summary: ${chapter.summary}`,
    `Narrative signals: ${chapter.narrativeSignals.join(', ') || 'none detected'}.`,
    `Motifs: ${chapter.motifs.join(', ') || 'none detected'}.`,
    'Source handling: raw manuscript text was read from the private manuscript export vault and was not copied into the repo, public wiki overlay, chatbot knowledge, or public RAG.',
  ].join('\n'), 1400)

  return {
    id: chapter.id,
    kind: 'fact',
    title: sanitizeOpenBrainText(`${chapter.sourceTitle} - ${chapter.title}`, 180),
    body,
    privacyTier: 'private',
    confidence: 0.82,
    sourceIds: [chapter.sourceId],
    createdAt: now,
    updatedAt: now,
    fingerprint: chapter.fingerprint,
  }
}

function buildSummaryEvents(chapters: ManuscriptChapterSummary[], now: string) {
  return unique(chapters.map((chapter) => chapter.sourceId)).map((sourceId) => {
    const sourceChapters = chapters.filter((chapter) => chapter.sourceId === sourceId)
    const source = sourceChapters[0]
    return {
      id: `event:creative-manuscript-summary:${slugify(sourceId)}`,
      kind: 'projection_compiled' as const,
      title: `Compiled private chapter summaries: ${source.sourceTitle}`,
      summary: `${sourceChapters.length} chapter-level private summary record(s) generated. Raw manuscript text remains only in the private export vault.`,
      privacyTier: 'private' as const,
      confidence: 0.82,
      sourceIds: [sourceId],
      createdAt: now,
      fingerprint: fingerprintOpenBrainRecord([
        'creative_manuscript_summary',
        sourceId,
        sourceChapters.map((chapter) => chapter.fingerprint).join(','),
      ]),
      metadata: {
        producerId: 'producer:creative-manuscript-chapter-summarizer',
        sourceKind: 'creative_manuscript',
        chaptersRecorded: sourceChapters.length,
        exportPaths: unique(sourceChapters.map((chapter) => chapter.exportPath)),
        rawFullTextIncluded: false,
        publicProjectionAllowed: false,
      },
    }
  })
}

function buildDeterministicChapterSummary(input: {
  sourceTitle: string
  chapterTitle: string
  wordCount: number
  narrativeSignals: string[]
  motifs: string[]
}) {
  const signals = input.narrativeSignals.slice(0, 5)
  const motifs = input.motifs.slice(0, 5)
  const signalText = signals.length > 0 ? signals.join(', ') : 'the named story world and chapter cast'
  const motifText = motifs.length > 0 ? motifs.join(', ') : 'the manuscript themes already present in the source'
  return sanitizeOpenBrainText(
    `This chapter appears to develop ${input.chapterTitle} within ${input.sourceTitle}, with attention on ${signalText}. The recurring motif layer points toward ${motifText}. This is a private machine-generated orientation summary from chapter structure and term signals; it should guide retrieval and review, not replace a human literary summary.`,
    700,
  )
}

function extractNarrativeSignals(text: string) {
  const matches = Array.from(text.matchAll(/\b[A-Z][a-zA-Z'’-]+(?:\s+[A-Z][a-zA-Z'’-]+){0,3}\b/g))
    .map((match) => normalizeWhitespace(match[0]))
    .filter((phrase) => !COMMON_CAPITALIZED.has(phrase) && phrase.length > 2)
  return topCounts(matches, 8)
}

function extractMotifs(text: string) {
  const motifPatterns: Array<[string, RegExp]> = [
    ['access', /\baccess\b/gi],
    ['algorithmic control', /\b(?:algorithm|algorithms|algorithmic)\b/gi],
    ['analog districts', /\banalog\s+districts?\b/gi],
    ['betrayal', /\bbetray(?:al|ed|s)?\b/gi],
    ['code', /\bcode\b/gi],
    ['community', /\bcommun(?:ity|ities)\b/gi],
    ['elite power', /\belites?\b/gi],
    ['liberation', /\bliberat(?:e|ed|ion)\b/gi],
    ['memory', /\bmemor(?:y|ies)\b/gi],
    ['quantum power', /\bquantum\b/gi],
    ['surveillance', /\bsurveil(?:lance|led|s)?\b/gi],
    ['trust', /\btrust\b/gi],
  ]
  return motifPatterns
    .map(([label, pattern]) => ({ label, count: Array.from(text.matchAll(pattern)).length }))
    .filter((motif) => motif.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 8)
    .map((motif) => motif.label)
}

function topCounts(values: string[], limit: number) {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1)
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value)
}

function countWords(text: string) {
  return (text.match(/\b[\w'’-]+\b/g) || []).length
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function upsertMemories(filePath: string, memories: OpenBrainMemoryRecord[]) {
  const existing = await readJsonArray<OpenBrainMemoryRecord>(filePath)
  const byId = new Map(existing.map((memory) => [memory.id, memory]))
  for (const memory of memories) {
    byId.set(memory.id, {
      ...byId.get(memory.id),
      ...memory,
      createdAt: byId.get(memory.id)?.createdAt || memory.createdAt,
      updatedAt: memory.updatedAt,
    })
  }
  await writeJsonArray(filePath, Array.from(byId.values()))
}

async function upsertEvents(filePath: string, events: OpenBrainEventRecord[]) {
  const existing = await readJsonArray<OpenBrainEventRecord>(filePath)
  const byId = new Map(existing.map((event) => [event.id, event]))
  for (const event of events) byId.set(event.id, event)
  await writeJsonArray(filePath, Array.from(byId.values()))
}

async function readJsonArray<T>(filePath: string): Promise<T[]> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T[]
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return []
    throw error
  }
}

async function writeJsonArray<T>(filePath: string, records: T[]) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(records, null, 2)}\n`, 'utf8')
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values))
}

function fingerprintOpenBrainRecord(parts: unknown[]) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex')
}

function sanitizeOpenBrainText(value: string, maxLength = 700) {
  const scrubbed = value
    .replace(SECRETISH_PATTERN, '[redacted-secret]')
    .replace(/\s+/g, ' ')
    .trim()
  if (scrubbed.length <= maxLength) return scrubbed
  return `${scrubbed.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

function emptyTrace(input: {
  status: ManuscriptSummaryTrace['status']
  reason: string
  openBrainHome: string
  exportDir: string
}): ManuscriptSummaryTrace {
  return {
    status: input.status,
    reason: input.reason,
    openBrainHome: input.openBrainHome,
    exportDir: input.exportDir,
    memories: [],
    events: [],
    missingExports: [],
    overview: {
      sourcesObserved: 0,
      manuscriptsWithExports: 0,
      chaptersDetected: 0,
      memoriesRecorded: 0,
      eventsRecorded: 0,
      rawFullTextIncluded: false,
    },
  }
}

const COMMON_CAPITALIZED = new Set([
  'A',
  'And',
  'But',
  'Chapter',
  'He',
  'Her',
  'His',
  'I',
  'In',
  'It',
  'Part',
  'She',
  'That',
  'The',
  'They',
  'This',
  'We',
  'When',
  'Where',
  'With',
])
