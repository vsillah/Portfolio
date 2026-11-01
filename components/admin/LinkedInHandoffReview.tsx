'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AgentWorkItem } from '@/lib/agent-work-items'
import { getCurrentSession } from '@/lib/auth'
import { getFullPostText } from '@/lib/social-content'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function value(input: unknown): string { return typeof input === 'string' ? input : '' }

export default function LinkedInHandoffReview({ item, onReviewed }: { item: AgentWorkItem; onReviewed: () => Promise<void> }) {
  const packet = record(item.metadata?.draft_packet)
  const candidate = record(packet.candidate_projection)
  const lineage = record(packet.canonical_decision_lineage)
  const visual = record(packet.visual_asset)
  const evidence = record(packet.evidence_receipts)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const contentId = value(packet.social_content_id)
  const privacyReceiptId = value(packet.privacy_decision_receipt_id)
  const createdAt = value(packet.created_at)
  const recordedDecision = value(item.metadata?.handoff_review_decision)
  const ready = item.status === 'ready_for_review'
    && packet.version === 'linkedin_draft_handoff_v2'
    && packet.status === 'ready_for_internal_review'
    && packet.external_execution === false
    && packet.external_account_draft_created === false
    && item.source_id === contentId
    && Boolean(contentId && privacyReceiptId && createdAt && value(packet.post_text) && value(visual.image_url))
    && Object.values(lineage).filter(Boolean).length === 4
    && Object.values(evidence).filter(Boolean).length >= 6
  const hashtags = Array.isArray(packet.hashtags) ? packet.hashtags.filter((tag): tag is string => typeof tag === 'string') : []
  const fullPost = getFullPostText({
    post_text: value(packet.post_text), cta_text: value(packet.cta_text) || null,
    cta_url: value(packet.cta_url) || null, hashtags,
  } as never)

  async function decide(decision: 'approve' | 'request_revision') {
    setBusy(true); setError(''); setResult('')
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Admin session required. Sign in again and reload this packet.')
      const response = await fetch(`/api/admin/social-content/${encodeURIComponent(contentId)}/linkedin-handoff-review`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_item_id: item.id, privacy_receipt_id: privacyReceiptId,
          handoff_created_at: createdAt, decision, note: decision === 'request_revision' ? note : null }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Review decision failed. Reload the current packet.')
      setResult(decision === 'approve'
        ? 'Approved for final platform-submission readiness only. No external action was taken.'
        : 'Revision requested with an immutable internal receipt. No external action was taken.')
      await onReviewed()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Review decision failed.') }
    finally { setBusy(false) }
  }

  return <section aria-label="LinkedIn handoff review packet" className="mt-4 min-w-0 rounded-lg border border-amber-400/35 bg-amber-500/5 p-4">
    <h4 className="font-semibold text-amber-100">Exact LinkedIn handoff packet</h4>
    {recordedDecision && <p className="mt-2 text-sm font-semibold text-emerald-100">Recorded decision: {recordedDecision.replace(/_/g, ' ')} · Receipt {value(item.metadata?.handoff_review_receipt_id)}</p>}
    <p className="mt-1 text-sm text-amber-50/80">Internal review only. Approval advances to final platform-submission readiness. A separate gate remains required for any provider call, external draft, upload, schedule, publish, or send.</p>
    <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2">
      <div className="min-w-0 rounded-lg border border-silicon-slate/70 bg-background/50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approved post and CTA</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{fullPost || 'No approved post in packet.'}</p>
      </div>
      <div className="min-w-0 rounded-lg border border-silicon-slate/70 bg-background/50 p-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visual and lead magnet</p>
        {value(visual.image_url) && <img src={value(visual.image_url)} alt="Approved LinkedIn visual preview" className="mt-2 max-h-56 w-full rounded-lg border border-silicon-slate/70 bg-slate-950 object-contain" />}
        <p className="mt-2 break-all">Visual path: {value(visual.image_url) || 'Missing'}</p>
        <p className="mt-1 break-all">Approved SHA-256: {value(packet.approved_visual_sha256) || 'Missing'}</p>
        <p className="mt-2 break-all">Lead magnet receipt: {value(candidate.lead_magnet_receipt_id) || 'No lead magnet bound'}</p>
        <p className="mt-1 break-all">Bound CTA URL: {value(packet.cta_url) || 'No CTA URL'}</p>
      </div>
    </div>
    <details className="mt-3 rounded-lg border border-silicon-slate/70 p-3 text-xs">
      <summary className="cursor-pointer font-semibold">Receipt lineage and exact version</summary>
      <div className="mt-2 grid gap-1 break-all sm:grid-cols-2">
        <p>Content version: {value(packet.source_content_updated_at)}</p>
        <p>Handoff created: {createdAt}</p>
        <p>Copy: {value(lineage.copy_receipt_id)}</p>
        <p>Visual review: {value(lineage.visual_review_receipt_id)}</p>
        <p>Asset packet: {value(lineage.asset_packet_receipt_id)}</p>
        <p>Privacy: {privacyReceiptId}</p>
        {Object.entries(evidence).map(([key, receipt]) => <p key={key}>{key}: {value(record(receipt).receipt_id)}</p>)}
      </div>
    </details>
    <div className="mt-3 flex flex-wrap gap-2 text-sm">
      {contentId && <Link href={`/admin/social-content/${encodeURIComponent(contentId)}?step=submit#social-platform-submission-gate`} className="rounded-lg border border-silicon-slate/70 px-3 py-2 hover:border-amber-400">Open Social Content source</Link>}
      <span className="rounded-lg border border-amber-400/35 px-3 py-2 text-amber-100">External actions closed</span>
    </div>
    {ready ? <div className="mt-4 space-y-3">
      <label className="block text-sm">Revision reason
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-silicon-slate/70 bg-background/70 p-2" placeholder="Specify what must change before review" />
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={() => decide('approve')} disabled={busy} className="min-h-11 rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">Approve internal handoff</button>
        <button type="button" onClick={() => decide('request_revision')} disabled={busy || !note.trim()} className="min-h-11 rounded-lg border border-amber-400/60 px-4 py-2 font-semibold text-amber-100 disabled:opacity-50">Request revision</button>
      </div>
    </div> : <p className="mt-3 text-sm text-amber-100">Decision controls are closed until the exact ready-for-review packet is present.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}
    {result && <p role="status" className="mt-3 text-sm text-emerald-100">{result}</p>}
  </section>
}
