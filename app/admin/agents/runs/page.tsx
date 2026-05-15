'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, FileText, RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import type { AgentRuntime, AgentRunStatus } from '@/lib/agent-run'

type RunRow = {
  id: string
  agent_key: string | null
  runtime: AgentRuntime
  kind: string
  title: string
  status: AgentRunStatus
  subject_type: string | null
  subject_id: string | null
  subject_label: string | null
  current_step: string | null
  trigger_source: string | null
  started_at: string
  completed_at: string | null
  stale_after: string | null
  error_message: string | null
  metadata?: Record<string, unknown> | null
  stale: boolean
  cost_total: number
  approvals: { pending: number; approved: number; rejected: number }
}

type RecoveryResult = {
  ok?: boolean
  error?: string
  run_id?: string
  recovery_run_id?: string
  retry_attempt?: number
  earliest_retry_at?: string
}

const RUNTIMES = ['all', 'codex', 'n8n', 'hermes', 'opencode', 'manual'] as const
const STATUSES = ['all', 'active', 'needs_review', 'queued', 'running', 'waiting_for_approval', 'completed', 'failed', 'cancelled', 'stale'] as const

export default function AgentRunsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <Suspense fallback={<div className="min-h-screen bg-background p-6 text-muted-foreground">Loading agent runs...</div>}>
        <AgentRunsContent />
      </Suspense>
    </ProtectedRoute>
  )
}

function AgentRunsContent() {
  const searchParams = useSearchParams()
  const [runs, setRuns] = useState<RunRow[]>([])
  const [runtime, setRuntime] = useState<(typeof RUNTIMES)[number]>('all')
  const [status, setStatus] = useState<(typeof STATUSES)[number]>(() => normalizeStatusFilter(searchParams.get('status'), searchParams.get('active')))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sweepLoading, setSweepLoading] = useState(false)
  const [sweepMessage, setSweepMessage] = useState<string | null>(null)
  const [recoveryLoadingId, setRecoveryLoadingId] = useState<string | null>(null)
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null)
  const kindFilter = searchParams.get('kind')

  const fetchRuns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const qs = new URLSearchParams({ limit: '75' })
      if (runtime !== 'all') qs.set('runtime', runtime)
      if (status === 'active') qs.set('active', 'true')
      else if (status !== 'all') qs.set('status', status)
      if (kindFilter) qs.set('kind', kindFilter)
      const res = await fetch(`/api/admin/agents/runs?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const body = await res.json()
      setRuns(body.runs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs')
      setRuns([])
    } finally {
      setLoading(false)
    }
  }, [kindFilter, runtime, status])

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  useEffect(() => {
    setStatus(normalizeStatusFilter(searchParams.get('status'), searchParams.get('active')))
  }, [searchParams])

  async function sweepStaleRuns() {
    setSweepLoading(true)
    setSweepMessage(null)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch('/api/admin/agents/runs/stale-sweep', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setSweepMessage(`Checked ${body.checked ?? 0} active run(s); marked ${body.marked ?? 0} stale.`)
      await fetchRuns()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sweep stale runs')
    } finally {
      setSweepLoading(false)
    }
  }

  async function requestRecovery(run: RunRow) {
    setRecoveryLoadingId(run.id)
    setRecoveryMessage(null)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch(`/api/admin/agents/runs/${run.id}/retry`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          note: 'Requested from Run Console action list.',
        }),
      })
      const body = await res.json().catch(() => ({})) as RecoveryResult
      if (!res.ok && !body.recovery_run_id) {
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const recoveryId = body.run_id ?? body.recovery_run_id
      setRecoveryMessage(recoveryId
        ? `Recovery request ${recoveryId} is queued for ${run.title}.`
        : `Recovery request queued for ${run.title}.`)
      if (res.ok) await fetchRuns()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create recovery request')
    } finally {
      setRecoveryLoadingId(null)
    }
  }

  const summary = summarizeRuns(runs)

  return (
    <div className="agent-ops-page min-h-screen p-5 text-foreground lg:p-7">
      <div className="mx-auto max-w-7xl">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Agent Operations', href: '/admin/agents' },
          { label: 'Runs' },
        ]} />

        <header className="agent-ops-surface-header mb-6 mt-5 flex flex-col gap-4 rounded-xl border p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="agent-ops-eyebrow mb-2">
              <Bot size={16} />
              Agent Ops trace history
            </div>
            <h1 className="text-3xl font-bold">Run Console</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Live and historical traces across supported runtimes, evaluations, dead letters, approvals, and artifacts.</p>
          </div>
          <div className="agent-ops-header-actions">
            <button
              onClick={sweepStaleRuns}
              disabled={sweepLoading}
              className="agent-ops-button-muted disabled:opacity-60"
            >
              <RefreshCw size={16} className={sweepLoading ? 'animate-spin' : ''} />
              Sweep stale
            </button>
            <button
              onClick={fetchRuns}
              className="agent-ops-button-secondary"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </header>

        {sweepMessage ? (
          <div className="mb-4 rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-3 text-sm text-cyan-100">
            {sweepMessage}
          </div>
        ) : null}
        {recoveryMessage ? (
          <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            {recoveryMessage}
          </div>
        ) : null}

        <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="grid gap-3 sm:grid-cols-4">
            <RunSummaryCard label="Needs review" value={summary.needsReview} detail="Failed, stale, or computed stale" tone={summary.needsReview ? 'red' : 'neutral'} />
            <RunSummaryCard label="Approval waits" value={summary.waitingForApproval} detail="Review on trace detail" tone={summary.waitingForApproval ? 'yellow' : 'neutral'} />
            <RunSummaryCard label="Active" value={summary.active} detail="Queued or running traces" tone={summary.active ? 'blue' : 'neutral'} />
            <RunSummaryCard label="Cost" value={`$${summary.cost.toFixed(4)}`} detail="Visible rows" tone="neutral" />
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              aria-label="Runtime filter"
              value={runtime}
              onChange={(e) => setRuntime(e.target.value as (typeof RUNTIMES)[number])}
              className="rounded-lg border border-silicon-slate/70 bg-background px-3 py-2 text-sm"
            >
              {RUNTIMES.map((value) => (
                <option key={value} value={value}>{value === 'all' ? 'All runtimes' : value}</option>
              ))}
            </select>
            <select
              aria-label="Status filter"
              value={status}
              onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
              className="rounded-lg border border-silicon-slate/70 bg-background px-3 py-2 text-sm"
            >
              {STATUSES.map((value) => (
                <option key={value} value={value}>{formatStatusOption(value)}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading agent runs...</div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-5 text-red-300">
            <div className="flex items-center gap-2 font-medium"><AlertTriangle size={18} /> Failed to load runs</div>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : runs.length === 0 ? (
          <div className="agent-ops-card rounded-lg border p-8 text-center text-muted-foreground">
            No agent runs match the current filters.
          </div>
        ) : (
          <div className="grid gap-3">
            {runs.map((run) => (
              <RunActionCard
                key={run.id}
                run={run}
                recoveryLoading={recoveryLoadingId === run.id}
                sweepLoading={sweepLoading}
                onRequestRecovery={() => requestRecovery(run)}
                onSweepStale={sweepStaleRuns}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function summarizeRuns(runs: RunRow[]) {
  return runs.reduce(
    (summary, run) => {
      const effectiveStatus = run.stale ? 'stale' : run.status
      if (effectiveStatus === 'failed' || effectiveStatus === 'stale') summary.needsReview += 1
      if (effectiveStatus === 'waiting_for_approval') summary.waitingForApproval += 1
      if (effectiveStatus === 'queued' || effectiveStatus === 'running') summary.active += 1
      summary.cost += run.cost_total
      return summary
    },
    { needsReview: 0, waitingForApproval: 0, active: 0, cost: 0 },
  )
}

function RunSummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string | number
  detail: string
  tone: 'blue' | 'red' | 'yellow' | 'neutral'
}) {
  const toneClass = {
    blue: 'border-sky-400/30 bg-sky-500/10',
    red: 'border-red-400/35 bg-red-500/10',
    yellow: 'border-yellow-400/35 bg-yellow-500/10',
    neutral: 'border-silicon-slate/60 bg-black/10',
  }[tone]

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function RunActionCard({
  run,
  recoveryLoading,
  sweepLoading,
  onRequestRecovery,
  onSweepStale,
}: {
  run: RunRow
  recoveryLoading: boolean
  sweepLoading: boolean
  onRequestRecovery: () => void
  onSweepStale: () => void
}) {
  const status = run.stale ? 'stale' : run.status
  const action = runActionModel(run)

  return (
    <article className={`agent-ops-card rounded-lg border p-4 ${action.toneClass}`}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.45fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <span className="inline-flex items-center gap-1 rounded-full border border-silicon-slate/50 bg-black/10 px-2 py-1 text-xs text-muted-foreground">
              <Bot size={12} />
              {run.runtime}
            </span>
            <span className="rounded-full border border-silicon-slate/50 bg-black/10 px-2 py-1 text-xs text-muted-foreground">
              {run.kind.replace(/_/g, ' ')}
            </span>
            {run.approvals.pending ? (
              <span className="rounded-full border border-yellow-400/40 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-100">
                {run.approvals.pending} pending approval(s)
              </span>
            ) : null}
          </div>
          <Link href={`/admin/agents/runs/${run.id}`} className="mt-3 block text-lg font-semibold hover:text-radiant-gold">
            {run.title}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(run.started_at)} · {run.agent_key?.replace(/-/g, ' ') || run.trigger_source || run.subject_label || 'Agent trace'}
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <RunFact icon={<ShieldAlert size={15} />} label="Status context" value={action.why} />
            <RunFact icon={<CheckCircle2 size={15} />} label="Next action" value={action.nextAction} />
            <RunFact icon={<FileText size={15} />} label="Evidence" value={action.evidence} />
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-lg border border-silicon-slate/55 bg-black/10 p-3">
          <div className="space-y-2 text-sm">
            <RunDetailLine label="Current step" value={run.current_step || '-'} />
            <RunDetailLine label="Subject" value={run.subject_label || run.subject_id || '-'} />
            <RunDetailLine label="Cost" value={`$${run.cost_total.toFixed(4)}`} />
            {run.stale_after ? <RunDetailLine label="Stale checkpoint" value={formatDate(run.stale_after)} /> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/agents/runs/${run.id}`} className="agent-ops-button-secondary">
              {action.primaryLabel}
              <ArrowRight size={15} />
            </Link>
            {action.canRecover ? (
              <button
                type="button"
                onClick={onRequestRecovery}
                disabled={recoveryLoading}
                className="agent-ops-button-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RotateCcw size={15} className={recoveryLoading ? 'animate-spin' : ''} />
                {recoveryLoading ? 'Requesting...' : 'Request recovery'}
              </button>
            ) : action.needsSweep ? (
              <button
                type="button"
                onClick={onSweepStale}
                disabled={sweepLoading}
                className="agent-ops-button-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={15} className={sweepLoading ? 'animate-spin' : ''} />
                {sweepLoading ? 'Sweeping...' : 'Sweep stale first'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}

function RunFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-silicon-slate/50 bg-black/10 p-3">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-sm text-foreground/90">{value}</p>
    </div>
  )
}

function RunDetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-foreground/90">{value}</p>
    </div>
  )
}

function runActionModel(run: RunRow) {
  const status = run.stale ? 'stale' : run.status
  if (status === 'failed') {
    return {
      primaryLabel: 'Review trace',
      why: run.error_message || 'The run ended in a failed state and needs an operator review before follow-up.',
      nextAction: 'Inspect the failure, then create a read-only recovery request if the trace is complete.',
      evidence: run.current_step || run.subject_label || 'Failure details are on the trace detail page.',
      canRecover: run.status === 'failed',
      needsSweep: false,
      toneClass: 'border-red-400/35 bg-red-500/10',
    }
  }
  if (status === 'stale') {
    const persistedStale = run.status === 'stale'
    return {
      primaryLabel: 'Review stale trace',
      why: run.stale_after
        ? `The run crossed its stale checkpoint at ${formatDate(run.stale_after)}.`
        : 'The run has stopped reporting progress and needs stale-run triage.',
      nextAction: persistedStale
        ? 'Create a read-only recovery request after confirming the original runtime is no longer active.'
        : 'Run the stale sweep first so the trace is persisted as stale before recovery is requested.',
      evidence: run.current_step || run.error_message || 'Latest step and events are on the trace detail page.',
      canRecover: persistedStale,
      needsSweep: !persistedStale,
      toneClass: 'border-red-400/35 bg-red-500/10',
    }
  }
  if (status === 'waiting_for_approval') {
    return {
      primaryLabel: 'Review approval',
      why: `${run.approvals.pending || 1} approval checkpoint(s) are waiting for a human decision.`,
      nextAction: 'Open the trace detail, review the recommendation and risk, then approve or decline there.',
      evidence: run.subject_label || run.current_step || 'Approval packet is attached to the trace detail page.',
      canRecover: false,
      needsSweep: false,
      toneClass: 'border-yellow-400/35 bg-yellow-500/10',
    }
  }
  if (status === 'running' || status === 'queued') {
    return {
      primaryLabel: status === 'queued' ? 'Open queued trace' : 'Open live trace',
      why: status === 'queued' ? 'The run is queued and has not produced terminal evidence yet.' : 'The run is still active and may still produce updates.',
      nextAction: 'Monitor the live trace. Use Sweep stale only if the runtime has crossed its stale checkpoint.',
      evidence: run.current_step || run.subject_label || 'Live events appear on the trace detail page.',
      canRecover: false,
      needsSweep: false,
      toneClass: 'border-sky-400/30 bg-sky-500/10',
    }
  }
  if (status === 'completed') {
    return {
      primaryLabel: 'View trace',
      why: 'The run completed and is available for audit, artifact review, or evaluation.',
      nextAction: 'Open the trace when you need evidence, cost, artifacts, or rubric evaluation.',
      evidence: run.completed_at ? `Completed ${formatDate(run.completed_at)}.` : 'Completion evidence is on the trace detail page.',
      canRecover: false,
      needsSweep: false,
      toneClass: '',
    }
  }
  return {
    primaryLabel: 'Open trace',
    why: `The run is currently ${status.replace(/_/g, ' ')}.`,
    nextAction: 'Open the trace detail for the next available action.',
    evidence: run.current_step || run.subject_label || 'Trace detail owns the evidence.',
    canRecover: ['cancelled'].includes(run.status),
    needsSweep: false,
    toneClass: '',
  }
}

function normalizeStatusFilter(status: string | null, active: string | null): (typeof STATUSES)[number] {
  if (active === 'true') return 'active'
  return STATUSES.includes(status as (typeof STATUSES)[number]) ? status as (typeof STATUSES)[number] : 'all'
}

function formatStatusOption(value: (typeof STATUSES)[number]) {
  if (value === 'all') return 'All statuses'
  if (value === 'active') return 'Active runs'
  if (value === 'needs_review') return 'Needs review'
  return value.replace(/_/g, ' ')
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'completed' ? 'bg-green-500/15 text-green-300 border-green-500/30'
      : status === 'failed' || status === 'stale' ? 'bg-red-500/15 text-red-300 border-red-500/30'
        : status === 'waiting_for_approval' ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
          : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
  return <span className={`rounded-full border px-2 py-1 text-xs ${cls}`}>{status}</span>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
