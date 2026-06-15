import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BuildEvidenceInvestmentSection from './BuildEvidenceInvestmentSection'
import type { ClientBuildEvidence } from '@/lib/client-build-evidence'

const evidence: ClientBuildEvidence = {
  id: 'evidence-1',
  projectLabel: 'ReversR Rebuild Product Asset',
  capturedAt: '2026-06-15T12:00:00.000Z',
  repoMetrics: {
    repoLabel: 'vsillah/ReversR-Rebuild',
    publicRepoUrl: 'https://github.com/vsillah/ReversR-Rebuild',
    capturedAt: '2026-06-12T12:35:02-04:00',
    allBranchCommitCount: 149,
    headCommitCount: 140,
    trackedFiles: 271,
    trackedCodeDocConfigFiles: 150,
    trackedTextLines: 36775,
    filesChanged: 151,
    insertions: 30973,
    deletions: 4990,
    releasePassCount: 38,
    releasePendingCount: 1,
    releasePendingGate: 'store-console-records',
    workflow: ['scan or describe a machine'],
  },
  tokenUsage: {
    attributionMethod: 'strict_reversr_workspace_cwd',
    confidenceLabel: 'Direct ReversR workspace evidence',
    comparisonWindowLabel: 'June 2026 local Codex sessions',
    sessionCount: 5,
    totalTokens: 283717602,
    inputTokens: 283030750,
    cachedInputTokens: 270859776,
    outputTokens: 686852,
    reasoningTokens: 177176,
    shareOfComparisonWindowPct: 17.38,
    modelProvider: 'openai',
    model: 'gpt-5.5',
    planType: 'pro',
  },
  costSummary: {
    pricingCapturedAt: null,
    pricingSourceLabel: 'Provider/API pricing snapshot not recorded',
    pricingAssumption: 'Observed token usage only.',
    apiEquivalentCostUsd: null,
    subscriptionMonthlyCostUsd: null,
    subscriptionAllocatedCostUsd: null,
    subscriptionSharePct: 17.38,
  },
  hourlyTranslation: {
    defaultBenchmarkHourlyRate: 175,
    defaultProposalAmount: 30000,
    focusedHoursLow: 300,
    focusedHoursHigh: 475,
    notes: 'Scenario estimate, not a time sheet.',
  },
  sourceConfidence: {
    label: 'Direct ReversR workspace evidence',
    confidence: 'high',
    sourceSummary: 'Strict attribution includes only Codex sessions whose working directory was the ReversR workspace.',
    excludedSources: [],
  },
  clientSafeNotes: [
    'Repository and token metrics are supporting evidence, not billing units.',
    'Hourly translation is a comparison lens.',
  ],
}

describe('BuildEvidenceInvestmentSection', () => {
  it('renders client-safe evidence and calculator outputs', () => {
    render(<BuildEvidenceInvestmentSection buildEvidence={evidence} />)

    expect(screen.getByText('Build Evidence & Investment')).toBeInTheDocument()
    expect(screen.getByText('Direct ReversR workspace evidence')).toBeInTheDocument()
    expect(screen.getByText('149')).toBeInTheDocument()
    expect(screen.getByText('Rate needed')).toBeInTheDocument()
    expect(screen.getByText('$52,500-$83,125 replacement-cost range')).toBeInTheDocument()
    expect(screen.getAllByText(/not a time sheet/i)).toHaveLength(2)
  })

  it('updates subscription allocation and proposal translation locally', () => {
    render(<BuildEvidenceInvestmentSection buildEvidence={evidence} />)

    fireEvent.change(screen.getByLabelText('Monthly AI spend'), {
      target: { value: '200' },
    })
    expect(screen.getByText('$35 allocated by usage share')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /proposal/i }))
    expect(screen.getByText('171 implied benchmark hours')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Rate'), {
      target: { value: '200' },
    })
    expect(screen.getByText('150 implied benchmark hours')).toBeInTheDocument()
  })
})
