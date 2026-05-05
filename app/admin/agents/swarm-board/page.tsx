'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Columns,
  LockKeyhole,
  RefreshCw,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import type {
  AgentSwarmBoardSnapshot,
  SwarmBoardCard,
  SwarmBoardColumnKey,
} from '@/lib/agent-swarm-board'

type Filter = 'all' | 'attention' | 'approval' | 'autonomous'

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'approval', label: 'Waiting approval' },
  { key: 'autonomous', label: 'Autonomous-ready' },
]

const COLUMN_TONES: Record<SwarmBoardColumnKey, string> = {
  intake: 'border-silicon-slate/70',
  discovery: 'border-blue-500/30',
  decision_packet: 'border-teal-500/30',
  provisioning_plan: 'border-amber-500/30',
  build_configure: 'border-purple-500/30',
  qa_isolation: 'border-cyan-500/30',
  waiting_approval: 'border-yellow-500/40',
  active_monitoring: 'border-green-500/35',
  blocked_escalated: 'border-red-500/40',
  done_archived: 'border-silicon-slate/70',
}

export default function AgentSwarmBoardPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AgentSwarmBoardContent />
    </ProtectedRoute>
  )
}

function AgentSwarmBoardContent() {
  const [snapshot, setSnapshot] = useState<AgentSwarmBoardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  const fetchBoard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch('/api/admin/agents/swarm-board', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setSnapshot(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load client swarm board')
      setSnapshot(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBoard()
  }, [fetchBoard])

  const filteredColumns = useMemo(() => {
    if (!snapshot) return []
    return snapshot.columns.map((column) => ({
      ...column,
      cards: column.cards.filter((card) => cardMatchesFilter(card, filter)),
    }))
  }, [filter, snapshot])

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Agent Operations', href: '/admin/agents' },
          { label: 'Swarm Board' },
        ]} />

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 text-sm text-radiant-gold">
              <Columns size={16} />
              ATAS AI Agent Org
            </div>
            <h1 className="text-3xl font-bold">Client Swarm Board</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Cross-client board for policy-bounded handoffs, swarm health, approval gates, and provisioning readiness.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/agents"
              className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 py-2 text-sm hover:border-radiant-gold/60"
            >
              <Bot size={16} />
              Mission Control
            </Link>
            <button
              onClick={fetchBoard}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading client swarm board...</div>
        ) : error ? (
          <FailureState message={error} />
        ) : snapshot ? (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <MetricCard label="Clients" value={snapshot.summary.clients} />
              <MetricCard label="Active" value={snapshot.summary.active} />
              <MetricCard label="Failed/stale" value={snapshot.summary.failed_or_stale} tone={snapshot.summary.failed_or_stale ? 'red' : 'slate'} />
              <MetricCard label="Approvals" value={snapshot.summary.pending_approvals} tone={snapshot.summary.pending_approvals ? 'yellow' : 'slate'} />
              <MetricCard label="Isolation failures" value={snapshot.summary.isolation_failures} tone={snapshot.summary.isolation_failures ? 'red' : 'slate'} />
              <MetricCard label="Autonomous-ready" value={snapshot.summary.autonomous_ready} tone="green" />
            </div>

            <section className="mb-6 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="font-semibold">Handoff Boundary</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Read-only, planning, QA, and reporting handoffs can move autonomously. Provider writes, credentials, sends, publishing, production config, and client-data mutation wait for approval.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {FILTERS.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setFilter(item.key)}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        filter === item.key
                          ? 'border-radiant-gold/60 bg-radiant-gold/15 text-radiant-gold'
                          : 'border-silicon-slate/70 bg-silicon-slate/20 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {filteredColumns.map((column) => (
                <section
                  key={column.key}
                  className={`rounded-lg border bg-silicon-slate/15 p-4 ${COLUMN_TONES[column.key]}`}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{column.label}</h2>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{column.description}</p>
                    </div>
                    <span className="rounded-full border border-silicon-slate/70 px-2 py-1 text-xs text-muted-foreground">
                      {column.cards.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {column.cards.length ? (
                      column.cards.map((card) => <SwarmCard key={card.id} card={card} />)
                    ) : (
                      <p className="rounded-lg border border-dashed border-silicon-slate/60 px-3 py-6 text-center text-sm text-muted-foreground">
                        No client swarms in this column.
                      </p>
                    )}
                  </div>
                </section>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function cardMatchesFilter(card: SwarmBoardCard, filter: Filter) {
  if (filter === 'attention') return card.moduleHealth === 'red' || card.failedOrStaleRuns > 0
  if (filter === 'approval') return card.approvalState !== 'none'
  if (filter === 'autonomous') return card.approvalState === 'none' && card.moduleHealth !== 'red'
  return true
}

function SwarmCard({ card }: { card: SwarmBoardCard }) {
  const HealthIcon = card.moduleHealth === 'red' ? AlertTriangle : card.approvalState !== 'none' ? LockKeyhole : CheckCircle2
  return (
    <article className="rounded-lg border border-silicon-slate/70 bg-background/70 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{card.projectName}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{card.clientName}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs ${priorityClass(card.priority)}`}>
          {card.priority}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <Badge label={card.currentAgentLabel} />
        <Badge label={card.statusLabel} />
        <Badge label={`isolation: ${card.isolationStatus.replace(/_/g, ' ')}`} />
      </div>

      <div className="mb-3 flex items-start gap-2 rounded-lg border border-silicon-slate/60 bg-silicon-slate/15 p-3">
        <HealthIcon size={16} className={healthIconClass(card)} />
        <div>
          <p className="text-sm font-medium">{card.nextAction}</p>
          <p className="mt-1 text-xs text-muted-foreground">{card.riskLabel}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
        <MiniMetric label="Active" value={card.activeRuns} />
        <MiniMetric label="Failed" value={card.failedOrStaleRuns} />
        <MiniMetric label="Approvals" value={card.pendingApprovals} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {card.latestRunStatus ? `Latest run: ${card.latestRunStatus}` : 'No traced run yet'}
        </span>
        <Link href={card.latestRunId ? `/admin/agents/runs/${card.latestRunId}` : card.href} className="inline-flex items-center gap-1 text-radiant-gold hover:underline">
          {card.latestRunId ? 'Open trace' : 'Open project'}
          <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  )
}

function MetricCard({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'green' | 'yellow' | 'red' }) {
  const toneClass = {
    slate: 'border-silicon-slate/70 bg-silicon-slate/20 text-foreground',
    green: 'border-green-500/30 bg-green-500/10 text-green-300',
    yellow: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
    red: 'border-red-500/30 bg-red-500/10 text-red-300',
  }[tone]
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-silicon-slate/15 px-2 py-2">
      <p className="font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-muted-foreground">{label}</p>
    </div>
  )
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-silicon-slate/70 bg-silicon-slate/20 px-2 py-1 text-muted-foreground">
      {label}
    </span>
  )
}

function FailureState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-red-200">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <AlertTriangle size={18} />
        Failed to load Client Swarm Board
      </div>
      <p className="text-sm text-red-100/80">{message}</p>
    </div>
  )
}

function priorityClass(priority: SwarmBoardCard['priority']) {
  if (priority === 'high') return 'bg-red-500/15 text-red-300 border border-red-500/30'
  if (priority === 'medium') return 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30'
  return 'bg-green-500/15 text-green-300 border border-green-500/30'
}

function healthIconClass(card: SwarmBoardCard) {
  if (card.moduleHealth === 'red') return 'mt-0.5 text-red-300'
  if (card.approvalState !== 'none') return 'mt-0.5 text-yellow-300'
  return 'mt-0.5 text-green-300'
}
