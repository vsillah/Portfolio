'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Bot, CheckCircle2, Clock3, DollarSign, FileText, Gauge, MessageSquare, RefreshCw, RotateCcw, ShieldAlert, XCircle } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import AgentAvatar from '@/components/admin/AgentAvatar'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'

type AnyRow = Record<string, unknown>

type RunDetail = {
  run: AnyRow
  steps: AnyRow[]
  events: AnyRow[]
  artifacts: AnyRow[]
  approvals: AnyRow[]
  handoffs: AnyRow[]
  costs: AnyRow[]
  evaluations: AnyRow[]
  cost_total: number
}

type ShakaContextReply = {
  run_id: string
  reply: string
  suggested_actions: string[]
}

type ShakaContextRef = {
  type: 'run' | 'approval'
  id: string
}

type RecoveryResult = {
  ok?: boolean
  error?: string
  run_id?: string
  recovery_run_id?: string
  source_run_id?: string
  retry_attempt?: number
  earliest_retry_at?: string
  target_agent_key?: string
  target_agent_name?: string
  recovery_packet_attached?: boolean
  execution_mode?: string
}

const RUBRIC_OPTIONS = [
  { key: 'chief-of-staff-synthesis-quality', label: 'Chief of Staff synthesis quality' },
  { key: 'warm-lead-capture-trace-completeness', label: 'Warm lead trace completeness' },
  { key: 'meeting-intake-follow-up-safety-isolation', label: 'Meeting intake safety isolation' },
  { key: 'inbox-follow-up-approval-readiness', label: 'Inbox follow-up approval readiness' },
  { key: 'research-source-register-source-quality', label: 'Research source quality' },
]

export default function AgentRunDetailPage({ params }: { params: { runId: string } }) {
  return (
    <ProtectedRoute requireAdmin>
      <AgentRunDetailContent runId={params.runId} />
    </ProtectedRoute>
  )
}

function AgentRunDetailContent({ runId }: { runId: string }) {
  const [data, setData] = useState<RunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rubricKey, setRubricKey] = useState(RUBRIC_OPTIONS[0].key)
  const [evaluating, setEvaluating] = useState(false)
  const [shakaLoading, setShakaLoading] = useState<string | null>(null)
  const [shakaReply, setShakaReply] = useState<ShakaContextReply | null>(null)
  const [shakaContextRef, setShakaContextRef] = useState<ShakaContextRef | null>(null)
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  const [recoveryResult, setRecoveryResult] = useState<RecoveryResult | null>(null)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch(`/api/admin/agents/runs/${runId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [runId])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  async function decideApproval(approvalId: string, status: 'approved' | 'rejected') {
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch(`/api/admin/agents/runs/${runId}/approval`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approval_id: approvalId,
          status,
          decision_notes: status === 'approved' ? 'Approved from Agent Operations' : 'Rejected from Agent Operations',
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      await fetchDetail()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update approval')
    }
  }

  async function evaluateRun() {
    setEvaluating(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch(`/api/admin/agents/runs/${runId}/evaluate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rubric_key: rubricKey }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      await fetchDetail()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to evaluate run')
    } finally {
      setEvaluating(false)
    }
  }

  async function askShaka(contextRef: ShakaContextRef, message: string) {
    setShakaLoading(`${contextRef.type}:${contextRef.id}`)
    setShakaReply(null)
    setShakaContextRef(contextRef)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch('/api/admin/agents/chief-of-staff/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          context_ref: contextRef,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setShakaReply(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Shaka context request failed')
    } finally {
      setShakaLoading(null)
    }
  }

  async function requestRecovery() {
    setRecoveryLoading(true)
    setRecoveryResult(null)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch(`/api/admin/agents/runs/${runId}/retry`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          note: 'Requested from Run Console stale resolution card.',
        }),
      })
      const body = await res.json().catch(() => ({})) as RecoveryResult
      if (!res.ok && !body.recovery_run_id) {
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      setRecoveryResult(body)
      if (res.ok) {
        await fetchDetail()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create recovery request')
    } finally {
      setRecoveryLoading(false)
    }
  }

  return (
    <div className="agent-ops-page min-h-screen p-5 text-foreground lg:p-7">
      <div className="mx-auto max-w-7xl">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Agent Operations', href: '/admin/agents' },
          { label: 'Runs', href: '/admin/agents/runs' },
          { label: 'Run Detail' },
        ]} />
        <Link href="/admin/agents/runs" className="mb-5 mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} />
          Back to runs
        </Link>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading run detail...</div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-5 text-red-300">
            <div className="flex items-center gap-2 font-medium"><AlertTriangle size={18} /> Failed to load run</div>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : data ? (
          <>
            <header className="agent-ops-surface-header mb-6 flex flex-col gap-4 rounded-xl border p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 gap-3">
                {asString(data.run.agent_key) ? <AgentAvatar agentKey={asString(data.run.agent_key)} size="lg" /> : null}
                <div className="min-w-0">
                  <div className="agent-ops-eyebrow mb-2">
                    <Bot size={16} />
                    Run Console detail
                  </div>
                  <h1 className="text-3xl font-bold mb-1">{String(data.run.title ?? 'Agent run')}</h1>
                  <p className="text-sm text-muted-foreground">{String(data.run.kind ?? 'run')} · {String(data.run.id)}</p>
                  {asString(data.run.agent_key) ? (
                    <p className="mt-1 text-xs text-muted-foreground">Owner: {String(data.run.agent_key).replace(/-/g, ' ')}</p>
                  ) : null}
                </div>
              </div>
              <div className="agent-ops-header-actions">
                <select
                  value={rubricKey}
                  onChange={(event) => setRubricKey(event.target.value)}
                  className="h-10 rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 text-sm outline-none focus:border-radiant-gold/60"
                >
                  {RUBRIC_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => askShaka(
                    { type: 'run', id: runId },
                    'Summarize this run trace. What failed or needs action, what evidence matters, and what is the safest next step?',
                  )}
                  disabled={Boolean(shakaLoading)}
                  aria-label="Ask Shaka about this run"
                  className="agent-ops-button-secondary disabled:opacity-60"
                >
                  <MessageSquare size={16} />
                  {shakaLoading === `run:${runId}` ? 'Asking...' : 'Ask Shaka'}
                </button>
                <button
                  onClick={evaluateRun}
                  disabled={evaluating}
                  className="agent-ops-button-secondary disabled:opacity-60"
                >
                  <Gauge size={16} />
                  {evaluating ? 'Evaluating...' : 'Evaluate'}
                </button>
                <button
                  onClick={fetchDetail}
                  className="agent-ops-button-muted"
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>
            </header>

            {shakaReply ? (
              <ShakaContextResponse
                reply={shakaReply}
                disabled={Boolean(shakaLoading)}
                onSuggestedAction={(action) => askShaka(shakaContextRef ?? { type: 'run', id: runId }, action)}
              />
            ) : null}

            {isRecoverableRunStatus(data.run.status) ? (
              <RunRecoveryPanel
                run={data.run}
                result={recoveryResult}
                loading={recoveryLoading}
                onRequestRecovery={requestRecovery}
                onRefresh={fetchDetail}
                onAskShaka={() => askShaka(
                  { type: 'run', id: runId },
                  'This run needs recovery. Explain why it is stale or blocked, what evidence proves the issue, who should own it, and the safest next action before any retry.',
                )}
                shakaLoading={shakaLoading === `run:${runId}`}
              />
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Metric icon={<Bot size={18} />} label="Runtime" value={String(data.run.runtime ?? '-')} />
              <Metric icon={<RefreshCw size={18} />} label="Status" value={String(data.run.status ?? '-')} />
              <Metric icon={<DollarSign size={18} />} label="Cost" value={`$${data.cost_total.toFixed(4)}`} />
              <Metric icon={<FileText size={18} />} label="Artifacts" value={String(data.artifacts.length)} />
            </div>

            <section className="agent-ops-card rounded-lg border p-5 mb-6">
              <h2 className="text-lg font-semibold mb-4">Evaluations</h2>
              <EvaluationList
                rows={data.evaluations}
                disabled={Boolean(shakaLoading)}
                onCoach={(row) => askShaka(
                  { type: 'run', id: runId },
                  evaluationCoachingPrompt(row),
                )}
              />
            </section>

            <section className="agent-ops-card rounded-lg border p-5 mb-6">
              <h2 className="text-lg font-semibold mb-4">Steps</h2>
              <Timeline rows={data.steps} timeKey="started_at" titleKey="name" detailKey="output_summary" fallback="No steps recorded yet." />
            </section>

            <section className="agent-ops-card rounded-lg border p-5 mb-6">
              <h2 className="text-lg font-semibold mb-4">Events</h2>
              <Timeline rows={data.events} timeKey="occurred_at" titleKey="event_type" detailKey="message" fallback="No events recorded yet." />
            </section>

            <section className="agent-ops-card rounded-lg border p-5 mb-6">
              <h2 className="text-lg font-semibold mb-4">Approval Decision</h2>
              <ApprovalDecisionList
                rows={data.approvals}
                onDecision={decideApproval}
                onAskShaka={(approvalId) => askShaka(
                  { type: 'approval', id: approvalId },
                  'Should I approve, reject, run another test, or close this approval? Summarize the experiment, objective, goal, current run, distance from goal, evidence, risk, and safest next action.',
                )}
                shakaLoading={shakaLoading}
              />
            </section>

            <section className="agent-ops-card rounded-lg border p-5">
              <h2 className="text-lg font-semibold mb-4">Artifacts</h2>
              <List rows={data.artifacts} titleKey="title" fallbackTitle="Artifact" detailKey="artifact_type" empty="No artifacts attached." />
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-black/10 p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">
        {icon}
        {label}
      </div>
      <p className="font-semibold">{value}</p>
    </div>
  )
}

function RunRecoveryPanel({
  run,
  result,
  loading,
  shakaLoading,
  onRequestRecovery,
  onRefresh,
  onAskShaka,
}: {
  run: AnyRow
  result: RecoveryResult | null
  loading: boolean
  shakaLoading?: boolean
  onRequestRecovery: () => void
  onRefresh: () => void
  onAskShaka: () => void
}) {
  const status = formatLabel(run.status, 'unknown')
  const reason = runRecoveryReason(run)
  const latestEvidence = runRecoveryEvidence(run)
  const recoveryId = result?.run_id ?? result?.recovery_run_id
  const isBackoff = Boolean(result?.recovery_run_id && result?.ok === false)

  return (
    <section className="agent-ops-card mb-6 rounded-lg border border-red-400/35 bg-red-500/10 p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="agent-ops-eyebrow text-red-200">
            <ShieldAlert size={16} />
            {status === 'stale' ? 'Stale run resolution' : 'Run recovery'}
          </div>
          <h2 className="mt-2 text-xl font-semibold">Operator action required</h2>
          <p className="mt-2 max-w-4xl text-sm text-muted-foreground">
            This run stopped before a successful terminal state. Use the recovery request to create a tracked follow-up; refresh only reloads the trace and will not resolve the stale status.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onRequestRecovery}
            disabled={loading}
            className="agent-ops-button-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw size={16} />
            {loading ? 'Creating...' : 'Create recovery request'}
          </button>
          <button
            type="button"
            onClick={onAskShaka}
            disabled={shakaLoading}
            className="agent-ops-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MessageSquare size={16} />
            {shakaLoading ? 'Asking...' : 'Ask Shaka for triage'}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="agent-ops-button-muted"
          >
            <RefreshCw size={16} />
            Refresh trace
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <RecoveryBlock
          title="Why it is stale"
          value={reason}
        />
        <RecoveryBlock
          title="Recommended resolution"
          value="Create the recovery request. It opens a separate Run Console item with the recovery packet so the operator can inspect, assign, and close it without mutating production automation directly."
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <RecoveryBlock
          title="What refresh does"
          value="Reloads current trace data only. Use it after another agent or poller reports progress; it is not the stale-run remedy."
        />
        <RecoveryBlock title="Latest evidence" value={latestEvidence} />
        <RecoveryBlock
          title="Operator sequence"
          value="Confirm the last heartbeat or error, ask Shaka if ownership is unclear, then queue recovery once the original runtime is no longer active."
        />
      </div>

      {result ? (
        <div className={`mt-4 rounded-lg border p-4 ${isBackoff ? 'border-yellow-400/40 bg-yellow-500/10' : 'border-emerald-400/40 bg-emerald-500/10'}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-semibold">{isBackoff ? 'Recovery request already queued' : 'Recovery request queued'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.error ?? 'A read-only recovery packet is now available in Run Console.'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {result.retry_attempt ? <span>Attempt {result.retry_attempt}</span> : null}
                {result.earliest_retry_at ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock3 size={12} />
                    Earliest retry {formatDate(result.earliest_retry_at)}
                  </span>
                ) : null}
                {result.execution_mode ? <span>{formatLabel(result.execution_mode)}</span> : null}
              </div>
            </div>
            {recoveryId ? (
              <Link
                href={`/admin/agents/runs/${recoveryId}`}
                className="agent-ops-button-secondary shrink-0"
              >
                Open recovery request
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function RecoveryBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-black/15 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-2 text-sm text-foreground/90">{value}</p>
    </div>
  )
}

function ShakaContextResponse({
  reply,
  disabled,
  onSuggestedAction,
}: {
  reply: ShakaContextReply
  disabled?: boolean
  onSuggestedAction: (action: string) => void
}) {
  return (
    <section className="mb-6 rounded-lg border border-radiant-gold/35 bg-radiant-gold/10 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-radiant-gold">
            <MessageSquare size={18} />
            <h2 className="font-semibold">Shaka context answer</h2>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{reply.reply}</p>
        </div>
        <Link
          href={`/admin/agents/runs/${reply.run_id}`}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-radiant-gold/50 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15"
        >
          Open Shaka trace
        </Link>
      </div>
      {reply.suggested_actions.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {reply.suggested_actions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onSuggestedAction(action)}
              disabled={disabled}
              aria-label={`Ask Shaka follow-up: ${action}`}
              className="rounded-full border border-radiant-gold/30 bg-background/40 px-2.5 py-1 text-xs text-radiant-gold hover:bg-radiant-gold/15 focus:outline-none focus:ring-2 focus:ring-radiant-gold/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {action}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function Timeline({ rows, timeKey, titleKey, detailKey, fallback }: { rows: AnyRow[]; timeKey: string; titleKey: string; detailKey: string; fallback: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{fallback}</p>
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={String(row.id)} className="rounded-lg border border-silicon-slate/50 bg-background/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">{String(row[titleKey] ?? '-')}</p>
            <p className="text-xs text-muted-foreground">{formatDate(asString(row[timeKey]))}</p>
          </div>
          {row[detailKey] ? <p className="text-sm text-muted-foreground mt-1">{String(row[detailKey])}</p> : null}
          {row.status ? <p className="text-xs text-muted-foreground mt-1">Status: {String(row.status)}</p> : null}
        </div>
      ))}
    </div>
  )
}

function EvaluationList({
  rows,
  disabled,
  onCoach,
}: {
  rows: AnyRow[]
  disabled?: boolean
  onCoach: (row: AnyRow) => void
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No rubric evaluations recorded yet.</p>
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {rows.map((row) => {
        const score = typeof row.score === 'number' ? row.score : Number(row.score ?? 0)
        const passed = row.passed === true
        const reasons = Array.isArray(row.failure_reasons)
          ? row.failure_reasons.filter((reason): reason is string => typeof reason === 'string')
          : []
        const dimensions = row.dimension_scores && typeof row.dimension_scores === 'object'
          ? Object.entries(row.dimension_scores as Record<string, unknown>)
          : []

        return (
          <div key={String(row.id)} className="rounded-lg border border-silicon-slate/50 bg-background/40 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{String(row.rubric_key ?? 'rubric')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{String(row.summary ?? row.judge_model ?? '')}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${passed ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200' : 'border-yellow-400/40 bg-yellow-500/10 text-yellow-100'}`}>
                {Number.isFinite(score) ? score.toFixed(1) : '-'} {passed ? 'pass' : 'review'}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <AgentAvatar agentKey={asString(row.agent_key)} size="sm" />
              <span>{String(row.agent_key ?? '-').replace(/-/g, ' ')}</span>
              <span>{String(row.judge_model ?? '-')}</span>
              <span>{formatDate(asString(row.created_at))}</span>
            </div>
            {dimensions.length ? (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                {dimensions.slice(0, 6).map(([key, value]) => (
                  <div key={key} className="rounded-md border border-silicon-slate/50 bg-black/10 px-2 py-1">
                    {key.replace(/_/g, ' ')}: <span className="text-foreground/80">{Number(value).toFixed(1)}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {reasons.length ? (
              <div className="mt-3 space-y-1">
                {reasons.slice(0, 3).map((reason) => (
                  <p key={reason} className="text-xs text-yellow-100">{reason}</p>
                ))}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onCoach(row)}
                disabled={disabled}
                aria-label={`Ask Shaka for coaching on evaluation ${String(row.rubric_key ?? 'rubric')}`}
                className="inline-flex items-center gap-2 rounded-md border border-radiant-gold/40 bg-radiant-gold/10 px-3 py-1.5 text-xs font-medium text-radiant-gold hover:bg-radiant-gold/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MessageSquare size={13} />
                Coach this evaluation
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ApprovalDecisionList({
  rows,
  onDecision,
  onAskShaka,
  shakaLoading,
}: {
  rows: AnyRow[]
  onDecision: (approvalId: string, status: 'approved' | 'rejected') => void
  onAskShaka: (approvalId: string) => void
  shakaLoading?: string | null
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No approvals recorded.</p>
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const id = typeof row.id === 'string' ? row.id : String(row.id)
        const summary = approvalExecutiveSummary(row)
        const pending = row.status === 'pending'
        const expanded = expandedId === id

        return (
          <article key={id} className="rounded-lg border border-silicon-slate/60 bg-background/45 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">{summary.title}</h3>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${pending ? 'border-yellow-400/40 bg-yellow-500/10 text-yellow-100' : 'border-silicon-slate/60 bg-silicon-slate/30 text-muted-foreground'}`}>
                    {String(row.status ?? 'unknown').replace(/_/g, ' ')}
                  </span>
                  <span className="rounded-full border border-silicon-slate/60 bg-black/10 px-2 py-0.5 text-xs text-muted-foreground">
                    Risk: {summary.risk}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{summary.actionRequired}</p>
              </div>
              {pending ? (
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onDecision(id, 'approved')}
                    className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20"
                  >
                    <CheckCircle2 size={15} />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => onDecision(id, 'rejected')}
                    className="inline-flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 hover:bg-red-500/20"
                  >
                    <XCircle size={15} />
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={() => onAskShaka(id)}
                    disabled={shakaLoading === `approval:${id}`}
                    aria-label={`Ask Shaka about approval ${id}`}
                    className="inline-flex items-center gap-2 rounded-md border border-radiant-gold/40 bg-radiant-gold/10 px-3 py-2 text-sm font-medium text-radiant-gold hover:bg-radiant-gold/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <MessageSquare size={15} />
                    {shakaLoading === `approval:${id}` ? 'Asking...' : 'Ask Shaka'}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <DecisionBlock label="Experiment" value={summary.experiment} />
              <DecisionBlock label="Objective" value={summary.problem} />
              {summary.goal ? <DecisionBlock label="Goal" value={summary.goal} /> : null}
              {summary.currentRun ? <DecisionBlock label="Current run" value={summary.currentRun} /> : null}
              {summary.distanceFromGoal ? <DecisionBlock label="Distance from goal" value={summary.distanceFromGoal} emphasis={summary.goalStatus === 'watch' || summary.goalStatus === 'blocked'} /> : null}
              <DecisionBlock label="Drawbacks" value={summary.drawbacks} />
              <DecisionBlock label="Recommended next action" value={summary.benefits} emphasis />
            </div>

            {summary.evidence.length ? (
              <div className="mt-4 rounded-md border border-silicon-slate/50 bg-black/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Evidence</p>
                <ul className="mt-2 space-y-1 text-sm text-foreground/85">
                  {summary.evidence.slice(0, 4).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : id)}
                className="text-sm text-radiant-gold hover:underline"
              >
                {expanded ? 'Hide decision packet' : 'Show decision packet'}
              </button>
              {row.url ? <a className="text-sm text-radiant-gold hover:underline" href={String(row.url)}>Open source</a> : null}
            </div>

            {expanded && rowSummary(row) ? (
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-black/20 p-3 text-xs text-muted-foreground">
                {rowSummary(row)}
              </pre>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}

function DecisionBlock({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${emphasis ? 'border-radiant-gold/30 bg-radiant-gold/10' : 'border-silicon-slate/50 bg-black/10'}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground/90">{value}</p>
    </div>
  )
}

function List({
  rows,
  titleKey,
  fallbackTitle,
  detailKey,
  empty,
  onDecision,
  onAskShaka,
  shakaLoading,
}: {
  rows: AnyRow[]
  titleKey: string
  fallbackTitle: string
  detailKey: string
  empty: string
  onDecision?: (approvalId: string, status: 'approved' | 'rejected') => void
  onAskShaka?: (approvalId: string) => void
  shakaLoading?: string | null
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={String(row.id)} className="rounded-lg border border-silicon-slate/50 bg-background/40 p-3">
          <p className="font-medium">{String(row[titleKey] || fallbackTitle)}</p>
          <p className="text-sm text-muted-foreground">{String(row[detailKey] ?? '')}</p>
          {rowSummary(row) ? (
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-black/20 p-3 text-xs text-muted-foreground">
              {rowSummary(row)}
            </pre>
          ) : null}
          {onDecision && row.status === 'pending' && typeof row.id === 'string' ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => onDecision(row.id as string, 'approved')}
                className="rounded-md border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs text-green-300 hover:bg-green-500/20"
              >
                Approve
              </button>
              <button
                onClick={() => onDecision(row.id as string, 'rejected')}
                className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs text-red-300 hover:bg-red-500/20"
              >
                Reject
              </button>
              {onAskShaka ? (
                <button
                  onClick={() => onAskShaka(row.id as string)}
                  disabled={shakaLoading === `approval:${String(row.id)}`}
                  aria-label={`Ask Shaka about approval ${String(row.id)}`}
                  className="inline-flex items-center gap-1 rounded-md border border-radiant-gold/40 bg-radiant-gold/10 px-3 py-1 text-xs text-radiant-gold hover:bg-radiant-gold/20 disabled:opacity-60"
                >
                  <MessageSquare size={13} />
                  {shakaLoading === `approval:${String(row.id)}` ? 'Asking...' : 'Ask Shaka'}
                </button>
              ) : null}
            </div>
          ) : null}
          {row.url ? <a className="text-sm text-radiant-gold hover:underline" href={String(row.url)}>Open</a> : null}
        </div>
      ))}
    </div>
  )
}

function formatDate(value?: string) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function isRecoverableRunStatus(value: unknown): boolean {
  return ['failed', 'stale', 'cancelled'].includes(String(value ?? '').toLowerCase())
}

function runRecoveryReason(run: AnyRow): string {
  const errorMessage = asString(run.error_message)
  if (errorMessage) {
    return `Latest error: ${errorMessage}`
  }

  const currentStep = asString(run.current_step)
  const staleAfter = asString(run.stale_after)
  if (staleAfter) {
    return `The stale-after checkpoint passed at ${formatDate(staleAfter)} before the run reached a successful terminal state${currentStep ? `; latest step: ${currentStep}.` : '.'}`
  }

  const updatedAt = asString(run.updated_at)
  if (updatedAt) {
    return `The run is marked ${formatLabel(run.status, 'needs recovery')} and has not reported progress since ${formatDate(updatedAt)}${currentStep ? `; latest step: ${currentStep}.` : '.'}`
  }

  if (currentStep) {
    return `The run is marked ${formatLabel(run.status, 'needs recovery')} while stopped at ${currentStep}.`
  }

  return `The run is marked ${formatLabel(run.status, 'needs recovery')} and no completion evidence is attached to this trace.`
}

function runRecoveryEvidence(run: AnyRow): string {
  const currentStep = asString(run.current_step)
  const updatedAt = asString(run.updated_at)
  const staleAfter = asString(run.stale_after)
  const errorMessage = asString(run.error_message)

  if (errorMessage && updatedAt) {
    return `Last reported ${formatDate(updatedAt)} with error evidence attached.`
  }

  if (staleAfter && updatedAt) {
    return `Last progress ${formatDate(updatedAt)}; stale checkpoint ${formatDate(staleAfter)}.`
  }

  if (currentStep && updatedAt) {
    return `Last progress ${formatDate(updatedAt)} at ${currentStep}.`
  }

  if (updatedAt) {
    return `Last progress reported ${formatDate(updatedAt)}.`
  }

  return 'No recent heartbeat, completion event, or terminal artifact is attached to this trace.'
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

function formatLabel(value: unknown, fallback = '-'): string {
  if (typeof value !== 'string' || value.length === 0) return fallback
  return value.replace(/_/g, ' ')
}

function evaluationCoachingPrompt(row: AnyRow): string {
  const dimensions = row.dimension_scores && typeof row.dimension_scores === 'object'
    ? Object.entries(row.dimension_scores as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${Number(value).toFixed(1)}`)
      .join(', ')
    : 'No dimension scores recorded.'
  const reasons = asStringArray(row.failure_reasons).join('; ') || 'No failure reasons recorded.'

  return [
    `Coach this evaluation: ${String(row.rubric_key ?? 'rubric')}.`,
    `Score: ${String(row.score ?? '-')}. Passed: ${row.passed === true ? 'yes' : 'no'}.`,
    `Summary: ${String(row.summary ?? '-')}.`,
    `Dimensions: ${dimensions}.`,
    `Failure reasons: ${reasons}.`,
    'Explain what needs to improve, which agent or workflow should handle it, and the safest next action.',
  ].join('\n')
}

function approvalExecutiveSummary(row: AnyRow) {
  const metadata = asRecord(row.metadata)
  const proposal = asRecord(metadata.proposal)
  const actionPayload = asRecord(metadata.action_payload)
  const evidence = asStringArray(proposal.evidence)
  const touchedSettings = asStringArray(proposal.touchedSettings)
  const touchedFiles = asStringArray(proposal.touchedFiles)
  const decisionFrame = asRecord(proposal.decisionFrame)
  const approvalQuestion = typeof metadata.approval_question === 'string' ? metadata.approval_question : null
  const executesAction = actionPayload.executes_action === true
  const risk = String(proposal.riskLevel ?? metadata.risk_level ?? metadata.risk ?? actionPayload.risk_level ?? 'not specified')
  const title = String(proposal.title ?? row.approval_type ?? 'Approval checkpoint')
  const action = formatLabel(actionPayload.action, formatLabel(row.approval_type, 'approval checkpoint'))

  const experiment = String(decisionFrame.experiment ?? proposal.title ?? title)
  const objective = String(
    decisionFrame.objective
      ?? proposal.hypothesis
      ?? approvalQuestion
      ?? metadata.problem_statement
      ?? `A human decision is required before ${action}.`,
  )
  const benefits = String(
    decisionFrame.recommendation
      ?? proposal.expectedImpact
      ?? metadata.benefits
      ?? 'Approving lets the agent proceed through the existing gated workflow with a recorded decision.',
  )
  const drawbacksParts = [
    risk !== 'not specified' ? `Risk level is ${risk}.` : null,
    touchedSettings.length ? `Touches settings: ${touchedSettings.join(', ')}.` : null,
    touchedFiles.length ? `Touches files: ${touchedFiles.slice(0, 4).join(', ')}.` : null,
    executesAction ? 'This approval can authorize a follow-up action.' : 'This checkpoint does not execute the action by itself.',
  ].filter((part): part is string => Boolean(part))
  const recommendation = String(
    metadata.recommendation
      ?? proposal.approvalQuestion
      ?? approvalQuestion
      ?? (executesAction
        ? 'Approve only after the evidence and risk boundary are clear; decline if the trace is incomplete.'
        : 'Approve if the proposal should move to the next scoped step; decline if the evidence is incomplete or the risk boundary is unclear.'),
  )

  return {
    title,
    actionRequired: `Action required: ${action}.`,
    problem: objective,
    benefits,
    drawbacks: drawbacksParts.join(' '),
    recommendation,
    risk,
    evidence,
    experiment,
    goal: typeof decisionFrame.target === 'string' ? decisionFrame.target : null,
    currentRun: typeof decisionFrame.currentRun === 'string' ? decisionFrame.currentRun : null,
    distanceFromGoal: typeof decisionFrame.distanceFromGoal === 'string' ? decisionFrame.distanceFromGoal : null,
    goalStatus: typeof decisionFrame.goalStatus === 'string' ? decisionFrame.goalStatus : null,
  }
}

function rowSummary(row: AnyRow): string | null {
  const metadata = row.metadata
  if (!metadata || typeof metadata !== 'object') return null
  const record = metadata as Record<string, unknown>
  const summary = record.summary_markdown
  if (typeof summary === 'string') return summary

  const payload = record.action_payload
  if (payload && typeof payload === 'object') {
    const actionPayload = payload as Record<string, unknown>
    return [
      `Action: ${String(actionPayload.action ?? '-').replace(/_/g, ' ')}`,
      `Approval type: ${String(actionPayload.approval_type ?? '-').replace(/_/g, ' ')}`,
      `Risk: ${String(actionPayload.risk_level ?? '-')}`,
      `Executes action now: ${actionPayload.executes_action ? 'yes' : 'no'}`,
      `Boundary: ${String(actionPayload.side_effect_boundary ?? 'No side effect is executed by this checkpoint.')}`,
    ].join('\n')
  }
  return null
}
