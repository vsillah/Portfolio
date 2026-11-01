'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import DarkCastleApprovedBinding from '@/components/admin/DarkCastleApprovedBinding'

const assetRoot = '/review-assets/social-content/dark-castle-youtube-master-2026-10-29'
const approvedThumbnailId = 'C' as const

const thumbnails = [
  {
    id: 'A',
    name: 'Human-led product proof',
    teaser: "A MOVE ISN'T PROOF.",
    src: `${assetRoot}/01-builder-doubt.png`,
    rationale: 'Uses the approved rotating HeyGen chessboard look as the dominant focal point and integrates the real handoff state without covering the face.',
  },
  {
    id: 'B',
    name: 'Pattern-alert continuity',
    teaser: 'THE BOARD REMEMBERED.',
    src: `${assetRoot}/02-board-remembered-v2.png`,
    rationale: 'Uses a fresh expressive hero shot and the real handoff state to show that the product preserves decision context.',
  },
  {
    id: 'C',
    name: 'Builder and reasoning tension',
    teaser: 'RIGHT MOVE. WRONG REASON?',
    src: `${assetRoot}/03-accidental-success-v2.png`,
    rationale: 'Uses a distinct skeptical-reaction hero shot with the live response state, without masks or blur effects, to question accidental success.',
  },
]

export default function DarkCastleYouTubeMasterReviewPage() {
  const [selectedThumbnailId, setSelectedThumbnailId] = useState<'A' | 'B' | 'C'>(approvedThumbnailId)
  const selectedThumbnail = thumbnails.find((thumbnail) => thumbnail.id === selectedThumbnailId) ?? thumbnails[0]
  const approvedThumbnail = thumbnails.find((thumbnail) => thumbnail.id === approvedThumbnailId) ?? thumbnails[2]

  return (
    <main className="mx-auto w-full max-w-[1480px] space-y-6 px-4 py-6 sm:px-6 lg:px-8" data-testid="dark-castle-youtube-master-review">
      <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold uppercase text-amber-100">Human QA · Review only</span>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-100">Evidence cohort 3/3</span>
            <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground">External execution closed</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-foreground sm:text-3xl">Dark Castle Chess YouTube master</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Human QA approved Direction C. The other evidence-backed candidates remain selectable for comparison only, while operator receipts stay separated from the published media.</p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/admin/social-content/dark-castle-youtube-receipt-review" className="text-primary hover:underline">Review six receipt packets</Link>
          <Link href="/admin/social-content/c12378f2-36de-4bf7-8c5d-0ce754e727eb?step=copy" className="text-primary hover:underline">Open canonical record</Link>
        </div>
      </header>

      <section aria-labelledby="customer-output-heading" className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-300">Customer-facing output</p>
          <h2 id="customer-output-heading" className="mt-1 text-xl font-semibold text-foreground">Final review master</h2>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-black">
          <video className="aspect-video w-full" controls preload="metadata" poster={`${assetRoot}/03-accidental-success-v2.png`}>
            <source src={`${assetRoot}/dark-castle-youtube-master.mp4`} type="video/mp4" />
          </video>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="border-l-4 border-emerald-400 bg-muted/30 p-3"><div className="text-xs text-muted-foreground">Runtime</div><div className="mt-1 font-semibold">3:05 final</div></div>
          <div className="border-l-4 border-amber-400 bg-muted/30 p-3"><div className="text-xs text-muted-foreground">Editorial cadence</div><div className="mt-1 font-semibold">35 timed visual beats</div></div>
          <div className="border-l-4 border-sky-400 bg-muted/30 p-3"><div className="text-xs text-muted-foreground">Typical shot</div><div className="mt-1 font-semibold">5 seconds · 7.5 max before CTA</div></div>
        </div>
      </section>

      <section aria-labelledby="pacing-heading" className="space-y-4 border-t border-border pt-6">
        <div><p className="text-xs font-semibold uppercase text-cyan-300">Retention-led edit</p><h2 id="pacing-heading" className="mt-1 text-xl font-semibold">The chessboard is evidence, not the whole visual language</h2></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">First 30 seconds</p><p className="mt-2 text-2xl font-semibold">7 visual forms</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Presenter, kinetic type, decision fork, evidence boundary, and product preview fulfill the opening promise.</p></div>
          <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Gameplay</p><p className="mt-2 text-2xl font-semibold">3 excerpts</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Separate, non-repeating moments show Explore, handoff, and response.</p></div>
          <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Presenter</p><p className="mt-2 text-2xl font-semibold">8 short returns</p><p className="mt-2 text-xs leading-5 text-muted-foreground">The native performance re-hooks the story instead of holding the screen for whole sections.</p></div>
          <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Pattern interrupts</p><p className="mt-2 text-2xl font-semibold">12 treatments</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Animated diagrams, product crops, candidate moves, model steps, and kinetic payoff cards.</p></div>
        </div>
        <details className="rounded-lg border border-border bg-card p-4">
          <summary className="cursor-pointer font-semibold">Inspect pacing evidence and editorial inference</summary>
          <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
            <p>Official YouTube guidance anchors the first 30-second promise, audience-retention review, and pacing experimentation. YouTube does not prescribe a universal cut interval; the 3–7 second target is this production&apos;s documented editorial inference.</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><a className="text-primary underline" href="https://support.google.com/youtube/answer/16559650?hl=en" target="_blank" rel="noreferrer">YouTube Help · Optimize your video</a></li>
              <li><a className="text-primary underline" href="https://support.google.com/youtube/answer/9314415?hl=en-GB" target="_blank" rel="noreferrer">YouTube Help · Audience retention</a></li>
              <li><a className="text-primary underline" href="https://blog.youtube/creator-and-artist-stories/master-these-4-metrics/" target="_blank" rel="noreferrer">YouTube Blog · Master these four metrics</a></li>
            </ul>
          </div>
        </details>
      </section>

      <section aria-labelledby="thumbnail-heading" className="space-y-4 border-t border-border pt-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-semibold uppercase text-emerald-300">Human QA approved · Direction C</p><h2 id="thumbnail-heading" className="mt-1 text-xl font-semibold">Review the thumbnail directions</h2></div>
          <p className="text-sm text-muted-foreground">All three require distinct hero shots and passed 320×180 and 160×90 legibility checks.</p>
        </div>
        <fieldset className="grid gap-5 lg:grid-cols-3" aria-describedby="thumbnail-selection-status">
          <legend className="sr-only">Thumbnail direction</legend>
          {thumbnails.map((thumbnail) => (
            <label
              key={thumbnail.id}
              className={`group relative cursor-pointer overflow-hidden rounded-lg border bg-card transition focus-within:outline-none focus-within:ring-2 focus-within:ring-amber-300 focus-within:ring-offset-2 focus-within:ring-offset-background ${selectedThumbnailId === thumbnail.id ? 'border-amber-300 ring-1 ring-amber-300/60' : 'border-border hover:border-amber-300/60'}`}
              data-testid={`thumbnail-option-${thumbnail.id}`}
            >
              <input
                type="radio"
                name="thumbnail-direction"
                value={thumbnail.id}
                checked={selectedThumbnailId === thumbnail.id}
                onChange={() => setSelectedThumbnailId(thumbnail.id as 'A' | 'B' | 'C')}
                className="sr-only"
                aria-label={`Select thumbnail ${thumbnail.id}: ${thumbnail.name}`}
              />
              <Image src={thumbnail.src} alt={`Thumbnail ${thumbnail.id}: ${thumbnail.teaser}`} width={1280} height={720} className="aspect-video w-full object-cover" />
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{thumbnail.id}. {thumbnail.name}</h3>
                  <span className={`shrink-0 rounded border px-2 py-1 text-xs font-semibold ${thumbnail.id === approvedThumbnailId ? 'border-emerald-300 bg-emerald-300/15 text-emerald-100' : selectedThumbnailId === thumbnail.id ? 'border-amber-300 bg-amber-300/15 text-amber-100' : 'border-border text-muted-foreground'}`}>{thumbnail.id === approvedThumbnailId ? 'Approved' : selectedThumbnailId === thumbnail.id ? 'Previewing' : 'Preview'}</span>
                </div>
                <p className="text-sm font-semibold text-amber-200">{thumbnail.teaser}</p>
                <p className="text-sm leading-5 text-muted-foreground">{thumbnail.rationale}</p>
              </div>
            </label>
          ))}
        </fieldset>
        <div id="thumbnail-selection-status" aria-live="polite" className="flex flex-col gap-2 border-l-4 border-amber-300 bg-amber-300/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-foreground">{selectedThumbnail.id === approvedThumbnailId ? `Direction ${approvedThumbnailId} approved` : `Previewing direction ${selectedThumbnail.id}`}</p>
            <p className="mt-1 text-sm text-muted-foreground">{selectedThumbnail.name} · {selectedThumbnail.teaser}{selectedThumbnail.id === approvedThumbnailId ? '' : ` · Approved direction remains ${approvedThumbnail.id}`}</p>
          </div>
          <p className="text-xs leading-5 text-muted-foreground sm:max-w-xs sm:text-right">Review selection only. Upload, scheduling, publishing, and external execution remain closed.</p>
        </div>
      </section>

      <DarkCastleApprovedBinding />

      <section aria-labelledby="trace-heading" className="space-y-3 border-t border-border pt-6">
        <div><p className="text-xs font-semibold uppercase text-sky-300">Operator evidence · Not customer-facing</p><h2 id="trace-heading" className="mt-1 text-xl font-semibold">Trace and execution boundaries</h2></div>
        <div className="grid gap-3 lg:grid-cols-2">
          <details className="rounded-lg border border-border bg-card p-4" open>
            <summary className="cursor-pointer font-semibold">Source and copy binding</summary>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Canonical record</dt><dd className="mt-1 break-all font-mono">c12378f2-36de-4bf7-8c5d-0ce754e727eb</dd></div>
              <div><dt className="text-muted-foreground">Content version</dt><dd className="mt-1 break-all font-mono">sha256:4b4126fe…00342a</dd></div>
              <div><dt className="text-muted-foreground">Description receipt</dt><dd className="mt-1 break-all font-mono">youtube-description:dark-castle:sha256:224f7d07a4d55a9d</dd></div>
              <div><dt className="text-muted-foreground">Evidence receipt</dt><dd className="mt-1 break-all font-mono">youtube-description-evidence-reconciliation:fnv1a:07f944bb</dd></div>
            </dl>
          </details>
          <details className="rounded-lg border border-border bg-card p-4" open>
            <summary className="cursor-pointer font-semibold">Media receipts and gates</summary>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><span className="font-semibold text-foreground">Presenter:</span> approved Vambah at the chessboard look, Avatar V, ElevenLabs voice, one bounded job.</li>
              <li><span className="font-semibold text-foreground">Provider usage:</span> 148 subscription credits, $0 incremental charge, zero retries.</li>
              <li><span className="font-semibold text-foreground">Gameplay:</span> live browser capture of Explore, e4 handoff, computer response, notation, guidance, and candidate moves.</li>
              <li><span className="font-semibold text-foreground">Music:</span> authorized The Stream 2.0 stem, mild under-speech mix.</li>
              <li><span className="font-semibold text-foreground">Presenter edit:</span> native 1.0x performance in eight short full-frame returns; no provider retry.</li>
              <li><span className="font-semibold text-foreground">Pacing:</span> 35 timed beats, 5-second median shot, 7.5-second maximum non-CTA hold.</li>
              <li><span className="font-semibold text-foreground">Caption contrast:</span> branded opaque lower thirds with white headline text and accent rails across every product-detail shot.</li>
              <li><span className="font-semibold text-foreground">Final master:</span> <span className="font-mono">sha256:2371cd46…11f36</span></li>
              <li><span className="font-semibold text-foreground">Closed:</span> YouTube upload, platform draft, scheduling, publishing, cross-posting, and LinkedIn alteration.</li>
            </ul>
          </details>
        </div>
      </section>
    </main>
  )
}
