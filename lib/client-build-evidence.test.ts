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
})
