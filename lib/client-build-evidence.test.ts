import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({
  supabaseAdmin: {},
}))

import { sanitizeBuildEvidenceRow } from './client-build-evidence'

describe('sanitizeBuildEvidenceRow', () => {
  it('returns client-safe evidence without private source refs', () => {
    const output = sanitizeBuildEvidenceRow({
      id: 'evidence-1',
      project_label: 'ReversR Rebuild Product Asset',
      captured_at: '2026-06-15T12:00:00.000Z',
      repo_metrics: {
        repoLabel: 'vsillah/ReversR-Rebuild',
        publicRepoUrl: 'https://github.com/vsillah/ReversR-Rebuild',
        allBranchCommitCount: 149,
        trackedTextLines: 36775,
        workflow: ['scan or describe a machine'],
      },
      token_usage: {
        confidenceLabel: 'Direct ReversR workspace evidence',
        sessionCount: 5,
        totalTokens: 283717602,
        shareOfComparisonWindowPct: 17.38,
      },
      cost_summary: {
        pricingSourceLabel: 'Provider/API pricing snapshot not recorded',
      },
      hourly_translation: {
        defaultBenchmarkHourlyRate: 175,
        defaultProposalAmount: 30000,
        focusedHoursLow: 300,
        focusedHoursHigh: 475,
      },
      source_confidence: {
        label: 'Direct ReversR workspace evidence',
        confidence: 'high',
        sourceSummary: 'Strict attribution only.',
        excludedSources: ['/Users/vambahsillah/.codex/sessions/private.jsonl'],
      },
      client_safe_notes: ['Not a time sheet.'],
      private_source_refs: ['/Users/vambahsillah/.codex/sessions/private.jsonl'],
    } as any)

    expect(output.repoMetrics.allBranchCommitCount).toBe(149)
    expect(output.tokenUsage.totalTokens).toBe(283717602)
    expect(output.clientSafeNotes).toEqual(['Not a time sheet.'])
    expect(JSON.stringify(output)).not.toContain('/Users/vambahsillah/.codex/sessions/private.jsonl')
    expect(output).not.toHaveProperty('privateSourceRefs')
    expect(output).not.toHaveProperty('private_source_refs')
  })

  it('falls back to template-safe source confidence copy', () => {
    const output = sanitizeBuildEvidenceRow({
      id: 'evidence-2',
      project_label: 'Client Dashboard Build',
      captured_at: '2026-06-16T12:00:00.000Z',
      repo_metrics: null,
      token_usage: null,
      cost_summary: null,
      hourly_translation: null,
      source_confidence: null,
      client_safe_notes: [],
    } as any)

    expect(output.sourceConfidence.label).toBe('Direct workspace evidence')
    expect(output.sourceConfidence.sourceSummary).toBe(
      'Strict attribution uses Codex sessions started from the tracked workspace.'
    )
  })

  it('normalizes malformed evidence payloads and strips unsafe note references', () => {
    const output = sanitizeBuildEvidenceRow({
      id: 'evidence-3',
      project_label: 'Generalized Client Dashboard Build',
      captured_at: '2026-06-17T12:00:00.000Z',
      repo_metrics: {
        allBranchCommitCount: '149',
        trackedTextLines: Number.NaN,
        workflow: ['client-visible workflow', 42, null],
      },
      token_usage: {
        confidenceLabel: 'Direct workspace evidence',
        totalTokens: Number.POSITIVE_INFINITY,
        shareOfComparisonWindowPct: '17.38',
      },
      cost_summary: {
        apiEquivalentCostUsd: 'unknown',
        subscriptionMonthlyCostUsd: 200,
      },
      hourly_translation: {
        defaultBenchmarkHourlyRate: -175,
        focusedHoursLow: 125,
      },
      source_confidence: {
        label: 'Direct workspace evidence',
        confidence: 'unverified',
        excludedSources: [
          'client-visible summary',
          '/Users/vambahsillah/.codex/sessions/private.jsonl',
          'local-private-store-console-record',
        ],
      },
      client_safe_notes: [
        'Repository and token metrics are supporting evidence.',
        'local-private source bundle was excluded.',
        '/Users/vambahsillah/.codex/sessions/private.jsonl',
      ],
    } as any)

    expect(output.repoMetrics.allBranchCommitCount).toBe(0)
    expect(output.repoMetrics.trackedTextLines).toBe(0)
    expect(output.repoMetrics.workflow).toEqual(['client-visible workflow'])
    expect(output.tokenUsage.totalTokens).toBe(0)
    expect(output.tokenUsage.shareOfComparisonWindowPct).toBe(0)
    expect(output.costSummary.apiEquivalentCostUsd).toBeNull()
    expect(output.costSummary.subscriptionMonthlyCostUsd).toBe(200)
    expect(output.hourlyTranslation.defaultBenchmarkHourlyRate).toBe(-175)
    expect(output.hourlyTranslation.focusedHoursLow).toBe(125)
    expect(output.sourceConfidence.confidence).toBe('high')
    expect(output.sourceConfidence.excludedSources).toEqual(['client-visible summary'])
    expect(output.clientSafeNotes).toEqual(['Repository and token metrics are supporting evidence.'])
    expect(JSON.stringify(output)).not.toContain('/Users/')
    expect(JSON.stringify(output)).not.toContain('local-private')
  })
})
