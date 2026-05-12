import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseArgs, sanitizeModelOpsDashboard, syncModelOpsSnapshot } from './sync-model-ops-snapshot'

let tempRoot: string | null = null

async function makeTempRoot() {
  tempRoot = await mkdtemp(path.join(tmpdir(), 'model-ops-snapshot-'))
  return tempRoot
}

afterEach(async () => {
  if (tempRoot) {
    await import('node:fs/promises').then(({ rm }) => rm(tempRoot as string, { recursive: true, force: true }))
    tempRoot = null
  }
})

describe('sync model ops snapshot', () => {
  it('parses defaults and check options', () => {
    expect(parseArgs(['--source', 'source.json', '--output', 'out.json', '--check', '--quiet'])).toEqual({
      source: 'source.json',
      output: 'out.json',
      check: true,
      quiet: true,
    })
    expect(() => parseArgs(['--bogus'])).toThrow('Unknown option')
  })

  it('sanitizes dashboard data to the repo-owned public shape', () => {
    const sanitized = sanitizeModelOpsDashboard({
      projectName: 'Local LLM Model Ops & Hermes Automation',
      generatedAt: '2026-05-04T13:11:08.027Z',
      recommendations: { productionGate: 'approval required' },
      replyRuns: [
        {
          file: 'eval-results/reply.json',
          model: 'qwen3-4b-instruct-2507',
          scored: 211,
          correct: 211,
          accuracy: 1,
          avgLatencyMs: 353,
          rawSecret: 'do not copy',
        },
      ],
      ragRuns: [
        {
          file: 'rag/routed.json',
          name: 'Routed local',
          totalQueries: 67,
          overall: { local_better: 33 },
        },
      ],
      swapRequests: [{ title: 'Swap request', exactProductionChange: 'do not copy' }],
    })

    expect(sanitized).toEqual(expect.objectContaining({
      projectName: 'Local LLM Model Ops & Hermes Automation',
      replyRuns: [expect.objectContaining({ model: 'qwen3-4b-instruct-2507', accuracy: 1 })],
      ragRuns: [expect.objectContaining({ name: 'Routed local', totalQueries: 67 })],
      swapRequests: [expect.objectContaining({ title: 'Swap request' })],
    }))
    expect(JSON.stringify(sanitized)).not.toContain('rawSecret')
    expect(JSON.stringify(sanitized)).not.toContain('exactProductionChange')
  })

  it('writes the sanitized snapshot and detects stale check mode', async () => {
    const root = await makeTempRoot()
    const source = path.join(root, 'source.json')
    const output = path.join(root, 'data/model-ops/reports/latest-dashboard-data.json')
    await mkdir(path.dirname(source), { recursive: true })
    await writeFile(source, JSON.stringify({
      projectName: 'Local LLM Model Ops & Hermes Automation',
      generatedAt: '2026-05-04T13:11:08.027Z',
      replyRuns: [{ model: 'qwen3-4b-instruct-2507', scored: 211, accuracy: 1 }],
      ragRuns: [{ name: 'Routed local', totalQueries: 67 }],
      swapRequests: [],
    }))

    const result = await syncModelOpsSnapshot({ source, output, check: false, quiet: true })
    expect(result.changed).toBe(true)
    expect(JSON.parse(await readFile(output, 'utf8'))).toEqual(expect.objectContaining({
      replyRuns: [expect.objectContaining({ model: 'qwen3-4b-instruct-2507' })],
    }))

    await expect(syncModelOpsSnapshot({ source, output, check: true, quiet: true })).resolves.toEqual(expect.objectContaining({
      changed: false,
    }))

    await writeFile(output, '{}\n')
    await expect(syncModelOpsSnapshot({ source, output, check: true, quiet: true })).rejects.toThrow('Model Ops snapshot is stale')
  })
})
