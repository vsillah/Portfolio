'use client'

import { useEffect, useState } from 'react'
import OfficialSignalResearchReview, { type OfficialSignalReviewPayload } from './OfficialSignalResearchReview'
import {
  normalizePractitionerEvidence,
  practitionerEvidenceValidation,
  type PractitionerEvidenceAuthoring,
} from '@/lib/research-practitioner-evidence'

export type ReviewableResearchPacket = {
  id: string
  status: string
  updated_at: string
  pattern_status: string
  title?: string | null
  source_url?: string | null
  pattern_packet?: Record<string, unknown>
  privacy_notes?: string | null
  actor_metadata: Record<string, unknown>
}

export function ResearchPacketReview({ packet, onReview, onSaveEvidence }: {
  packet: ReviewableResearchPacket
  onReview: (decision: 'approved' | 'rejected', note: string, signalReview?: OfficialSignalReviewPayload) => Promise<void>
  onSaveEvidence?: (evidence: PractitionerEvidenceAuthoring) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const savedEvidence = normalizePractitionerEvidence(packet.actor_metadata?.practitioner_evidence)
  const [evidence, setEvidence] = useState<PractitionerEvidenceAuthoring>(savedEvidence)
  useEffect(() => {
    setEvidence(normalizePractitionerEvidence(packet.actor_metadata?.practitioner_evidence))
  }, [packet.updated_at, packet.actor_metadata])
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
  const evidenceValidation = practitionerEvidenceValidation(evidence, packet.pattern_packet)
  const eligible = packet.pattern_status === 'usable_framework' && hasSource && hasPattern && evidenceValidation.valid
  const canEdit = packet.status === 'review_ready' || packet.status === 'rejected'
  const frameworkEntries = Object.entries(packet.pattern_packet ?? {})
  function changeEvidence(patch: Partial<PractitionerEvidenceAuthoring>) {
    setEvidence(current => ({ ...current, ...patch }))
  }
  async function saveEvidence() {
    if (!onSaveEvidence) return
    setBusy(true)
    setError('')
    try { await onSaveEvidence(evidence) }
    catch (err) { setError(err instanceof Error ? err.message : 'Evidence save failed. Try again.') }
    finally { setBusy(false) }
  }
  async function submit(decision: 'approved' | 'rejected') {
    setBusy(true)
    setError('')
    try { await onReview(decision, note.trim()); setOpen(false); setNote('') }
    catch (err) { setError(err instanceof Error ? err.message : 'Review failed. Try again.') }
    finally { setBusy(false) }
  }
  const observation = packet.actor_metadata?.public_signal_observation as Record<string, unknown> | undefined
  if (packet.actor_metadata?.official_signal) return <OfficialSignalResearchReview packet={packet} onReview={onReview} />
  if (observation) return <div className="mt-2 text-xs">
    <button type="button" className="agent-ops-button-secondary" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Close observation review' : 'Review public observation'}</button>
    {open && <div className="mt-2 space-y-2 rounded-lg border border-border p-3">
      <p>Verify the exact public page, both observed values and required denominators, freshness, and the official packet binding before approving this source. Approval only makes the source eligible for a later measurement.</p>
      <a href={packet.source_url ?? '#'} target="_blank" rel="noreferrer" className="break-all underline">{packet.source_url}</a>
      <p className="break-all">Coverage {String(observation.coverage_identity)} · identity {String(observation.observation_identity)} · official packet {String(observation.official_packet_id)}</p>
      <p>Observed {String(observation.observed_at)} · expires {String(observation.expires_at)}</p>
      <p>Attention {String((observation.public_attention as { observed?: number })?.observed)}/{String((observation.public_attention as { required?: number })?.required)} · relevance {String((observation.relevance as { observed?: number })?.observed)}/{String((observation.relevance as { required?: number })?.required)}</p>
      <p>{String(observation.evidence_note ?? '')}</p>
      {packet.status === 'review_ready' ? <><label className="block">Source review reason<textarea className="mt-1 block w-full rounded border border-border bg-background p-2" rows={2} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} disabled={busy} /></label>
        <div className="flex gap-2"><button type="button" className="agent-ops-button-primary disabled:opacity-50" disabled={busy || !note.trim()} onClick={() => void submit('approved')}>Approve observation</button>
          <button type="button" className="agent-ops-button-secondary disabled:opacity-50" disabled={busy || !note.trim()} onClick={() => void submit('rejected')}>Reject observation</button></div></>
        : <p>{review?.note ?? 'No operator review note recorded.'}</p>}
      {error && <p role="alert">{error}</p>}
    </div>}
  </div>
  return <div className="mt-2 min-w-0 max-w-full overflow-hidden text-xs">
    <div className="flex flex-wrap items-center gap-2">
      <span className="capitalize">{(packet.status ?? 'unknown').replace(/_/g, ' ')}</span>
      <button type="button" className="agent-ops-button-secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Close review' : packet.status === 'review_ready' ? 'Review packet' : 'Review details'}
      </button>
    </div>
    {open && <div className="mt-2 space-y-2 rounded-lg border border-silicon-slate/70 p-3">
      <p>Approval keeps this packet in the existing Shaka and Social Insights selection flow. It does not publish or create provider content.</p>
      <dl className="max-h-48 space-y-2 overflow-auto break-words">
        {Object.entries(packet.pattern_packet ?? {}).map(([key, value]) => <div key={key}>
          <dt className="font-semibold capitalize">{key.replace(/_/g, ' ')}</dt>
          <dd className="whitespace-pre-wrap">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
        </div>)}
      </dl>
      {packet.privacy_notes && <p>{packet.privacy_notes}</p>}
      {canEdit ? <>
        <fieldset className="space-y-2 rounded border border-silicon-slate/70 p-3" disabled={busy}>
          <legend className="px-1 font-semibold">Evidence boundary</legend>
          <label className="block">Public-use boundary
            <select className="mt-1 block w-full rounded border border-silicon-slate bg-background p-2" value={evidence.public_use_boundary} onChange={event => {
              const publicUseBoundary = event.target.value as PractitionerEvidenceAuthoring['public_use_boundary']
              changeEvidence(publicUseBoundary === 'framework_only' ? {
                public_use_boundary: publicUseBoundary,
                role_context: '', situation: '', action_taken: '', observed_outcome: '', limitations: '',
                redaction_receipt: { direct_identifiers_removed: false, indirect_identifiers_reviewed: false, sensitive_details_removed: false, review_note: '' },
              } : { public_use_boundary: publicUseBoundary })
            }}>
              <option value="">Choose a boundary</option>
              <option value="framework_only">Framework only — no practitioner narrative</option>
              <option value="anonymized_public_summary">Anonymized public summary</option>
              <option value="internal_only">Internal only — cannot be approved for Social Insights</option>
            </select>
          </label>
          {evidence.public_use_boundary === 'framework_only' && <p role="status" className="rounded border border-emerald-400/40 bg-emerald-400/5 p-3 text-muted-foreground">Public framework path: only the approved source, selected framework, and originality receipt are used. No practitioner anecdote is collected or included.</p>}
          {evidence.public_use_boundary && evidence.public_use_boundary !== 'framework_only' && <>
            <p className="text-muted-foreground">Describe the practice without names, organizations, locations, dates, account details, or uniquely identifying combinations.</p>
            <label className="block">Practitioner role or context
              <input className="mt-1 block w-full rounded border border-silicon-slate bg-background p-2" maxLength={120} value={evidence.role_context} onChange={event => changeEvidence({ role_context: event.target.value })} placeholder="Example: nonprofit operations lead" />
            </label>
            {([
              ['Situation', 'situation'],
              ['Action taken', 'action_taken'],
              ['Observed outcome', 'observed_outcome'],
              ['Limitations or evidence boundary', 'limitations'],
            ] as const).map(([label, key]) => <label className="block" key={key}>{label}
              <textarea className="mt-1 block w-full rounded border border-silicon-slate bg-background p-2" rows={2} maxLength={1200} value={evidence[key]} onChange={event => changeEvidence({ [key]: event.target.value })} />
            </label>)}
          </>}
        </fieldset>
        {evidence.public_use_boundary && evidence.public_use_boundary !== 'framework_only' && <fieldset className="space-y-2 rounded border border-silicon-slate/70 p-3" disabled={busy}>
          <legend className="px-1 font-semibold">Privacy and redaction receipt</legend>
          {([
            ['I removed direct identifiers.', 'direct_identifiers_removed'],
            ['I reviewed indirect identifiers and identifying combinations.', 'indirect_identifiers_reviewed'],
            ['I removed or generalized sensitive details.', 'sensitive_details_removed'],
          ] as const).map(([label, key]) => <label className="flex items-start gap-2" key={key}>
            <input type="checkbox" className="mt-0.5" checked={evidence.redaction_receipt[key]} onChange={event => changeEvidence({ redaction_receipt: { ...evidence.redaction_receipt, [key]: event.target.checked } })} />
            <span>{label}</span>
          </label>)}
          <label className="block">Redaction receipt note
            <textarea className="mt-1 block w-full rounded border border-silicon-slate bg-background p-2" rows={2} maxLength={1000} value={evidence.redaction_receipt.review_note} onChange={event => changeEvidence({ redaction_receipt: { ...evidence.redaction_receipt, review_note: event.target.value } })} placeholder="What was removed or generalized; do not repeat the private detail." />
          </label>
        </fieldset>}
        <fieldset className="space-y-2 rounded border border-silicon-slate/70 p-3" disabled={busy}>
          <legend className="px-1 font-semibold">Framework receipt</legend>
          <label className="block">Selected packet framework
            <select className="mt-1 block w-full rounded border border-silicon-slate bg-background p-2" value={evidence.framework_receipt.selected_framework_key} onChange={event => changeEvidence({ framework_receipt: { ...evidence.framework_receipt, selected_framework_key: event.target.value } })}>
              <option value="">Choose a framework</option>
              {frameworkEntries.map(([key]) => <option key={key} value={key}>{key.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
          <label className="block">Application note
            <textarea className="mt-1 block w-full rounded border border-silicon-slate bg-background p-2" rows={2} maxLength={1200} value={evidence.framework_receipt.application_note} onChange={event => changeEvidence({ framework_receipt: { ...evidence.framework_receipt, application_note: event.target.value } })} placeholder="How this framework helps the existing insight without copying source language." />
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5" checked={evidence.framework_receipt.source_use_confirmed} onChange={event => changeEvidence({ framework_receipt: { ...evidence.framework_receipt, source_use_confirmed: event.target.checked } })} />
            <span>I confirm the source is a pattern input, not copy, title, thumbnail, script, or visual identity to reproduce.</span>
          </label>
          <label className="block">Revision note
            <input className="mt-1 block w-full rounded border border-silicon-slate bg-background p-2" maxLength={500} value={evidence.revision_note} onChange={event => changeEvidence({ revision_note: event.target.value })} placeholder="What changed in this evidence revision?" />
          </label>
          {onSaveEvidence && <button type="button" className="agent-ops-button-secondary disabled:opacity-50" disabled={busy || !evidence.revision_note.trim()} onClick={() => void saveEvidence()}>{packet.status === 'rejected' ? 'Revise and return to review' : 'Save evidence draft'}</button>}
        </fieldset>
        {!eligible && <div role="status" className="rounded border border-amber-400/40 bg-amber-400/5 p-3"><p className="font-semibold">Approval blocked until:</p><ul className="mt-1 list-disc space-y-1 pl-5">{[
          ...(!hasSource ? ['Add a valid public source URL.'] : []),
          ...(!hasPattern ? ['Add a nonempty pattern packet.'] : []),
          ...(packet.pattern_status !== 'usable_framework' ? ['Mark the packet as a usable framework.'] : []),
          ...evidenceValidation.issues,
        ].map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
        {packet.status === 'review_ready' && <>
        <label className="block">Review reason
          <textarea className="mt-1 block w-full rounded border border-silicon-slate bg-background p-2" rows={2} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} disabled={busy} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="agent-ops-button-primary disabled:opacity-50" disabled={busy || !note.trim() || !eligible} onClick={() => void submit('approved')}>Approve framework</button>
          <button type="button" className="rounded border border-red-400/60 px-3 py-2 text-red-300 disabled:opacity-50" disabled={busy || !note.trim()} onClick={() => void submit('rejected')}>Reject packet</button>
        </div>
        {busy && <p role="status">Saving review…</p>}
        </>}
      </> : <p>{review?.note ?? 'No operator review note recorded.'}{review?.reviewed_at ? ` • ${new Date(review.reviewed_at).toLocaleString()}` : ''}</p>}
      {error && <p role="alert" className="text-red-300">{error}</p>}
    </div>}
  </div>
}
