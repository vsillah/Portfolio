'use client'

import { useState } from 'react'
import { ExternalLink, FlaskConical, ShieldCheck } from 'lucide-react'
import {
  channelExperimentReviewForPacket,
  type ExperimentChannel,
  type LinkedInExperiment,
  type YouTubeExperiment,
} from '@/lib/channel-experiment-review'

function LinkChip({ href, label }: { href: string; label: string }) {
  const external = href.startsWith('http')
  return <a
    href={href}
    {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs font-semibold text-foreground hover:border-blue-400/60 hover:text-blue-600 dark:hover:text-blue-200"
  >
    <span className="truncate">{label}</span>
    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
  </a>
}

function OrderedList({ items }: { items: string[] }) {
  return <ol className="space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
    {items.map((item, index) => <li key={`${index}-${item}`} className="list-decimal pl-1">{item}</li>)}
  </ol>
}

function LinkedInVariant({ variant }: { variant: LinkedInExperiment }) {
  return <div className="space-y-4" data-testid={`experiment-${variant.id}`}>
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-200">Test hypothesis</p>
      <p className="mt-1 text-sm leading-6 text-foreground">{variant.hypothesis}</p>
    </div>
    <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Hook</p>
      <p className="mt-2 text-base font-semibold leading-6 text-foreground">{variant.hook}</p>
    </div>
    <div>
      <h5 className="text-sm font-semibold text-foreground">Body structure</h5>
      <div className="mt-2"><OrderedList items={variant.bodyStructure} /></div>
    </div>
    <dl className="grid gap-3 text-sm md:grid-cols-2">
      <div className="rounded-lg border border-border bg-background/50 p-3"><dt className="font-semibold text-foreground">CTA</dt><dd className="mt-1 leading-6 text-muted-foreground">{variant.cta}</dd></div>
      <div className="rounded-lg border border-border bg-background/50 p-3"><dt className="font-semibold text-foreground">Product or owned-proof tie-in</dt><dd className="mt-1 leading-6 text-muted-foreground">{variant.productTieIn}</dd></div>
    </dl>
    <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
      <h5 className="text-sm font-semibold text-foreground">Visual brief</h5>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{variant.visualBrief}</p>
    </div>
  </div>
}

function YouTubeVariant({ variant }: { variant: YouTubeExperiment }) {
  return <div className="space-y-4" data-testid={`experiment-${variant.id}`}>
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-700 dark:text-red-200">Test hypothesis</p>
      <p className="mt-1 text-sm leading-6 text-foreground">{variant.hypothesis}</p>
    </div>
    <dl className="grid gap-3 text-sm md:grid-cols-2">
      <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-3"><dt className="font-semibold text-foreground">Title</dt><dd className="mt-1 text-base font-semibold leading-6 text-foreground">{variant.title}</dd></div>
      <div className="rounded-lg border border-border bg-background/50 p-3"><dt className="font-semibold text-foreground">Thumbnail concept</dt><dd className="mt-1 leading-6 text-muted-foreground">{variant.thumbnailConcept}</dd></div>
    </dl>
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
      <h5 className="text-sm font-semibold text-foreground">Opening hook</h5>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{variant.openingHook}</p>
    </div>
    <div>
      <h5 className="text-sm font-semibold text-foreground">Script and storyboard outline</h5>
      <div className="mt-2"><OrderedList items={variant.outline} /></div>
    </div>
    <dl className="grid gap-3 text-sm lg:grid-cols-3">
      <div className="rounded-lg border border-border bg-background/50 p-3"><dt className="font-semibold text-foreground">Description</dt><dd className="mt-1 leading-6 text-muted-foreground">{variant.description}</dd></div>
      <div className="rounded-lg border border-border bg-background/50 p-3"><dt className="font-semibold text-foreground">CTA</dt><dd className="mt-1 leading-6 text-muted-foreground">{variant.cta}</dd></div>
      <div className="rounded-lg border border-border bg-background/50 p-3"><dt className="font-semibold text-foreground">Product or owned-proof tie-in</dt><dd className="mt-1 leading-6 text-muted-foreground">{variant.productTieIn}</dd></div>
    </dl>
    <div>
      <h5 className="text-sm font-semibold text-foreground">Proposed visual evidence</h5>
      <ul className="mt-2 space-y-1 text-sm leading-6 text-muted-foreground">
        {variant.visualEvidence.map(item => <li key={item}>• {item}</li>)}
      </ul>
    </div>
  </div>
}

export default function ChannelExperimentReview({ packetId, defaultOpen = false }: { packetId: string; defaultOpen?: boolean }) {
  const review = channelExperimentReviewForPacket(packetId)
  const [open, setOpen] = useState(defaultOpen)
  const [channel, setChannel] = useState<ExperimentChannel>('linkedin')
  const [variantIndex, setVariantIndex] = useState(0)

  if (!review) return null
  const variants = review[channel]
  const variant = variants[variantIndex] ?? variants[0]

  function selectChannel(next: ExperimentChannel) {
    setChannel(next)
    setVariantIndex(0)
  }

  return <section className="mt-3 overflow-hidden rounded-xl border border-cyan-500/30 bg-cyan-500/[0.04] text-sm" aria-label={`Channel experiments for ${review.campaignTitle}`}>
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen(current => !current)}
      className="flex w-full items-start justify-between gap-3 p-3 text-left hover:bg-cyan-500/[0.06] sm:items-center"
    >
      <span className="flex min-w-0 items-start gap-2">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700 dark:text-cyan-200" aria-hidden="true" />
        <span>
          <span className="block font-semibold text-foreground">LinkedIn + YouTube experiment review</span>
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">Four review-only variants from one evidence core. No draft, render, upload, schedule, publish, or send action is available.</span>
        </span>
      </span>
      <span className="shrink-0 rounded-full border border-cyan-500/30 px-2 py-1 text-[11px] font-semibold text-cyan-800 dark:text-cyan-100">{open ? 'Close' : 'Open 4 variants'}</span>
    </button>

    {open ? <div className="border-t border-cyan-500/20 p-3 sm:p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-3 text-card-foreground">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold">Shared evidence core</h4>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-100">Review only</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{review.audience}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {review.evidenceLinks.map(link => <LinkChip key={`${link.kind}-${link.href}`} href={link.href} label={link.label} />)}
            </div>
          </div>

          <details className="rounded-lg border border-border bg-card p-3 text-card-foreground" open>
            <summary className="cursor-pointer font-semibold">Claims, lineage, and boundaries</summary>
            <div className="mt-3 space-y-4">
              <div><h5 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Approved claims</h5><ul className="mt-2 space-y-2 text-sm leading-6 text-foreground">{review.approvedClaims.map(item => <li key={item}>• {item}</li>)}</ul></div>
              <div><h5 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Unique Vambah angle</h5><p className="mt-2 leading-6 text-muted-foreground">{review.uniqueVambahAngle}</p></div>
              <div><h5 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Comparable-cohort basis</h5><p className="mt-2 leading-6 text-muted-foreground">{review.outlierBasis}</p></div>
              <div><h5 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Evidence boundary</h5><ul className="mt-2 space-y-2 leading-6 text-muted-foreground">{review.evidenceBoundary.map(item => <li key={item}>• {item}</li>)}</ul></div>
              <div><h5 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Originality risk</h5><p className="mt-2 leading-6 text-muted-foreground">{review.originalityRisk}</p></div>
            </div>
          </details>

          <details className="rounded-lg border border-border bg-card p-3 text-card-foreground" open>
            <summary className="cursor-pointer font-semibold">Numerical scorecard and inputs</summary>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{review.formula}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2">
              {review.scores.map(score => <div key={score.label} className="rounded-lg border border-border bg-background/50 p-2.5">
                <dt className="text-xs text-muted-foreground">{score.label}</dt>
                <dd className="mt-1 text-lg font-semibold text-foreground">{score.value == null ? 'Unscored' : `${score.value}/100`}</dd>
                <a href={score.inputLink} className="mt-1 block text-xs leading-5 text-blue-700 hover:underline dark:text-blue-200">{score.input}</a>
              </div>)}
            </dl>
            <div role="status" className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-100"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Missing evidence stays Unscored</div>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-950/80 dark:text-amber-100/80">{review.missingEvidence.map(item => <li key={item}>• {item}</li>)}</ul>
            </div>
          </details>
        </aside>

        <div className="min-w-0 rounded-lg border border-border bg-card p-3 text-card-foreground sm:p-4">
          <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Channel-native artifacts</p>
              <h4 className="mt-1 text-lg font-semibold">{review.campaignTitle}</h4>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-background/60 p-1" aria-label="Experiment channel">
              {(['linkedin', 'youtube'] as const).map(option => <button
                key={option}
                type="button"
                aria-pressed={channel === option}
                onClick={() => selectChannel(option)}
                className={`rounded-md px-3 py-2 text-xs font-semibold capitalize ${channel === option ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
              >{option}</button>)}
            </div>
          </div>

          <div className="my-4 grid gap-2 sm:grid-cols-2" aria-label={`${channel} variants`}>
            {variants.map((item, index) => <button
              key={item.id}
              type="button"
              aria-pressed={variantIndex === index}
              onClick={() => setVariantIndex(index)}
              className={`min-w-0 rounded-lg border p-3 text-left text-sm font-semibold ${variantIndex === index ? 'border-cyan-500/70 bg-cyan-500/10 text-foreground' : 'border-border bg-background/40 text-muted-foreground hover:text-foreground'}`}
            >{item.label}</button>)}
          </div>

          {channel === 'linkedin'
            ? <LinkedInVariant variant={variant as LinkedInExperiment} />
            : <YouTubeVariant variant={variant as YouTubeExperiment} />}
        </div>
      </div>
    </div> : null}
  </section>
}
