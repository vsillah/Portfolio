'use client'

import { useState } from 'react'

export type ReviewableResearchPacket = {
  id: string
  status: string
  updated_at: string
  pattern_status: string
  source_url?: string | null
  pattern_packet?: Record<string, unknown>
  privacy_notes?: string | null
  actor_metadata: Record<string, unknown>
}

export function ResearchPacketReview({ packet, onReview }: {
  packet: ReviewableResearchPacket
  onReview: (decision: 'approved' | 'rejected', note: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const review = packet.actor_metadata?.operator_review as { note?: string; reviewed_at?: string } | undefined
  const hasSource = (() => {
    try {
      const url = new URL(packet.source_url ?? '')
      return url.protocol === 'https:' || url.protocol === 'http:'
    } catch {
      return false
    }
  })()
  const hasPattern = !!packet.pattern_packet && Object.keys(packet.pattern_packet).length > 0
  const eligible = packet.pattern_status === 'usable_framework' && hasSource && hasPattern
  async function submit(decision: 'approved' | 'rejected') {
    setBusy(true)
    setError('')
    try { await onReview(decision, note.trim()); setOpen(false); setNote('') }
    catch (err) { setError(err instanceof Error ? err.message : 'Review failed. Try again.') }
    finally { setBusy(false) }
  }
  return <div className="mt-2 min-w-0 text-xs">
    <div className="flex flex-wrap items-center gap-2">
      <span className="capitalize">{(packet.status ?? 'unknown').replace(/_/g, ' ')}</span>
      <button type="button" className="agent-ops-button-secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Close review' : packet.status === 'review_ready' ? 'Review packet' : 'Review details'}
      </button>
    </div>
    {open && <div className="mt-2 space-y-2 rounded-lg border border-silicon-slate/70 p-3">
      <p>Approval makes this framework available for insight selection.</p>
      <dl className="max-h-48 space-y-2 overflow-auto break-words">
        {Object.entries(packet.pattern_packet ?? {}).map(([key, value]) => <div key={key}>
          <dt className="font-semibold capitalize">{key.replace(/_/g, ' ')}</dt>
          <dd className="whitespace-pre-wrap">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
        </div>)}
      </dl>
      {packet.privacy_notes && <p>{packet.privacy_notes}</p>}
      {packet.status === 'review_ready' ? <>
        {!eligible && <p>Approval blocked: a usable framework, valid public source URL, and nonempty pattern packet are required. Complete or reassess this packet first, or reject it below.</p>}
        <label className="block">Review reason
          <textarea className="mt-1 block w-full rounded border border-silicon-slate bg-background p-2" rows={2} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} disabled={busy} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="agent-ops-button-primary disabled:opacity-50" disabled={busy || !note.trim() || !eligible} onClick={() => void submit('approved')}>Approve framework</button>
          <button type="button" className="rounded border border-red-400/60 px-3 py-2 text-red-300 disabled:opacity-50" disabled={busy || !note.trim()} onClick={() => void submit('rejected')}>Reject packet</button>
        </div>
        {busy && <p role="status">Saving review…</p>}
      </> : <p>{review?.note ?? 'No operator review note recorded.'}{review?.reviewed_at ? ` • ${new Date(review.reviewed_at).toLocaleString()}` : ''}</p>}
      {error && <p role="alert" className="text-red-300">{error}</p>}
    </div>}
  </div>
}
