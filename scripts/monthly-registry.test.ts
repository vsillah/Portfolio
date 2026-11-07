import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverTests, evidenceFreshness, hostedFreshness, validateManifest } from './portfolio-eval-monthly'

const family = {
  id: 'sample', owner: 'Model Ops', scope: 'sample', testFiles: ['lib/sample-eval.test.ts'],
  command: ['vitest', 'run', 'lib/sample-eval.test.ts'],
  threshold: { kind: 'all-tests-pass', source: 'Vitest exit status' }, requiredEnvironment: [], mode: 'local' as const,
  freshness: { maxAgeDays: 31, basis: 'monthly-run-artifact' },
  evidence: { location: 'reports/evals/monthly/*.json', format: 'json' },
  remediation: { owner: 'Model Ops', route: 'Captain review' },
}

describe('monthly eval registry', () => {
  it('fails closed for uncovered tests and missing commands', () => {
    const manifest = { schemaVersion: 1, discoveryPattern: 'eval', families: [{ ...family, command: [] }] }
    expect(validateManifest(manifest, ['lib/sample-eval.test.ts', 'lib/new-eval.test.ts'])).toEqual(expect.arrayContaining([
      'sample: missing executable command',
      'lib/new-eval.test.ts: no manifest owner',
    ]))
  })

  it('classifies absent, stale, current, and invalid future evidence', () => {
    const now = new Date('2026-11-02T00:00:00Z')
    expect(evidenceFreshness(undefined, 31, now)).toBe('absent')
    expect(evidenceFreshness({ count: 0, latestAt: null }, 31, now)).toBe('absent')
    expect(evidenceFreshness({ count: 2, latestAt: '2026-09-01T00:00:00Z' }, 31, now)).toBe('stale')
    expect(evidenceFreshness({ count: 2, latestAt: '2026-10-23T00:00:00Z' }, 31, now)).toBe('current')
    expect(evidenceFreshness({ count: 2, latestAt: '2026-12-01T00:00:00Z' }, 31, now)).toBe('stale')
    expect(hostedFreshness(undefined, 'chatbot', 31, now)).toBe('gated')
  })

  it('treats the exact age limit as current and a missing snapshot key as absent', () => {
    const now = new Date('2026-11-02T00:00:00.000Z')
    const exact = new Date(now.getTime() - 31 * 86400000).toISOString()
    const older = new Date(now.getTime() - 31 * 86400000 - 1).toISOString()
    expect(evidenceFreshness({ count: 1, latestAt: exact }, 31, now)).toBe('current')
    expect(evidenceFreshness({ count: 1, latestAt: older }, 31, now)).toBe('stale')
    expect(evidenceFreshness({ count: 1, latestAt: 'not-a-time' }, 31, now)).toBe('stale')
    expect(evidenceFreshness({ count: 3, latestAt: null }, 31, now)).toBe('absent')
    expect(evidenceFreshness({ count: -1, latestAt: exact }, 31, now)).toBe('absent')
    expect(hostedFreshness({}, 'chatbot', 31, now)).toBe('absent')
    expect(hostedFreshness({ chatbot: { count: 1, latestAt: exact } }, 'chatbot', 31, now)).toBe('current')
  })

  it('stops at an unsupported schema and rejects duplicate coverage or a drifted command', () => {
    expect(validateManifest({ schemaVersion: 2, discoveryPattern: 'eval', families: [] }, ['lib/orphan-eval.test.ts'])).toEqual(['Unsupported manifest schema'])
    const drifted = { ...family, command: ['vitest', 'run', 'lib/other-eval.test.ts'] }
    expect(validateManifest(
      { schemaVersion: 1, discoveryPattern: 'eval', families: [drifted, { ...family }] },
      ['lib/sample-eval.test.ts'],
    )).toEqual([
      'sample: command must run exactly the listed tests',
      'Missing or duplicate family id: sample',
      'lib/sample-eval.test.ts: covered twice',
    ])
  })

  it('requires an evidence-only hosted command and test files for a local family', () => {
    const hosted = {
      ...family, id: 'hosted-chatbot', mode: 'gated' as const, testFiles: [], command: ['vitest', 'run'],
      evidence: { ...family.evidence, snapshotKey: 'chatbot' },
    }
    const localEmpty = { ...family, id: 'local-empty', testFiles: [], command: ['vitest', 'run'] }
    expect(validateManifest({ schemaVersion: 1, discoveryPattern: 'eval', families: [hosted, localEmpty] }, [])).toEqual([
      'hosted-chatbot: hosted command must be evidence-only',
      'local-empty: local command needs test files',
    ])
  })

  it('discovers legitimate eval tests and skips nested worktrees', () => {
    const dir = mkdtempSync(join(tmpdir(), 'portfolio-eval-discovery-'))
    try {
      mkdirSync(join(dir, 'lib'), { recursive: true })
      mkdirSync(join(dir, 'lib/.codex-worktrees/other/lib'), { recursive: true })
      writeFileSync(join(dir, 'lib/golden.test.ts'), '')
      writeFileSync(join(dir, 'lib/.codex-worktrees/other/lib/duplicate-eval.test.ts'), '')
      expect(discoverTests(dir)).toEqual(['lib/golden.test.ts'])
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})
