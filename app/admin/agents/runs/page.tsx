'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, Bot, RefreshCw } from 'lucide-react'
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
  started_at: string
  completed_at: string | null
  error_message: string | null
  stale: boolean
  cost_total: number
  approvals: { pending: number; approved: number; rejected: number }
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

        <div className="mb-5 flex gap-3 flex-wrap">
          <select
            value={runtime}
            onChange={(e) => setRuntime(e.target.value as (typeof RUNTIMES)[number])}
            className="rounded-lg border border-silicon-slate/70 bg-background px-3 py-2 text-sm"
          >
            {RUNTIMES.map((value) => (
              <option key={value} value={value}>{value === 'all' ? 'All runtimes' : value}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
            className="rounded-lg border border-silicon-slate/70 bg-background px-3 py-2 text-sm"
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>{formatStatusOption(value)}</option>
            ))}
          </select>
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
          <div className="agent-ops-card overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-silicon-slate/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Run</th>
                  <th className="text-left px-4 py-3 font-medium">Runtime</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Current step</th>
                  <th className="text-left px-4 py-3 font-medium">Subject</th>
                  <th className="text-right px-4 py-3 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-silicon-slate/60">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-silicon-slate/20">
                    <td className="px-4 py-3">
                      <Link href={`/admin/agents/runs/${run.id}`} className="font-medium hover:text-radiant-gold">
                        {run.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">{formatDate(run.started_at)} · {run.agent_key || run.kind}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-1 text-xs">
                        <Bot size={12} />
                        {run.runtime}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={run.stale ? 'stale' : run.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{run.current_step || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{run.subject_label || run.subject_id || '-'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">${run.cost_total.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
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
