'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2, Film, LockKeyhole, ShieldCheck, Youtube } from 'lucide-react'

type RecordValue = Record<string, unknown>

type ChannelNativeVideoItem = {
  id: string
  platform?: string
  post_text?: string | null
  voiceover_text?: string | null
  youtube_title?: string | null
  youtube_description?: string | null
  rag_context?: unknown
}

function record(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function records(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.filter((entry): entry is RecordValue => Boolean(record(entry))) : []
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function publicReviewAssetUrl(value: unknown): string | null {
  const path = text(value)
  if (!path.startsWith('artifacts/human-qa/artifact-video-review-2026-10-14/')) return null
  const fileName = path.split('/').at(-1) ?? ''
  if (!/^[a-z0-9][a-z0-9.-]+\.(mp4|png)$/i.test(fileName)) return null
  return `/review-assets/social-content/${fileName}`
}

export function getChannelVideoPacket(item: ChannelNativeVideoItem) {
  const rag = record(item.rag_context)
  const packet = record(rag?.approved_video_packet)
  if (!packet || text(rag?.source_type) !== 'version_bound_provider_none_mp4') return null

  const target = text(packet.target)
  if (item.platform !== 'youtube' && !target.startsWith('youtube_')) return null

  const titleOptions = records(rag?.approved_title_options)
  const approvedDescription = record(rag?.approved_description)
  const receipts = record(rag?.receipts)
  const sideEffects = record(rag?.side_effects)
  const claims = records(rag?.claims)
  const evidenceAssets = records(rag?.evidence_assets)
  const title = item.youtube_title || text(titleOptions[0]?.title) || 'Untitled video review'
  const description = item.youtube_description
    || [text(approvedDescription?.practical_value), text(approvedDescription?.why_artifact_matters)].filter(Boolean).join(' ')
  const script = item.voiceover_text || item.post_text || ''
  const provider = text(packet.provider) || 'none'
  const channelLabel = target === 'youtube_shorts' ? 'YouTube Shorts' : 'YouTube'

  return {
    channelLabel,
    title,
    description,
    script,
    provider,
    packet,
    receipts,
    sideEffects,
    claims,
    evidenceAssets,
    sourceIds: strings(rag?.source_ids),
    channelPacketIds: strings(rag?.channel_packet_ids),
    inputVersion: text(rag?.input_version),
    traceabilitySummary: text(rag?.traceability_summary),
    workflowState: text(rag?.workflow_state),
    workItemId: text(rag?.work_item_id),
    videoUrl: publicReviewAssetUrl(packet.video_path),
    posterUrl: publicReviewAssetUrl(packet.poster_path),
  }
}

function compactHash(value: string): string {
  if (!value) return 'Missing'
  return value.length > 28 ? `${value.slice(0, 20)}…${value.slice(-8)}` : value
}

export default function ChannelNativeVideoReview({ item }: { item: ChannelNativeVideoItem }) {
  const review = getChannelVideoPacket(item)
  if (!review) return null

  const isPortraitVideo = Number(review.packet.height) > Number(review.packet.width)

  const receiptEntries = Object.entries(review.receipts ?? {})
    .map(([kind, value]) => ({ kind, receipt: record(value) }))
    .filter((entry): entry is { kind: string; receipt: RecordValue } => Boolean(entry.receipt))
  const disabledReasons = [
    ['Provider generation', review.sideEffects?.provider_generation],
    ['Provider upload', review.sideEffects?.upload],
    ['Platform draft', review.sideEffects?.platform_draft],
    ['Scheduling', review.sideEffects?.schedule],
    ['Publishing', review.sideEffects?.publish],
    ['External send', review.sideEffects?.external_send],
  ].map(([label, enabled]) => ({ label: String(label), enabled: enabled === true }))

  return (
    <section aria-label={`${review.channelLabel} channel-native video review`} className="min-w-0 space-y-4 rounded-xl border border-red-500/30 bg-card p-4 text-card-foreground shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-red-700 dark:text-red-200">
            <Youtube className="h-4 w-4" /> {review.channelLabel} review
          </p>
          <h2 className="mt-1 break-words text-xl font-semibold text-foreground">{review.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{review.description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-emerald-600/35 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-800 dark:text-emerald-100">Version bound</span>
          <span className="rounded-full border border-slate-500/35 bg-slate-500/10 px-2.5 py-1 font-semibold text-foreground">Provider: {review.provider}</span>
        </div>
      </div>

      {review.videoUrl ? (
        <div className={isPortraitVideo ? 'flex justify-center rounded-lg border border-border bg-black p-2 sm:p-4' : ''}>
          <video
            aria-label={`${review.channelLabel} review video`}
            controls
            playsInline
            preload="metadata"
            poster={review.posterUrl ?? undefined}
            src={review.videoUrl}
            className={isPortraitVideo
              ? 'aspect-[9/16] max-h-[78vh] w-auto max-w-full rounded-lg bg-black object-contain'
              : 'aspect-video w-full rounded-lg border border-border bg-black object-contain'}
          >
            Your browser cannot play this review video.
          </video>
        </div>
      ) : review.posterUrl ? (
        <Image src={review.posterUrl} alt={`${review.channelLabel} approved thumbnail poster`} width={1920} height={1080} className="aspect-video w-full rounded-lg border border-border bg-black object-contain" />
      ) : (
        <p role="status" className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
          The repository review media is not mapped into this deployment. Keep upload and platform actions blocked until the bound asset is restored.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted/35 p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Duration</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{String(review.packet.duration_seconds ?? 'Missing')} seconds</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/35 p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Video receipt</p>
          <p className="mt-1 break-all text-xs font-semibold text-foreground">{compactHash(text(review.packet.video_sha256))}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/35 p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Workflow</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{review.workflowState.replaceAll('_', ' ') || 'human review required'}</p>
        </div>
      </div>

      <details open className="rounded-lg border border-border bg-background p-3">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">Approved script</summary>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{review.script || 'No approved script is bound.'}</p>
      </details>

      <details className="rounded-lg border border-border bg-background p-3">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">Source lineage and privacy boundaries</summary>
        <div className="mt-3 space-y-4 text-xs leading-5 text-muted-foreground">
          <div>
            <p className="font-semibold text-foreground">Source identities</p>
            {review.sourceIds.map((sourceId) => <p key={sourceId} className="break-all">{sourceId}</p>)}
          </div>
          <div>
            <p className="font-semibold text-foreground">Channel packets</p>
            {review.channelPacketIds.map((packetId) => <p key={packetId} className="break-all">{packetId}</p>)}
          </div>
          {review.claims.map((claim) => (
            <article key={text(claim.claim_id)} className="rounded-md border border-border bg-muted/30 p-2.5">
              <p className="font-semibold text-foreground">{text(claim.text)}</p>
              <p className="mt-1"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" /> Privacy boundary: {text(claim.privacy_boundary)}</p>
            </article>
          ))}
          <p>{review.traceabilitySummary}</p>
          <p className="break-all">Input version: {review.inputVersion || 'Missing'}</p>
        </div>
      </details>

      <details className="rounded-lg border border-border bg-background p-3">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">Receipt status</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {receiptEntries.map(({ kind, receipt }) => (
            <div key={kind} className="rounded-md border border-border bg-muted/30 p-2.5 text-xs">
              <p className="flex items-center justify-between gap-2 font-semibold capitalize text-foreground">
                {kind.replaceAll('_', ' ')}
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" /> {text(receipt.status) || 'unknown'}</span>
              </p>
              <p className="mt-1 break-all text-muted-foreground">{text(receipt.receipt_id)}</p>
            </div>
          ))}
        </div>
      </details>

      <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-100"><LockKeyhole className="h-4 w-4" /> External execution remains disabled</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {disabledReasons.map(({ label, enabled }) => (
            <button key={label} type="button" disabled title={enabled ? `${label} is not available from this review surface.` : `${label} is disabled by the version-bound provider-none packet.`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-amber-700/35 bg-background px-3 py-2 text-xs font-semibold text-amber-950 opacity-70 disabled:cursor-not-allowed dark:text-amber-100">
              <Film className="h-3.5 w-3.5" /> {label}: disabled
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-amber-900 dark:text-amber-100">
          Review this evidence here. Record the decision in the canonical Decision Queue; approval does not upload, create a platform draft, schedule, publish, send, change credentials, or enable a provider.
        </p>
        <Link href={review.workItemId ? `/admin/agents/coordination?proposal=${encodeURIComponent(review.workItemId)}` : '/admin/agents/coordination'} className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-amber-700/40 px-3 py-2 text-sm font-semibold text-amber-950 underline-offset-2 hover:underline dark:text-amber-100">
          Open canonical Decision Queue
        </Link>
      </div>
    </section>
  )
}
