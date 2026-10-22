'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { getCurrentSession } from '@/lib/auth'
import type { ReviewableResearchPacket } from './ResearchPacketReview'

type Source = { id: string; status: string; source_url: string; observed_at?: string; expires_at?: string;
  observation_identity?: string; excluded?: boolean; evidence_note?: string;
  public_attention?: { observed: number; required: number }; relevance?: { observed: number; required: number } }
type Receipt = { version: string; receipt_id: string; coverage_identity: string; observed_at: string; fresh_until: string;
  sample_size: number; formula: string; public_attention_score: number; public_attention_threshold: number;
  relevance_score: number; relevance_threshold: number; source_receipts: Array<{ receipt_id: string; source_url: string;
    source_packet_id?: string; observed_at: string; observed_values?: { public_attention: number; relevance: number };
    required_values?: { public_attention: number; relevance: number }; public_attention_score: number; relevance_score: number }> }
type OfficialState = { id: string; status: string; updated_at: string; source_url: string; coverage_identity: string;
  packet_identity: string; attribution_valid: boolean; observed_at: string; expires_at: string;
  measurement_status: string; blocked_reason: string | null; observed_value: number | null; required_value: number | null;
  owner: string; attempt_count: number; max_attempts: number; measurement_receipt: Receipt | null; observations: Source[] }
export type OfficialSignalReviewPayload = { sentiment: 'positive' | 'negative' | 'mixed'; materiality: 'material';
  evidence_state: 'corroborated' | 'attributable_single_source'; context_summary: string;
  public_attention_score: number; relevance_score: number; measurement_receipt: Receipt }

function evidenceProgress(state: OfficialState | null) {
  if (state?.measurement_receipt && state.measurement_status === 'Receipt ready')
    return `${state.measurement_receipt.sample_size} of 3 required public sources verified across ${new Set(state.measurement_receipt.source_receipts.map(source => new URL(source.source_url).hostname)).size} websites.`
  if (state?.blocked_reason?.includes('insufficient') && typeof state.observed_value === 'number')
    return `${state.observed_value} of 3 required public sources verified so far.`
  return 'Public-source verification is pending. Three verified sources are required.'
}

function missingEvidence(state: OfficialState | null) {
  if (!state) return 'The current evidence has not loaded yet.'
  if (!state.attribution_valid) return 'The official announcement needs to be checked again.'
  if (Date.parse(state.expires_at) <= Date.now()) return 'The official announcement is outside its review window.'
  if (state.blocked_reason === 'retry_limit_reached_owner_review_required') return 'The preparation limit was reached. The research owner needs to resolve this evidence.'
  if (state.blocked_reason?.includes('immutable') || state.blocked_reason?.includes('receipt')) return 'The saved measurement no longer verifies. The research owner needs to inspect it.'
  if (state.blocked_reason === 'measured_score_below_threshold') return 'Attention or relevance is below the required 0.65 score.'
  if (state.blocked_reason) return 'Independent coverage is missing, pending review, excluded, or no longer current.'
  return 'The source rule is met. Complete the review fields before approval.'
}

export function officialReviewBlockers(packet: ReviewableResearchPacket, state: OfficialState | null,
  sentiment: string, evidenceState: string, context: string, now = Date.now()) {
  const issues: string[] = []
  if (packet.status !== 'review_ready') issues.push('This packet is not pending review.')
  if (!state || state.id !== packet.id || state.updated_at !== packet.updated_at) issues.push('Refresh this page to load the latest review record.')
  if (state && !state.attribution_valid) issues.push('Recheck the official announcement; its source details changed.')
  if (state && (!Number.isFinite(Date.parse(state.expires_at)) || Date.parse(state.expires_at) <= now)) issues.push('Refresh the official announcement; its review window expired.')
  const receipt = state?.measurement_receipt
  if (!receipt || state?.measurement_status !== 'Receipt ready') issues.push('Verify the required public sources and prepare the measurement.')
  if (receipt && (!Number.isFinite(Date.parse(receipt.fresh_until)) || Date.parse(receipt.fresh_until) <= now)) issues.push('The measurement expired. Ask the research owner to resolve it.')
  if (receipt && (receipt.sample_size < 3 || receipt.source_receipts.length !== receipt.sample_size
    || new Set(receipt.source_receipts.map(source => source.source_url)).size !== receipt.sample_size
    || new Set(receipt.source_receipts.map(source => { try { return new URL(source.source_url).hostname } catch { return '' } })).size < 2
    || !receipt.source_receipts.some(source => source.source_url === state?.source_url))) issues.push('Verify three distinct public sources from two websites, including the official announcement.')
  if (receipt && (receipt.public_attention_score < 0.65 || receipt.relevance_score < 0.65
    || receipt.public_attention_threshold !== 0.65 || receipt.relevance_threshold !== 0.65)) issues.push('Both attention and relevance must score at least 0.65.')
  if (!['positive', 'negative', 'mixed'].includes(sentiment)) issues.push('Select the tone of the public coverage.')
  if (!['corroborated', 'attributable_single_source'].includes(evidenceState)) issues.push('Describe how strongly the sources support the claim.')
  if (context.trim().length < 12) issues.push('Summarize the public context in at least 12 characters.')
  return issues
}

export default function OfficialSignalResearchReview({ packet, onReview }: {
  packet: ReviewableResearchPacket
  onReview: (decision: 'approved' | 'rejected', note: string, signalReview?: OfficialSignalReviewPayload) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<OfficialState | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [sentiment, setSentiment] = useState('')
  const [evidenceState, setEvidenceState] = useState('')
  const [context, setContext] = useState('')
  const signal = packet.actor_metadata.official_signal as Record<string, unknown>
  const review = packet.actor_metadata.operator_review as { note?: string } | undefined
  const refresh = useCallback(async () => {
    setLoading(true); setError(''); setState(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Admin session is unavailable.')
      const response = await fetch('/api/admin/social-content/source-coverage/official-signals', {
        cache: 'no-store', headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const payload = await response.json()
      if (!response.ok || !Array.isArray(payload.packets)) throw new Error(payload.error || 'Official evidence could not be loaded.')
      const selected = payload.packets.find((item: OfficialState) => item.id === packet.id)
      if (!selected) throw new Error('Official packet is absent from the current evidence window. Ask social_content_research to inspect coverage.')
      setState(selected)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Official evidence could not be loaded.') }
    finally { setLoading(false) }
  }, [packet.id])
  useEffect(() => { if (open) void refresh() }, [open, refresh, packet.updated_at])
  const issues = officialReviewBlockers(packet, state, sentiment, evidenceState, context)
  const receipt = state?.measurement_receipt
  const included = new Set(receipt?.source_receipts.map(source => source.source_packet_id) ?? [])
  async function submit(decision: 'approved' | 'rejected') {
    if (busy || !note.trim() || decision === 'approved' && (issues.length > 0 || !receipt)) return
    setBusy(true); setError('')
    try {
      const payload = decision === 'approved' && receipt ? {
        sentiment: sentiment as OfficialSignalReviewPayload['sentiment'], materiality: 'material' as const,
        evidence_state: evidenceState as OfficialSignalReviewPayload['evidence_state'], context_summary: context.trim(),
        public_attention_score: receipt.public_attention_score, relevance_score: receipt.relevance_score,
        measurement_receipt: receipt,
      } : undefined
      await onReview(decision, note.trim(), payload)
      setOpen(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Review could not be saved.') }
    finally { setBusy(false) }
  }
  return <div className="mt-2 min-w-0 text-xs">
    <button type="button" className="agent-ops-button-secondary" aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? 'Close official signal review' : 'Review official signal'}</button>
    {open && <div className="mt-2 space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">Official announcement review</p>
        <span className={`rounded-full border px-2 py-1 font-semibold ${receipt && Date.parse(receipt.fresh_until) > Date.now() ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-amber-500/50 bg-amber-500/10'}`}>{receipt && Date.parse(receipt.fresh_until) > Date.now() ? 'Evidence ready for review' : 'Unscored — approval blocked'}</span></div>
      <div className="space-y-2 rounded border border-border bg-muted/20 p-3">
        <p><strong>What happened?</strong> {packet.title || 'An official public announcement was collected for review.'}</p>
        <p><strong>Why is it relevant to my work?</strong> It may inform Portfolio’s agent systems campaign if the public evidence supports the claim. This review does not release campaign content.</p>
        <p><strong>What evidence do we have?</strong> {evidenceProgress(state)}</p>
        <p><strong>What is missing?</strong> {missingEvidence(state)}</p>
        <p><strong>What should I do next?</strong> Check the announcement, then add or review public evidence. Complete the review fields only when the evidence passes.</p>
      </div>
      <p className="rounded border border-border p-2"><strong>Evidence rule:</strong> At least 3 verified public sources from 2 or more websites, including the official announcement, and both attention and relevance scores must be 0.65 or higher.</p>
      <ol className="grid gap-2 sm:grid-cols-3">
        <li className="rounded border border-border p-2"><strong>1. Review official announcement</strong><a className="mt-1 block break-all underline" href={packet.source_url ?? '#'} target="_blank" rel="noreferrer">Open official source</a></li>
        <li className="rounded border border-border p-2"><strong>2. Add or verify independent coverage</strong><span className="mt-1 block">{evidenceProgress(state)}</span></li>
        <li className="rounded border border-border p-2"><strong>3. Approve only after evidence passes</strong><span className="mt-1 block">The button stays disabled until the source check and your review are complete.</span></li>
      </ol>
      <Link className="agent-ops-button-secondary inline-flex" href="/admin/social-content?workflow=evidence#official-public-signal-preparation">Add or review public evidence</Link>
      <button type="button" className="agent-ops-button-secondary ml-2" disabled={loading || busy} onClick={() => void refresh()}>Refresh evidence status</button>
      {loading && <p role="status">Checking the latest public evidence…</p>}
      {error && <p role="alert" className="text-red-300">{error}</p>}
      <details className="rounded border border-border p-2"><summary className="cursor-pointer font-semibold">Technical evidence</summary>
        <div className="mt-2 space-y-2 break-all">
          <p>Packet {packet.id} · record version {packet.updated_at} · coverage {String(signal.coverage_identity)} · fingerprint {String(signal.source_fingerprint)}</p>
          <p>Published {String(signal.published_at)} · observed {String(signal.observed_at)} · expires {String(signal.expires_at)}</p>
          {state && <p>Owner {state.owner} · attempt {state.attempt_count}/{state.max_attempts} · {state.attribution_valid ? 'Attribution valid' : 'Attribution blocked'}</p>}
          {state?.blocked_reason && <p>Technical blocker {state.blocked_reason} · observed {state.observed_value ?? 'unknown'} · required {state.required_value ?? 'current receipt'}</p>}
          {receipt && <div className="rounded border border-border p-2"><p className="font-semibold">Immutable measurement receipt</p>
            <p className="font-mono">{receipt.receipt_id} · {receipt.version}</p>
            <p>Sample {receipt.sample_size} · hosts {new Set(receipt.source_receipts.map(source => new URL(source.source_url).hostname)).size} · formula {receipt.formula}</p>
            <p>Attention {receipt.public_attention_score} / {receipt.public_attention_threshold} required · relevance {receipt.relevance_score} / {receipt.relevance_threshold} required</p>
            <p>Observed {receipt.observed_at} · fresh until {receipt.fresh_until}</p>
            <p className="mt-2 font-semibold">Included source values ({receipt.source_receipts.length})</p>
            <ul className="mt-2 space-y-2">{receipt.source_receipts.map(source => <li key={source.receipt_id} className="rounded border border-border p-2">
              <a href={source.source_url} target="_blank" rel="noreferrer" className="underline">{source.source_url}</a><br />
              Attention {source.observed_values?.public_attention ?? 'unknown'}/{source.required_values?.public_attention ?? 'unknown'} = {source.public_attention_score}; relevance {source.observed_values?.relevance ?? 'unknown'}/{source.required_values?.relevance ?? 'unknown'} = {source.relevance_score}<br />
              Observed {source.observed_at} · {source.receipt_id}
            </li>)}</ul>
          </div>}
          <p className="font-semibold">Observation cohort and exclusions ({state?.observations.length ?? 0})</p>
          <ul className="space-y-2">{state?.observations.map(source => <li key={source.id} className="rounded border border-border p-2">
            {included.has(source.id) ? 'Included' : source.excluded ? 'Excluded by review' : source.status !== 'approved' ? `Pending: ${source.status}` : source.expires_at && Date.parse(source.expires_at) <= Date.now() ? 'Excluded: stale' : 'Excluded: not in validated receipt'} · <a href={source.source_url} target="_blank" rel="noreferrer" className="underline">{source.source_url}</a><br />
            Attention {source.public_attention?.observed ?? 'unknown'}/{source.public_attention?.required ?? 'unknown'} · relevance {source.relevance?.observed ?? 'unknown'}/{source.relevance?.required ?? 'unknown'}<br />
            Observed {source.observed_at ?? 'unknown'} · expires {source.expires_at ?? 'unknown'} · identity {source.observation_identity ?? 'missing'} · {source.evidence_note ?? ''}
          </li>)}</ul>
        </div>
      </details>
      {packet.status === 'review_ready' ? <>
        <div className="grid gap-2 sm:grid-cols-2"><label>Tone of public coverage<select className="mt-1 block w-full rounded border border-border bg-background p-2" value={sentiment} onChange={event => setSentiment(event.target.value)}><option value="">Select</option><option value="positive">Positive</option><option value="negative">Negative</option><option value="mixed">Mixed</option></select></label>
          <label>How well do the sources support this?<select className="mt-1 block w-full rounded border border-border bg-background p-2" value={evidenceState} onChange={event => setEvidenceState(event.target.value)}><option value="">Select</option><option value="corroborated">Multiple sources confirm it</option><option value="attributable_single_source">One source supports the claim</option></select></label></div>
        <p>Public importance: material (required before approval)</p>
        <label className="block">Public context summary<textarea className="mt-1 block w-full rounded border border-border bg-background p-2" rows={3} maxLength={2000} value={context} onChange={event => setContext(event.target.value)} /></label>
        <label className="block">Review reason<textarea className="mt-1 block w-full rounded border border-border bg-background p-2" rows={2} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} /></label>
        {issues.length > 0 && <div role="status" className="rounded border border-amber-500/40 p-2"><p className="font-semibold">Approval blocked</p><ul className="mt-1 list-disc pl-5">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
        <div className="flex flex-wrap gap-2"><button type="button" className="agent-ops-button-primary disabled:opacity-50" disabled={busy || loading || !!error || !note.trim() || issues.length > 0} onClick={() => void submit('approved')}>Approve official signal</button>
          <button type="button" className="agent-ops-button-secondary disabled:opacity-50" disabled={busy || !note.trim()} onClick={() => void submit('rejected')}>Reject signal</button></div>
      </> : <p>{review?.note ?? 'No operator review recorded.'}</p>}
    </div>}
  </div>
}
