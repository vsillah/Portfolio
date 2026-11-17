'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { fetchWithSessionRecovery } from '@/lib/authenticated-fetch'
import type { AcceleratedCampaignReview as Review } from '@/lib/social-accelerated-campaign-review'

export default function AcceleratedCampaignReview({ review, postText }: { review: Review; postText: string }) {
  const [images, setImages] = useState<string[]>([])
  const [assetError, setAssetError] = useState(false)
  const assetsLoaded = review.kind === 'text_only' || images.length === review.assetUrls.length

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
      <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">External actions remain locked: provider generation, upload, scheduling, publishing, posting, spending, and outreach require separate authorization.</p>
    </section>
  )
}
