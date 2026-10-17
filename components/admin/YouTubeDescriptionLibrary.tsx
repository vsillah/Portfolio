'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, Search, Youtube } from 'lucide-react'
import { buildYouTubeOutlierDescriptionLibrary } from '@/lib/youtube-outlier-description-library'

type View = 'sources' | 'excluded' | 'structure'

function value(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function data(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export default function YouTubeDescriptionLibrary({
  researchPackets,
  initialTopic = '',
  generatedAt,
}: {
  researchPackets: unknown[]
  initialTopic?: string
  generatedAt: string
}) {
  const [topic, setTopic] = useState(initialTopic)
  const [view, setView] = useState<View>('sources')
  const youtubePackets = useMemo(() => researchPackets.filter((packet) => {
    const platform = value(data(packet).platform)
    return platform === 'youtube' || platform === 'youtube_shorts'
  }), [researchPackets])
  const approvedDescriptions = useMemo(() => youtubePackets.filter((packet) => {
    const item = data(packet)
    return value(item.pattern_status) === 'usable_framework'
      && Boolean(value(item.caption) || value(data(item.pattern_packet).description))
  }).length, [youtubePackets])
  const scoredDescriptions = useMemo(() => youtubePackets.filter((packet) => {
    const item = data(packet)
    return typeof item.outlier_score === 'number' && item.outlier_score >= 65
  }).length, [youtubePackets])
  const receipt = useMemo(() => buildYouTubeOutlierDescriptionLibrary({
    researchPackets,
    targetTopics: topic ? [topic] : [],
    generatedAt,
  }), [generatedAt, researchPackets, topic])

  const metrics = [
    { label: 'YouTube sources', value: youtubePackets.length, target: 'sources' as const },
    { label: 'Approved descriptions', value: approvedDescriptions, target: 'sources' as const },
    { label: 'Outlier score 65+', value: scoredDescriptions, target: 'sources' as const },
    { label: 'Excluded', value: receipt.excluded_sources.length, target: 'excluded' as const },
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
            onClick={() => setView(metric.target)}
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
            {(['sources', 'excluded', 'structure'] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={view === item}
                onClick={() => setView(item)}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${view === item ? 'bg-radiant-gold text-slate-950' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
              >
                {item === 'sources' ? `Qualifying sources (${receipt.sources.length})` : item === 'excluded' ? `Excluded (${receipt.excluded_sources.length})` : 'Structure'}
              </button>
            ))}
          </div>

          {view === 'sources' ? (
            <div className="divide-y divide-silicon-slate/60">
              {receipt.sources.length ? receipt.sources.map((source) => (
                <div key={source.source_id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{source.source_title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Outlier {Math.round(source.outlier_score)} · topic match {Math.round(source.topic_match_score * 100)}% · {source.pattern.opening_style} opening · {source.pattern.proof_style.replace(/_/g, ' ')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Matched: {source.topic_matches.join(', ')}</p>
                  </div>
                  <a href={source.source_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground hover:bg-accent">
                    Open source <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
              )) : (
                <div className="p-4 text-sm text-muted-foreground">No source currently clears every approval, freshness, score, topic, and attribution gate.</div>
              )}
            </div>
          ) : null}

          {view === 'excluded' ? (
            <div className="divide-y divide-silicon-slate/60">
              {receipt.excluded_sources.length ? receipt.excluded_sources.map((source) => (
                <div key={source.source_id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{source.source_title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{source.reason}</p>
                  </div>
                  {source.source_url ? <a href={source.source_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground hover:bg-accent">Inspect source <ExternalLink className="h-4 w-4" aria-hidden="true" /></a> : null}
                </div>
              )) : <div className="p-4 text-sm text-muted-foreground">No YouTube sources were excluded from this comparison.</div>}
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
        </>
      )}
    </section>
  )
}
