import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { mkdtemp } from 'fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  recordManuscriptChapterSummaries,
  summarizeManuscriptChapters,
} from './open-brain-manuscript-summaries'
import type { OpenBrainEventRecord, OpenBrainMemoryRecord, OpenBrainSourceRecord } from './open-brain'

vi.mock('./codex-automation-inventory', () => ({
  listCodexAutomationInventory: vi.fn(async () => ({
    available: true,
    generatedAt: '2026-06-25T12:00:00.000Z',
    automations: [],
    repairPackets: [],
  })),
}))

vi.mock('./codex-workspace-roots', () => ({
  getCodexWorkspaceRootReport: vi.fn(async () => ({
    available: true,
    generatedAt: '2026-06-25T12:00:00.000Z',
    stateDatabase: '/tmp/state.sqlite',
    overview: {
      portfolioThreads: 0,
      nonPortfolioThreads: 0,
    },
    health: 'green',
  })),
}))

vi.mock('./agent-work-items', () => ({
  listAgentWorkItems: vi.fn(async () => []),
  getAgentWorkItem: vi.fn(async () => ({ id: 'work-item', latest_handoff: null })),
}))

let tempRoot: string | null = null

async function makeTempRoot() {
  tempRoot = await mkdtemp(path.join(tmpdir(), 'open-brain-manuscripts-'))
  return tempRoot
}

afterEach(async () => {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true })
    tempRoot = null
  }
})

describe('Open Brain manuscript chapter summaries', () => {
  it('extracts chapter summaries from chaptered manuscript text without copying full manuscript text', () => {
    const summaries = summarizeManuscriptChapters({
      id: 'creative-source:codex-chronicles:quantum-rebel-book-1',
      title: 'Code Chronicles, Book 1: The Quantum Rebel',
      path: '/private/book.txt',
    }, '/private/book.txt', [
      'Chapter 1: The Quantum Key',
      'Kwame entered the Analog District with Dr. Wangari. Quantum power and access shaped the argument.',
      '',
      '**Chapter 2: The Plan**',
      'Chapter 2 Summary with Additional Characters',
      'This metadata section should stay inside the chapter body, not become a separate chapter.',
      '',
      '### Part 1: Chapter 3: The Betrayal',
      'Mobutu watched the Quantum Elite turn code into surveillance. Community trust broke under pressure.',
    ].join('\n'))

    expect(summaries).toHaveLength(3)
    expect(summaries[0]).toEqual(expect.objectContaining({
      sequence: 1,
      title: 'The Quantum Key',
    }))
    expect(summaries[0].motifs).toEqual(expect.arrayContaining(['quantum power', 'access']))
    expect(summaries[1].title).toBe('The Plan')
    expect(summaries[2].title).toBe('The Betrayal')
    expect(summaries[2].summary).toContain('private machine-generated orientation summary')
    expect(summaries[2].summary).not.toContain('Mobutu watched the Quantum Elite turn code into surveillance')
  })

  it('records private chapter memory records and a projection event from a Google Doc text export', async () => {
    const root = await makeTempRoot()
    const exportDir = path.join(root, 'exports')
    const pointerPath = path.join(root, 'Book 1.gdoc')
    await mkdir(exportDir, { recursive: true })
    await writeFile(pointerPath, JSON.stringify({
      doc_id: 'doc-123',
      url: 'https://docs.google.com/document/d/doc-123/edit',
    }), 'utf8')
    await writeSources(root, [{
      id: 'creative-source:codex-chronicles:quantum-rebel-book-1',
      kind: 'creative_manuscript',
      title: 'Code Chronicles, Book 1: The Quantum Rebel',
      summary: 'Private book draft/source document. Raw manuscript text is not copied into Open Brain.',
      path: pointerPath,
      privacyTier: 'private',
      confidence: 0.94,
      lastObservedAt: '2026-06-25T22:31:44.851Z',
      fingerprint: 'source-fingerprint',
    }])
    await writeFile(path.join(exportDir, 'doc-123.txt'), [
      'Chapter 1: The Signal',
      'Kwame studies the Quantum Key inside the Analog District. Access and community shape the conflict.',
      '',
      'Chapter 2: The Gate',
      'Dr. Wangari explains the algorithm. The elite system tests trust and memory.',
    ].join('\n'), 'utf8')

    const result = await recordManuscriptChapterSummaries({
      openBrainHome: root,
      exportDir,
      write: true,
      generatedAt: '2026-06-25T23:00:00.000Z',
    })

    expect(result.status).toBe('recorded')
    expect(result.overview).toEqual(expect.objectContaining({
      sourcesObserved: 1,
      manuscriptsWithExports: 1,
      chaptersDetected: 2,
      memoriesRecorded: 2,
      eventsRecorded: 1,
      rawFullTextIncluded: false,
    }))
    const memories = await readJson<OpenBrainMemoryRecord[]>(path.join(root, 'memories.json'))
    expect(memories).toHaveLength(2)
    expect(memories[0]).toEqual(expect.objectContaining({
      privacyTier: 'private',
      sourceIds: ['creative-source:codex-chronicles:quantum-rebel-book-1'],
    }))
    expect(memories[0].body).toContain('raw manuscript text was read from the private manuscript export vault')
    expect(memories[0].body).not.toContain('Kwame studies the Quantum Key inside the Analog District')
    const events = await readJson<OpenBrainEventRecord[]>(path.join(root, 'events.json'))
    expect(events).toHaveLength(1)
    expect(events[0].metadata).toEqual(expect.objectContaining({
      producerId: 'producer:creative-manuscript-chapter-summarizer',
      rawFullTextIncluded: false,
      publicProjectionAllowed: false,
    }))

    await recordManuscriptChapterSummaries({
      openBrainHome: root,
      exportDir,
      write: true,
      generatedAt: '2026-06-25T23:05:00.000Z',
    })
    const afterSecondRun = await readJson<OpenBrainMemoryRecord[]>(path.join(root, 'memories.json'))
    expect(afterSecondRun).toHaveLength(2)
  })

  it('reports missing private exports without writing memory records', async () => {
    const root = await makeTempRoot()
    const exportDir = path.join(root, 'exports')
    await writeSources(root, [{
      id: 'creative-source:codex-chronicles:quantum-prophecy-outline',
      kind: 'creative_manuscript',
      title: 'Code Breaker Chronicles: The Quantum Prophecy',
      summary: 'Private source.',
      path: path.join(root, 'missing.gdoc'),
      privacyTier: 'private',
      confidence: 0.94,
      lastObservedAt: '2026-06-25T22:31:44.851Z',
      fingerprint: 'source-fingerprint',
    }])

    const result = await recordManuscriptChapterSummaries({
      openBrainHome: root,
      exportDir,
      write: true,
      generatedAt: '2026-06-25T23:00:00.000Z',
    })

    expect(result.status).toBe('missing')
    expect(result.missingExports).toHaveLength(1)
    expect(result.missingExports[0].expectedCandidates).toEqual(expect.arrayContaining([
      path.join(exportDir, 'creative-source-codex-chronicles-quantum-prophecy-outline.txt'),
    ]))
    await expect(readFile(path.join(root, 'memories.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })
})

async function writeSources(root: string, sources: OpenBrainSourceRecord[]) {
  await mkdir(root, { recursive: true })
  await writeFile(path.join(root, 'sources.json'), `${JSON.stringify(sources, null, 2)}\n`, 'utf8')
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}
