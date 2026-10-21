'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { getCurrentSession } from '@/lib/auth'

type Source = { id: string; status: string; source_url: string; observed_at: string; expires_at: string;
  public_attention: { observed: number; required: number }; relevance: { observed: number; required: number };
  observation_identity: string; evidence_note: string }
type Packet = { id: string; title: string; source_url: string; status: string; coverage_identity: string;
  published_at: string; expires_at: string; packet_identity: string; attribution_valid: boolean;
  measurement_status: string; blocked_reason: string | null; owner: string; attempt_count: number; max_attempts: number;
  observed_value: number | null; required_value: number | null;
  measurement_receipt: { receipt_id: string; source_receipts: Array<{ receipt_id: string; source_url: string;
    observed_values: { public_attention: number; relevance: number }; required_values: { public_attention: number; relevance: number } }> } | null;
  observations: Source[] }
type State = { packets: Packet[]; review_only: boolean; release_ready: false; exclusions: string[] }
const ENDPOINT = '/api/admin/social-content/source-coverage/official-signals'
const button = 'admin-console-button-secondary min-h-9 px-3 disabled:cursor-not-allowed disabled:opacity-50'
export function measurementBlockerCopy(reason: string | null, observed: number | null, required: number | null) {
  const sourceCount = Number.isFinite(observed) && Number.isFinite(required)
    ? `${observed} source observation ${observed === 1 ? 'row' : 'rows'} passed initial checks; at least ${required} are required. ` : ''
  switch (reason) {
    case 'measurement_not_attempted':
      return { explanation: 'No measurement has been prepared for this official packet yet.',
        recovery: 'Add exact public observations below, approve them in Content Intelligence, then use Prepare measurement for this packet here.' }
    case 'insufficient_attributable_public_sources':
      return { explanation: `${sourceCount}This packet needs three approved, current public observations on unique URLs across at least two hosts, including the official release.`,
        recovery: 'Add the missing exact-source observations below, approve them in Content Intelligence, then prepare measurement again.' }
    case 'insufficient_or_excluded_attributable_public_sources':
      return { explanation: `${sourceCount}At least one observation is excluded, stale, unapproved, or does not match its source or packet.`,
        recovery: 'Expand source observations and exact receipts here. Replace invalid evidence below, approve the replacement in Content Intelligence, then retry measurement.' }
    case 'measured_score_below_threshold':
      return { explanation: `The lowest measured score is ${observed ?? 'unknown'}; both attention and relevance must reach ${required ?? 0.65}.`,
        recovery: 'Review the exact numerators and denominators in source receipts here. If they are wrong, add corrected evidence for Content Intelligence review; otherwise leave this packet Unscored.' }
    case 'official_packet_stale_or_not_pending':
    case 'official_packet_not_pending_or_outside_bounded_window':
      return { explanation: 'The official release packet is expired, changed, or no longer pending review.',
        recovery: 'Use Check official public sources above, then inspect the fresh pending packet in Content Intelligence before measuring.' }
    case 'retry_limit_reached_owner_review_required':
      return { explanation: 'Three changed-evidence attempts have been used. Automatic preparation is closed for this packet.',
        recovery: 'Ask social_content_research to inspect the exact receipts here and resolve the packet in Content Intelligence. Do not retry unchanged evidence.' }
    case 'existing_measurement_immutable_review_required':
    case 'measurement_receipt_missing_or_mismatched':
    case 'measurement_receipt_identity_mismatched':
    case 'measurement_receipt_stale_or_wrong_version':
      return { explanation: 'The stored measurement receipt is missing, expired, changed, or does not match this packet.',
        recovery: 'Ask social_content_research to inspect the immutable receipt here and the packet in Content Intelligence. A new source check cannot overwrite it.' }
    case 'measurement_sample_insufficient':
    case 'measurement_source_unattributable':
    case 'measurement_source_values_mismatched':
    case 'measurement_score_insufficient_or_mismatched':
      return { explanation: 'The stored receipt lacks enough valid sources or its source values and scores do not reconcile.',
        recovery: 'Expand source observations and exact receipts here, then ask social_content_research to resolve the packet in Content Intelligence.' }
    default:
      return { explanation: reason ? 'Measurement evidence cannot be verified for this packet.' : 'The source-bound measurement receipt is ready for human review.',
        recovery: reason ? 'Inspect the technical reason and source receipts here, then route the packet to social_content_research in Content Intelligence.'
          : 'Review the pending packet in Content Intelligence. No approval occurs here.' }
  }
}
const QA_STATE: State = { review_only: true, release_ready: false, exclusions: ['No packet approval', 'No provider or media action', 'No platform draft, schedule, publication, or external send'],
  packets: [{ id: '11111111-1111-1111-1111-111111111111', title: 'Synthetic OpenAI Agents API update',
    source_url: 'https://developers.openai.com/api/docs/changelog', status: 'review_ready', coverage_identity: 'openai_agents_api_qa',
    published_at: '2026-10-20T12:00:00.000Z', expires_at: '2026-10-25T12:00:00.000Z', packet_identity: 'synthetic-source-fingerprint',
    attribution_valid: true, measurement_status: 'Unscored', blocked_reason: 'insufficient_attributable_public_sources',
    observed_value: 1, required_value: 3,
    owner: 'social_content_research', attempt_count: 1, max_attempts: 3, measurement_receipt: null,
    observations: [{ id: 'synthetic-observation-1', status: 'approved', source_url: 'https://example.org/public-observation',
      observed_at: '2026-10-20T12:00:00.000Z', expires_at: '2026-10-25T12:00:00.000Z',
      public_attention: { observed: 80, required: 100 }, relevance: { observed: 9, required: 10 },
      observation_identity: 'synthetic-observation-fingerprint', evidence_note: 'Synthetic exact public values for review only.' }],
  }] }

export default function OfficialSignalOperations({ active, qaFixture = false }: { active: boolean; qaFixture?: boolean }) {
  const [state, setState] = useState<State | null>(qaFixture ? QA_STATE : null)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [observedAt, setObservedAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [attentionObserved, setAttentionObserved] = useState('')
  const [attentionRequired, setAttentionRequired] = useState('')
  const [relevanceObserved, setRelevanceObserved] = useState('')
  const [relevanceRequired, setRelevanceRequired] = useState('')
  const [evidenceNote, setEvidenceNote] = useState('')
  const selectedPacket = state?.packets.find((packet) => packet.id === selected)
  const pendingObservationId = selectedPacket?.observations.find((item) => item.status === 'review_ready')?.id
  const blockedCopy = selectedPacket && !selectedPacket.attribution_valid
    ? { explanation: 'The official source binding no longer matches this packet.',
      recovery: 'Use Check official public sources above, then inspect the fresh pending packet in Content Intelligence.' }
    : measurementBlockerCopy(selectedPacket?.blocked_reason ?? null, selectedPacket?.observed_value ?? null, selectedPacket?.required_value ?? null)
  const authFetch = useCallback(async (init?: RequestInit) => {
    const session = await getCurrentSession()
    if (!session?.access_token) throw new Error('Admin session is unavailable.')
    const response = await fetch(ENDPOINT, { ...init, cache: 'no-store', headers: {
      Authorization: `Bearer ${session.access_token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    } })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Official signal operation failed.')
    return payload
  }, [])
  const refresh = useCallback(async () => {
    if (qaFixture) { setState(QA_STATE); return }
    setError('')
    try {
      const payload = await authFetch()
      if (!Array.isArray(payload.packets) || !Array.isArray(payload.exclusions) || payload.release_ready !== false)
        throw new Error('Official signal status is incomplete. Ask social_content_research to restore the read path.')
      setState(payload)
    } catch (cause) { setState(null); setError(cause instanceof Error ? cause.message : 'Official signal read failed.') }
  }, [authFetch, qaFixture])
  useEffect(() => { if (active) void refresh() }, [active, refresh])
  async function operate(action: 'collect_official' | 'measure' | 'intake_observation') {
    if (busy || qaFixture) return
    setBusy(true); setError(''); setResult('')
    try {
      const observation = action === 'intake_observation' && selectedPacket ? {
        coverage_identity: selectedPacket.coverage_identity, source_url: sourceUrl.trim(),
        observed_at: new Date(observedAt).toISOString(), expires_at: new Date(expiresAt).toISOString(),
        public_attention: { observed: Number(attentionObserved), required: Number(attentionRequired) },
        relevance: { observed: Number(relevanceObserved), required: Number(relevanceRequired) },
        evidence_note: evidenceNote.trim(),
      } : null
      const payload = await authFetch({ method: 'POST', body: JSON.stringify({ action, packet_id: selected, observation }) })
      setResult(action === 'collect_official' ? `${payload.inserted} pending official packet(s) added. ${payload.discovered} discovered; ${payload.excluded?.length ?? 0} public sources excluded${payload.excluded?.length ? ` (${payload.excluded.map((item: { reason: string }) => item.reason).join(', ')})` : ''}.`
        : action === 'measure' ? `${payload.receipts_ready} receipt(s) ready from ${payload.packets_scanned} pending packet.`
          : payload.unchanged ? 'Unchanged observation reused.' : 'Observation saved for separate source review.')
      await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Operation failed.') }
    finally { setBusy(false) }
  }
  if (!active) return null
  return <section aria-label="Official public signal preparation" className="rounded-lg border border-border bg-card p-3 text-foreground">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-sm font-semibold">Official public signal preparation</h3>
        <p className="mt-1 text-xs text-muted-foreground">Review-only OpenAI and Meta release intake, source observations, and measurement receipts. Release readiness stays closed.</p></div>
      <div className="flex gap-2"><button type="button" className={button} disabled={busy || qaFixture} onClick={() => void refresh()}>Refresh status</button>
        <button type="button" className={button} disabled={busy || qaFixture} onClick={() => void operate('collect_official')}>Check official public sources</button></div>
    </div>
    {qaFixture && <p className="mt-2 rounded border border-accent/40 bg-accent/10 p-2 text-xs font-semibold">Synthetic localhost QA fixture · all writes disabled · no live source read</p>}
    <p className="mt-2 text-xs text-muted-foreground">This public-source check can add pending research packets. It cannot approve, generate, upload, draft on a platform, schedule, publish, or send.</p>
    {error && <p role="alert" className="mt-2 rounded border border-red-500/40 p-2 text-xs">{error} Refresh status or ask social_content_research to resolve the source.</p>}
    {result && <p role="status" className="mt-2 rounded border border-emerald-500/40 p-2 text-xs">{result}</p>}
    {!state && !error && <p role="status" className="mt-2 text-xs">Reading official packet receipts…</p>}
    {state && <>
      <label className="mt-3 block text-xs font-semibold">Pending official packet
        <select className="mt-1 w-full rounded border border-border bg-background p-2 text-foreground" value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">Choose a packet</option>{state.packets.filter((packet) => packet.status === 'review_ready').map((packet) =>
            <option key={packet.id} value={packet.id}>{packet.title} · {packet.coverage_identity}</option>)}</select>
      </label>
      {selectedPacket && <div className="mt-3 space-y-2 rounded border border-border p-3 text-xs">
        <p className="font-semibold">{selectedPacket.measurement_status} · owner {selectedPacket.owner} · attempt {selectedPacket.attempt_count}/{selectedPacket.max_attempts}</p>
        <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2" role={selectedPacket.blocked_reason ? 'status' : undefined}>
          <p className="font-medium">{blockedCopy.explanation}</p>
          <p className="mt-1">Next: {blockedCopy.recovery}</p>
        </div>
        <p className="break-all">Coverage {selectedPacket.coverage_identity} · packet {selectedPacket.id} · source fingerprint {selectedPacket.packet_identity}</p>
        <p>Published {selectedPacket.published_at} · expires {selectedPacket.expires_at} · attribution {selectedPacket.attribution_valid ? 'valid' : 'blocked'}</p>
        <a className="break-all underline" href={selectedPacket.source_url} target="_blank" rel="noreferrer">Official source: {selectedPacket.source_url}</a>
        <button type="button" className={button} disabled={busy || qaFixture || !selectedPacket.attribution_valid || selectedPacket.attempt_count >= selectedPacket.max_attempts}
          onClick={() => void operate('measure')}>Prepare measurement for this packet</button>
        <details><summary className="cursor-pointer font-semibold">Source observations and exact receipts ({selectedPacket.observations.length})</summary>
          {selectedPacket.blocked_reason && <p className="mt-2 break-all font-mono text-[10px]">Technical reason: {selectedPacket.blocked_reason}</p>}
          <ul className="mt-2 space-y-2">{selectedPacket.observations.map((item) => <li key={item.id} className="break-all rounded border border-border p-2">
            {item.status} · {item.source_url}<br />Observed {item.observed_at} · expires {item.expires_at}<br />
            Attention {item.public_attention?.observed}/{item.public_attention?.required} · relevance {item.relevance?.observed}/{item.relevance?.required}<br />
            Identity {item.observation_identity} · {item.evidence_note}
          </li>)}</ul>
          {selectedPacket.measurement_receipt && <p className="mt-2 break-all">Measurement receipt {selectedPacket.measurement_receipt.receipt_id}; sources {selectedPacket.measurement_receipt.source_receipts.map((item) => item.receipt_id).join(', ')}</p>}
        </details>
        <Link className="underline" href={`/admin/agents/content-intelligence${pendingObservationId ? `?packet=${encodeURIComponent(pendingObservationId)}` : ''}`}>Review pending observations in Content Intelligence</Link>
      </div>}
      <details className="mt-3 rounded border border-border p-3 text-xs"><summary className="cursor-pointer font-semibold">Add a public source observation for review</summary>
        <p className="mt-2 text-muted-foreground">Record exact visible values and denominators from one public HTTPS page. A separate reviewer must verify the source before measurement can use it.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label>Exact public source URL<input className="input-brand mt-1 w-full" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} /></label>
          <label>Observed at (local time)<input type="datetime-local" className="input-brand mt-1 w-full" value={observedAt} onChange={e => setObservedAt(e.target.value)} /></label>
          <label>Expires at (local time)<input type="datetime-local" className="input-brand mt-1 w-full" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} /></label>
          <label>Public attention observed<input type="number" min="0" className="input-brand mt-1 w-full" value={attentionObserved} onChange={e => setAttentionObserved(e.target.value)} /></label>
          <label>Public attention required<input type="number" min="0.01" className="input-brand mt-1 w-full" value={attentionRequired} onChange={e => setAttentionRequired(e.target.value)} /></label>
          <label>Relevance observed<input type="number" min="0" className="input-brand mt-1 w-full" value={relevanceObserved} onChange={e => setRelevanceObserved(e.target.value)} /></label>
          <label>Relevance required<input type="number" min="0.01" className="input-brand mt-1 w-full" value={relevanceRequired} onChange={e => setRelevanceRequired(e.target.value)} /></label>
        </div>
        <label className="mt-2 block">Evidence note (20–500 characters)<textarea className="input-brand mt-1 w-full" maxLength={500} value={evidenceNote} onChange={e => setEvidenceNote(e.target.value)} /></label>
        <button type="button" className={`${button} mt-2`} disabled={busy || qaFixture || !selectedPacket || !sourceUrl || !observedAt || !expiresAt || !attentionObserved || !attentionRequired || !relevanceObserved || !relevanceRequired || evidenceNote.trim().length < 20}
          onClick={() => void operate('intake_observation')}>Save observation for review</button>
      </details>
      <p className="mt-3 text-xs text-muted-foreground">Excluded: {state.exclusions.join(' · ')}. All packets remain review only; aggregate release readiness is blocked.</p>
    </>}
  </section>
}
