import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/social-topic-backlog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/social-topic-backlog')>()
  return { ...actual, collectSocialTopicSignals: vi.fn() }
})
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: vi.fn() } }))
import { buildLiveCoverage, sourceSignalProjection, workItemCoverageProjections } from './social-topic-source-coverage'
import { buildApprovedSourceProjection } from './social-topic-source-receipts'
import { prototypeLifecycleStage, type SourceSignal } from './social-topic-backlog'

const at = '2026-10-10T14:00:00.000Z'

function receipt(stage: 'insight' | 'in_development' | 'preview_deployed' | 'production_deployed' | 'publicly_cataloged', group: string) {
  return buildApprovedSourceProjection({
    sourceGroup: group,
    sourceKind: `${group}_receipt`,
    sourceId: `${group}-${stage}`,
    productIdentity: 'dark_castle_chess',
    lifecycleStage: stage,
    label: 'Dark Castle Chess',
    approvedSummary: `Approved ${stage} evidence.`,
    privacyClassification: 'public_safe',
    provenance: `${group}:${stage}`,
    approvedAt: at,
    approvedBy: 'reviewer-1',
  })
}

describe('dynamic Social Content source coverage', () => {
  it.each([
    ['Pilot', 'preview_deployed'],
    ['Production', 'production_deployed'],
  ] as const)('maps an app prototype %s record without overstating its lifecycle', (productionStage, expected) => {
    const lifecycleStage = prototypeLifecycleStage(productionStage)
    const signal: SourceSignal = {
      id: `app_prototype:${productionStage}`,
      type: 'shipped_feature',
      kind: 'app_prototype',
      label: `Prototype ${lifecycleStage}`,
      summary: 'A public-safe app prototype summary.',
      date: at,
      sensitivity: 'public_safe',
      product_ids: ['dark_castle_chess'],
      lifecycle_stage: lifecycleStage,
      receipt: {
        receipt_id: `receipt-${lifecycleStage}`,
        source_id: `app_prototype:${productionStage}`,
        source_kind: 'app_prototype',
        approval_status: 'approved',
        approved_at: at,
        approved_by: 'public_catalog_state',
        privacy_classification: 'public_safe',
        provenance: `public_catalog:app_prototypes:${lifecycleStage}`,
        summary_sha256: 'hash',
        product_ids: ['dark_castle_chess'],
        raw_content_included: false,
      },
    }

    expect(sourceSignalProjection(signal).map((item) => item.lifecycle_stage)).toEqual([expected])
  })

  it('deduplicates cross-source evidence into one product lifecycle', () => {
    const report = buildLiveCoverage({
      generatedAt: at,
      receipts: [
        receipt('insight', 'codex_insights'),
        receipt('in_development', 'github_development'),
        receipt('preview_deployed', 'vercel_deployments'),
        receipt('production_deployed', 'operational_records'),
        receipt('publicly_cataloged', 'public_catalog'),
      ],
    })
    expect(report.products).toHaveLength(3)
    expect(report.products[0]).toMatchObject({
      product_identity: 'dark_castle_chess',
      current_stage: 'publicly_cataloged',
      receipt_count: 5,
      gaps: [],
    })
    expect(report.products.map((product) => product.product_identity).slice(0, 3)).toEqual([
      'dark_castle_chess', 'accelerated', 'agentified',
    ])
    expect(report.gaps).toEqual([
      'Accelerated: No approved privacy-safe source receipt',
      'Agentified: No approved privacy-safe source receipt',
    ])
    expect(report.historical_gaps).toEqual([])
  })

  it('does not treat a preview as production or public release', () => {
    const report = buildLiveCoverage({
      generatedAt: at,
      receipts: [receipt('insight', 'codex_insights'), receipt('preview_deployed', 'vercel_deployments')],
    })
    const product = report.products[0]
    expect(product.current_stage).toBe('preview_deployed')
    expect(product.gaps).toEqual([])
    expect(product.historical_gaps).toEqual([
      'No recorded in development evidence',
      'No public catalog/site release evidence',
    ])
    expect(report.gaps).toHaveLength(2)
  })

  it('preserves last successful scan and actionable recovery for failed collectors', () => {
    const report = buildLiveCoverage({
      generatedAt: '2026-10-10T16:00:00.000Z',
      receipts: [receipt('insight', 'codex_insights')],
      collectorFailures: { codex_insights: 'projection read failed' },
      persistedScans: [{
        source_group: 'codex_insights',
        last_successful_scan_at: at,
      }],
    })
    const source = report.sources.find((item) => item.key === 'codex_insights')
    expect(source).toMatchObject({
      status: 'blocked',
      last_successful_scan: at,
      collector_failure: 'projection read failed',
    })
    expect(source?.recovery_action).toMatch(/Approve a privacy-safe Open Brain proposal/)
    expect(report.status).toBe('blocked')
  })

  it('blocks candidate readiness when no receipts exist', () => {
    const report = buildLiveCoverage({ generatedAt: at, receipts: [] })
    expect(report.status).toBe('blocked')
    expect(report.blockers).toContain('No approved source receipts are available. Candidate creation remains blocked.')
  })

  it('ignores unrelated Agent Ops work without an explicit approved coverage receipt', () => {
    const projections = workItemCoverageProjections([{
      id: 'private-task',
      title: 'Unrelated private work',
      objective: 'This text must never become Social Content evidence.',
      branch_name: 'codex/private-task',
      pr_url: 'https://github.com/example/private/pull/1',
      metadata: {},
      updated_at: at,
    }], at)
    expect(projections).toEqual([])
  })

  it('admits governed GitHub and preview evidence only from an approved receipt', () => {
    const projections = workItemCoverageProjections([{
      id: 'work-1',
      title: 'Internal title is not used',
      objective: 'Internal objective is not used',
      status: 'ready_for_review',
      branch_name: 'codex/dark-castle-learning',
      pr_url: 'https://github.com/example/repo/pull/2',
      metadata: {
        preview_url: 'https://preview.example.com',
        source_coverage_receipt: {
          approval_status: 'approved',
          raw_content_included: false,
          privacy_classification: 'public_safe',
          provenance: 'agent_ops:approved:work-1',
          approved_at: at,
          approved_by: 'reviewer-1',
          approved_summary: 'A privacy-safe learning mode update is in review.',
          product_identity: 'dark_castle_chess',
          label: 'Dark Castle Chess',
        },
      },
      updated_at: at,
    }], at)
    expect(projections.map((item) => item.lifecycle_stage)).toEqual(['in_development', 'preview_deployed'])
    expect(projections.every((item) => item.approved_summary.includes('privacy-safe'))).toBe(true)
  })
})
