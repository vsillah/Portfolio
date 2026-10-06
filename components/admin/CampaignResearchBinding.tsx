'use client'

import { useEffect, useState } from 'react'
import type { AgentWorkItem } from '@/lib/agent-work-items'
import type { ResearchCalendarTarget } from '@/lib/campaign-research-targets'
import { campaignResearchBlocker, researchPacketBlocker } from '@/lib/campaign-research-targets'

type Packet = { id: string; title: string | null; source_url: string; status: string; pattern_status: string; pattern_packet?: unknown; updated_at: string }
type Props = { packets: Packet[]; calendarItems: ResearchCalendarTarget[]; authedFetch: (url: string, init?: RequestInit) => Promise<Response>; onLinked: () => Promise<void> }
const field = 'mt-1 w-full min-w-0 rounded-lg border border-white/20 bg-slate-950 p-2 text-sm text-white'

export default function CampaignResearchBinding({ packets, calendarItems, authedFetch, onLinked }: Props) {
  const [targets, setTargets] = useState<AgentWorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [campaign, setCampaign] = useState('')
  const [packetIds, setPacketIds] = useState<string[]>([])
  const [targetIds, setTargetIds] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    authedFetch('/api/admin/agents/work-items?source_type=social_content_calendar_authorization&limit=500')
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Unable to load campaign handoffs. Sign in as an admin and retry.')
        if (active) setTargets(Array.isArray(body.work_items) ? body.work_items : [])
      }).catch(err => { if (active) { setTargets([]); setError(err.message) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [authedFetch, refresh])
  const campaigns = Array.from(new Map(targets.filter(t => t.metadata?.campaign_id).map(t => [String(t.metadata.campaign_id), String(t.metadata.campaign_name || t.metadata.campaign_id)])).entries())
  const visible = targets.filter(t => !campaign || t.metadata?.campaign_id === campaign)
  const blocker = (t: AgentWorkItem) => campaignResearchBlocker(t, calendarItems.find(c => c.id === t.metadata?.calendar_item_id))
  const selectedPackets = packets.filter(p => packetIds.includes(p.id))
  const selectedTargets = visible.filter(t => targetIds.includes(t.id))
  const invalid = selectedPackets.some(p => researchPacketBlocker(p)) || selectedTargets.some(t => blocker(t))
  const toggle = (ids: string[], id: string) => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
  async function bind() {
    if (busy || invalid || !selectedPackets.length || !selectedTargets.length || !note.trim()) return
    setBusy(true); setError(''); setNotice('')
    let approved = 0, linked = 0
    try {
      // Reuse the version-checked approval endpoint and its operator review audit.
      for (const p of selectedPackets) {
        if (p.status === 'approved') continue
        const response = await authedFetch(`/api/admin/social-content/intelligence/research-packets/${p.id}/review`, {
          method: 'POST', body: JSON.stringify({ decision: 'approved', note: note.trim(), updated_at: p.updated_at }),
        })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Packet approval failed.')
        approved++
      }
      for (const target of selectedTargets) {
        const response = await authedFetch(`/api/admin/agents/work-items/${target.id}/research-packets`, {
          method: 'POST', body: JSON.stringify({ mode: 'link_approved', packet_ids: selectedPackets.map(p => p.id), decision_note: note.trim() }),
        })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || `Evidence linking failed for ${target.title}.`)
        linked++
      }
      setNotice(`${selectedPackets.length} packet(s) linked to ${linked} handoff(s). Evidence binding only; no external action ran.`)
      setTargetIds([]); setPacketIds([]); setNote('')
    } catch (err) {
      setError(`${approved} packet(s) approved; ${linked} handoff(s) linked before stopping. ${err instanceof Error ? err.message : 'Unable to bind evidence.'} Refresh and retry remaining targets; relinking does not duplicate patterns.`)
    } finally {
      await onLinked()
      setRefresh(n => n + 1)
      setBusy(false)
    }
  }
  return <div className="min-w-0 space-y-3 text-sm" aria-label="Campaign research binding">
    <p className="text-muted-foreground">Approve selected usable public patterns and bind their provenance to existing campaign handoffs. No drafts, provider jobs, uploads, scheduling, publishing, or external sends run.</p>
    {error && <div role="alert" className="break-words text-red-300">{error} <button type="button" disabled={busy} onClick={() => setRefresh(n => n + 1)} className="underline">Retry loading handoffs</button></div>}
    {notice && <p role="status" className="text-emerald-300">{notice}</p>}
    {loading ? <p>Loading campaign handoffs…</p> : <>
      <label className="block">Campaign filter<select className={field} value={campaign} disabled={busy} onChange={e => { setCampaign(e.target.value); setTargetIds([]) }}><option value="">All campaigns</option>{campaigns.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <p>{visible.length} handoffs shown · {selectedTargets.length} selected · up to 500 loaded</p>
      {!visible.length && <p>No campaign handoffs found. <a className="underline" href="/admin/agents/content-intelligence?section=calendar">Open the campaign calendar to authorize a draft handoff.</a></p>}
      <fieldset disabled={busy} className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0"><h3 className="mb-2 font-semibold">Research packets</h3><div className="max-h-80 space-y-2 overflow-y-auto">
          {!packets.length && <p>No packets available. Record public evidence in Research first.</p>}
          {packets.map(p => { const reason = researchPacketBlocker(p); return <label key={p.id} className="flex items-start gap-2 rounded-lg border border-white/10 p-3"><input type="checkbox" className="mt-1 shrink-0" checked={packetIds.includes(p.id)} disabled={!!reason} onChange={() => setPacketIds(ids => toggle(ids, p.id))}/><span className="min-w-0 break-words"><span className="block">{p.title || p.source_url}</span><span className="text-xs text-muted-foreground">{reason || (p.status === 'approved' ? 'Approved · ready to link' : 'Awaiting your approval')}</span></span></label> })}
        </div></div>
        <div className="min-w-0"><h3 className="mb-2 font-semibold">Campaign handoffs</h3><div className="max-h-80 space-y-2 overflow-y-auto">
          {visible.map(t => { const m = t.metadata; const reason = blocker(t); const count = Array.isArray(m.research_packet_ids) ? new Set(m.research_packet_ids).size : 0; return <label key={t.id} className="flex items-start gap-2 rounded-lg border border-white/10 p-3"><input type="checkbox" className="mt-1 shrink-0" checked={targetIds.includes(t.id)} disabled={!!reason} onChange={() => setTargetIds(ids => toggle(ids, t.id))}/><span className="min-w-0 break-words"><span className="block">{t.title}</span><span className="block text-xs text-muted-foreground">{String(m.campaign_name || m.campaign_id || 'No campaign')} · {String(m.channel || 'No channel')} · {String(m.campaign_phase || 'No phase')}</span><span className="block text-xs text-muted-foreground">Planned date: {String(m.scheduled_for || 'Not set')} · {count} linked</span>{reason && <span className="block text-xs text-amber-200">{reason}</span>}</span></label> })}
        </div></div>
      </fieldset>
      <label className="block">Campaign evidence decision note<textarea value={note} maxLength={2000} disabled={busy} onChange={e => setNote(e.target.value)} rows={2} className={field} placeholder="Why these frameworks fit the selected campaign handoffs; source-use boundaries."/></label>
      <button type="button" onClick={bind} disabled={busy || invalid || !selectedPackets.length || !selectedTargets.length || !note.trim()} className="agent-ops-button-primary max-w-full whitespace-normal disabled:opacity-50">{busy ? 'Approving and linking…' : `Approve & link ${selectedPackets.length} packet(s) to ${selectedTargets.length} handoff(s)`}</button>
    </>}
  </div>
}
