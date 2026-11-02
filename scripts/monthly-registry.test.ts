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
