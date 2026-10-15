'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, Fingerprint, Gauge, ShieldCheck } from 'lucide-react'
import {
  evaluateOutlierEvidenceCalibration,
  type OutlierEvidenceDimension,
} from '@/lib/social-outlier-evidence-calibration'

type OutlierEvidenceScorecardProps = {
  packet: unknown
  qaState?: string | null
}

function formatDate(value: string) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed)
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(parsed)
    : 'Unavailable'
}

export default function OutlierEvidenceScorecard({ packet, qaState }: OutlierEvidenceScorecardProps) {
  const evaluation = useMemo(() => evaluateOutlierEvidenceCalibration(packet), [packet])
  const [selectedDimension, setSelectedDimension] = useState<OutlierEvidenceDimension>('headline')
  const selected = evaluation.dimensions.find((dimension) => dimension.dimension === selectedDimension)
    ?? evaluation.dimensions[0]
  const scored = evaluation.status === 'scored'

  return (
    <section
      aria-labelledby="outlier-evidence-scorecard-heading"
      className="mt-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
      data-testid="outlier-evidence-scorecard"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Gauge className="h-4 w-4" /> Comparable-content calibration
          </p>
          <h3 id="outlier-evidence-scorecard-heading" className="mt-2 text-lg font-semibold text-foreground">
            Outlier evidence scorecard
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Deterministic percentile evaluations use only attributable, fresh comparisons from the same channel, format, audience-size band, and recency window. Missing or stale evidence remains Unscored.
          </p>
        </div>
        <div className={`min-w-36 rounded-lg border px-4 py-3 text-left lg:text-right ${scored ? 'border-emerald-500/35 bg-emerald-500/10' : 'border-amber-500/35 bg-amber-500/10'}`}>
          <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${scored ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
            {scored ? 'Scored' : 'Unscored'}
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{evaluation.overall_score ?? '—'}</p>
          <p className="text-xs text-muted-foreground">Overall percentile</p>
        </div>
      </div>

      {qaState ? (
        <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-800 dark:text-blue-200">
          Privacy-safe local QA fixture · {qaState} · no provider, draft, schedule, publish, or external-send action
        </div>
      ) : null}

      <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border border-border bg-muted/35 p-3"><dt className="text-muted-foreground">Model</dt><dd className="mt-1 break-all font-medium text-foreground">{evaluation.model_version}</dd></div>
        <div className="rounded-lg border border-border bg-muted/35 p-3"><dt className="text-muted-foreground">Normalized cohort</dt><dd className="mt-1 font-medium text-foreground">{evaluation.normalization.channel} · {evaluation.normalization.format}</dd></div>
        <div className="rounded-lg border border-border bg-muted/35 p-3"><dt className="text-muted-foreground">Audience band</dt><dd className="mt-1 font-medium capitalize text-foreground">{evaluation.normalization.audience_band}</dd></div>
        <div className="rounded-lg border border-border bg-muted/35 p-3"><dt className="text-muted-foreground">Freshness</dt><dd className="mt-1 font-medium text-foreground">≤ {evaluation.normalization.freshness_days} days</dd></div>
        <div className="rounded-lg border border-border bg-muted/35 p-3"><dt className="text-muted-foreground">Sample</dt><dd className="mt-1 font-medium text-foreground">{evaluation.included_sources.length} / {evaluation.normalization.minimum_sample_size} minimum</dd></div>
      </dl>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Numerical evaluations</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Outlier evidence dimensions">
            {evaluation.dimensions.map((dimension) => (
              <button
                key={dimension.dimension}
                type="button"
                onClick={() => setSelectedDimension(dimension.dimension)}
                aria-pressed={selectedDimension === dimension.dimension}
                className={`rounded-lg border p-3 text-left transition-colors ${selectedDimension === dimension.dimension ? 'border-accent bg-accent/10 ring-1 ring-accent/30' : 'border-border bg-background hover:border-accent/45'}`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{dimension.label}</span>
                  {dimension.status === 'scored'
                    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                    : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />}
                </span>
                <span className="mt-2 block text-xl font-semibold text-foreground">{dimension.score ?? 'Unscored'}</span>
                <span className="mt-1 block text-xs text-muted-foreground">n={dimension.sample_size} · median {dimension.cohort_median ?? '—'}</span>
              </button>
            ))}
          </div>
        </div>

        <aside aria-live="polite" className="rounded-lg border border-border bg-muted/25 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Drill-in</p>
          <h4 className="mt-2 text-base font-semibold text-foreground">{selected.label}</h4>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div><dt className="text-muted-foreground">Candidate input</dt><dd className="mt-1 font-medium text-foreground">{selected.candidate_value ?? 'Missing'}</dd></div>
            <div><dt className="text-muted-foreground">Percentile</dt><dd className="mt-1 font-medium text-foreground">{selected.score ?? 'Unscored'}</dd></div>
            <div><dt className="text-muted-foreground">Cohort median</dt><dd className="mt-1 font-medium text-foreground">{selected.cohort_median ?? '—'}</dd></div>
            <div><dt className="text-muted-foreground">Sample size</dt><dd className="mt-1 font-medium text-foreground">{selected.sample_size}</dd></div>
          </dl>
          <p className="mt-3 rounded-md border border-border bg-background p-3 text-xs leading-5 text-muted-foreground">{selected.formula}</p>
          {selected.reason ? <p role="alert" className="mt-3 text-sm leading-6 text-amber-700 dark:text-amber-200">{selected.reason}</p> : null}
        </aside>
      </div>

      <details className="mt-4 rounded-lg border border-border bg-muted/20">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground">
          Sources, exclusions, and deterministic inputs
        </summary>
        <div className="grid gap-4 border-t border-border p-4 lg:grid-cols-2">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Included sources</p>
            <ul className="mt-2 space-y-2">
              {evaluation.included_sources.map((source) => (
                <li key={source.id} className="rounded-md border border-border bg-background p-3 text-sm">
                  <a href={source.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                    {source.source_label} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <p className="mt-1 text-xs text-muted-foreground">Observed {formatDate(source.observed_at)} · audience {source.audience_size.toLocaleString()}</p>
                </li>
              ))}
              {evaluation.included_sources.length === 0 ? <li className="text-sm text-muted-foreground">No attributable fresh sources passed normalization.</li> : null}
            </ul>
          </div>
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"><AlertTriangle className="h-4 w-4" /> Excluded evidence</p>
            <ul className="mt-2 space-y-2 text-sm">
              {evaluation.excluded_sources.map((source) => (
                <li key={source.id} className="rounded-md border border-amber-500/25 bg-amber-500/5 p-3 text-amber-800 dark:text-amber-100">
                  <span className="font-medium">{source.source_label || source.id}</span><span className="block text-xs leading-5">{source.reason}</span>
                </li>
              ))}
              {evaluation.excluded_sources.length === 0 ? <li className="text-muted-foreground">No cohort sources were excluded.</li> : null}
            </ul>
          </div>
        </div>
        <div className="flex flex-col gap-1 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2"><Fingerprint className="h-3.5 w-3.5" /> Input fingerprint: {evaluation.input_fingerprint}</span>
          <span>Evaluated: {evaluation.evaluated_at ? formatDate(evaluation.evaluated_at) : 'Unavailable'}</span>
        </div>
      </details>
    </section>
  )
}
