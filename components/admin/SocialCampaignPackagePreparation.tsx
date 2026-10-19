'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, FileCheck2, History, Loader2, LockKeyhole, Play, RotateCcw } from 'lucide-react'
import { getCurrentSession } from '@/lib/auth'
import type { CampaignPreparationCandidate, CampaignPreparationResult, CampaignReviewPackage } from '@/lib/social-campaign-package-preparation'
import type { CampaignLongFormBatch, CampaignLongFormDraftPacket, CampaignLongFormProjection } from '@/lib/social-campaign-long-form-batch'

type CandidateProjection = { candidate: CampaignPreparationCandidate; evaluation: CampaignPreparationResult }
type Run = {
  id: string
  status: string
  subject_id: string
  subject_label: string
  current_step: string
  metadata: { package?: CampaignReviewPackage; long_form_batch?: CampaignLongFormBatch; attempt_number?: number; retry_count?: number; retry_limit?: number; maximum_attempts?: number }
  outcome?: Record<string, unknown>
  error_message?: string | null
  idempotency_key: string
  created_at: string
  updated_at: string
  completed_at?: string | null
}
type Payload = {
  candidates: CandidateProjection[]
  long_form_inventory: CampaignLongFormProjection[]
  runs: Run[]
  retry_policy: { maximum_attempts_per_input_version: number; retry_limit: number; duplicate_records_allowed: false; source_change_requires_new_input_version: true }
  external_gates: Record<string, false>
  fixture: boolean
  integration_note: string | null
}

function pretty(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function LongFormPacketDetails({ packet }: { packet: CampaignLongFormDraftPacket }) {
  const contract = packet.evaluation_receipt.script_contract

  return (
    <details className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 md:col-span-2">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">{packet.title}</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <p className="rounded-md border border-border bg-background p-2 text-xs text-muted-foreground"><strong className="block text-foreground">Contract</strong>{Math.round(contract.duration_seconds / 60)} min · {contract.word_count} words</p>
        <p className="rounded-md border border-border bg-background p-2 text-xs text-muted-foreground"><strong className="block text-foreground">Delivery</strong>{contract.minimum_word_count}-{contract.maximum_word_count} words · {contract.delivery_words_per_minute} WPM</p>
        <p className="rounded-md border border-border bg-background p-2 text-xs text-muted-foreground"><strong className="block text-foreground">Evaluation</strong>Score {packet.evaluation_receipt.overall_score ?? 'Unscored'} · {packet.evaluation_receipt.dimensions.length} dimensions</p>
        <p className="rounded-md border border-border bg-background p-2 text-xs text-muted-foreground"><strong className="block text-foreground">Evidence gates</strong>Topic {packet.evaluation_receipt.topic_evidence.status} · originality {packet.evaluation_receipt.originality.status}</p>
      </div>
      <ul className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-3" aria-label="Passed long-form dimensions">
        {packet.evaluation_receipt.dimensions.map((dimension) => <li key={dimension.key} className="text-[11px] text-muted-foreground"><CheckCircle2 className="mr-1 inline h-3 w-3 text-emerald-600" />{dimension.label}</li>)}
      </ul>
      <div className="mt-4">
        <h4 className="text-sm font-semibold text-foreground">Full chaptered script</h4>
        <p className="mt-1 text-xs text-muted-foreground">Every spoken beat, owned-evidence cue, and framework change remains inspectable before approval.</p>
        <ol className="mt-3 space-y-3" aria-label="Full chaptered long-form script">
          {packet.beats.map((beat) => (
            <li key={beat.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h5 className="text-xs font-semibold text-foreground">{pretty(beat.chapter_id ?? beat.role)} · {pretty(beat.role)}</h5>
                <span className="font-mono text-[10px] text-muted-foreground">{beat.start_seconds}s-{beat.end_seconds}s · {beat.id}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{beat.text}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">B-roll:</strong> {beat.broll_cue}</p>
              {beat.pattern_interrupt ? <p className="mt-1 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Pattern interrupt:</strong> {beat.pattern_interrupt}</p> : null}
              {(beat.framework_applications ?? []).length ? <ul className="mt-2 space-y-1" aria-label={`Framework changes for ${beat.id}`}>{beat.framework_applications?.map((application) => <li key={`${application.rule_id}-${application.change}`} className="rounded border border-violet-500/20 bg-violet-500/5 p-2 text-[11px] leading-5 text-muted-foreground"><strong className="text-foreground">{application.source_creators.join(' + ')}:</strong> {application.change}</li>)}</ul> : null}
              {beat.primary_cta ? <p className="mt-2 text-xs leading-5 text-emerald-800 dark:text-emerald-100"><strong>Primary CTA:</strong> {beat.primary_cta.action} · <a href={beat.primary_cta.destination_url} target="_blank" rel="noreferrer" className="underline">{beat.primary_cta.destination_label}</a></p> : null}
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-3 break-all font-mono text-[10px] text-muted-foreground">{packet.packet_id}</p>
    </details>
  )
}

export default function SocialCampaignPackagePreparation({ qaFixture }: { qaFixture?: string }) {
  const [data, setData] = useState<Payload | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState(false)
  const [batchBusy, setBatchBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const fixtureQuery = qaFixture ? `?qa_fixture=${encodeURIComponent(qaFixture)}` : ''

  const load = useCallback(async () => {
    setError('')
    try {
      const session = await getCurrentSession()
      if (!session) throw new Error('Sign in with an authorized Portfolio staff account.')
      const response = await fetch(`/api/admin/social-content/campaign-packages${fixtureQuery}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Campaign preparation is unavailable.')
      const normalized = {
        ...payload,
        candidates: Array.isArray(payload.candidates) ? payload.candidates : [],
        long_form_inventory: Array.isArray(payload.long_form_inventory) ? payload.long_form_inventory : [],
        runs: Array.isArray(payload.runs) ? payload.runs : [],
        external_gates: payload.external_gates && typeof payload.external_gates === 'object' ? payload.external_gates : {},
        retry_policy: payload.retry_policy ?? { maximum_attempts_per_input_version: 2, retry_limit: 1, duplicate_records_allowed: false, source_change_requires_new_input_version: true },
      } as Payload
      setData(normalized)
      setSelectedId((current) => current || normalized.candidates[0]?.candidate.candidate_id || '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Campaign preparation is unavailable.')
    }
  }, [fixtureQuery])

  useEffect(() => { void load() }, [load])
  const selected = useMemo(() => data?.candidates.find((entry) => entry.candidate.candidate_id === selectedId) ?? null, [data, selectedId])
  const packageRuns = useMemo(() => (data?.runs ?? []).filter((run) => run.subject_id === selectedId), [data, selectedId])
  const latestPackage = packageRuns.find((run) => run.metadata?.package)?.metadata.package ?? null
  const longFormRuns = useMemo(() => (data?.runs ?? []).filter((run) => run.metadata?.long_form_batch), [data])
  const latestLongFormBatch = longFormRuns[0]?.metadata.long_form_batch ?? null

  const prepare = async () => {
    if (!selected) return
    setBusy(true); setError(''); setNotice('')
    try {
      const session = await getCurrentSession()
      if (!session) throw new Error('Sign in with an authorized Portfolio staff account.')
      const response = await fetch(`/api/admin/social-content/campaign-packages${fixtureQuery}`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate_id: selected.candidate.candidate_id }) })
      const payload = await response.json()
      if (!response.ok) {
        if (payload.evaluation) setData((current) => current ? { ...current, candidates: current.candidates.map((entry) => entry.candidate.candidate_id === selectedId ? { ...entry, evaluation: payload.evaluation } : entry) } : current)
        throw new Error(payload.error || 'Candidate remains blocked.')
      }
      setData((current) => current ? { ...current, runs: [payload.run, ...current.runs.filter((run) => run.id !== payload.run.id)] } : current)
      setNotice(payload.duplicate ? 'The existing receipt was returned. No duplicate record was created.' : 'Review package prepared. Approval and advancement remain in the canonical Decision Queue.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Preparation failed. Refresh before a bounded retry.')
    } finally { setBusy(false) }
  }

  const prepareLongFormBatch = async () => {
    setBatchBusy(true); setError(''); setNotice('')
    try {
      const session = await getCurrentSession()
      if (!session) throw new Error('Sign in with an authorized Portfolio staff account.')
      const response = await fetch(`/api/admin/social-content/campaign-packages${fixtureQuery}`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prepare_long_form_batch' }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Long-form batch preparation failed.')
      setData((current) => current ? { ...current, runs: [payload.run, ...current.runs.filter((run) => run.id !== payload.run.id)] } : current)
      const batch = payload.run?.metadata?.long_form_batch as CampaignLongFormBatch | undefined
      setNotice(payload.duplicate
        ? 'The existing long-form batch receipt was returned. No duplicate drafts were created.'
        : `${batch?.prepared_count ?? 0} long-form script${batch?.prepared_count === 1 ? '' : 's'} prepared for human review; ${batch?.blocked_count ?? 0} blocked; ${batch?.remaining ?? 0} remaining.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Long-form batch preparation failed. Refresh before a bounded retry.')
    } finally { setBatchBusy(false) }
  }

  if (!data && !error) return <section aria-label="Campaign package preparation" className="admin-console-card rounded-xl border p-5"><p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading eligible campaigns…</p></section>

  return (
    <section aria-label="Campaign package preparation" className="admin-console-card rounded-xl border p-4 sm:p-5" data-testid="campaign-package-preparation">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="admin-console-eyebrow mb-2">Social Content · review-only preparation</div>
          <h2 className="text-xl font-semibold text-foreground">Prepare a complete campaign package</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Select an evidence-backed candidate, resolve exact blockers, then prepare LinkedIn and YouTube assets with durable receipts. Only the canonical Decision Queue can approve or advance the result.</p>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end"><span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-500/35 bg-slate-500/10 px-3 py-1 text-xs font-semibold text-foreground"><LockKeyhole className="h-3.5 w-3.5" /> External gates closed</span><button type="button" onClick={() => void prepareLongFormBatch()} disabled={batchBusy || !(data?.long_form_inventory.length)} className="admin-console-button-primary disabled:cursor-not-allowed disabled:opacity-50">{batchBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{batchBusy ? 'Preparing batch…' : longFormRuns.length ? 'Return existing script batch' : 'Prepare eligible long-form scripts'}</button></div>
      </div>
      {data?.integration_note ? <p className="mt-3 rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-xs leading-5 text-muted-foreground">{data.integration_note}</p> : null}
      {error ? <div role="alert" className="mt-3 rounded-lg border border-red-500/35 bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-100">{error} <button type="button" onClick={() => void load()} className="ml-1 underline">Refresh</button></div> : null}
      {notice ? <p role="status" className="mt-3 rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-100">{notice}</p> : null}

      <section aria-label="Long-form script batch review" className="mt-4 rounded-lg border border-border bg-background p-3" data-testid="long-form-script-batch">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-foreground">Long-form Script Intelligence batch</h3><p className="mt-1 text-xs text-muted-foreground">{data?.long_form_inventory.length ?? 0} total · {data?.long_form_inventory.filter((entry) => entry.ready).length ?? 0} ready · {data?.long_form_inventory.filter((entry) => !entry.ready).length ?? 0} blocked · processed in deterministic chunks of 10</p></div><span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-foreground">Review only</span></div>
        {!latestLongFormBatch ? <p className="mt-3 text-xs leading-5 text-muted-foreground">Long-form draft scripts remain sealed until the bounded batch action validates current source, product proof, live topic evidence, originality, privacy, title/thumbnail distinction, and canonical framework receipts.</p> : <div className="mt-3 space-y-3">
          <p className="text-xs font-semibold text-foreground">{latestLongFormBatch.total} total · {latestLongFormBatch.scanned} scanned · {latestLongFormBatch.prepared_count} prepared · {latestLongFormBatch.blocked_count} blocked · {latestLongFormBatch.deferred_count} deferred · {latestLongFormBatch.remaining} remaining · {latestLongFormBatch.chunks_processed} chunks</p>
          <div className="grid gap-2 md:grid-cols-2">{latestLongFormBatch.prepared.map((packet) => <LongFormPacketDetails key={packet.packet_id} packet={packet} />)}</div>
          {latestLongFormBatch.blocked.length ? <div className="space-y-2">{latestLongFormBatch.blocked.map((entry) => <div key={entry.candidate_id} className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3"><p className="text-sm font-semibold text-foreground">{entry.product_label} · Blocked</p>{entry.blockers.slice(0, 3).map((item) => <p key={item.code} className="mt-1 text-xs leading-5 text-muted-foreground">{item.message} <Link href={item.recovery_href} className="font-semibold text-blue-700 underline dark:text-blue-200">{item.recovery_label}</Link></p>)}</div>)}</div> : null}
        </div>}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Eligible campaign candidates</h3>
          <div className="mt-2 space-y-2" role="listbox" aria-label="Campaign candidates">
            {(data?.candidates ?? []).map((entry) => {
              const active = entry.candidate.candidate_id === selectedId
              return <button key={entry.candidate.candidate_id} type="button" role="option" aria-selected={active} onClick={() => { setSelectedId(entry.candidate.candidate_id); setError(''); setNotice('') }} className={`w-full rounded-lg border p-3 text-left transition-colors ${active ? 'border-radiant-gold bg-radiant-gold/10' : 'border-border bg-background hover:bg-muted/30'}`}>
                <span className="flex items-start justify-between gap-3"><span><span className="block text-sm font-semibold text-foreground">{entry.candidate.product_label}</span><span className="mt-1 block text-xs text-muted-foreground">LinkedIn + YouTube · {entry.candidate.calendar_item_ids.length} calendar bindings</span></span><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${entry.evaluation.ready ? 'border-emerald-500/35 text-emerald-700 dark:text-emerald-200' : entry.evaluation.state === 'unscored' ? 'border-slate-500/35 text-muted-foreground' : 'border-amber-500/35 text-amber-800 dark:text-amber-100'}`}>{entry.evaluation.ready ? 'Ready' : entry.evaluation.state === 'unscored' ? 'Unscored' : 'Blocked'}</span></span>
              </button>
            })}
          </div>
        </div>

        {selected ? <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="text-lg font-semibold text-foreground">{selected.candidate.product_label}</h3><p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{selected.candidate.campaign_identity} · {selected.candidate.content_version}</p></div>
            <button type="button" onClick={() => void prepare()} disabled={busy || !selected.evaluation.ready} className="admin-console-button-primary disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{busy ? 'Preparing…' : packageRuns.some((run) => ['completed', 'running', 'waiting_for_approval', 'queued'].includes(run.status)) ? 'Return existing receipt' : packageRuns.length ? 'Retry preparation' : 'Prepare review package'}</button>
          </div>

          {!selected.evaluation.ready ? <div className="mt-4 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><AlertTriangle className="h-4 w-4" /> {selected.evaluation.state === 'unscored' ? 'Unscored evidence' : 'Preparation blocked'}</p>
            <ul className="mt-2 space-y-2">{selected.evaluation.blockers.map((blocker) => <li key={blocker.code} className="rounded-md border border-border bg-background p-2 text-xs leading-5"><p className="text-foreground">{blocker.message}</p><Link href={blocker.recovery_href} className="font-semibold text-blue-700 underline dark:text-blue-200">{blocker.recovery_label}</Link></li>)}</ul>
          </div> : <div className="mt-4 rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-3"><p className="flex items-center gap-2 text-sm font-semibold text-foreground"><CheckCircle2 className="h-4 w-4" /> Every prerequisite passed</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Evidence, live outlier threshold, product proof, originality, privacy, version bindings, and thumbnail v6 checks are current.</p></div>}

          {latestPackage ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">LinkedIn package</p><p className="mt-2 text-sm leading-6 text-foreground">{latestPackage.deliverables.linkedin.copy}</p><p className="mt-2 break-all text-xs text-muted-foreground">Visual: {latestPackage.deliverables.linkedin.visual_href}</p></div>
            <div className="rounded-lg border border-border bg-background p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">YouTube package</p><p className="mt-2 text-sm font-semibold text-foreground">{latestPackage.deliverables.youtube.title}</p><p className="mt-1 text-xs text-muted-foreground">Thumbnail teaser: <strong className="text-foreground">{latestPackage.deliverables.youtube.thumbnail_teaser}</strong></p><p className="mt-2 text-xs leading-5 text-muted-foreground">Description, script, {latestPackage.deliverables.youtube.storyboard.length}-beat storyboard, thumbnail, and product-proof binding included.</p></div>
          </div> : <p className="mt-4 rounded-lg border border-border bg-muted/25 p-3 text-sm text-muted-foreground">{selected.evaluation.ready ? 'All inputs are ready. LinkedIn and YouTube deliverables remain sealed until the idempotent preparation run completes.' : 'LinkedIn and YouTube deliverables are withheld until every prerequisite passes.'}</p>}

          <details className="mt-3 rounded-lg border border-border bg-background p-3"><summary className="cursor-pointer text-sm font-semibold text-foreground">Evidence, formulas, and comparison trace</summary><div className="mt-3 space-y-2">{Object.entries(selected.candidate.receipts).map(([name, receipt]) => <div key={name} className="rounded-md border border-border p-2 text-xs"><div className="flex flex-wrap justify-between gap-2"><strong className="text-foreground">{pretty(name)}</strong><span>{String(receipt.observed_value)} observed / {String(receipt.required_value)} required · n={receipt.sample_size ?? '—'}</span></div><p className="mt-1 text-muted-foreground">{receipt.formula ?? 'No formula recorded'} · fresh until {receipt.fresh_until ?? 'not supplied'}</p><p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{receipt.receipt_id}</p></div>)}</div><div className="mt-3 space-y-2">{selected.candidate.source_trace.map((source) => <p key={source.source_id} className="text-xs leading-5"><strong>{source.decision === 'selected' ? 'Selected' : 'Excluded'}:</strong> {source.label} — {source.reason}</p>)}</div><p className="mt-3 text-xs text-muted-foreground">Saved playlist examples: zero performance weight; taste calibration only; Unscored.</p></details>

          <details className="mt-3 rounded-lg border border-border bg-background p-3"><summary className="cursor-pointer text-sm font-semibold text-foreground">Thumbnail v6 pre-Human-QA checklist</summary><ul className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(selected.candidate.thumbnail_checklist).map(([label, passed]) => <li key={label} className="flex items-start gap-2 text-xs leading-5">{passed ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />}{label}</li>)}</ul></details>

          <section aria-label="Preparation run history" className="mt-4 rounded-lg border border-border bg-background p-3"><div className="flex items-center justify-between gap-2"><h4 className="flex items-center gap-2 text-sm font-semibold text-foreground"><History className="h-4 w-4" /> Run history and receipts</h4><span className="text-xs text-muted-foreground">Maximum attempts: {data?.retry_policy.maximum_attempts_per_input_version ?? 2}</span></div>{packageRuns.length ? <ul className="mt-3 space-y-2">{packageRuns.map((run) => <li key={run.id} className="rounded-md border border-border p-2 text-xs"><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold text-foreground">{run.current_step}</span><span>{run.status}</span></div><p className="mt-1 text-muted-foreground">Attempt {run.metadata.attempt_number ?? 1} of {run.metadata.maximum_attempts ?? 2} · Retry {run.metadata.retry_count ?? 0} of {run.metadata.retry_limit ?? 1}</p><p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{run.id} · {run.idempotency_key}</p>{run.metadata.package ? <Link href={run.metadata.package.decision_queue_href} className="mt-2 inline-flex items-center gap-1 font-semibold text-blue-700 underline dark:text-blue-200"><FileCheck2 className="h-3.5 w-3.5" /> Open canonical Decision Queue</Link> : null}</li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">No preparation run yet. Blocked candidates create no package; a failed run permits one immutable retry receipt.</p>}</section>

          {latestPackage ? <p className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs leading-5 text-muted-foreground"><FileCheck2 className="mr-1 inline h-4 w-4" /> Package <span className="font-mono">{latestPackage.package_id}</span> preserves source trace, version bindings, product-proof receipts, selected/excluded comparison logic, and closed external gates.</p> : null}
        </div> : null}
      </div>

      <div className="mt-5 border-t border-border pt-4"><p className="text-xs font-semibold text-foreground">Closed in this workflow</p><div className="mt-2 flex flex-wrap gap-2">{Object.keys(data?.external_gates ?? {}).map((gate) => <span key={gate} className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground">{pretty(gate)}</span>)}</div><p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" /> A retry is available only after a visible failure and is capped at two attempts for the same input version. A source change requires a new version; the idempotency key prevents duplicate records.</p></div>
    </section>
  )
}

