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

export function officialReviewBlockers(packet: ReviewableResearchPacket, state: OfficialState | null,
  sentiment: string, evidenceState: string, context: string, now = Date.now()) {
  const issues: string[] = []
  if (packet.status !== 'review_ready') issues.push('This packet is not pending review.')
  if (!state || state.id !== packet.id || state.updated_at !== packet.updated_at) issues.push('Refresh the current packet and measurement status.')
  if (state && !state.attribution_valid) issues.push('Official source attribution changed. Recheck the public source.')
  if (state && (!Number.isFinite(Date.parse(state.expires_at)) || Date.parse(state.expires_at) <= now)) issues.push('Official packet expired. Recollect the official source.')
  const receipt = state?.measurement_receipt
  if (!receipt || state?.measurement_status !== 'Receipt ready') issues.push('Unscored: prepare a current source-bound measurement receipt.')
  if (receipt && (!Number.isFinite(Date.parse(receipt.fresh_until)) || Date.parse(receipt.fresh_until) <= now)) issues.push('Measurement receipt expired. Route to the evidence owner.')
  if (receipt && (receipt.sample_size < 3 || receipt.source_receipts.length !== receipt.sample_size
    || new Set(receipt.source_receipts.map(source => source.source_url)).size !== receipt.sample_size
    || new Set(receipt.source_receipts.map(source => { try { return new URL(source.source_url).hostname } catch { return '' } })).size < 2
    || !receipt.source_receipts.some(source => source.source_url === state?.source_url))) issues.push('At least three unique approved sources across two hosts, including the official source, are required.')
  if (receipt && (receipt.public_attention_score < 0.65 || receipt.relevance_score < 0.65
    || receipt.public_attention_threshold !== 0.65 || receipt.relevance_threshold !== 0.65)) issues.push('Both measured scores must meet the 0.65 threshold.')
  if (!['positive', 'negative', 'mixed'].includes(sentiment)) issues.push('Select reviewed sentiment.')
  if (!['corroborated', 'attributable_single_source'].includes(evidenceState)) issues.push('Select the evidence state.')
  if (context.trim().length < 12) issues.push('Write at least 12 characters of public context.')
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
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">Official public signal · {state?.measurement_status ?? 'Unscored'}</p>
        <button type="button" className="agent-ops-button-secondary" disabled={loading || busy} onClick={() => void refresh()}>Refresh evidence</button></div>
      <p>Review the public claim and measured observations. This approval records a source-bound signal; campaign and release gates remain separate.</p>
      <a className="block break-all underline" href={packet.source_url ?? '#'} target="_blank" rel="noreferrer">Official source: {packet.source_url}</a>
      <p className="break-all">Packet {packet.id} · coverage {String(signal.coverage_identity)} · fingerprint {String(signal.source_fingerprint)}</p>
      <p>Published {String(signal.published_at)} · observed {String(signal.observed_at)} · expires {String(signal.expires_at)}</p>
      {state && <p>Owner {state.owner} · attempt {state.attempt_count}/{state.max_attempts} · {state.attribution_valid ? 'Attribution valid' : 'Attribution blocked'}</p>}
      {loading && <p role="status">Checking the current receipt…</p>}
      {error && <p role="alert" className="text-red-300">{error}</p>}
      {state?.blocked_reason && <p role="status" className="rounded border border-amber-500/40 p-2">Unscored: {state.blocked_reason.replaceAll('_', ' ')}. Observed {state.observed_value ?? 'unknown'}; required {state.required_value ?? 'current receipt'}. Next: review source observations, then prepare measurement in Social Content. Owner: {state.owner}.</p>}
      {receipt && <div className="rounded border border-border p-2">
        <p className="font-semibold">Immutable measurement receipt</p>
        <p className="break-all font-mono">{receipt.receipt_id} · {receipt.version}</p>
        <p>Sample {receipt.sample_size} · hosts {new Set(receipt.source_receipts.map(source => new URL(source.source_url).hostname)).size} · formula {receipt.formula}</p>
        <p>Attention {receipt.public_attention_score} / {receipt.public_attention_threshold} required · relevance {receipt.relevance_score} / {receipt.relevance_threshold} required</p>
        <p>Observed {receipt.observed_at} · fresh until {receipt.fresh_until}</p>
        <details className="mt-2"><summary className="cursor-pointer font-semibold">Included source values ({receipt.source_receipts.length})</summary>
          <ul className="mt-2 space-y-2">{receipt.source_receipts.map(source => <li key={source.receipt_id} className="break-all rounded border border-border p-2">
            <a href={source.source_url} target="_blank" rel="noreferrer" className="underline">{source.source_url}</a><br />
            Attention {source.observed_values?.public_attention ?? 'unknown'}/{source.required_values?.public_attention ?? 'unknown'} = {source.public_attention_score}; relevance {source.observed_values?.relevance ?? 'unknown'}/{source.required_values?.relevance ?? 'unknown'} = {source.relevance_score}<br />
            Observed {source.observed_at} · {source.receipt_id}
          </li>)}</ul>
        </details>
      </div>}
      <details><summary className="cursor-pointer font-semibold">Observation cohort and exclusions ({state?.observations.length ?? 0})</summary>
        <ul className="mt-2 space-y-2">{state?.observations.map(source => <li key={source.id} className="break-all rounded border border-border p-2">
          {included.has(source.id) ? 'Included' : source.excluded ? 'Excluded by review' : source.status !== 'approved' ? `Pending: ${source.status}` : source.expires_at && Date.parse(source.expires_at) <= Date.now() ? 'Excluded: stale' : 'Excluded: not in validated receipt'} · <a href={source.source_url} target="_blank" rel="noreferrer" className="underline">{source.source_url}</a><br />
          Attention {source.public_attention?.observed ?? 'unknown'}/{source.public_attention?.required ?? 'unknown'} · relevance {source.relevance?.observed ?? 'unknown'}/{source.relevance?.required ?? 'unknown'}<br />
          Observed {source.observed_at ?? 'unknown'} · expires {source.expires_at ?? 'unknown'} · identity {source.observation_identity ?? 'missing'} · {source.evidence_note ?? ''}
        </li>)}</ul>
      </details>
      <Link className="inline-block underline" href={`/admin/social-content?workflow=evidence#official-public-signal-preparation`}>Add observations or prepare measurement</Link>
      {packet.status === 'review_ready' ? <>
        <div className="grid gap-2 sm:grid-cols-2"><label>Sentiment<select className="mt-1 block w-full rounded border border-border bg-background p-2" value={sentiment} onChange={event => setSentiment(event.target.value)}><option value="">Select</option><option value="positive">Positive</option><option value="negative">Negative</option><option value="mixed">Mixed</option></select></label>
          <label>Evidence state<select className="mt-1 block w-full rounded border border-border bg-background p-2" value={evidenceState} onChange={event => setEvidenceState(event.target.value)}><option value="">Select</option><option value="corroborated">Corroborated</option><option value="attributable_single_source">Attributable single source</option></select></label></div>
        <p>Materiality: material (required for this signal route)</p>
        <label className="block">Public context summary<textarea className="mt-1 block w-full rounded border border-border bg-background p-2" rows={3} maxLength={2000} value={context} onChange={event => setContext(event.target.value)} /></label>
        <label className="block">Review reason<textarea className="mt-1 block w-full rounded border border-border bg-background p-2" rows={2} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} /></label>
        {issues.length > 0 && <div role="status" className="rounded border border-amber-500/40 p-2"><p className="font-semibold">Approval blocked</p><ul className="mt-1 list-disc pl-5">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
        <div className="flex flex-wrap gap-2"><button type="button" className="agent-ops-button-primary disabled:opacity-50" disabled={busy || loading || !!error || !note.trim() || issues.length > 0} onClick={() => void submit('approved')}>Approve official signal</button>
          <button type="button" className="agent-ops-button-secondary disabled:opacity-50" disabled={busy || !note.trim()} onClick={() => void submit('rejected')}>Reject signal</button></div>
      </> : <p>{review?.note ?? 'No operator review recorded.'}</p>}
    </div>}
  </div>
}
