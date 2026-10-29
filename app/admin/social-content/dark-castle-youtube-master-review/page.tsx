import Image from 'next/image'
import Link from 'next/link'

const assetRoot = '/review-assets/social-content/dark-castle-youtube-master-2026-10-29'

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
    name: 'Product-led continuity',
    teaser: 'THE BOARD REMEMBERED.',
    src: `${assetRoot}/02-board-remembered.png`,
    rationale: 'Makes the owned gameplay the hero and shows the evidence-backed Explore-to-play continuity in one-second visual language.',
  },
  {
    id: 'C',
    name: 'Builder and reasoning tension',
    teaser: 'RIGHT MOVE. WRONG REASON?',
    src: `${assetRoot}/03-accidental-success.png`,
    rationale: 'Pairs the presenter with the live response state to frame the difference between reaching a square and preserving the decision context.',
  },
]

export default function DarkCastleYouTubeMasterReviewPage() {
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
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Review the customer-facing video and choose among three evidence-backed thumbnail styles. Operator receipts are separated below so internal provenance never appears in the published media.</p>
        </div>
        <Link href="/admin/social-content/c12378f2-36de-4bf7-8c5d-0ce754e727eb?step=copy" className="text-sm font-semibold text-primary hover:underline">Open canonical record</Link>
      </header>

      <section aria-labelledby="customer-output-heading" className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-300">Customer-facing output</p>
          <h2 id="customer-output-heading" className="mt-1 text-xl font-semibold text-foreground">Final review master</h2>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-black">
          <video className="aspect-video w-full" controls preload="metadata" poster={`${assetRoot}/01-builder-doubt.png`}>
            <source src={`${assetRoot}/dark-castle-youtube-master.mp4`} type="video/mp4" />
          </video>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="border-l-4 border-emerald-400 bg-muted/30 p-3"><div className="text-xs text-muted-foreground">Runtime</div><div className="mt-1 font-semibold">3:05 final</div></div>
          <div className="border-l-4 border-amber-400 bg-muted/30 p-3"><div className="text-xs text-muted-foreground">Product proof</div><div className="mt-1 font-semibold">Owned live gameplay</div></div>
          <div className="border-l-4 border-sky-400 bg-muted/30 p-3"><div className="text-xs text-muted-foreground">Conclusion</div><div className="mt-1 font-semibold">Spoken CTA included</div></div>
        </div>
      </section>

      <section aria-labelledby="thumbnail-heading" className="space-y-4 border-t border-border pt-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-semibold uppercase text-amber-300">Decision required</p><h2 id="thumbnail-heading" className="mt-1 text-xl font-semibold">Choose one thumbnail direction</h2></div>
          <p className="text-sm text-muted-foreground">All three passed 320×180 and 160×90 legibility checks.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {thumbnails.map((thumbnail) => (
            <article key={thumbnail.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <Image src={thumbnail.src} alt={`Thumbnail ${thumbnail.id}: ${thumbnail.teaser}`} width={1280} height={720} className="aspect-video w-full object-cover" />
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{thumbnail.id}. {thumbnail.name}</h3><span className="rounded border border-border px-2 py-1 text-xs">Distinct style</span></div>
                <p className="text-sm font-semibold text-amber-200">{thumbnail.teaser}</p>
                <p className="text-sm leading-5 text-muted-foreground">{thumbnail.rationale}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

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
              <li><span className="font-semibold text-foreground">Final master:</span> <span className="font-mono">sha256:f5178489…d5c2d5</span></li>
              <li><span className="font-semibold text-foreground">Closed:</span> YouTube upload, platform draft, scheduling, publishing, cross-posting, and LinkedIn alteration.</li>
            </ul>
          </details>
        </div>
      </section>
    </main>
  )
}
