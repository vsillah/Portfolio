'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
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
const STATUSES = ['all', 'queued', 'running', 'waiting_for_approval', 'completed', 'failed', 'cancelled', 'stale'] as const

export default function AgentRunsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AgentRunsContent />
    </ProtectedRoute>
  )
}

function AgentRunsContent() {
  const [runs, setRuns] = useState<RunRow[]>([])
  const [runtime, setRuntime] = useState<(typeof RUNTIMES)[number]>('all')
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sweepLoading, setSweepLoading] = useState(false)
  const [sweepMessage, setSweepMessage] = useState<string | null>(null)

  const fetchRuns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const qs = new URLSearchParams({ limit: '75' })
      if (runtime !== 'all') qs.set('runtime', runtime)
      if (status !== 'all') qs.set('status', status)
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
  }, [runtime, status])

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

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
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Agent Operations', href: '/admin/agents' },
          { label: 'Runs' },
        ]} />

        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold mb-1">Agent Runs</h1>
            <p className="text-muted-foreground text-sm">Live and historical traces across supported runtimes.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={sweepStaleRuns}
              disabled={sweepLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 py-2 text-sm hover:border-radiant-gold/60 disabled:opacity-60"
            >
              <RefreshCw size={16} className={sweepLoading ? 'animate-spin' : ''} />
              Sweep stale
            </button>
            <button
              onClick={fetchRuns}
              className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 py-2 text-sm hover:border-radiant-gold/60"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

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
              <option key={value} value={value}>{value === 'all' ? 'All statuses' : value}</option>
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
          <div className="rounded-lg border border-silicon-slate/60 bg-silicon-slate/20 p-8 text-center text-muted-foreground">
            No agent runs match the current filters.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-silicon-slate/70">
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
