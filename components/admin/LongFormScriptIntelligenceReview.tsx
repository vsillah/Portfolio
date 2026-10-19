'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ExternalLink, Fingerprint, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { LONG_FORM_FRAMEWORK_LIBRARY, type LongFormScriptReview, type ScriptDimensionKey } from '@/lib/long-form-script-intelligence'

function statusClasses(status: 'passed' | 'blocked' | 'unscored') {
  if (status === 'passed') return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100'
  if (status === 'blocked') return 'border-red-500/35 bg-red-500/10 text-red-800 dark:text-red-100'
  return 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-100'
}

function pretty(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function LongFormScriptIntelligenceReview({ review, loading = false, subjectLabel }: {
  review: LongFormScriptReview | null
  loading?: boolean
  subjectLabel?: string
}) {
  const [selectedDimension, setSelectedDimension] = useState<ScriptDimensionKey>('first_30_seconds')

  useEffect(() => setSelectedDimension('first_30_seconds'), [review?.input_fingerprint])

  if (!review) {
    return (
      <section aria-label="Long-form script intelligence" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4" data-testid="long-form-script-intelligence-review">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4 text-amber-300" />}
          {loading ? 'Checking selected script intelligence' : 'Script intelligence receipt unavailable'}
        </p>
        <p className="mt-1 text-xs leading-5 text-gray-400">Render readiness stays closed until the selected draft returns a current server-side evaluation.</p>
      </section>
    )
  }

  const selected = review.dimensions.find((dimension) => dimension.key === selectedDimension) ?? review.dimensions[0]

  return (
    <section aria-labelledby="script-intelligence-review-heading" className="rounded-lg border border-silicon-slate bg-silicon-slate/35 p-4" data-testid="long-form-script-intelligence-review" data-input-fingerprint={review.input_fingerprint}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-radiant-gold">Selected-item script intelligence</p>
          <h4 id="script-intelligence-review-heading" className="mt-1 text-base font-semibold text-foreground">Can this script earn render readiness?</h4>
          <p className="mt-1 text-xs leading-5 text-gray-400">{subjectLabel ? `${subjectLabel}: ` : ''}the current server receipt checks retention, proof, pacing, visual cues, payoff, conclusion, CTA, live topic evidence, and creator distance.</p>
        </div>
        <div className={`w-fit rounded-lg border px-3 py-2 ${statusClasses(review.status)}`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">{review.status}</p>
          <p className="mt-0.5 text-xl font-semibold">{review.overall_score ?? '—'}</p>
          <p className="text-[10px]">{review.approval_ready ? 'Approval-ready' : 'Approval closed'}</p>
        </div>
      </div>

      {!review.approval_ready ? (
        <div role="alert" className="mt-3 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><AlertTriangle className="h-4 w-4" /> {review.status === 'unscored' ? 'Evidence remains Unscored' : 'Script remains blocked'}</p>
          <p className="mt-1 text-xs leading-5 text-gray-400">{review.blockers[0] ?? 'A required decision has not passed.'}</p>
          <Link href="/admin/agents/content-intelligence?section=research" className="mt-2 inline-flex text-xs font-semibold text-blue-700 underline dark:text-blue-200">Refresh topic evidence in Content Intelligence</Link>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><CheckCircle2 className="h-4 w-4" /> Script intelligence passed</p>
          <p className="mt-1 text-xs leading-5 text-gray-400">Current topic evidence, creator distance, and all eleven script checks passed. Render and every external action remain separately gated.</p>
        </div>
      )}

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border border-silicon-slate bg-background/45 p-3"><dt className="text-gray-500">Framework library</dt><dd className="mt-1 break-all font-medium text-gray-200">{review.framework_library_version}</dd></div>
        <div className="rounded-lg border border-silicon-slate bg-background/45 p-3"><dt className="text-gray-500">Live topic sources</dt><dd className="mt-1 font-medium text-gray-200">{review.topic_evidence.included.length} / {review.topic_evidence.minimum_sources} minimum</dd></div>
        <div className="rounded-lg border border-silicon-slate bg-background/45 p-3"><dt className="text-gray-500">Freshness window</dt><dd className="mt-1 font-medium text-gray-200">{review.topic_evidence.freshness_days} days</dd></div>
        <div className="rounded-lg border border-silicon-slate bg-background/45 p-3"><dt className="text-gray-500">Outlier threshold</dt><dd className="mt-1 font-medium text-gray-200">{review.topic_evidence.minimum_outlier_ratio.toFixed(1)}× channel baseline</dd></div>
        <div className="rounded-lg border border-silicon-slate bg-background/45 p-3"><dt className="text-gray-500">Creator distance</dt><dd className="mt-1 font-medium text-gray-200">{pretty(review.originality.status)}</dd></div>
      </dl>

      <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Script decisions</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Long-form script dimensions">
            {review.dimensions.map((dimension) => <button key={dimension.key} type="button" onClick={() => setSelectedDimension(dimension.key)} aria-pressed={selectedDimension === dimension.key} className={`rounded-lg border p-3 text-left ${selectedDimension === dimension.key ? 'border-radiant-gold bg-radiant-gold/10' : 'border-silicon-slate bg-background/45 hover:border-radiant-gold/40'}`}>
              <span className="flex items-start justify-between gap-2"><span className="text-sm font-medium text-foreground">{dimension.label}</span>{dimension.status === 'passed' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />}</span>
              <span className="mt-2 block text-xl font-semibold text-foreground">{dimension.score ?? 'Unscored'}</span>
              <span className="mt-1 block text-xs text-gray-500">{pretty(dimension.status)}</span>
            </button>)}
          </div>
        </div>

        <aside aria-live="polite" className="rounded-lg border border-silicon-slate bg-background/45 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Decision trace</p>
          <h5 className="mt-2 text-base font-semibold text-foreground">{selected.label}</h5>
          <p className="mt-2 text-sm leading-6 text-gray-300">{selected.observed}</p>
          <p className="mt-3 rounded-md border border-silicon-slate bg-imperial-navy/35 p-3 text-xs leading-5 text-gray-400">{selected.formula}</p>
          {selected.blocker ? <p className="mt-3 text-xs leading-5 text-amber-200">{selected.blocker} {selected.recovery}</p> : null}
          <p className="mt-3 break-all font-mono text-[10px] leading-4 text-gray-500">Inputs: {selected.input_ids.join(', ') || 'none'}</p>
          <p className="mt-1 break-all font-mono text-[10px] leading-4 text-gray-500">Rules: {selected.framework_rule_ids.join(', ') || 'none'}</p>
        </aside>
      </div>

      <details className="mt-3 rounded-lg border border-silicon-slate bg-background/35">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">Topic sources, exclusions, and deterministic fingerprint</summary>
        <div className="grid gap-4 border-t border-silicon-slate p-4 lg:grid-cols-2">
          <div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400"><ShieldCheck className="h-4 w-4" /> Included live sources</p><ul className="mt-2 space-y-2">{review.topic_evidence.included.map((source) => <li key={source.id} className="rounded-md border border-silicon-slate bg-background/55 p-3 text-sm"><a href={source.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-300 hover:underline">{source.label} <ExternalLink className="h-3.5 w-3.5" /></a><p className="mt-1 text-xs text-gray-500">Observed {source.observed_at.slice(0, 10)} · {source.outlier_ratio.toFixed(2)}× baseline</p></li>)}{review.topic_evidence.included.length === 0 ? <li className="text-sm text-gray-500">No live topic source passed normalization.</li> : null}</ul></div>
          <div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400"><AlertTriangle className="h-4 w-4" /> Excluded evidence</p><ul className="mt-2 space-y-2">{review.topic_evidence.excluded.map((source) => <li key={source.id} className="rounded-md border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-amber-100"><span className="font-medium">{source.label}</span><span className="mt-1 block text-xs leading-5">{source.reason}</span></li>)}{review.topic_evidence.excluded.length === 0 ? <li className="text-sm text-gray-500">No source was excluded.</li> : null}</ul></div>
        </div>
        <div className="flex flex-col gap-1 border-t border-silicon-slate px-4 py-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between"><span className="flex min-w-0 items-center gap-2 break-all"><Fingerprint className="h-3.5 w-3.5 shrink-0" /> {review.input_fingerprint}</span><span>{review.deterministic_inputs.script_version || 'No script version'}</span></div>
      </details>

      <details className="mt-3 rounded-lg border border-silicon-slate bg-background/35">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">Framework receipts and public-source boundaries</summary>
        <div className="border-t border-silicon-slate p-4">
          <p className="text-xs leading-5 text-gray-400">Raw public metadata lives in the versioned source register. Saved playlist examples guide structure only and never substitute for live topic-specific outlier evidence.</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">{LONG_FORM_FRAMEWORK_LIBRARY.rules.map((rule) => <article key={rule.id} className="rounded-lg border border-silicon-slate bg-background/55 p-3"><h5 className="text-sm font-semibold text-foreground">{rule.label}</h5><p className="mt-1 text-xs leading-5 text-gray-300">{rule.rule}</p><p className="mt-2 text-[11px] leading-5 text-gray-500">{rule.derivation_receipt}</p><p className="mt-2 text-[11px] leading-5 text-amber-200">Originality boundary: {rule.imitation_boundary}</p><div className="mt-2 flex flex-wrap gap-1">{rule.source_ids.map((sourceId) => { const source = LONG_FORM_FRAMEWORK_LIBRARY.sources.find((candidate) => candidate.id === sourceId); return source ? <a key={sourceId} href={source.url} target="_blank" rel="noreferrer" className="rounded-full border border-silicon-slate px-2 py-1 text-[10px] text-blue-300 hover:underline">{source.creator}</a> : null })}</div></article>)}</div>
        </div>
      </details>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-silicon-slate pt-3 text-xs text-gray-500"><LockKeyhole className="h-4 w-4" /><span>Still closed:</span>{['Provider', 'Render', 'Upload', 'Platform draft', 'Schedule', 'Publish', 'External send', 'Spend'].map((gate) => <span key={gate} className="rounded-full border border-silicon-slate bg-background/45 px-2 py-1">{gate}</span>)}</div>
    </section>
  )
}
