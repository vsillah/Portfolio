import { describe, it, expect } from 'vitest'

import { runPainPointEvidenceValidation } from './pain-point-evidence'
import type { PainPointEvidenceRow } from './pain-point-evidence'
import { PROMPT_VERSION, JUDGE_VERSION } from './llm-judge'

function mkRow(overrides: Partial<PainPointEvidenceRow>): PainPointEvidenceRow {
  return {
    id: 'ppe-1',
    pain_point_category_id: 'cat-payroll',
    source_type: 'market_intelligence',
    source_id: 'mi-1',
    source_excerpt:
      'We run payroll three times per week because our outdated system costs roughly $12,000/month in staff time.',
    monetary_indicator: 12000,
    monetary_context: 'Weekly payroll run overhead',
    source_validation_status: 'pending',
    excerpt_faithfulness_status: 'pending',
    prompt_version: null,
    validator_version: null,
    last_validated_at: null,
    ...overrides,
  }
}

const nameMap = async (ids: string[]) => {
  const m = new Map<string, string>()
  for (const id of ids) m.set(id, 'Payroll inefficiency')
  return m
}

const nullParent = async () => null

describe('runPainPointEvidenceValidation — dryRun mode', () => {
  it('judges a single pending row and returns a faithful verdict', async () => {
    const row = mkRow({})
    const { summary, items } = await runPainPointEvidenceValidation({
      mode: 'sample-audit',
      rows: [row],
      loadPainPointNames: nameMap,
      lookupParentStatus: nullParent,
      judge: { dryRun: true },
    })
    expect(summary.attempted).toBe(1)
    expect(summary.faithful).toBe(1)
    expect(summary.dry_run).toBe(true)
    expect(items[0].result.excerpt_faithfulness_status).toBe('faithful')
    expect(items[0].sample).toBeDefined()
    expect(items[0].sample?.pain_category).toBe('Payroll inefficiency')
  })

  it('skips already-judged rows when mode=pending and versions match (idempotence)', async () => {
    const row = mkRow({
      excerpt_faithfulness_status: 'faithful',
      prompt_version: PROMPT_VERSION,
      validator_version: JUDGE_VERSION,
    })
    const { summary, items } = await runPainPointEvidenceValidation({
      mode: 'pending',
      rows: [row],
      loadPainPointNames: nameMap,
      lookupParentStatus: nullParent,
      judge: { dryRun: true },
      dryRun: true,
    })
    expect(summary.attempted).toBe(0)
    expect(items).toHaveLength(0)
  })

  it('forces re-judge when mode=forced even if versions match', async () => {
    const row = mkRow({
      excerpt_faithfulness_status: 'faithful',
      prompt_version: PROMPT_VERSION,
      validator_version: JUDGE_VERSION,
    })
    const { summary } = await runPainPointEvidenceValidation({
      mode: 'forced',
      rows: [row],
      loadPainPointNames: nameMap,
      lookupParentStatus: nullParent,
      judge: { dryRun: true },
      dryRun: true,
    })
    expect(summary.attempted).toBe(1)
  })

  it('short-circuits rows whose parent is "rejected" (Phase 3 wiring)', async () => {
    // In Phase 2a the default parent lookup returns null, so this path is only
    // hit via the injected resolver here. Phase 3 will enable it for real.
    const row = mkRow({ id: 'ppe-reject' })
    const { summary, items } = await runPainPointEvidenceValidation({
      mode: 'sample-audit',
      rows: [row],
      loadPainPointNames: nameMap,
      lookupParentStatus: async () => 'rejected',
      judge: { dryRun: true },
    })
    expect(summary.short_circuited).toBe(1)
    expect(items).toHaveLength(1)
    expect(items[0].result.short_circuited).toBe(true)
    expect(items[0].result.source_validation_status).toBe('rejected')
    expect(items[0].result.excerpt_faithfulness_status).toBe('pending')
    expect(summary.faithful + summary.unfaithful + summary.insufficient).toBe(0)
  })

  it('respects maxBatchSize when judging many rows', async () => {
    const rows = Array.from({ length: 8 }, (_, i) => mkRow({ id: `ppe-${i}` }))
    const { summary, items } = await runPainPointEvidenceValidation({
      mode: 'sample-audit',
      rows,
      loadPainPointNames: nameMap,
      lookupParentStatus: nullParent,
      judge: { dryRun: true },
      maxBatchSize: 3,
    })
    expect(summary.attempted).toBe(8)
    expect(summary.llm_batches).toBe(3) // 3 + 3 + 2
    expect(items).toHaveLength(8)
  })

  it('short-excerpt rows land as "insufficient"', async () => {
    const row = mkRow({ id: 'ppe-short', source_excerpt: 'tiny' })
    const { summary, items } = await runPainPointEvidenceValidation({
      mode: 'sample-audit',
      rows: [row],
      loadPainPointNames: nameMap,
      lookupParentStatus: nullParent,
      judge: { dryRun: true },
    })
    expect(summary.insufficient).toBe(1)
    expect(items[0].result.excerpt_faithfulness_status).toBe('insufficient')
  })
})
