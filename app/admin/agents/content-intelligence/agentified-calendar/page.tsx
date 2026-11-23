import Link from 'next/link'
import { agentifiedCalendarDrafts } from '@/lib/agentified-calendar-drafts'

export const dynamic = 'force-dynamic'

const route = '/admin/agents/content-intelligence/agentified-calendar'
const channels = ['linkedin', 'instagram', 'instagram_reels', 'youtube', 'youtube_shorts']
const phases = ['tease', 'teach', 'proof', 'offer']

export default async function AgentifiedCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; channel?: string; phase?: string; asset?: string }>
}) {
  const params = await searchParams
  const drafts = agentifiedCalendarDrafts()
  const q = (params.q ?? '').trim().toLowerCase()
  const filtered = drafts.filter((draft) =>
    (!q || [draft.title, draft.asset_id, draft.planned_angle, draft.campaign_name]
      .some((value) => value.toLowerCase().includes(q)))
    && (!params.channel || draft.channel === params.channel)
    && (!params.phase || draft.campaign_phase === params.phase))

  return (
    <main className="mx-auto min-h-screen max-w-7xl overflow-x-hidden px-4 py-8 text-foreground sm:px-6">
      <Link href="/admin/agents/content-intelligence?section=calendar" className="text-sm text-blue-300 underline">
        Release Calendar
      </Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">Inactive Draft · internal review</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Agentified campaign calendar</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Ten source-bound planning records in the Release Calendar framework. Dates describe the approved editorial sequence; they do not schedule a platform action.
          </p>
        </div>
        <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-200">
          {drafts.length} Drafts · 0 active
        </span>
      </div>

      <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
        Provider generation, uploads, external scheduling, publishing, email, outreach, and paid X access are locked. X cutdowns remain manual-only and the two email proposals are outside these calendar records.
      </div>

      <form action={route} className="mt-6 grid gap-3 rounded-xl border border-silicon-slate/70 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_minmax(0,10rem)_auto]">
        <label className="min-w-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Search
          <input name="q" defaultValue={params.q ?? ''} placeholder="Title, asset ID, angle" className="mt-1 block w-full min-w-0 rounded-md border border-silicon-slate/70 bg-background p-2 text-sm text-foreground" />
        </label>
        <label className="min-w-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Channel
          <select name="channel" defaultValue={params.channel ?? ''} className="mt-1 block w-full min-w-0 rounded-md border border-silicon-slate/70 bg-background p-2 text-sm text-foreground">
            <option value="">All channels</option>
            {channels.map((channel) => <option key={channel} value={channel}>{channel.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Phase
          <select name="phase" defaultValue={params.phase ?? ''} className="mt-1 block w-full min-w-0 rounded-md border border-silicon-slate/70 bg-background p-2 text-sm text-foreground">
            <option value="">All phases</option>
            {phases.map((phase) => <option key={phase} value={phase}>{phase}</option>)}
          </select>
        </label>
        <button type="submit" className="self-end rounded-md border border-blue-400/50 bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-100">Filter</button>
      </form>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>Showing {filtered.length} of {drafts.length} Drafts</span>
        <Link href={route} className="text-blue-300 underline">Clear filters</Link>
      </div>

      <div className="mt-5 space-y-3">
        {filtered.map((draft) => (
          <details key={draft.id} id={draft.asset_id} open={params.asset === draft.asset_id} className="min-w-0 overflow-hidden rounded-xl border border-silicon-slate/70 bg-silicon-slate/15">
            <summary className="grid cursor-pointer list-none gap-3 p-4 sm:grid-cols-[9rem_minmax(0,1fr)_9rem_6rem] sm:items-center">
              <span className="text-sm text-muted-foreground">{new Date(draft.scheduled_for).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} ET</span>
              <span className="min-w-0"><strong className="block break-words text-sm">{draft.title}</strong><small className="block text-muted-foreground">{draft.asset_id} · {draft.campaign_phase} · {draft.template_key}</small></span>
              <span className="text-sm capitalize">{draft.channel.replaceAll('_', ' ')}</span>
              <span className="w-fit rounded-full border border-amber-400/40 px-2 py-0.5 text-xs font-bold text-amber-200">Draft</span>
            </summary>
            <div className="grid min-w-0 gap-5 border-t border-silicon-slate/70 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-w-0 space-y-3 text-sm">
                <p><strong>Campaign:</strong> {draft.campaign_name}</p>
                <p><strong>Angle:</strong> {draft.planned_angle}</p>
                <p><strong>Preparation:</strong> {new Date(draft.preparation_deadline).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} ET</p>
                <p><strong>CTA:</strong> <a href={draft.cta_url} className="break-all text-blue-300 underline">{draft.cta_url}</a></p>
                <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-amber-100"><strong>Actions blocked:</strong> {draft.gate}</p>
                <p className="break-all text-xs text-muted-foreground">Source: {draft.draft_asset_path} · SHA-256 {draft.copy_sha256}</p>
                <p className="break-all text-xs text-muted-foreground">Packet: {draft.packet_path} · SHA-256 {draft.packet_sha256}</p>
                <p className="break-all text-xs text-muted-foreground">Visual manifest: {draft.manifest_path} · SHA-256 {draft.manifest_sha256}</p>
                <p className="break-all text-xs text-muted-foreground">Source paths: {draft.source_paths.join(', ')}</p>
                <p className="break-all text-xs text-muted-foreground">Stable ID: {draft.id}</p>
              </div>
              <div className="min-w-0 space-y-4">
                <div>
                  <h2 className="mb-2 text-sm font-semibold">Approved source copy</h2>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border border-silicon-slate/70 bg-background p-3 font-sans text-xs leading-5">{draft.copy}</pre>
                </div>
                {draft.media.length ? <div>
                  <h2 className="mb-2 text-sm font-semibold">Source-bound visual previews</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {draft.media.map((asset) => <div key={asset.path} className="min-w-0 rounded-md border border-silicon-slate/70 p-2">
                      {asset.type === 'video'
                        ? <video controls preload="metadata" className="max-h-64 w-full" src={asset.url} />
                        // eslint-disable-next-line @next/next/no-img-element
                        : <img src={asset.url} alt={`${draft.asset_id} internal visual preview`} className="max-h-64 w-full object-contain" />}
                      <p className="mt-1 break-all text-[0.65rem] text-muted-foreground">{asset.path.split('/').at(-1)} · SHA-256 {asset.sha256}</p>
                    </div>)}
                  </div>
                </div> : <p className="text-xs text-muted-foreground">No raster asset is bound to this copy-only Draft.</p>}
              </div>
            </div>
          </details>
        ))}
        {!filtered.length ? <p className="rounded-xl border border-silicon-slate/70 p-8 text-center text-sm text-muted-foreground">No Drafts match these filters. Clear filters to restore the full campaign.</p> : null}
      </div>
    </main>
  )
}
