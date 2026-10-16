'use client'

import Link from 'next/link'
import { ExternalLink, FlaskConical, ShieldCheck, Youtube } from 'lucide-react'
import { persistedChannelExperimentReviewForItem } from '@/lib/channel-experiment-review'

type RecordValue = Record<string, unknown>

type ChannelExperimentSocialItem = {
  id: string
  platform?: string
  youtube_title?: string | null
  youtube_description?: string | null
  rag_context?: unknown
}

function record(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null
}

function records(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.filter((entry): entry is RecordValue => Boolean(record(entry))) : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : []
}

export function getChannelExperimentSocialReview(item: ChannelExperimentSocialItem) {
  const ragContext = record(item.rag_context)
  const packet = record(ragContext?.channel_experiment_review)
  const persisted = persistedChannelExperimentReviewForItem(item)

  if (persisted) {
    const { review, variant } = persisted
    return {
      packetId: review.packetId,
      campaignTitle: review.campaignTitle,
      audience: review.audience,
      variantId: variant.id,
      variantLabel: variant.label,
      hypothesis: variant.hypothesis,
      title: item.youtube_title || variant.title,
      description: item.youtube_description || variant.description,
      openingHook: variant.openingHook,
      outline: variant.outline,
      thumbnailBrief: variant.thumbnailConcept,
      cta: variant.cta,
      productProofRequirements: [variant.productTieIn, ...variant.visualEvidence],
      evidenceLineage: review.evidenceLinks,
      approvedClaims: review.approvedClaims,
      evidenceBoundary: review.evidenceBoundary,
      formula: review.formula,
      scores: review.scores,
      missingEvidence: review.missingEvidence,
      source: 'persisted' as const,
    }
  }

  if (!packet || text(ragContext?.source_type) !== 'review_only_youtube_experiment' || item.platform !== 'youtube') return null

  const packetId = text(packet.packet_id)
  const title = item.youtube_title || text(packet.title)
  const description = item.youtube_description || text(packet.description)
  if (!packetId || !title || !description) return null

  return {
    packetId,
    campaignTitle: text(packet.campaign_title),
    audience: text(packet.audience),
    variantId: text(packet.variant_id) || item.id,
    variantLabel: text(packet.variant_label),
    hypothesis: text(packet.hypothesis),
    title,
    description,
    openingHook: text(packet.opening_hook),
    outline: strings(packet.outline),
    thumbnailBrief: text(packet.thumbnail_brief),
    cta: text(packet.cta),
    productProofRequirements: strings(packet.product_proof_requirements),
    evidenceLineage: records(packet.evidence_lineage).map(entry => ({
      label: text(entry.label),
      href: text(entry.href),
      kind: text(entry.kind),
    })).filter(entry => entry.label && entry.href),
    approvedClaims: strings(packet.approved_claims),
    evidenceBoundary: strings(packet.evidence_boundary),
    formula: text(packet.formula),
    scores: records(packet.scores).map(entry => ({
      label: text(entry.label),
      value: typeof entry.value === 'number' ? entry.value : null,
      input: text(entry.input),
      inputLink: text(entry.inputLink),
    })).filter(entry => entry.label),
    missingEvidence: strings(packet.missing_evidence),
    source: 'fixture' as const,
  }
}

function EvidenceLink({ label, href, kind }: { label: string; href: string; kind: string }) {
  const external = href.startsWith('http')
  const className = 'inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-red-400/60 hover:text-red-700 dark:hover:text-red-200'
  const children = <><span className="truncate">{label}</span><ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /></>
  if (external) return <a href={href} target="_blank" rel="noreferrer" className={className} data-evidence-kind={kind}>{children}</a>
  return <Link href={href} className={className} data-evidence-kind={kind}>{children}</Link>
}

export default function ChannelExperimentSocialReview({ item }: { item: ChannelExperimentSocialItem }) {
  const review = getChannelExperimentSocialReview(item)
  if (!review) return null

  const unscored = review.scores.filter(score => score.value == null)

  return (
    <section
      aria-label={`YouTube experiment review: ${review.title}`}
      data-testid="channel-experiment-social-review"
      className="min-w-0 space-y-4 rounded-xl border border-red-500/30 bg-card p-4 text-card-foreground shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-red-700 dark:text-red-200">
            <Youtube className="h-4 w-4" aria-hidden="true" /> YouTube experiment review
          </p>
          <h2 className="mt-2 break-words text-xl font-semibold leading-7 text-foreground">{review.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{review.description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-emerald-600/35 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-800 dark:text-emerald-100">Review only</span>
          <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-900 dark:text-amber-100">Unscored</span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background/65 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Campaign and test hypothesis</p>
        <p className="mt-2 text-sm font-semibold text-foreground">{review.campaignTitle} · {review.variantLabel}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{review.hypothesis}</p>
        {review.audience ? <p className="mt-2 text-xs leading-5 text-muted-foreground">Audience: {review.audience}</p> : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <h3 className="text-sm font-semibold text-foreground">Opening hook</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{review.openingHook}</p>
        </article>
        <article className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3">
          <h3 className="text-sm font-semibold text-foreground">Thumbnail brief</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{review.thumbnailBrief}</p>
        </article>
      </div>

      <article className="rounded-lg border border-border bg-background/65 p-3">
        <h3 className="text-sm font-semibold text-foreground">Episode outline</h3>
        <ol className="mt-3 space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
          {review.outline.map((item, index) => <li key={`${index}-${item}`} className="list-decimal pl-1">{item}</li>)}
        </ol>
      </article>

      <div className="grid gap-3 xl:grid-cols-2">
        <article className="rounded-lg border border-border bg-background/65 p-3">
          <h3 className="text-sm font-semibold text-foreground">Evidence lineage</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {review.evidenceLineage.map(entry => <EvidenceLink key={`${entry.kind}-${entry.href}`} {...entry} />)}
          </div>
          <div className="mt-4 space-y-2 text-xs leading-5 text-muted-foreground">
            {review.approvedClaims.map(claim => <p key={claim}>• {claim}</p>)}
          </div>
        </article>

        <article className="rounded-lg border border-border bg-background/65 p-3">
          <h3 className="text-sm font-semibold text-foreground">Product-proof requirements</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
            {review.productProofRequirements.map(requirement => <li key={requirement}>• {requirement}</li>)}
          </ul>
          {review.cta ? <p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted-foreground"><span className="font-semibold text-foreground">Proposed CTA:</span> {review.cta}</p> : null}
        </article>
      </div>

      <details open className="rounded-lg border border-border bg-background/65 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">Score inputs and Unscored evidence</summary>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{review.formula}</p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {review.scores.map(score => <div key={score.label} className="rounded-lg border border-border bg-muted/25 p-2.5">
            <dt className="text-xs text-muted-foreground">{score.label}</dt>
            <dd className="mt-1 text-lg font-semibold text-foreground">{score.value == null ? 'Unscored' : `${score.value}/100`}</dd>
            {score.inputLink ? <Link href={score.inputLink} className="mt-1 block text-xs leading-5 text-blue-700 hover:underline dark:text-blue-200">{score.input}</Link> : <p className="mt-1 text-xs leading-5 text-muted-foreground">{score.input}</p>}
          </div>)}
        </dl>
        <div role="status" className="mt-3 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> {unscored.length} score input{unscored.length === 1 ? '' : 's'} remain Unscored</p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-950/80 dark:text-amber-100/80">
            {review.missingEvidence.map(item => <li key={item}>• {item}</li>)}
          </ul>
        </div>
      </details>

      <details open className="rounded-lg border border-border bg-background/65 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">Evidence boundaries and execution gates</summary>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
          {review.evidenceBoundary.map(item => <li key={item}>• {item}</li>)}
        </ul>
        <p className="mt-3 flex items-start gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-950 dark:text-emerald-100">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          This record cannot call a provider, render or upload media, create a platform draft, schedule, publish, or send externally.
        </p>
      </details>
    </section>
  )
}
