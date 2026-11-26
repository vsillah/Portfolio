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

export type EvidenceRepairReview = {
  binding: { caseId?: string; packetVersion: string; bindingHash: string; sourceSha256: string; sourceExpiresAt: string; approvedCopySha256: string; originalPacketId: string; originalPacketVersion: string; contentVersion?: string; claimBoundarySha256?: string }
  title: string
  source_url: string
  source_use_boundary: string
  supported_claims: string[]
  removed_claims: string[]
  approval_scope: string
  slack_review_enabled: boolean
  terminal_receipt?: { id: string; decision: 'approve' | 'reject' | 'revise'; reason: string;
    reviewer_id: string; surface: 'portfolio' | 'slack'; created_at: string; external_execution_enabled: false }
}

export function ResearchPacketReview({ packet, onReview, onSaveEvidence, onLoadRepairReview, onRepairDecision, onRequestSlackReview }: {
  packet: ReviewableResearchPacket
  onReview: (decision: 'approved' | 'rejected', note: string, signalReview?: OfficialSignalReviewPayload) => Promise<void>
  onSaveEvidence?: (evidence: PractitionerEvidenceAuthoring) => Promise<void>
  onLoadRepairReview?: () => Promise<EvidenceRepairReview>
  onRepairDecision?: (decision: 'approve' | 'reject' | 'revise', reason: string, review: EvidenceRepairReview) => Promise<void>
  onRequestSlackReview?: (review: EvidenceRepairReview) => Promise<string>
}) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [repairReview, setRepairReview] = useState<EvidenceRepairReview | null>(null)
  const [repairSlackStatus, setRepairSlackStatus] = useState('')
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
  async function openRepair() {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (!onLoadRepairReview) return
    setBusy(true); setError('')
    try { setRepairReview(await onLoadRepairReview()) }
    catch (err) { setError(err instanceof Error ? err.message : 'Review unavailable. Refresh the packet.') }
    finally { setBusy(false) }
  }
  async function decideRepair(decision: 'approve' | 'reject' | 'revise') {
    if (!repairReview || !onRepairDecision) return
    setBusy(true); setError('')
    let recorded = false
    try {
      await onRepairDecision(decision, note.trim(), repairReview)
      recorded = true
      setNote('')
      if (onLoadRepairReview) setRepairReview(await onLoadRepairReview())
      else setRepairReview(null)
    }
    catch (err) { setError(recorded ? 'Decision recorded. Refresh this packet to load its receipt.'
      : err instanceof Error ? err.message : 'Decision not confirmed. Refresh before retrying.') }
    finally { setBusy(false) }
  }
  async function requestRepairSlack() {
    if (!onRequestSlackReview || !repairReview) return
    setBusy(true); setError('')
    try { setRepairSlackStatus(await onRequestSlackReview(repairReview)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Slack request was not confirmed.') }
    finally { setBusy(false) }
  }
  const repair = packet.actor_metadata?.evidence_repair_candidate as { candidate_status?: string } | undefined
  const repairStatusLabel = ({ human_qa_pending: 'Pending Human QA', human_qa_approved: 'Evidence approved',
    human_qa_rejected: 'Candidate rejected', revision_requested: 'Revision requested' } as Record<string, string>)[repair?.candidate_status ?? ''] ?? 'Unknown'
  if (repair) return <div className="mt-2 min-w-0 max-w-full text-xs">
    <div className="flex flex-wrap items-center gap-2">
      <span>Evidence repair · {repairStatusLabel}</span>
      <button type="button" className="agent-ops-button-secondary" aria-expanded={open} onClick={() => void openRepair()}>{open ? 'Close Human QA' : repair.candidate_status === 'human_qa_pending' ? 'Review evidence repair' : 'View Human QA receipt'}</button>
    </div>
    {open && <div className="mt-2 space-y-3 rounded-lg border border-border p-3">
      <p>Review this replacement source only. The original packet, approved copy, calendar linkage, and external execution stay unchanged.</p>
      {busy && <p role="status">Loading or saving review…</p>}
      {repairReview?.terminal_receipt && <div role="status" className="space-y-1 rounded border border-border p-2">
        <p className="font-semibold">Human QA decision: {repairReview.terminal_receipt.decision === 'revise' ? 'Revision requested' : repairReview.terminal_receipt.decision === 'approve' ? 'Evidence approved' : 'Candidate rejected'}</p>
        <p>Reason: {repairReview.terminal_receipt.reason}</p>
        <p>Recorded {new Date(repairReview.terminal_receipt.created_at).toLocaleString()} in {repairReview.terminal_receipt.surface === 'slack' ? 'Slack' : 'Portfolio'} · receipt <span className="font-mono break-all">{repairReview.terminal_receipt.id}</span></p>
        <p>Candidate only. No source linkage, preparation rerun, or external execution.</p>
      </div>}
      {repairReview && !repairReview.terminal_receipt && <>
        <p className="font-semibold">{repairReview.title}</p>
        <a href={repairReview.source_url} target="_blank" rel="noreferrer" className="block break-all underline">Inspect source</a>
        <p>Source use: {repairReview.source_use_boundary || 'Unrecorded'}</p>
        <p>Expires: {new Date(repairReview.binding.sourceExpiresAt).toLocaleString()}</p>
        <details className="rounded border border-border p-2"><summary className="cursor-pointer font-semibold">Exact binding and lineage</summary>
          <div className="mt-2 space-y-1">
            {repairReview.binding.caseId && <p>Case: <span className="font-mono break-all">{repairReview.binding.caseId}</span></p>}
            <p>Candidate version: <span className="font-mono break-all">{repairReview.binding.packetVersion}</span></p>
            <p>Original packet: <span className="font-mono break-all">{repairReview.binding.originalPacketId}</span></p>
            <p>Original version: <span className="font-mono break-all">{repairReview.binding.originalPacketVersion}</span></p>
            {repairReview.binding.contentVersion && <p>Social Content version: <span className="font-mono break-all">{repairReview.binding.contentVersion}</span></p>}
            <p>Source hash: <span className="font-mono break-all">{repairReview.binding.sourceSha256}</span></p>
            {repairReview.binding.claimBoundarySha256 && <p>Claim boundary hash: <span className="font-mono break-all">{repairReview.binding.claimBoundarySha256}</span></p>}
            <p>Approved copy hash: <span className="font-mono break-all">{repairReview.binding.approvedCopySha256}</span></p>
          </div>
        </details>
        <div><p className="font-semibold">Supported claims</p><ul className="list-disc pl-4">{repairReview.supported_claims.map((claim, index) => <li key={index}>{claim}</li>)}</ul></div>
        <div><p className="font-semibold">Removed claims</p><ul className="list-disc pl-4">{repairReview.removed_claims.map((claim, index) => <li key={index}>{claim}</li>)}</ul></div>
        <p>{repairReview.approval_scope}</p>
        <label className="block">Decision reason<textarea className="mt-1 block w-full rounded border border-border bg-background p-2" rows={2} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} disabled={busy} /></label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="agent-ops-button-primary disabled:opacity-50" disabled={busy || !note.trim()} onClick={() => void decideRepair('approve')}>Approve evidence only</button>
          <button type="button" className="agent-ops-button-secondary disabled:opacity-50" disabled={busy || !note.trim()} onClick={() => void decideRepair('revise')}>Request revision</button>
          <button type="button" className="rounded border border-red-400/60 px-3 py-2 text-red-300 disabled:opacity-50" disabled={busy || !note.trim()} onClick={() => void decideRepair('reject')}>Reject candidate</button>
        </div>
        {repairReview.slack_review_enabled && onRequestSlackReview
          ? <button type="button" className="agent-ops-button-secondary disabled:opacity-50" disabled={busy} onClick={() => void requestRepairSlack()}>Request this exact review in Slack</button>
          : <p className="text-muted-foreground">Slack review delivery is disabled. Decide here in Portfolio.</p>}
        {repairSlackStatus && <p role="status">{repairSlackStatus}</p>}
      </>}
      {error && <p role="alert" className="text-red-300">{error}</p>}
    </div>}
  </div>
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
