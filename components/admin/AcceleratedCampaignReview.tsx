'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { fetchWithSessionRecovery } from '@/lib/authenticated-fetch'
import type { AcceleratedCampaignReview as Review } from '@/lib/social-accelerated-campaign-review'

type Activation = { ready: boolean; blockers: string[]; scope: string; campaignId: string; copyHash: string | null; calendarId: string; channel: string; scheduledFor: string }

export default function AcceleratedCampaignReview({ review, contentId, postText, ctaUrl }: { review: Review; contentId: string; postText: string; ctaUrl: string }) {
  const [images, setImages] = useState<string[]>([])
  const [assetError, setAssetError] = useState(false)
  const [activation, setActivation] = useState<Activation | null>(null)
  const [activationError, setActivationError] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const assetsLoaded = review.kind === 'text_only' || images.length === review.assetUrls.length

  useEffect(() => {
    let cancelled = false
    void fetchWithSessionRecovery(`/api/admin/social-content/${contentId}/accelerated-activation`, { cache: 'no-store' })
      .then(async response => {
        if (!response?.ok) throw new Error('Current activation evidence is unavailable.')
        return response.json() as Promise<Activation>
      }).then(value => { if (!cancelled) setActivation(value) })
      .catch(() => { if (!cancelled) setActivationError('Current activation evidence is unavailable.') })
    return () => { cancelled = true }
  }, [contentId, review.contentVersion])

  async function scheduleApprovedRecord() {
    if (!activation?.ready || !activation.copyHash || scheduling) return
    if (!window.confirm(`Schedule this exact ${activation.channel} record for ${new Date(activation.scheduledFor).toLocaleString()}? This creates a live scheduled publication.`)) return
    setScheduling(true)
    setActivationError('')
    try {
      const response = await fetchWithSessionRecovery(`/api/admin/social-content/${contentId}/accelerated-activation`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: activation.scope, campaign_id: activation.campaignId,
          content_id: contentId, calendar_item_id: activation.calendarId, channel: activation.channel,
          scheduled_for: activation.scheduledFor, copy_sha256: activation.copyHash,
          expected_updated_at: review.contentVersion }),
      })
      const result = await response?.json().catch(() => ({}))
      if (!response?.ok || !result?.scheduled) throw new Error(result?.error || 'Schedule was not confirmed.')
      window.location.reload()
    } catch (error) { setActivationError(error instanceof Error ? error.message : 'Schedule was not confirmed.') }
    finally { setScheduling(false) }
  }

  useEffect(() => {
    let cancelled = false
    const objectUrls: string[] = []
    setImages([])
    setAssetError(false)
    if (review.assetUrls.length) {
      void Promise.all(review.assetUrls.map(async (url) => {
        const response = await fetchWithSessionRecovery(url, { cache: 'no-store' })
        if (!response?.ok) throw new Error('Review asset unavailable')
        const objectUrl = URL.createObjectURL(await response.blob())
        objectUrls.push(objectUrl)
        return objectUrl
      })).then((loaded) => {
        if (!cancelled) setImages(loaded)
      }).catch(() => {
        if (!cancelled) setAssetError(true)
      })
    }
    return () => {
      cancelled = true
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [review.assetUrls])

  return (
    <section aria-label="Accelerated campaign review" className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accelerated · internal campaign review</p>
      <h2 className="mt-1 text-xl font-semibold">Approved copy and visual treatment</h2>
      <p className="mt-2 text-sm text-muted-foreground">Linked calendar item {review.calendarItemId}. This review keeps the campaign in Draft.</p>
      <p className="mt-1 text-xs text-muted-foreground">Copy version: <span className="font-mono">{review.contentVersion || 'Unavailable'}</span></p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {review.checks.map((check) => (
          <div key={check.label} className={`rounded-lg border px-3 py-2 text-sm ${check.passed ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10'}`}>
            <strong>{check.label}</strong> · {check.passed ? 'ready for review' : 'needs review'}
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm font-medium">{review.readyForHumanReview && assetsLoaded && !assetError ? 'Internal packet ready for Human QA' : 'Internal packet needs a current binding or review check'}</p>
      <div className="mt-4 rounded-lg border border-border bg-background p-4">
        <h3 className="text-sm font-semibold">Approved post copy</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{postText}</p>
      </div>
      <p className="mt-3 text-sm">Approved CTA: <span className="break-all font-medium">{ctaUrl}</span></p>
      {review.kind === 'text_only' ? (
        <p className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">Intentional text-only treatment. No visual asset is required.</p>
      ) : review.assetUrls.length && !assetError ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Approved raster {review.kind === 'carousel' ? 'carousel · 8 frames' : 'image'}</h3>
          <div className={`mt-3 grid gap-3 ${review.kind === 'carousel' ? 'sm:grid-cols-2' : ''}`}>
            {images.map((url, index) => (
              <figure key={url} className="min-w-0 overflow-hidden rounded-lg border border-border">
                <Image unoptimized src={url} alt={`Approved Accelerated campaign ${review.kind === 'carousel' ? `slide ${index + 1} of 8` : 'image'}`} width={1080} height={1080} className="h-auto w-full" />
                {review.kind === 'carousel' && <figcaption className="p-2 text-xs text-muted-foreground">Slide {index + 1} of 8</figcaption>}
              </figure>
            ))}
          </div>
          {!images.length && <p className="mt-2 text-sm text-muted-foreground">Loading approved assets…</p>}
        </div>
      ) : <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">Approved visual binding is unavailable. Review remains blocked.</p>}
      <p className="mt-4 text-xs text-muted-foreground">Visual source manifest SHA-256: <span className="break-all font-mono">{review.sourceManifestSha256 || 'Missing'}</span></p>
      <p className="mt-1 text-xs text-muted-foreground">JIT packet SHA-256: <span className="break-all font-mono">{review.jitPacketSha256 || 'Missing'}</span></p>
      <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">External actions remain locked in the general workflow. Only the exact campaign schedule below can unlock after its separate checks pass; provider generation, uploads, spending, and outreach stay blocked.</p>
      <section aria-label="Accelerated campaign activation" className="mt-4 rounded-lg border border-border bg-background p-4">
        <h3 className="text-base font-semibold">Exact campaign schedule</h3>
        <p className="mt-1 text-sm text-muted-foreground">Only this approved record, its linked calendar time, fixed copy, approved raster treatment, and configured AmaduTown channel can pass this control.</p>
        <p className="mt-2 text-sm">{activation?.scheduledFor ? `Calendar time: ${new Date(activation.scheduledFor).toLocaleString()}` : 'Checking current calendar and account evidence…'}</p>
        {activation?.blockers?.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-200">{activation.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul> : null}
        {activationError && <p role="alert" className="mt-3 text-sm text-red-300">{activationError}</p>}
        <button type="button" onClick={() => void scheduleApprovedRecord()} disabled={!activation?.ready || scheduling || !assetsLoaded || assetError}
          className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-300 sm:w-auto">
          {scheduling ? 'Confirming schedule…' : 'Schedule approved record'}
        </button>
      </section>
    </section>
  )
}
