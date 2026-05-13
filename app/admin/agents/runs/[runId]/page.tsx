'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Bot, DollarSign, FileText, Gauge, MessageSquare, RefreshCw } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
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

  async function askShaka(contextRef: { type: 'run' | 'approval'; id: string }, message: string) {
    setShakaLoading(`${contextRef.type}:${contextRef.id}`)
    setShakaReply(null)
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

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Agent Operations', href: '/admin/agents' },
          { label: 'Runs', href: '/admin/agents/runs' },
          { label: 'Run Detail' },
        ]} />
        <Link href="/admin/agents/runs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5">
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
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold mb-1">{String(data.run.title ?? 'Agent run')}</h1>
                <p className="text-sm text-muted-foreground">{String(data.run.kind ?? 'run')} · {String(data.run.id)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                  className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-60"
                >
                  <MessageSquare size={16} />
                  {shakaLoading === `run:${runId}` ? 'Asking...' : 'Ask Shaka'}
                </button>
                <button
                  onClick={evaluateRun}
                  disabled={evaluating}
                  className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-60"
                >
                  <Gauge size={16} />
                  {evaluating ? 'Evaluating...' : 'Evaluate'}
                </button>
                <button
                  onClick={fetchDetail}
                  className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 py-2 text-sm hover:border-radiant-gold/60"
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>
            </div>

            {shakaReply ? <ShakaContextResponse reply={shakaReply} /> : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Metric icon={<Bot size={18} />} label="Runtime" value={String(data.run.runtime ?? '-')} />
              <Metric icon={<RefreshCw size={18} />} label="Status" value={String(data.run.status ?? '-')} />
              <Metric icon={<DollarSign size={18} />} label="Cost" value={`$${data.cost_total.toFixed(4)}`} />
              <Metric icon={<FileText size={18} />} label="Artifacts" value={String(data.artifacts.length)} />
            </div>

            <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5 mb-6">
              <h2 className="text-lg font-semibold mb-4">Evaluations</h2>
              <EvaluationList rows={data.evaluations} />
            </section>

            <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5 mb-6">
              <h2 className="text-lg font-semibold mb-4">Steps</h2>
              <Timeline rows={data.steps} timeKey="started_at" titleKey="name" detailKey="output_summary" fallback="No steps recorded yet." />
            </section>

            <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5 mb-6">
              <h2 className="text-lg font-semibold mb-4">Events</h2>
              <Timeline rows={data.events} timeKey="occurred_at" titleKey="event_type" detailKey="message" fallback="No events recorded yet." />
            </section>

            <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
              <h2 className="text-lg font-semibold mb-4">Artifacts & Approvals</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <List rows={data.artifacts} titleKey="title" fallbackTitle="Artifact" detailKey="artifact_type" empty="No artifacts attached." />
                <List
                  rows={data.approvals}
                  titleKey="approval_type"
                  fallbackTitle="Approval"
                  detailKey="status"
                  empty="No approvals recorded."
                  onDecision={decideApproval}
                  onAskShaka={(approvalId) => askShaka(
                    { type: 'approval', id: approvalId },
                    'Should I approve or reject this approval? Summarize the action required, risk, evidence, and safest next step.',
                  )}
                  shakaLoading={shakaLoading}
                />
              </div>
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

function ShakaContextResponse({ reply }: { reply: ShakaContextReply }) {
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
            <span key={action} className="rounded-full border border-radiant-gold/30 bg-background/40 px-2.5 py-1 text-xs text-radiant-gold">
              {action}
            </span>
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

function EvaluationList({ rows }: { rows: AnyRow[] }) {
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
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
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
          </div>
        )
      })}
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
