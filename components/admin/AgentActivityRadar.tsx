'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquare,
  PauseCircle,
  Radio,
  RefreshCw,
  Send,
} from 'lucide-react'
import { getCurrentSession } from '@/lib/auth'
import type {
  AgentActivityRadarAgent,
  AgentActivityRadarAttention,
  AgentActivityRadarSnapshot,
  AgentActivityState,
  AgentActivitySteerAction,
} from '@/lib/agent-activity-radar'

type AgentActivityRadarProps = {
  variant?: 'compact' | 'full'
}

const STATE_LABELS: Record<AgentActivityState, string> = {
  active: 'Active',
  idle: 'Idle',
  queued: 'Queued',
  waiting_for_approval: 'Waiting approval',
  blocked: 'Blocked',
  stale: 'Stale',
  failed: 'Failed',
}

const STATE_STYLES: Record<AgentActivityState, string> = {
  active: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  idle: 'border-silicon-slate/60 bg-silicon-slate/20 text-muted-foreground',
  queued: 'border-sky-400/40 bg-sky-500/10 text-sky-200',
  waiting_for_approval: 'border-radiant-gold/45 bg-radiant-gold/10 text-radiant-gold',
  blocked: 'border-yellow-400/45 bg-yellow-500/10 text-yellow-200',
  stale: 'border-orange-400/45 bg-orange-500/10 text-orange-200',
  failed: 'border-red-400/45 bg-red-500/10 text-red-200',
}

function formatAge(seconds: number | null | undefined) {
  if (seconds == null) return 'No trace'
  if (seconds < 60) return 'now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function formatGeneratedAt(value: string | null) {
  if (!value) return 'Not loaded'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function stateIcon(state: AgentActivityState) {
  if (state === 'active') return <Radio size={14} />
  if (state === 'idle') return <PauseCircle size={14} />
  if (state === 'waiting_for_approval') return <Clock3 size={14} />
  if (state === 'blocked' || state === 'stale' || state === 'failed') return <AlertTriangle size={14} />
  return <Bot size={14} />
}

export default function AgentActivityRadar({ variant = 'full' }: AgentActivityRadarProps) {
  const [snapshot, setSnapshot] = useState<AgentActivityRadarSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<string | null>(null)

  const loadRadar = useCallback(async ({ quiet = false }: { quiet?: boolean } = {}) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const response = await fetch('/api/admin/agents/activity-radar', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setSnapshot(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Agent Activity Radar')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadRadar()
  }, [loadRadar])

  useEffect(() => {
    const intervalSeconds = snapshot?.refresh_interval_seconds ?? 15
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadRadar({ quiet: true })
      }
    }, intervalSeconds * 1000)
    return () => window.clearInterval(interval)
  }, [loadRadar, snapshot?.refresh_interval_seconds])

  const visibleAgents = useMemo(() => {
    const agents = snapshot?.agents ?? []
    const rank: Record<AgentActivityState, number> = {
      failed: 0,
      stale: 1,
      blocked: 2,
      waiting_for_approval: 3,
      active: 4,
      queued: 5,
      idle: 6,
    }
    return [...agents].sort((a, b) => rank[a.live_state] - rank[b.live_state] || a.pod_name.localeCompare(b.pod_name))
  }, [snapshot?.agents])

  async function executeAction(agent: AgentActivityRadarAgent, action: AgentActivitySteerAction) {
    if (!action.endpoint || action.method !== 'POST') return
    const key = `${agent.key}:${action.kind}`
    setActionLoading(key)
    setActionResult(null)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const response = await fetch(action.endpoint, {
        method: action.method,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(action.payload ?? {}),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      const runId = body.run_id || body.runId
      setActionResult(runId ? `${action.label} queued. Trace: ${runId}` : `${action.label} queued.`)
      await loadRadar({ quiet: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action.label} failed`)
    } finally {
      setActionLoading(null)
    }
  }

  const compact = variant === 'compact'
  const attention = snapshot?.attention ?? []
  const agents = compact ? visibleAgents.slice(0, 5) : visibleAgents

  return (
    <section className="agent-ops-panel rounded-xl border p-5" aria-label="Agent Activity Radar">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="agent-ops-eyebrow mb-2">
            <Radio size={16} />
            Agent Activity Radar
          </div>
          <h2 className="text-2xl font-bold">Live agent work map</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Point-in-time trace of what each agent is doing, why idle agents are idle, and the safe steering actions available now.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-silicon-slate/60 bg-background/45 px-3 py-2 text-xs text-muted-foreground">
            Updated {formatGeneratedAt(snapshot?.generated_at ?? null)}
          </span>
          <button
            type="button"
            onClick={() => loadRadar({ quiet: true })}
            disabled={loading || refreshing}
            className="agent-ops-button-secondary disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link href="/admin/agents" className="agent-ops-button-muted">
            Agent Ops
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-yellow-400/35 bg-yellow-500/10 p-3 text-sm text-yellow-100" role="status">
          {error}
          {snapshot ? <span className="ml-1 text-yellow-100/70">Showing the last loaded radar.</span> : null}
        </div>
      ) : null}

      {actionResult ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-400/35 bg-emerald-500/10 p-3 text-sm text-emerald-100" role="status">
          <CheckCircle2 size={16} />
          {actionResult}
        </div>
      ) : null}

      {loading && !snapshot ? (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-silicon-slate/60 bg-silicon-slate/20 p-8 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          Loading Agent Activity Radar...
        </div>
      ) : snapshot ? (
        <>
          <SummaryStrip snapshot={snapshot} />

          <div className={`mt-5 grid gap-4 ${compact ? 'xl:grid-cols-[minmax(0,1fr)_320px]' : '2xl:grid-cols-[minmax(0,1fr)_360px]'}`}>
            <div className={`grid gap-3 ${compact ? 'md:grid-cols-2' : 'lg:grid-cols-2 2xl:grid-cols-3'}`}>
              {agents.map((agent) => (
                <AgentRadarCard
                  key={agent.key}
                  agent={agent}
                  compact={compact}
                  actionLoading={actionLoading}
                  onExecuteAction={executeAction}
                />
              ))}
            </div>
            <AttentionList attention={attention} compact={compact} />
          </div>

          {compact ? (
            <div className="mt-4">
              <Link href="/admin/agents" className="inline-flex items-center gap-2 text-sm text-radiant-gold hover:underline">
                Open full Mission Control radar
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

function SummaryStrip({ snapshot }: { snapshot: AgentActivityRadarSnapshot }) {
  const keys: AgentActivityState[] = ['active', 'queued', 'waiting_for_approval', 'blocked', 'stale', 'failed', 'idle']
  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7" aria-label="Agent Activity Radar summary">
      {keys.map((key) => (
        <div key={key} className={`rounded-lg border px-3 py-2 ${STATE_STYLES[key]}`}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
            {stateIcon(key)}
            {STATE_LABELS[key]}
          </div>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{snapshot.summary[key] ?? 0}</p>
        </div>
      ))}
    </div>
  )
}

function AgentRadarCard({
  agent,
  compact,
  actionLoading,
  onExecuteAction,
}: {
  agent: AgentActivityRadarAgent
  compact: boolean
  actionLoading: string | null
  onExecuteAction: (agent: AgentActivityRadarAgent, action: AgentActivitySteerAction) => void
}) {
  const actions = compact
    ? agent.steer_actions.filter((action) => ['open_trace', 'open_kanban', 'open_approval', 'ask_shaka'].includes(action.kind)).slice(0, 3)
    : agent.steer_actions
  return (
    <article className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/15 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold" title={agent.name}>{agent.name}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{agent.pod_name} · {agent.runtime}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs ${STATE_STYLES[agent.live_state]}`}>
          {stateIcon(agent.live_state)}
          {STATE_LABELS[agent.live_state]}
        </span>
      </div>

      <div className="mt-4 rounded-lg border border-silicon-slate/55 bg-background/45 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Current work</p>
        <p className="mt-1 line-clamp-2 text-sm font-medium">
          {agent.current_work_item?.title ?? agent.active_run?.title ?? agent.idle_reason ?? 'No active assignment'}
        </p>
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {agent.current_step ?? agent.latest_event?.message ?? 'No current step recorded.'}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full border border-silicon-slate/60 px-2 py-1">Last signal {formatAge(agent.age_seconds)}</span>
        {agent.backlog_lane ? <span className="rounded-full border border-silicon-slate/60 px-2 py-1">{agent.backlog_lane.label}</span> : null}
        {agent.linked_goal ? <span className="rounded-full border border-silicon-slate/60 px-2 py-1">Goal linked</span> : null}
      </div>

      {!compact && agent.linked_goal ? (
        <Link href={agent.linked_goal.href} className="mt-3 line-clamp-1 text-xs text-radiant-gold hover:underline">
          {agent.linked_goal.title}
        </Link>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((action) => action.href ? (
          <Link key={action.kind} href={action.href} className="inline-flex items-center gap-1 rounded-lg border border-silicon-slate/65 px-2 py-1.5 text-xs hover:border-radiant-gold/55">
            {action.label}
          </Link>
        ) : (
          <button
            key={action.kind}
            type="button"
            onClick={() => onExecuteAction(agent, action)}
            disabled={actionLoading === `${agent.key}:${action.kind}`}
            className="inline-flex items-center gap-1 rounded-lg border border-silicon-slate/65 px-2 py-1.5 text-xs hover:border-radiant-gold/55 disabled:opacity-60"
          >
            {action.kind === 'ask_shaka' ? <MessageSquare size={13} /> : <Send size={13} />}
            {actionLoading === `${agent.key}:${action.kind}` ? 'Sending...' : action.label}
          </button>
        ))}
      </div>
    </article>
  )
}

function AttentionList({ attention, compact }: { attention: AgentActivityRadarAttention[]; compact: boolean }) {
  const visible = compact ? attention.slice(0, 4) : attention
  return (
    <aside className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/15 p-4" aria-label="Agent Activity Radar attention">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attention queue</p>
          <h3 className="mt-1 font-semibold">Needs operator eyes</h3>
        </div>
        <Link href="/admin/agents/coordination" className="text-xs text-radiant-gold hover:underline">
          Decision Queue
        </Link>
      </div>
      <div className="mt-4 space-y-3">
        {visible.length ? visible.map((item) => (
          <Link key={item.id} href={item.href} className="block rounded-lg border border-silicon-slate/60 bg-background/45 p-3 hover:border-radiant-gold/50">
            <div className="flex items-start justify-between gap-3">
              <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
              <span className={`rounded-full border px-2 py-1 text-xs ${item.severity === 'error' ? 'border-red-400/40 text-red-200' : item.severity === 'warning' ? 'border-yellow-400/40 text-yellow-200' : 'border-silicon-slate/60 text-muted-foreground'}`}>
                {STATE_LABELS[item.state]}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.detail}</p>
            <p className="mt-2 text-xs text-muted-foreground">{item.agent_name} · {formatAge(item.age_seconds)}</p>
          </Link>
        )) : (
          <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            No blocked, failed, stale, or approval-waiting agents in the current radar.
          </div>
        )}
      </div>
    </aside>
  )
}
