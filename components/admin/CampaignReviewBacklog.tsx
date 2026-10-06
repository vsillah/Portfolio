'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { ReviewCadence, ReviewProjection, ReviewRow } from '@/lib/campaign-review-cadence'

type Props = { campaignId: string; authedFetch: (url: string, init?: RequestInit) => Promise<Response> }
export default function CampaignReviewBacklog({ campaignId, authedFetch }: Props) {
  const [data, setData] = useState<ReviewProjection | null>(null)
  const [config, setConfig] = useState<ReviewCadence | null>(null)
  const [filter, setFilter] = useState<'all' | ReviewRow['state']>('all')
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const load = useCallback(async (method = 'GET', body?: unknown) => {
    setBusy(true); setError('')
    try {
      const response = await authedFetch(`/api/admin/campaigns/${campaignId}/review-backlog`, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not load review backlog.')
      setData(result); setConfig(result.config)
      if (method === 'POST') { setNotice(`${result.prepared_count} prepared for review. ${result.gap} still needed for the horizon.`); setFilter('ready'); setPage(0) }
      if (method === 'PATCH') setNotice('Review cadence saved.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Review backlog unavailable.') }
    finally { setBusy(false) }
  }, [authedFetch, campaignId])
  useEffect(() => { void load() }, [load])
  const changeFilter = (value: typeof filter) => { setFilter(value); setPage(0) }
  const rows = data?.rows.filter(r => filter === 'all' || r.state === filter) || []
  const stamp = (value: string) => new Intl.DateTimeFormat('en-US', { timeZone: data?.config.timezone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
  return <section aria-label="Rolling review backlog" className="admin-console-card mb-4 min-w-0 rounded-lg border p-3 sm:p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 basis-52"><h2 className="text-lg font-semibold">Next content review</h2><p className="mt-1 text-sm text-muted-foreground break-words">{data ? `${data.campaign.name} · ${data.campaign.status}` : 'Loading campaign coverage…'}</p></div>
      <button className="admin-console-button-primary max-w-full whitespace-normal text-left disabled:opacity-50" disabled={busy || !data?.eligible || !data.gap || !data.batch_remaining} onClick={() => load('POST', { action: 'prepare' })}>{busy ? 'Working…' : 'Prepare next review batch'}</button>
    </div>
    {error && <div role="alert" className="mt-3 text-sm text-red-300">{error} <button className="underline" onClick={() => load()}>Retry</button></div>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-300">{notice}</p>}
    {data && <>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Coverage filters">
        {([
          ['ready', data.ready, 'Ready'], ['blocked', data.blocked, 'Blocked'], ['eligible', data.eligible, 'To prepare'], ['all', data.rows.length, `${data.config.horizon_days}-day horizon`],
        ] as const).map(([key, count, label]) => <button key={key} aria-pressed={filter === key} onClick={() => changeFilter(key)} className={`min-w-0 rounded-md border p-2 text-left ${filter === key ? 'border-radiant-gold bg-radiant-gold/10' : 'border-white/15'}`}><span className="block text-xl font-semibold">{count}</span><span className="block text-xs leading-5 break-words">{label}</span></button>)}
      </div>
      <p className="mt-3 text-sm">{data.coverage_days} days covered · {data.ready}/{data.config.target_ready} ready · {data.gap} gap</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">Next {data.next_batch.kind} batch: {stamp(data.next_batch.at)} · up to {data.next_batch.limit}. {data.config.timezone}</p>
      {!data.eligible && data.gap > 0 && <p className="mt-2 text-sm text-amber-200">{data.blocked ? 'Resolve blocked records to refill this horizon.' : 'Add calendar items and link approved evidence to fill the gap.'} <a onClick={() => { const panel = document.getElementById("calendar-planning"); if (panel instanceof HTMLDetailsElement) panel.open = true }} href="#calendar-planning" className="underline">Open calendar planning</a></p>}
      {!data.batch_remaining && data.gap > 0 && <p className="mt-2 text-xs text-muted-foreground">This batch is prepared. Open Ready items to review the copy; the next window will refill the remaining gap.</p>}
      {!data.gap && <p className="mt-2 text-xs text-muted-foreground">Review-ready target reached. Open a ready item to review its copy.</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{filter === 'all' ? 'Calendar items' : `${filter === 'eligible' ? 'To prepare' : filter[0].toUpperCase() + filter.slice(1)} items`} ({rows.length})</h3>{filter !== 'all' && <button className="text-xs underline" onClick={() => changeFilter('all')}>Clear filter</button>}</div>
      <ul className="mt-2 divide-y divide-white/10">
        {rows.slice(page * 5, page * 5 + 5).map(row => <li key={row.id} className="py-3 min-w-0"><div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><span className="min-w-0 flex-1 basis-44 text-sm font-medium break-words">{row.title}</span><span className="text-xs leading-5 text-muted-foreground">{row.channel.replaceAll('_', ' ')} · {row.state === 'eligible' ? 'to prepare' : row.state}</span></div><div className="mt-1 flex flex-wrap justify-between gap-2 text-xs leading-5"><span className={row.reason ? 'text-amber-200' : 'text-muted-foreground'}>{row.reason || stamp(row.scheduled_for)}</span><Link prefetch={false} href={row.href} className="text-blue-200 underline">{row.state === 'blocked' ? 'Resolve blocker' : 'Review copy'}</Link></div><details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">Provenance</summary><p className="break-all leading-5">Calendar {row.id} · {row.phase} · Work {row.work_item_id || 'unlinked'} · Draft {row.social_content_id || 'unlinked'} · Evidence {row.evidence_ids.join(', ') || 'unlinked'}</p>{row.social_content_id && <Link prefetch={false} className="underline" href={`/admin/social-content/${row.social_content_id}`}>Open Social Content draft</Link>}</details></li>)}
      </ul>
      {!rows.length && <p className="py-3 text-sm text-muted-foreground">No {filter === 'all' ? 'calendar' : filter} items in this horizon. <a onClick={() => { const panel = document.getElementById("calendar-planning"); if (panel instanceof HTMLDetailsElement) panel.open = true }} href="#calendar-planning" className="underline">Open calendar planning</a></p>}
      {rows.length > 5 && <div className="flex flex-wrap items-center gap-3 text-sm"><button disabled={page === 0} className="underline disabled:opacity-40" onClick={() => setPage(p => p - 1)}>Previous</button><span>{page + 1}/{Math.ceil(rows.length / 5)}</span><button disabled={(page + 1) * 5 >= rows.length} className="underline disabled:opacity-40" onClick={() => setPage(p => p + 1)}>Next</button></div>}
      <details className="mt-4 border-t border-white/10 pt-3"><summary className="cursor-pointer text-sm">Review cadence</summary><p className="my-2 text-xs text-muted-foreground">Internal review only. Mon/Wed/Fri primary; Tue/Thu revision and gaps. Sunday refresh: {stamp(data.next_refresh.at)}.</p>
        {config && <form onSubmit={e => { e.preventDefault(); void load('PATCH', { config }) }}>
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            {([['horizon_days', 'Horizon days', 60], ['target_ready', 'Ready target', 50], ['primary_limit', 'Primary batch limit', 10], ['revision_limit', 'Revision batch limit', 10]] as const).map(([key, label, max]) => <label key={key} className="text-xs">{label}<input className="mt-1 block w-full min-w-0 rounded border border-white/20 bg-background p-2" type="number" min={1} max={max} required value={config[key]} onChange={e => setConfig({ ...config, [key]: Number(e.target.value) })}/></label>)}
            {([['review_time', 'Weekday review time'], ['refresh_time', 'Sunday refresh time']] as const).map(([key, label]) => <label key={key} className="text-xs">{label}<input className="mt-1 block w-full min-w-0 rounded border border-white/20 bg-background p-2" type="time" required value={config[key]} onChange={e => setConfig({ ...config, [key]: e.target.value })}/></label>)}
            <label className="text-xs">Timezone<input className="mt-1 block w-full min-w-0 rounded border border-white/20 bg-background p-2" required value={config.timezone} onChange={e => setConfig({ ...config, timezone: e.target.value })}/></label>
          </div><button className="admin-console-button-secondary mt-3" disabled={busy || !data.anchor_id}>Save cadence</button>
        </form>}
      </details>
    </>}
  </section>
}
