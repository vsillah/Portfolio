'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Search, Youtube } from 'lucide-react'
import {
  buildYouTubeOutlierDescriptionLibrary,
  type YouTubeDescriptionRemediationReceipt,
} from '@/lib/youtube-outlier-description-library'

type View = 'samples' | 'structure' | 'logic'

const SAMPLE_PAGE_SIZE = 4

function value(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function data(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []
}

function formatDate(valueToFormat: unknown) {
  const parsed = Date.parse(value(valueToFormat))
  return Number.isFinite(parsed) ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(parsed) : 'Missing'
}

function formatKey(valueToFormat: string) {
  return valueToFormat.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase())
}

function capturedDescription(packet: Record<string, unknown>) {
  const metadata = data(packet.actor_metadata)
  const pattern = data(packet.pattern_packet)
  return value(metadata.source_description)
    || value(metadata.source_description_excerpt)
    || value(pattern.source_description)
}

const decisionStyles = {
  passed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  failed: 'border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200',
  not_evaluated: 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-200',
  not_applicable: 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-200',
} as const

const decisionLabels = {
  passed: 'Passed',
  failed: 'Failed',
  not_evaluated: 'Not evaluated',
  not_applicable: 'Not applicable',
} as const

export default function YouTubeDescriptionLibrary({
  researchPackets,
  initialTopic = '',
  generatedAt,
  priorRemediationReceipts = [],
}: {
  researchPackets: unknown[]
  initialTopic?: string
  generatedAt: string
  priorRemediationReceipts?: YouTubeDescriptionRemediationReceipt[]
}) {
  const [topic, setTopic] = useState(initialTopic)
  const [view, setView] = useState<View>('samples')
  const [samplePage, setSamplePage] = useState(1)
  const youtubePackets = useMemo(() => researchPackets.filter((packet) => {
    const platform = value(data(packet).platform)
    return platform === 'youtube' || platform === 'youtube_shorts'
  }), [researchPackets])
  const approvedDescriptions = useMemo(() => youtubePackets.filter((packet) => {
    const item = data(packet)
    return value(item.pattern_status) === 'usable_framework'
      && Boolean(capturedDescription(item) && value(data(item.actor_metadata).description_provenance))
  }).length, [youtubePackets])
  const scoredDescriptions = useMemo(() => youtubePackets.filter((packet) => {
    const item = data(packet)
    return typeof item.outlier_score === 'number' && item.outlier_score >= 65
  }).length, [youtubePackets])
  const receipt = useMemo(() => buildYouTubeOutlierDescriptionLibrary({
    researchPackets,
    targetTopics: topic ? [topic] : [],
    generatedAt,
    priorRemediationReceipts,
  }), [generatedAt, priorRemediationReceipts, researchPackets, topic])

  const sampleRows = useMemo(() => {
    const includedById = new Map(receipt.sources.map((source) => [source.source_id, source]))
    const excludedById = new Map(receipt.excluded_sources.map((source) => [source.source_id, source]))
    return youtubePackets.map((packet) => {
      const item = data(packet)
      const id = value(item.id) || value(item.source_url) || value(item.title)
      const included = includedById.get(id)
      const excluded = excludedById.get(id)
      const remediation = receipt.remediation_receipts.find((candidate) => candidate.source_id === id && candidate.status !== 'resolved')
      const metrics = data(item.metrics)
      const metadata = data(item.actor_metadata)
      const scoreBreakdown = data(item.score_breakdown)
      const topics = [
        ...strings(item.topics),
        ...strings(metadata.topics),
        ...strings(metadata.topic_ids),
        ...strings(metadata.entity_identities),
      ]
      return {
        id,
        title: value(metadata.source_title) || value(item.title) || 'Untitled YouTube source',
        creator: value(item.creator_name) || value(item.creator_handle) || 'Unknown creator',
        sourceUrl: value(item.source_url),
        thumbnailUrl: value(item.thumbnail_url),
        description: capturedDescription(item),
        descriptionProvenance: value(metadata.description_provenance),
        descriptionIsExcerpt: Boolean(value(metadata.source_description_excerpt) && !value(metadata.source_description)),
        packetSummary: value(item.caption),
        outlierScore: numberValue(item.outlier_score),
        patternStatus: value(item.pattern_status) || 'Missing',
        packetStatus: value(item.status) || 'Missing',
        publishedAt: value(metrics.published_at) || value(item.published_at),
        retrievedAt: value(item.retrieved_at),
        audienceSize: numberValue(metrics.follower_count) ?? numberValue(metrics.subscriber_count),
        topics: [...new Set(topics)],
        included,
        remediation,
        gateDecisions: included?.gate_decisions ?? excluded?.gate_decisions ?? [],
        reason: excluded?.reason ?? (included ? 'Cleared every gate and was selected for the comparison cohort.' : 'Qualified but fell outside the ranked cohort limit.'),
        fixture: metadata.qa_fixture === true,
        publicSnapshot: metadata.public_evidence_snapshot === true,
        collector: value(metadata.collector),
        discoveryQuery: value(metadata.query),
        datasetId: value(metadata.dataset_id),
        observedAt: value(metadata.observed_at),
        cohortSize: numberValue(metadata.cohort_size),
        cohortMedian: numberValue(metadata.cohort_median_view_to_follower_ratio),
        publicSummaryOnly: metadata.public_summary_only === true,
        scoreBreakdown,
      }
    })
  }, [receipt, youtubePackets])
  const pageCount = Math.max(1, Math.ceil(sampleRows.length / SAMPLE_PAGE_SIZE))
  const safeSamplePage = Math.min(samplePage, pageCount)
  const visibleSamples = sampleRows.slice((safeSamplePage - 1) * SAMPLE_PAGE_SIZE, safeSamplePage * SAMPLE_PAGE_SIZE)

  const metrics = [
    { label: 'All samples', value: youtubePackets.length, target: 'samples' as const },
    { label: 'Approved descriptions', value: approvedDescriptions, target: 'samples' as const },
    { label: 'Outlier score 65+', value: scoredDescriptions, target: 'samples' as const },
    { label: 'Included in cohort', value: receipt.sources.length, target: 'samples' as const },
  ]

  return (
    <section aria-labelledby="youtube-description-library-heading" className="mb-4 overflow-hidden rounded-lg border border-silicon-slate/70 bg-background/35">
      <div className="flex flex-col gap-3 border-b border-silicon-slate/60 p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Youtube className="h-5 w-5 text-red-400" aria-hidden="true" />
            <h3 id="youtube-description-library-heading" className="text-base font-semibold">YouTube description patterns</h3>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${receipt.status === 'ready' ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200' : 'border-amber-500/45 bg-amber-500/10 text-amber-800 dark:text-amber-200'}`}>
              {receipt.status === 'ready' ? 'Ready' : 'Unscored'}
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Compare approved same-topic descriptions, inspect why evidence qualified or failed, and reuse only the aggregate structure.
          </p>
        </div>
        <label className="w-full text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:max-w-sm">
          Topic to compare
          <span className="mt-1 flex min-h-11 items-center gap-2 rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <input
              type="search"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="AI licenses, agent harnesses..."
              className="min-w-0 flex-1 bg-transparent py-2 text-sm font-normal text-foreground outline-none placeholder:text-muted-foreground"
            />
          </span>
        </label>
      </div>

      <div className="grid grid-cols-2 border-b border-silicon-slate/60 lg:grid-cols-4">
        {metrics.map((metric) => (
          <button
            key={metric.label}
            type="button"
              onClick={() => { setView(metric.target); setSamplePage(1) }}
            className="min-h-20 border-b border-r border-silicon-slate/60 p-3 text-left transition-colors hover:bg-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:border-b-0"
            aria-label={`${metric.label}: ${metric.value}. Show ${metric.target}.`}
          >
            <span className="block text-2xl font-semibold text-foreground">{metric.value}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{metric.label}</span>
          </button>
        ))}
      </div>

      {!topic.trim() ? (
        <div className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />
          <p>Enter a topic to build a same-topic cohort. The pipeline will not infer a reusable description pattern without a stable topic identity.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto border-b border-silicon-slate/60 p-2" role="tablist" aria-label="YouTube description library views">
            {(['samples', 'structure', 'logic'] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-label={item === 'structure' ? 'Applied structure' : item === 'logic' ? 'Evidence logic' : undefined}
                aria-selected={view === item}
                onClick={() => setView(item)}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${view === item ? 'bg-radiant-gold text-slate-950' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
              >
                {item === 'samples' ? `Sample ledger (${sampleRows.length})` : item === 'structure' ? 'Structure' : 'Logic'}
              </button>
            ))}
          </div>

          {receipt.remediation_receipts.length ? (
            <section aria-label="Nzinga remediation status" className="border-b border-silicon-slate/60 bg-amber-500/5 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-foreground">Nzinga remediation ledger</h4>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${receipt.release_readiness === 'ready' ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200' : 'border-red-500/45 bg-red-500/10 text-red-800 dark:text-red-200'}`}>
                  Release {receipt.release_readiness}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Nzinga records and verifies evidence changes. The designated owner repairs the source or structure; Nzinga does not fabricate evidence or lower a gate.</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {receipt.remediation_receipts.map((remediation) => (
                  <article key={remediation.receipt_id} className="rounded-md border border-border bg-background/60 p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{formatKey(remediation.failed_gate)}</span>
                      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-800 dark:text-amber-200">{formatKey(remediation.status)}</span>
                    </div>
                    <dl className="mt-2 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-muted-foreground">
                      <dt>Owner</dt><dd className="break-words text-foreground">{formatKey(remediation.designated_owner)}</dd>
                      <dt>Recovery</dt><dd className="break-words text-foreground">{formatKey(remediation.recovery_action)}</dd>
                      <dt>Recheck</dt><dd className="break-words text-foreground">{formatKey(remediation.recheck_result)}</dd>
                      <dt>Attempts</dt><dd className="text-foreground">{remediation.attempt_count}</dd>
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {view === 'samples' ? (
            <div>
              <div className="border-b border-silicon-slate/60 bg-muted/25 px-4 py-3 text-xs text-muted-foreground">
                This ledger shows every YouTube evidence input. Captured wording is inspection-only and is never copied into generated descriptions.
              </div>
              <div className="divide-y divide-silicon-slate/60">
                {visibleSamples.map((sample) => (
                  <article key={sample.id} className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{sample.title}</p>
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${sample.included ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200' : 'border-amber-500/45 bg-amber-500/10 text-amber-800 dark:text-amber-200'}`}>
                            {sample.included ? 'Included' : 'Excluded'}
                          </span>
                          {sample.fixture ? <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-xs font-semibold text-cyan-800 dark:text-cyan-200">Synthetic QA sample</span> : null}
                          {sample.publicSnapshot ? <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-xs font-semibold text-cyan-800 dark:text-cyan-200">Public evidence snapshot</span> : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{sample.creator} · Outlier {sample.outlierScore ?? 'Missing'} · {sample.reason}</p>
                        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{sample.sourceUrl || 'YouTube URL missing'}</p>
                      </div>
                      {sample.sourceUrl ? (
                        <a href={sample.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground hover:bg-accent">
                          Open exact source <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
                      <div className="aspect-video overflow-hidden rounded-md border border-border bg-muted">
                        {sample.thumbnailUrl ? (
                          // Public evidence thumbnails are rendered exactly as captured from the source packet.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sample.thumbnailUrl} alt={`Thumbnail from ${sample.title}`} className="h-full w-full object-cover" />
                        ) : <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground">Thumbnail not captured</div>}
                      </div>
                      <div className="min-w-0 rounded-md border border-border bg-card/45 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Captured public description{sample.descriptionIsExcerpt ? ' excerpt' : ''}</p>
                        <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-6 text-foreground">{sample.description || 'Not captured. This sample cannot contribute to the description cohort.'}</p>
                        <p className="mt-2 break-all text-xs text-muted-foreground"><span className="font-semibold text-foreground">YouTube URL:</span> {sample.sourceUrl || 'Missing'}</p>
                        <p className="mt-1 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Description provenance:</span> {sample.descriptionProvenance || 'Missing'}</p>
                      </div>
                    </div>
                    <details className="mt-3 rounded-md border border-border bg-card/45">
                      <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-foreground">Inspect evidence and decision logic</summary>
                      <div className="grid gap-4 border-t border-border p-3 lg:grid-cols-2">
                        <section className="rounded-md border border-border bg-background/60 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why this sample appears</p>
                          <p className="mt-2 text-sm text-foreground">
                            {sample.collector && sample.discoveryQuery
                              ? `Collected by ${sample.collector} for the public discovery query “${sample.discoveryQuery}” and stored as a research evidence packet.`
                              : 'Present in the approved Content Intelligence research packet set for this topic comparison.'}
                          </p>
                          <dl className="mt-3 grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] gap-x-3 gap-y-2 text-sm">
                            <dt className="text-muted-foreground">Discovery query</dt><dd className="break-words text-foreground">{sample.discoveryQuery || 'Not recorded'}</dd>
                            <dt className="text-muted-foreground">Collector</dt><dd className="break-words font-mono text-xs text-foreground">{sample.collector || 'Not recorded'}</dd>
                            <dt className="text-muted-foreground">Dataset receipt</dt><dd className="break-all font-mono text-xs text-foreground">{sample.datasetId || 'Not recorded'}</dd>
                            <dt className="text-muted-foreground">Observed</dt><dd className="text-foreground">{formatDate(sample.observedAt)}</dd>
                            <dt className="text-muted-foreground">Source cohort</dt><dd className="text-foreground">{sample.cohortSize === null ? 'Not recorded' : `${sample.cohortSize} samples`}</dd>
                            <dt className="text-muted-foreground">Cohort median</dt><dd className="text-foreground">{sample.cohortMedian === null ? 'Not recorded' : `${sample.cohortMedian.toFixed(2)} view/follower ratio`}</dd>
                            <dt className="text-muted-foreground">Privacy boundary</dt><dd className="text-foreground">{sample.publicSummaryOnly ? 'Public summary only' : 'Not recorded'}</dd>
                          </dl>
                        </section>
                        <section className="rounded-md border border-border bg-background/60 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cohort decision</p>
                          <p className="mt-2 text-sm font-medium text-foreground">{sample.included ? 'Included' : 'Excluded'} · {sample.reason}</p>
                          {sample.remediation ? (
                            <div className="mt-3 rounded-md border border-amber-500/35 bg-amber-500/10 p-3 text-xs">
                              <p className="font-semibold text-foreground">Nzinga remediation · {formatKey(sample.remediation.status)}</p>
                              <p className="mt-1 text-muted-foreground"><span className="font-semibold text-foreground">Owner:</span> {formatKey(sample.remediation.designated_owner)}</p>
                              <p className="mt-1 text-muted-foreground"><span className="font-semibold text-foreground">Recovery:</span> {formatKey(sample.remediation.recovery_action)}</p>
                              <p className="mt-1 text-muted-foreground"><span className="font-semibold text-foreground">Recheck:</span> {formatKey(sample.remediation.recheck_result)}</p>
                            </div>
                          ) : null}
                          <ol className="mt-3 space-y-2">
                            {sample.gateDecisions.map((decision, index) => (
                              <li key={decision.gate} className="rounded-md border border-border bg-card/45 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>
                                  <span className="text-sm font-semibold text-foreground">{decision.label}</span>
                                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${decisionStyles[decision.status]}`}>{decisionLabels[decision.status]}</span>
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Required:</span> {decision.requirement}</p>
                                <p className="mt-1 break-all text-xs text-muted-foreground"><span className="font-semibold text-foreground">Observed:</span> {decision.observed}</p>
                              </li>
                            ))}
                          </ol>
                        </section>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Captured description evidence</p>
                          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">{sample.description || 'No separately proven public YouTube description was captured.'}</p>
                          {sample.packetSummary ? <div className="mt-3 rounded-md border border-amber-500/35 bg-amber-500/10 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">Internal packet summary · not source evidence</p><p className="mt-1 text-sm text-foreground">{sample.packetSummary}</p></div> : null}
                        </div>
                        <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-3 gap-y-2 text-sm">
                          <dt className="text-muted-foreground">Pattern approval</dt><dd className="break-words text-foreground">{sample.patternStatus}</dd>
                          <dt className="text-muted-foreground">Packet status</dt><dd className="break-words text-foreground">{sample.packetStatus}</dd>
                          <dt className="text-muted-foreground">Published</dt><dd className="text-foreground">{formatDate(sample.publishedAt)}</dd>
                          <dt className="text-muted-foreground">Retrieved</dt><dd className="text-foreground">{formatDate(sample.retrievedAt)}</dd>
                          <dt className="text-muted-foreground">Audience size</dt><dd className="text-foreground">{sample.audienceSize?.toLocaleString() ?? 'Missing'}</dd>
                          <dt className="text-muted-foreground">Recorded topics</dt><dd className="break-words text-foreground">{sample.topics.length ? sample.topics.join(', ') : 'Derived from title and pattern fields'}</dd>
                          <dt className="text-muted-foreground">Matched topic tokens</dt><dd className="break-words text-foreground">{sample.included?.topic_matches.join(', ') || 'None recorded for an included cohort source'}</dd>
                          <dt className="text-muted-foreground">Description fingerprint</dt><dd className="break-all font-mono text-xs text-foreground">{sample.included?.description_fingerprint ?? 'Not generated for excluded input'}</dd>
                          <dt className="text-muted-foreground">Topic-match score</dt><dd className="text-foreground">{sample.included ? `${Math.round(sample.included.topic_match_score * 100)}%` : 'Not scored after failed gate'}</dd>
                          <dt className="text-muted-foreground">Score model</dt><dd className="break-words text-foreground">{value(sample.scoreBreakdown.model) || 'No model label recorded'}</dd>
                        </dl>
                        {sample.included ? (
                          <div className="rounded-md border border-border bg-background/60 p-3 text-sm lg:col-span-2">
                            <p className="font-semibold text-foreground">Extracted structure</p>
                            <p className="mt-1 text-muted-foreground">{sample.included.pattern.opening_style} opening · {sample.included.pattern.length_band} length · {sample.included.pattern.paragraph_count} paragraphs · {sample.included.pattern.proof_style.replace(/_/g, ' ')} · {sample.included.pattern.cta_style} CTA · {sample.included.pattern.link_placement} link · {sample.included.pattern.uses_chapters ? 'chapters present' : 'no chapters'} · {sample.included.pattern.hashtag_count} hashtags</p>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  </article>
                ))}
              </div>
              {sampleRows.length > SAMPLE_PAGE_SIZE ? (
                <div className="flex items-center justify-between gap-3 border-t border-silicon-slate/60 p-3">
                  <p className="text-xs text-muted-foreground">Page {safeSamplePage} of {pageCount} · four records per page</p>
                  <div className="flex gap-2">
                    <button type="button" aria-label="Previous sample page" disabled={safeSamplePage === 1} onClick={() => setSamplePage((page) => Math.max(1, page - 1))} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-input px-3 text-sm font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"><ChevronLeft className="h-4 w-4" aria-hidden="true" />Previous</button>
                    <button type="button" aria-label="Next sample page" disabled={safeSamplePage === pageCount} onClick={() => setSamplePage((page) => Math.min(pageCount, page + 1))} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-input px-3 text-sm font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45">Next<ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {view === 'structure' ? (
            <div className="p-4">
              {receipt.status === 'ready' ? (
                <ol className="space-y-3">
                  {receipt.recommended_structure.blueprint.map((step, index) => (
                    <li key={step} className="flex gap-3 text-sm text-foreground"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true" /><span><span className="font-semibold">{index + 1}.</span> {step}</span></li>
                  ))}
                </ol>
              ) : (
                <div className="space-y-2 text-sm text-muted-foreground">
                  {receipt.blockers.map((blocker) => <p key={blocker} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />{blocker}</p>)}
                  <p>No description structure will be applied until the cohort is ready.</p>
                </div>
              )}
              <p className="mt-4 border-t border-silicon-slate/60 pt-3 text-xs text-muted-foreground">{receipt.originality_boundary}</p>
            </div>
          ) : null}

          {view === 'logic' ? (
            <div className="grid gap-4 p-4 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <h4 className="font-semibold text-foreground">Gate order</h4>
                <ol className="mt-3 space-y-2 text-sm text-foreground">
                  {[
                    'Keep only YouTube or YouTube Shorts packets.',
                    'Require pattern_status usable_framework.',
                    'Require an attributable HTTP source URL and captured customer-facing description.',
                    `Require an outlier score of ${receipt.minimum_outlier_score} or higher.`,
                    `Require a publication or retrieval date inside the ${receipt.freshness_days}-day window.`,
                    'Require at least one stable topic-token match; apply the audience-size band when one is supplied.',
                    `Rank the survivors and require at least ${receipt.minimum_source_count} independent samples before applying a structure.`,
                  ].map((rule, index) => <li key={rule} className="flex gap-3"><span className="font-semibold text-radiant-gold">{index + 1}.</span><span>{rule}</span></li>)}
                </ol>
              </div>
              <div className="rounded-md border border-border bg-card/60 p-4">
                <h4 className="font-semibold text-foreground">Ranking formula</h4>
                <p className="mt-2 font-mono text-xs leading-6 text-foreground">topic match = (matched topic-token ratio × 0.65) + (outlier score ÷ 100 × 0.35)</p>
                <p className="mt-3 text-sm text-muted-foreground">A record that fails an earlier gate is excluded before this ranking formula runs. Missing or stale evidence remains Unscored.</p>
                <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">{receipt.originality_boundary}</p>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
