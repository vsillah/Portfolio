'use client'

import { useMemo, useState } from 'react'
import { Calculator, Code2, Cpu, DollarSign, Gauge, GitCommit, ShieldCheck } from 'lucide-react'
import type { ClientBuildEvidence } from '@/lib/client-build-evidence'

interface Props {
  buildEvidence: ClientBuildEvidence
}

type CalculatorMode = 'rate' | 'hours' | 'proposal'

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function safeNumber(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0
}

export default function BuildEvidenceInvestmentSection({ buildEvidence }: Props) {
  const { repoMetrics, tokenUsage, costSummary, hourlyTranslation, sourceConfidence } = buildEvidence
  const [mode, setMode] = useState<CalculatorMode>('rate')
  const [hourlyRate, setHourlyRate] = useState(hourlyTranslation.defaultBenchmarkHourlyRate)
  const [proposalAmount, setProposalAmount] = useState(hourlyTranslation.defaultProposalAmount)
  const [focusedHoursLow, setFocusedHoursLow] = useState(hourlyTranslation.focusedHoursLow)
  const [focusedHoursHigh, setFocusedHoursHigh] = useState(hourlyTranslation.focusedHoursHigh)
  const [monthlySpend, setMonthlySpend] = useState(costSummary.subscriptionMonthlyCostUsd ?? 0)

  const normalizedLow = Math.min(safeNumber(focusedHoursLow), safeNumber(focusedHoursHigh))
  const normalizedHigh = Math.max(safeNumber(focusedHoursLow), safeNumber(focusedHoursHigh))
  const normalizedRate = safeNumber(hourlyRate)
  const normalizedProposal = safeNumber(proposalAmount)
  const normalizedMonthlySpend = safeNumber(monthlySpend)

  const calculated = useMemo(() => {
    const rateRangeLow = normalizedLow * normalizedRate
    const rateRangeHigh = normalizedHigh * normalizedRate
    const effectiveHourlyLow = normalizedHigh > 0 ? normalizedProposal / normalizedHigh : 0
    const effectiveHourlyHigh = normalizedLow > 0 ? normalizedProposal / normalizedLow : 0
    const impliedHours = normalizedRate > 0 ? normalizedProposal / normalizedRate : 0
    const subscriptionAllocation = normalizedMonthlySpend * (tokenUsage.shareOfComparisonWindowPct / 100)

    return {
      rateRangeLow,
      rateRangeHigh,
      effectiveHourlyLow,
      effectiveHourlyHigh,
      impliedHours,
      subscriptionAllocation,
    }
  }, [
    normalizedHigh,
    normalizedLow,
    normalizedMonthlySpend,
    normalizedProposal,
    normalizedRate,
    tokenUsage.shareOfComparisonWindowPct,
  ])

  const calculatorSummary =
    mode === 'rate'
      ? `${formatCurrency(calculated.rateRangeLow)}-${formatCurrency(calculated.rateRangeHigh)} replacement-cost range`
      : mode === 'hours'
        ? `${formatCurrency(calculated.effectiveHourlyLow)}-${formatCurrency(calculated.effectiveHourlyHigh)} effective hourly lens`
        : `${formatNumber(calculated.impliedHours)} implied benchmark hours`

  const metricCards = [
    {
      label: 'Commits',
      value: formatNumber(repoMetrics.allBranchCommitCount),
      detail: `${formatNumber(repoMetrics.filesChanged)} files changed`,
      icon: GitCommit,
      tone: 'border-radiant-gold/35 bg-radiant-gold/10 text-radiant-gold',
    },
    {
      label: 'Code + docs',
      value: formatCompact(repoMetrics.trackedTextLines),
      detail: `${formatNumber(repoMetrics.insertions)} insertions`,
      icon: Code2,
      tone: 'border-gold-light/30 bg-gold-light/10 text-gold-light',
    },
    {
      label: 'Release gates',
      value: `${repoMetrics.releasePassCount}/${repoMetrics.releasePassCount + repoMetrics.releasePendingCount}`,
      detail: repoMetrics.releasePendingGate ? `${repoMetrics.releasePendingGate} pending` : 'No pending gate recorded',
      icon: ShieldCheck,
      tone: 'border-bronze/45 bg-bronze/15 text-gold-light',
    },
    {
      label: 'Attributed tokens',
      value: formatCompact(tokenUsage.totalTokens),
      detail: `${tokenUsage.shareOfComparisonWindowPct.toFixed(2)}% of comparison window`,
      icon: Cpu,
      tone: 'border-radiant-gold/25 bg-silicon-slate/55 text-radiant-gold',
    },
  ]

  return (
    <section className="rounded-lg border border-radiant-gold/20 bg-silicon-slate/35 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.24)]">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Gauge className="h-5 w-5 text-radiant-gold" />
            <h3 className="text-sm font-medium uppercase tracking-wider text-radiant-gold">
              Build Evidence & Investment
            </h3>
          </div>
          <p className="max-w-3xl text-sm text-platinum-white/65">
            ReversR Rebuild is measured here as product-asset evidence. The numbers support replacement-cost and fixed-fee evaluation; they are not a time sheet.
          </p>
        </div>
        <div className="rounded-lg border border-radiant-gold/30 bg-radiant-gold/10 px-3 py-2 text-xs text-gold-light">
          <p className="font-semibold">{sourceConfidence.label}</p>
          <p className="mt-1 text-platinum-white/60 capitalize">{sourceConfidence.confidence} confidence</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <div key={card.label} className={`rounded-lg border p-4 ${card.tone}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wider text-platinum-white/55">{card.label}</p>
              <card.icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold text-platinum-white">{card.value}</p>
            <p className="mt-1 text-xs text-platinum-white/55">{card.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-lg border border-radiant-gold/15 bg-imperial-navy/55 p-4 lg:col-span-1">
          <div className="mb-3 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-radiant-gold" />
            <p className="text-xs font-semibold uppercase tracking-wider text-radiant-gold">Token attribution</p>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-platinum-white/45">Sessions</dt>
              <dd className="font-medium text-platinum-white">{formatNumber(tokenUsage.sessionCount)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-platinum-white/45">Input tokens</dt>
              <dd className="font-medium text-platinum-white">{formatCompact(tokenUsage.inputTokens)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-platinum-white/45">Cached input</dt>
              <dd className="font-medium text-platinum-white">{formatCompact(tokenUsage.cachedInputTokens)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-platinum-white/45">Output + reasoning</dt>
              <dd className="font-medium text-platinum-white">
                {formatCompact(tokenUsage.outputTokens + tokenUsage.reasoningTokens)}
              </dd>
            </div>
          </dl>
          <p className="mt-4 rounded-lg border border-radiant-gold/20 bg-radiant-gold/10 p-3 text-xs text-platinum-white/75">
            {sourceConfidence.sourceSummary}
          </p>
        </div>

        <div className="rounded-lg border border-radiant-gold/15 bg-imperial-navy/55 p-4 lg:col-span-1">
          <div className="mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-radiant-gold" />
            <p className="text-xs font-semibold uppercase tracking-wider text-radiant-gold">Token cost lens</p>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg bg-silicon-slate/45 p-3">
              <p className="text-xs uppercase tracking-wider text-platinum-white/45">API-equivalent estimate</p>
              <p className="mt-1 text-lg font-semibold text-platinum-white">
                {costSummary.apiEquivalentCostUsd == null ? 'Rate needed' : formatCurrency(costSummary.apiEquivalentCostUsd)}
              </p>
              <p className="mt-1 text-xs text-platinum-white/45">{costSummary.pricingSourceLabel}</p>
            </div>
            <div className="rounded-lg bg-silicon-slate/45 p-3">
              <label className="text-xs uppercase tracking-wider text-platinum-white/45" htmlFor="ai-monthly-spend">
                Monthly AI spend
              </label>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-platinum-white/45">$</span>
                <input
                  id="ai-monthly-spend"
                  type="number"
                  min="0"
                  value={monthlySpend}
                  onChange={(event) => setMonthlySpend(Number(event.target.value))}
                  className="w-full rounded-lg border border-radiant-gold/15 bg-imperial-navy px-3 py-2 text-sm text-platinum-white outline-none focus:border-radiant-gold"
                />
              </div>
              <p className="mt-2 text-sm font-semibold text-gold-light">
                {formatCurrency(calculated.subscriptionAllocation)} allocated by usage share
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-radiant-gold/15 bg-imperial-navy/55 p-4 lg:col-span-1">
          <div className="mb-3 flex items-center gap-2">
            <Calculator className="h-4 w-4 text-radiant-gold" />
            <p className="text-xs font-semibold uppercase tracking-wider text-radiant-gold">Hourly translation</p>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {(['rate', 'hours', 'proposal'] as CalculatorMode[]).map((nextMode) => (
              <button
                key={nextMode}
                type="button"
                onClick={() => setMode(nextMode)}
                className={`rounded-lg border px-2 py-2 text-xs font-medium capitalize transition-colors ${
                  mode === nextMode
                    ? 'border-radiant-gold bg-radiant-gold/20 text-gold-light'
                    : 'border-radiant-gold/15 bg-silicon-slate/45 text-platinum-white/55 hover:text-platinum-white'
                }`}
              >
                {nextMode}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-platinum-white/45">
              Rate
              <input
                type="number"
                min="0"
                value={hourlyRate}
                onChange={(event) => setHourlyRate(Number(event.target.value))}
                className="mt-1 w-full rounded-lg border border-radiant-gold/15 bg-imperial-navy px-3 py-2 text-sm text-platinum-white outline-none focus:border-radiant-gold"
              />
            </label>
            <label className="text-xs text-platinum-white/45">
              Proposal
              <input
                type="number"
                min="0"
                value={proposalAmount}
                onChange={(event) => setProposalAmount(Number(event.target.value))}
                className="mt-1 w-full rounded-lg border border-radiant-gold/15 bg-imperial-navy px-3 py-2 text-sm text-platinum-white outline-none focus:border-radiant-gold"
              />
            </label>
            <label className="text-xs text-platinum-white/45">
              Low hours
              <input
                type="number"
                min="0"
                value={focusedHoursLow}
                onChange={(event) => setFocusedHoursLow(Number(event.target.value))}
                className="mt-1 w-full rounded-lg border border-radiant-gold/15 bg-imperial-navy px-3 py-2 text-sm text-platinum-white outline-none focus:border-radiant-gold"
              />
            </label>
            <label className="text-xs text-platinum-white/45">
              High hours
              <input
                type="number"
                min="0"
                value={focusedHoursHigh}
                onChange={(event) => setFocusedHoursHigh(Number(event.target.value))}
                className="mt-1 w-full rounded-lg border border-radiant-gold/15 bg-imperial-navy px-3 py-2 text-sm text-platinum-white outline-none focus:border-radiant-gold"
              />
            </label>
          </div>
          <div className="mt-4 rounded-lg border border-radiant-gold/25 bg-radiant-gold/10 p-3">
            <p className="text-lg font-semibold text-platinum-white">{calculatorSummary}</p>
            <p className="mt-1 text-xs text-platinum-white/65">{hourlyTranslation.notes}</p>
          </div>
        </div>
      </div>

      {buildEvidence.clientSafeNotes.length > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-3">
          {buildEvidence.clientSafeNotes.map((note) => (
            <p key={note} className="rounded-lg border border-radiant-gold/15 bg-imperial-navy/50 p-3 text-xs text-platinum-white/60">
              {note}
            </p>
          ))}
        </div>
      )}
    </section>
  )
}
