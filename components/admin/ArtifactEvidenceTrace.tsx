'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ExternalLink, FileSearch, ShieldCheck, X } from 'lucide-react'
import { ARTIFACT_EVALUATION_DIMENSIONS, type ArtifactEvaluationDimensionKey } from '@/lib/artifact-evidence-evaluation'
import {
  artifactManifestSnapshot,
  validateArtifactEvidenceManifest,
  validateYouTubePackagingEvidence,
  type ArtifactEvidenceElement,
  type ArtifactEvidenceManifest,
  type YouTubePackagingEvidenceValidation,
  type YouTubePackagingTarget,
} from '@/lib/artifact-evidence-manifest'

function compactHash(value: string) {
  return value.length > 28 ? `${value.slice(0, 18)}…${value.slice(-8)}` : value
}

const DIMENSION_LABELS: Record<ArtifactEvaluationDimensionKey, string> = {
  outlier_pattern_fit: 'Reference-pattern fit',
  source_support: 'Source support',
  core_audience_fit: 'Core-audience fit',
  timeliness: 'Timeliness',
  product_work_evidence_fit: 'Product/work evidence fit',
  originality_repetition_risk: 'Originality / repetition risk',
}

function AbsoluteEvidenceLink({ href, label, status = 'verified_openable' }: { href: string; label: string; status?: 'verified_openable' | 'blocked' }) {
  const [absoluteHref, setAbsoluteHref] = useState(href.startsWith('https://') ? href : '')
  useEffect(() => {
    try {
      setAbsoluteHref(new URL(href, window.location.origin).toString())
    } catch {
      setAbsoluteHref('')
    }
  }, [href])
  const verified = status === 'verified_openable' && Boolean(absoluteHref)
  return (
    <div className="space-y-1">
      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${verified ? 'border-emerald-600/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100' : 'border-red-600/35 bg-red-500/10 text-red-900 dark:text-red-100'}`}>
        {verified ? 'Verified / openable' : 'Blocked / not openable'}
      </span>
      {verified ? <a href={absoluteHref} target="_blank" rel="noreferrer" className="block break-all font-semibold text-sky-900 underline-offset-4 hover:underline dark:text-sky-100"><ExternalLink className="mr-1 inline h-3 w-3" />{label}: {absoluteHref}</a> : <p className="break-all text-red-800 dark:text-red-200">{label}: {href || 'Missing URL'}</p>}
    </div>
  )
}

function ElementEvaluationScorecard({ element }: { element: ArtifactEvidenceElement }) {
  const receipt = element.evaluation_receipt
  if (!receipt) return null
  return (
    <section aria-label={`${element.label} numerical evaluation`} className="mt-3 rounded-lg border border-sky-600/30 bg-sky-500/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-sky-800 dark:text-sky-200">Numerical evaluation</p>
          <p className="mt-1 text-xs text-muted-foreground">{receipt.weighting_version} · {receipt.version}</p>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${receipt.overall.score == null ? 'border-amber-600/35 bg-amber-500/10 text-amber-900 dark:text-amber-100' : 'border-emerald-600/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'}`}>
          {receipt.overall.score == null ? 'Unscored · hold' : `${receipt.overall.score}/100 · ${receipt.overall.recommendation}`}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{receipt.overall.rationale}</p>
      <div className="mt-2 grid gap-2">{receipt.overall.source_receipts.map((source) => <AbsoluteEvidenceLink key={source.receipt_id} href={source.href} label={source.receipt_id} />)}</div>
      <div className="mt-3 space-y-2">
        {ARTIFACT_EVALUATION_DIMENSIONS.map((key) => {
          const dimension = receipt.dimensions[key]
          return (
            <details key={key} className="rounded-md border border-border bg-background p-2.5">
              <summary className="cursor-pointer list-none">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-foreground">{DIMENSION_LABELS[key]}</span>
                  <span className={`shrink-0 text-xs font-bold ${dimension.score == null ? 'text-amber-700 dark:text-amber-200' : 'text-foreground'}`}>
                    {dimension.score == null ? 'Unscored' : `${dimension.score}/100`}
                  </span>
                </span>
                <span className="mt-1 block text-[10px] text-muted-foreground">{dimension.basis.replaceAll('_', ' ')} · weight {dimension.weight}% · threshold {dimension.threshold} · {dimension.direction.replaceAll('_', ' ')}</span>
              </summary>
              <div className="mt-2 space-y-2 border-t border-border pt-2 text-[11px] leading-5 text-muted-foreground">
                <p>{dimension.rationale}</p>
                <p>Percentile: <span className="font-medium text-foreground">{dimension.percentile ?? 'Unavailable'}</span> · Rank: <span className="font-medium text-foreground">{dimension.rank ? `${dimension.rank.position} of ${dimension.rank.total}` : 'Unavailable'}</span></p>
                {dimension.deterministic_inputs.length > 0 && (
                  <div><p className="font-semibold text-foreground">Deterministic inputs</p><ul>{dimension.deterministic_inputs.map((input) => <li key={`${input.name}-${input.receipt_id}`}>{input.name}: {input.value} · <span className="font-mono">{input.receipt_id}</span></li>)}</ul></div>
                )}
                {dimension.source_receipts.length > 0 && (
                  <div className="grid gap-2">{dimension.source_receipts.map((source) => <AbsoluteEvidenceLink key={source.receipt_id} href={source.href} label={source.receipt_id} />)}</div>
                )}
              </div>
            </details>
          )
        })}
      </div>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <dt>Cohort</dt><dd className="font-medium text-foreground">{receipt.benchmark_cohort.cohort_id ?? 'Unavailable'} · {receipt.benchmark_cohort.status}</dd>
        <dt>Sample</dt><dd className="font-medium text-foreground">{receipt.benchmark_cohort.sample_size ?? 'Unavailable'}</dd>
        <dt>Observed</dt><dd className="font-medium text-foreground">{receipt.benchmark_cohort.observed_from && receipt.benchmark_cohort.observed_to ? `${receipt.benchmark_cohort.observed_from} – ${receipt.benchmark_cohort.observed_to}` : 'Unavailable'}</dd>
        <dt>Fresh until</dt><dd className="font-medium text-foreground">{receipt.benchmark_cohort.fresh_until ?? 'Unavailable'}</dd>
        <dt>Confidence</dt><dd className="font-medium text-foreground">{receipt.overall.confidence_score == null ? 'Unscored' : `${receipt.overall.confidence_score}/100`} · {receipt.overall.confidence_label}</dd>
        <dt>Receipt</dt><dd className="break-all font-mono text-foreground">{receipt.receipt_id}</dd>
      </dl>
    </section>
  )
}

function PackagingArtifactEvidence({ element, label }: { element: ArtifactEvidenceElement; label: 'Title' | 'Thumbnail' }) {
  const receipt = element.evaluation_receipt
  const observedInputs = receipt
    ? ARTIFACT_EVALUATION_DIMENSIONS.flatMap((key) => receipt.dimensions[key].deterministic_inputs)
    : []
  return (
    <details className="rounded-lg border border-border bg-background p-3">
      <summary className="cursor-pointer list-none">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">{label} evidence</span>
          <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${receipt?.overall.score == null ? 'border-amber-600/35 bg-amber-500/10 text-amber-900 dark:text-amber-100' : 'border-emerald-600/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'}`}>
            {receipt?.overall.score == null ? 'Unscored · hold' : `${receipt.overall.score}/100 · threshold ${receipt.overall.threshold}`}
          </span>
        </span>
        <span className="mt-1 block break-words text-xs text-muted-foreground">{element.input_excerpt || `${label} value missing`}</span>
      </summary>
      <div className="mt-3 space-y-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
          <dt>Evidence-fit score</dt><dd className="font-semibold text-foreground">{receipt?.overall.score == null ? 'Unscored' : `${receipt.overall.score}/100`}</dd>
          <dt>Required threshold</dt><dd className="font-semibold text-foreground">{receipt ? `${receipt.overall.threshold}/100` : 'Missing'}</dd>
          <dt>Cohort identity</dt><dd className="break-all font-mono text-[11px] text-foreground">{receipt?.benchmark_cohort.cohort_id ?? 'Missing'}</dd>
          <dt>Sample size</dt><dd className="font-medium text-foreground">{receipt?.benchmark_cohort.sample_size ?? 'Missing'}</dd>
          <dt>Observed window</dt><dd className="font-medium text-foreground">{receipt?.benchmark_cohort.observed_from && receipt.benchmark_cohort.observed_to ? `${receipt.benchmark_cohort.observed_from} – ${receipt.benchmark_cohort.observed_to}` : 'Missing'}</dd>
          <dt>Fresh until</dt><dd className="font-medium text-foreground">{receipt?.benchmark_cohort.fresh_until ?? 'Missing'}</dd>
          <dt>Receipt identity</dt><dd className="break-all font-mono text-[11px] text-foreground">{receipt?.receipt_id || 'Missing'}</dd>
          <dt>Content version</dt><dd className="break-all font-mono text-[11px] text-foreground">{element.content_version || 'Missing'}</dd>
          <dt>Version hash</dt><dd className="break-all font-mono text-[11px] text-foreground">{element.version_hash || 'Missing'}</dd>
          <dt>Product proof</dt><dd className="font-medium text-foreground">{element.source_identity || 'Missing'} · {element.source_record_type.replaceAll('_', ' ') || 'source type missing'}</dd>
        </dl>
        <p className="rounded-md border border-border bg-muted/30 p-2.5">This score measures conformance to the recorded evidence-backed packaging criteria. It does not predict click-through rate, views, or platform performance.</p>
        <div className="rounded-md border border-border bg-muted/30 p-2.5">
          <p className="font-semibold text-foreground">Formula and decision logic</p>
          <p className="mt-1">Weighted normalized score = Σ(direction-normalized dimension score × weight) ÷ 100. Advance only when every dimension is scored, the cohort is current and attributable, and the result meets the recorded threshold.</p>
          <p className="mt-1">{receipt?.overall.rationale || 'No versioned decision rationale is attached.'}</p>
        </div>
        <div>
          <p className="font-semibold text-foreground">Observed values</p>
          {observedInputs.length ? (
            <ul className="mt-1 space-y-1">{observedInputs.map((input, index) => <li key={`${input.receipt_id}-${input.name}-${index}`}>{input.name}: <span className="font-medium text-foreground">{input.value}</span> · <span className="font-mono text-[11px]">{input.receipt_id}</span></li>)}</ul>
          ) : <p className="mt-1">No scored deterministic observations are attached.</p>}
        </div>
        <div className="grid gap-2">
          {element.authoritative_href && <AbsoluteEvidenceLink href={element.authoritative_href} label="Product/source lineage" />}
          {receipt?.overall.source_receipts.map((source) => <AbsoluteEvidenceLink key={source.receipt_id} href={source.href} label={source.receipt_id} />)}
        </div>
        {element.research_cohort && <ThumbnailResearchEvidence cohort={element.research_cohort} />}
      </div>
    </details>
  )
}

function metric(value: number | null, suffix = '') {
  return value == null ? 'Unavailable' : `${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}${suffix}`
}

function ThumbnailResearchEvidence({ cohort }: { cohort: NonNullable<ArtifactEvidenceElement['research_cohort']> }) {
  const publicSources = cohort.samples.filter((sample) => sample.decision === 'included')
  const excluded = cohort.samples.filter((sample) => sample.decision === 'excluded')
  const neighborCard = (neighbor: NonNullable<typeof cohort.candidate>, role: string) => (
    <article key={neighbor.id} className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="relative aspect-[9/16] bg-slate-950"><Image src={neighbor.artifact_url} alt={`${role}: ${neighbor.label}`} fill sizes="(max-width: 640px) 50vw, 240px" className="object-contain" /></div>
      <div className="space-y-2 p-2.5">
        <p className="font-semibold text-foreground">{neighbor.label}</p>
        {neighbor.width && neighbor.height && <p>{neighbor.width}×{neighbor.height} · {neighbor.aspect_ratio ?? 'ratio unavailable'}</p>}
        <p className={`font-semibold ${neighbor.supports_candidate_composition ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-800 dark:text-red-200'}`}>{neighbor.supports_candidate_composition ? 'Supports candidate composition' : 'Does not support candidate composition'}</p>
        <p>{neighbor.support_reason}</p>
        <AbsoluteEvidenceLink href={neighbor.source_url} label="Open source" status={neighbor.link_status} />
      </div>
    </article>
  )
  return (
    <details className="rounded-lg border border-violet-600/30 bg-violet-500/5 p-3" data-testid="youtube-thumbnail-research-cohort">
      <summary className="cursor-pointer list-none">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-foreground">Visual-neighbor comparison and source map</span>
          <span className="rounded-full border border-violet-600/30 px-2 py-1 text-[10px] font-semibold uppercase text-violet-900 dark:text-violet-100">9:16 candidate · {cohort.first_party_neighbors.length} first-party · {publicSources.length} live topic sources</span>
        </span>
        <span className="mt-1 block text-[11px] text-muted-foreground">{cohort.target} · observed {cohort.observed_at}</span>
      </summary>
      <div className="mt-3 space-y-4 border-t border-border pt-3">
        <div className="rounded-md border border-amber-600/35 bg-amber-500/10 p-3">
          <p className="font-semibold text-amber-950 dark:text-amber-100">Evidence boundary</p>
          <p className="mt-1">{cohort.public_outlier_boundary}</p>
          <p className="mt-2">Public outlier rule: <span className="font-mono text-foreground">{cohort.outlier_rule}</span>.</p>
          <ul className="mt-1 space-y-1">{cohort.formula.map((formula) => <li key={formula}>• {formula}</li>)}</ul>
        </div>
        <div className="rounded-md border border-violet-600/30 bg-background p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-foreground">Candidate title + thumbnail copy pair</p>
            <span className="rounded-full border border-border px-2 py-1 text-[10px] font-semibold uppercase text-foreground">{cohort.candidate_copy_pair.relationship.replaceAll('_', ' ')}</span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-border p-2"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Published title</p><p className="mt-1 font-semibold text-foreground">{cohort.candidate_copy_pair.title}</p></div>
            <div className="rounded-md border border-border p-2"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Thumbnail hook</p><p className="mt-1 font-semibold text-foreground">{cohort.candidate_copy_pair.thumbnail_hook}</p></div>
          </div>
          <p className="mt-2">Exact strings distinct: <span className="font-semibold text-foreground">{cohort.candidate_copy_pair.exact_strings_are_distinct ? 'Yes' : 'No'}</span> · strategy status: {cohort.candidate_copy_pair.strategy_status.replaceAll('_', ' ')}</p>
          <p className="mt-1">{cohort.candidate_copy_pair.rationale}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">Source examples: {cohort.candidate_copy_pair.source_example_video_ids.join(', ')}</p>
        </div>
        <div className="rounded-md border border-amber-600/35 bg-amber-500/10 p-3" data-testid="copy-pair-analysis">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-foreground">Copy-pair heuristic</p><span className="rounded-full border border-amber-700/40 px-2 py-1 text-[10px] font-semibold uppercase text-amber-950 dark:text-amber-100">{cohort.copy_pair_analysis.status}</span></div>
          <p className="mt-1">{cohort.copy_pair_analysis.hypothesis}</p>
          <p className="mt-2 font-mono text-[10px] text-foreground">{cohort.copy_pair_analysis.comparison_formula}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-background p-2"><p className="font-semibold text-foreground">Duplicate / near-duplicate</p><p>n={cohort.copy_pair_analysis.repeated_group.sample_size}; minimum={cohort.copy_pair_analysis.repeated_group.minimum_sample_size}; median score={metric(cohort.copy_pair_analysis.repeated_group.median_normalized_performance_score)}</p></div>
            <div className="rounded-md border border-border bg-background p-2"><p className="font-semibold text-foreground">Distinct complementary</p><p>n={cohort.copy_pair_analysis.distinct_group.sample_size}; minimum={cohort.copy_pair_analysis.distinct_group.minimum_sample_size}; median score={metric(cohort.copy_pair_analysis.distinct_group.median_normalized_performance_score)}</p></div>
          </div>
          <p className="mt-2">Observed median difference: {metric(cohort.copy_pair_analysis.observed_difference)} points <span className="font-semibold text-amber-950 dark:text-amber-100">(descriptive only)</span>.</p>
          <p className="mt-1 font-semibold text-foreground">{cohort.copy_pair_analysis.limitation}</p>
        </div>
        <div>
          <p className="font-semibold text-foreground">Side-by-side visual neighbors</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {cohort.first_party_neighbors.map((neighbor) => neighborCard(neighbor, 'Approved first-party baseline'))}
            {cohort.candidate && neighborCard(cohort.candidate, 'Current candidate')}
          </div>
        </div>
        <div>
          <p className="font-semibold text-foreground">Live topic copy-pair sources ({publicSources.length})</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {publicSources.map((sample) => (
              <article key={sample.video_id} className="overflow-hidden rounded-lg border border-border bg-background">
                {sample.thumbnail_path && <div className="relative aspect-[9/16] bg-slate-950"><Image src={sample.thumbnail_path} alt={`Public YouTube Short thumbnail from ${sample.creator}: ${sample.title}`} fill sizes="(max-width: 640px) 50vw, 220px" className="object-cover" /></div>}
                <div className="space-y-1.5 p-2.5">
                  <p className="font-semibold text-foreground">{sample.creator}</p>
                  <p><span className="font-semibold text-foreground">Exact title:</span> {sample.title}</p>
                  <p><span className="font-semibold text-foreground">Exact thumbnail text:</span> {sample.thumbnail_text_transcription_status === 'verified' ? sample.thumbnail_text.join(' / ') || 'No visible thumbnail text' : 'Unreadable — not inferred'}</p>
                  {sample.description_opening && <p><span className="font-semibold text-foreground">Description opening:</span> {sample.description_opening}{sample.description_opening_truncated ? '…' : ''}</p>}
                  <p>Relationship: <span className="font-semibold text-foreground">{sample.title_thumbnail_relationship.replaceAll('_', ' ')}</span> · text length {sample.thumbnail_text_length} · hook {sample.hook_type.replaceAll('_', ' ')}</p>
                  <p>{metric(sample.view_count)} views · {metric(sample.subscriber_count)} subscribers · {metric(sample.duration_seconds, 's')}</p>
                  <p>Channel baseline n={metric(sample.channel_baseline_size)} · relative {metric(sample.channel_relative_ratio, '×')} · audience/view {metric(sample.audience_view_ratio)} · views/day {metric(sample.recency_adjusted_views_per_day)}</p>
                  <p>Normalized score <span className="font-semibold text-foreground">{metric(sample.normalized_performance_score)}/100</span></p>
                  <p className="font-semibold text-red-800 dark:text-red-200">Does not support candidate composition</p>
                  <p>{sample.composition_support_reason}</p>
                  <p>Traits: {Object.entries(sample.visual_traits).map(([name, value]) => `${name.replaceAll('_', ' ')}=${value ? 'yes' : 'no'}`).join(' · ')}</p>
                  <p>{sample.decision_reason}</p>
                  <p>Published {sample.published_at || 'Unavailable'} · observed {sample.observed_at}</p>
                  {sample.transcription_provenance && <p className="break-all text-[10px] text-muted-foreground">Transcription: {sample.transcription_provenance.method} · {sample.transcription_provenance.captured_thumbnail_sha256}</p>}
                  <AbsoluteEvidenceLink href={sample.youtube_url} label="Public Short" status={sample.link_status} />
                  {sample.source_thumbnail_url && <AbsoluteEvidenceLink href={sample.source_thumbnail_url} label="Source thumbnail" status={sample.link_status} />}
                </div>
              </article>
            ))}
          </div>
        </div>
        <div>
          <p className="font-semibold text-foreground">Candidate element bindings</p>
          <div className="mt-2 overflow-x-auto rounded-md border border-border bg-background">
            <table className="min-w-full text-left text-[11px]">
              <thead className="border-b border-border bg-muted/40 text-foreground"><tr><th className="p-2">Element</th><th className="p-2">Source</th><th className="p-2">Support</th><th className="p-2">Boundary</th></tr></thead>
              <tbody>{cohort.element_bindings.map((binding) => <tr key={binding.element} className="border-b border-border last:border-0"><td className="p-2 font-semibold text-foreground">{binding.element.replaceAll('_', ' ')}</td><td className="p-2"><AbsoluteEvidenceLink href={binding.source_url} label={binding.source_label} status={binding.link_status} /></td><td className={`p-2 font-semibold ${binding.support === 'supports' ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-800 dark:text-red-200'}`}>{binding.support.replaceAll('_', ' ')}</td><td className="p-2">{binding.limitation}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <details className="rounded-md border border-border bg-background p-2.5">
          <summary className="cursor-pointer font-semibold text-foreground">First-party design decision</summary>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <div><p className="font-semibold text-foreground">Supported traits</p><ul className="mt-1 space-y-1">{cohort.adopted_traits.map((trait) => <li key={trait}>• {trait}</li>)}</ul></div>
            <div><p className="font-semibold text-foreground">Unsupported or rejected</p><ul className="mt-1 space-y-1">{cohort.rejected_traits.map((trait) => <li key={trait}>• {trait}</li>)}</ul></div>
          </div>
          <p className="mt-3">{cohort.composition_decision}</p>
        </details>
        <details className="rounded-md border border-border bg-background p-2.5">
          <summary className="cursor-pointer font-semibold text-foreground">Excluded sources ({excluded.length})</summary>
          <ul className="mt-2 space-y-2">{excluded.map((sample) => <li key={sample.video_id}><AbsoluteEvidenceLink href={sample.youtube_url} label={`${sample.creator} · ${sample.title}`} status={sample.link_status} /><span className="block">{sample.decision_reason} · {metric(sample.duration_seconds, 's')} · {metric(sample.view_count)} views · observed {sample.observed_at}</span></li>)}</ul>
        </details>
        <p className="break-all font-mono text-[10px] text-muted-foreground">{cohort.cohort_id}</p>
      </div>
    </details>
  )
}

function YouTubePackagingReview({ validation }: { validation: YouTubePackagingEvidenceValidation }) {
  const label = validation.target === 'youtube_shorts' ? 'YouTube Shorts' : 'YouTube'
  return (
    <section aria-label={`${label} packaging evidence`} className={`mt-4 rounded-xl border p-4 ${validation.ready ? 'border-emerald-600/35 bg-emerald-500/5' : 'border-amber-600/40 bg-amber-500/5'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label} asset-package review</p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">Customer-facing title and bound thumbnail</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Review the words and the actual image together. Evidence details stay collapsed until needed.</p>
        </div>
        <span role="status" className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${validation.ready ? 'border-emerald-600/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100' : validation.pairBound ? 'border-amber-600/35 bg-amber-500/10 text-amber-950 dark:text-amber-100' : 'border-red-600/35 bg-red-500/10 text-red-900 dark:text-red-100'}`}>
          {validation.ready ? 'Asset-package evidence ready' : validation.pairBound ? 'Pair binding passed · scoring hold' : 'Asset package blocked'}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(320px,1.18fr)] lg:items-start">
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Customer-facing title</p>
          <p className="mt-2 text-xl font-semibold leading-7 text-foreground">{validation.title?.input_excerpt || 'Title missing'}</p>
          <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Thumbnail headline</p>
          <p className="mt-1 text-base font-bold text-foreground">{validation.thumbnail?.input_excerpt || 'Headline missing'}</p>
        </div>
        {validation.thumbnail?.artifact_url ? (
          <div className={`relative mx-auto w-full overflow-hidden rounded-lg border border-border bg-slate-950 ${validation.target === 'youtube_shorts' ? 'max-w-sm aspect-[9/16]' : 'aspect-video'}`} data-testid="youtube-packaging-thumbnail">
            <Image src={validation.thumbnail.artifact_url} alt={`${label} bound thumbnail: ${validation.thumbnail.input_excerpt}`} fill sizes="(max-width: 1024px) 100vw, 640px" className="object-contain" />
          </div>
        ) : (
          <div role="img" aria-label={`${label} thumbnail missing`} className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-red-500/45 bg-red-500/5 p-5 text-center text-sm font-semibold text-red-900 dark:text-red-100">
            No actual thumbnail is bound. The packet cannot be asset-package ready.
          </div>
        )}
      </div>

      {!validation.ready && (
        <div role="alert" className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-red-500/35 bg-red-500/10 p-3">
            <p className="text-sm font-semibold text-red-900 dark:text-red-100">Specific blockers</p>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-red-900/90 dark:text-red-100/90">{validation.blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}</ul>
          </div>
          <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-3">
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Recovery actions</p>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-950/90 dark:text-amber-100/90">{validation.recoveryActions.map((action) => <li key={action}>• {action}</li>)}</ul>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {validation.title && <PackagingArtifactEvidence element={validation.title} label="Title" />}
        {validation.thumbnail && <PackagingArtifactEvidence element={validation.thumbnail} label="Thumbnail" />}
      </div>
    </section>
  )
}

function SourceLineageDetail({ element, number, onClose }: {
  element: ArtifactEvidenceElement
  number: number
  onClose: () => void
}) {
  return (
    <aside aria-label={`Trace ${number} evidence detail`} className="rounded-lg border border-amber-600/35 bg-background p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-200">Trace {number} · {element.category.replaceAll('_', ' ')}</p>
          <h4 className="mt-1 text-sm font-semibold text-foreground">{element.label}</h4>
        </div>
        <button type="button" aria-label="Close trace detail" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 rounded-md border border-border bg-muted/30 p-2.5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Bounded input</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{element.redacted ? '[Private source withheld — approved summary only]' : `“${element.input_excerpt}”`}</p>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <dt>Source</dt><dd className="break-words font-medium text-foreground">{element.source_identity}</dd>
        <dt>Record</dt><dd className="font-medium text-foreground">{element.source_record_type.replaceAll('_', ' ')}</dd>
        <dt>Evidence</dt><dd className="break-all font-mono text-[11px] text-foreground">{element.evidence_receipt_ids.join(' · ') || 'Missing'}</dd>
        <dt>Version</dt><dd className="break-all font-mono text-[11px] text-foreground">{compactHash(element.version_hash)}</dd>
        <dt>Rights/privacy</dt><dd className="font-medium text-foreground">{element.rights_privacy_status} · {element.rights_privacy_receipt_ids.join(' · ') || 'receipt missing'}</dd>
        <dt>Transform</dt><dd className="font-medium text-foreground">{element.transformation_step}</dd>
        <dt>Visibility</dt><dd className="font-medium text-foreground">{element.customer_facing ? 'Customer-facing' : 'Review-only'}{element.redacted ? ' · redacted' : ''}</dd>
      </dl>
      <ElementEvaluationScorecard element={element} />
      {element.authoritative_href ? (
        <Link href={element.authoritative_href} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-600/45 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:bg-amber-300/10 dark:text-amber-100 dark:hover:bg-amber-300/15">
          <ExternalLink className="h-4 w-4" /> Open authoritative evidence
        </Link>
      ) : (
        <p className="mt-3 rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">No raw private source link is exposed. Use the approved review record named above.</p>
      )}
    </aside>
  )
}

function VisualSourceTrace({ manifest, selectedId, onSelect }: {
  manifest: ArtifactEvidenceManifest
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const regions = manifest.elements.filter((element) => element.region)
  return (
    <>
      {regions.map((element) => {
        const number = manifest.elements.findIndex((candidate) => candidate.id === element.id) + 1
        return (
          <button
            key={element.id}
            type="button"
            aria-label={`Trace ${number}: ${element.label}`}
            aria-pressed={selectedId === element.id}
            onClick={() => onSelect(element.id)}
            style={{ left: `${element.region!.x}%`, top: `${element.region!.y}%` }}
            className={`absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 ${element.rights_privacy_status === 'passed' ? 'bg-emerald-600' : 'bg-red-600'}`}
          >
            {number}
          </button>
        )
      })}
    </>
  )
}

export default function ArtifactEvidenceTrace({ manifest: rawManifest, currentContentVersion, recordedSnapshot, evaluationAsOf, packagingTarget }: {
  manifest: unknown
  currentContentVersion: string
  evaluationAsOf?: string
  packagingTarget?: YouTubePackagingTarget
  recordedSnapshot?: { manifest_id?: string; manifest_hash?: string; content_version?: string; evaluation_receipt_version?: string | null; evaluation_receipt_ids?: string[] } | null
}) {
  const validation = useMemo(() => validateArtifactEvidenceManifest(rawManifest, currentContentVersion, evaluationAsOf), [currentContentVersion, evaluationAsOf, rawManifest])
  const manifest = validation.manifest
  const packagingValidation = useMemo(
    () => packagingTarget ? validateYouTubePackagingEvidence(rawManifest, currentContentVersion, packagingTarget, evaluationAsOf) : null,
    [currentContentVersion, evaluationAsOf, packagingTarget, rawManifest],
  )
  const [traceEnabled, setTraceEnabled] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  if (!manifest) return null

  const selected = manifest.elements.find((element) => element.id === selectedId) ?? null
  const currentSnapshot = artifactManifestSnapshot(manifest)
  const recordedMatches = recordedSnapshot
    ? recordedSnapshot.manifest_id === manifest.manifest_id
      && recordedSnapshot.manifest_hash === manifest.manifest_hash
      && recordedSnapshot.evaluation_receipt_version === currentSnapshot?.evaluation_receipt_version
      && JSON.stringify([...(recordedSnapshot.evaluation_receipt_ids ?? [])].sort()) === JSON.stringify(currentSnapshot?.evaluation_receipt_ids ?? [])
    : null

  return (
    <section aria-labelledby="artifact-evidence-heading" data-testid="artifact-evidence-trace" className="min-w-0 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200"><FileSearch className="h-4 w-4" /> Artifact evidence</p>
          <h2 id="artifact-evidence-heading" className="mt-1 text-xl font-semibold text-foreground">{manifest.artifact_label}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Inspect what produced this customer-facing artifact without exposing private conversations, internal prompts, secrets, or implementation logic.</p>
        </div>
        <button
          type="button"
          aria-pressed={traceEnabled}
          aria-controls="artifact-evidence-trace-list"
          onClick={() => { setTraceEnabled((value) => !value); setSelectedId(null) }}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-600/45 bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <FileSearch className="h-4 w-4 text-amber-700 dark:text-amber-300" /> Trace evidence
          <span className="text-xs text-muted-foreground">{traceEnabled ? 'On' : 'Off'}</span>
        </button>
      </div>

      {!validation.ready && (
        <div role="alert" className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-900 dark:text-red-100"><AlertTriangle className="h-4 w-4" /> Evidence gate blocked</p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-red-900/90 dark:text-red-100/90">{validation.blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}</ul>
        </div>
      )}

      {recordedSnapshot && (
        <div className={`mt-4 rounded-lg border p-3 text-xs ${recordedMatches ? 'border-emerald-600/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100' : 'border-amber-600/35 bg-amber-500/10 text-amber-950 dark:text-amber-100'}`}>
          <p className="font-semibold">Recorded decision manifest {recordedMatches ? 'matches this artifact' : 'preserved from an earlier content version'}</p>
          <p className="mt-1 break-all font-mono">{recordedSnapshot.manifest_id} · {compactHash(recordedSnapshot.manifest_hash || '')} · {recordedSnapshot.content_version}</p>
          {recordedSnapshot.evaluation_receipt_version && <p className="mt-1 break-all font-mono">{recordedSnapshot.evaluation_receipt_version} · {(recordedSnapshot.evaluation_receipt_ids ?? []).join(' · ') || 'no evaluation receipt ids'}</p>}
        </div>
      )}

      {packagingValidation && <YouTubePackagingReview validation={packagingValidation} />}

      {manifest.preview_url && (
        <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-lg border border-border bg-slate-950" data-testid="artifact-trace-canvas">
          <Image src={manifest.preview_url} alt={manifest.preview_alt} fill sizes="(max-width: 800px) 100vw, 900px" className="object-contain" />
          {traceEnabled && <VisualSourceTrace manifest={manifest} selectedId={selectedId} onSelect={setSelectedId} />}
        </div>
      )}

      {traceEnabled && (
        <div id="artifact-evidence-trace-list" className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-2" aria-label="Artifact trace list">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Trace list</p>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${validation.ready ? 'border-emerald-600/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100' : 'border-red-600/35 bg-red-500/10 text-red-800 dark:text-red-100'}`}>
                {validation.ready ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{validation.ready ? 'Receipt complete' : 'Fail closed'}
              </span>
            </div>
            {manifest.elements.map((element, index) => (
              <button
                key={element.id}
                type="button"
                onClick={() => setSelectedId(element.id)}
                aria-pressed={selectedId === element.id}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${selectedId === element.id ? 'border-amber-600 bg-amber-50 dark:bg-amber-300/10' : 'border-border bg-background hover:bg-muted'}`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${element.rights_privacy_status === 'passed' ? 'bg-emerald-600' : 'bg-red-600'}`}>{index + 1}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-foreground">{element.label}</span><span className="block text-[11px] capitalize text-muted-foreground">{element.category.replaceAll('_', ' ')} · {element.customer_facing ? 'customer-facing' : 'review-only'}</span></span>
                {element.evaluation_receipt && <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{element.evaluation_receipt.overall.score == null ? 'Unscored' : `${element.evaluation_receipt.overall.score}/100`}</span>}
              </button>
            ))}
          </div>
          <div>{selected ? <SourceLineageDetail element={selected} number={manifest.elements.findIndex((element) => element.id === selected.id) + 1} onClose={() => setSelectedId(null)} /> : <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground"><ShieldCheck className="mr-2 h-4 w-4" /> Select a numbered region or trace-list item to inspect its proof.</div>}</div>
        </div>
      )}

      <details className="mt-4 rounded-lg border border-border bg-background p-3 text-xs">
        <summary className="cursor-pointer font-semibold text-foreground">Manifest identity and final output hashes</summary>
        <div className="mt-3 space-y-1 text-muted-foreground">
          <p className="break-all">Manifest: <span className="font-mono text-foreground">{manifest.manifest_id}</span></p>
          <p className="break-all">Hash: <span className="font-mono text-foreground">{manifest.manifest_hash}</span></p>
          {manifest.final_output_hashes.map((entry) => <p key={entry.label} className="break-all">{entry.label}: <span className="font-mono text-foreground">{entry.sha256}</span></p>)}
        </div>
      </details>
    </section>
  )
}
