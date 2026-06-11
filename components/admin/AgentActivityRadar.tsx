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
import AgentAvatar from '@/components/admin/AgentAvatar'
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

type ClientLifecycleStageKey =
  | 'attract'
  | 'qualify'
  | 'schedule'
  | 'diagnose'
  | 'propose'
  | 'close'
  | 'onboard'
  | 'deliver'
  | 'prove'
  | 'retain'

type ClientLifecycleStage = {
  key: ClientLifecycleStageKey
  label: string
  eyebrow: string
  description: string
  className: string
}

const CLIENT_LIFECYCLE_STAGES: ClientLifecycleStage[] = [
  {
    key: 'attract',
    label: 'Attract',
    eyebrow: 'Social + content',
    description: 'Posts, campaigns, comments, and lead capture.',
    className: 'border-cyan-400/35 bg-cyan-500/10',
  },
  {
    key: 'qualify',
    label: 'Qualify',
    eyebrow: 'Research + fit',
    description: 'Lead research, source maps, and fit scoring.',
    className: 'border-sky-400/35 bg-sky-500/10',
  },
  {
    key: 'schedule',
    label: 'Schedule',
    eyebrow: 'Conversation',
    description: 'Warm follow-up, calendar holds, and meeting prep.',
    className: 'border-violet-400/35 bg-violet-500/10',
  },
  {
    key: 'diagnose',
    label: 'Diagnose',
    eyebrow: 'Discovery',
    description: 'Audits, pain points, and value evidence.',
    className: 'border-fuchsia-400/35 bg-fuchsia-500/10',
  },
  {
    key: 'propose',
    label: 'Propose',
    eyebrow: 'Offer design',
    description: 'Packages, scripts, pricing, and proof packets.',
    className: 'border-amber-400/35 bg-amber-500/10',
  },
  {
    key: 'close',
    label: 'Close',
    eyebrow: 'Transaction',
    description: 'Contracts, checkout, payment, and approvals.',
    className: 'border-emerald-400/35 bg-emerald-500/10',
  },
  {
    key: 'onboard',
    label: 'Onboard',
    eyebrow: 'Kickoff',
    description: 'Provisioning, access, intake, and kickoff notes.',
    className: 'border-teal-400/35 bg-teal-500/10',
  },
  {
    key: 'deliver',
    label: 'Deliver',
    eyebrow: 'Build + operate',
    description: 'Implementation, workflows, automation, and handoffs.',
    className: 'border-blue-400/35 bg-blue-500/10',
  },
  {
    key: 'prove',
    label: 'Prove',
    eyebrow: 'QA + evidence',
    description: 'Validation, observability, reporting, and traceability.',
    className: 'border-radiant-gold/45 bg-radiant-gold/10',
  },
  {
    key: 'retain',
    label: 'Retain',
    eyebrow: 'Continuity',
    description: 'Weekly updates, renewals, upsell, and down-sell motion.',
    className: 'border-rose-400/35 bg-rose-500/10',
  },
]

const STAGE_KEYWORDS: Array<{ stage: ClientLifecycleStageKey; terms: string[] }> = [
  { stage: 'attract', terms: ['social', 'linkedin', 'post', 'content', 'campaign', 'comment', 'brand', 'video', 'youtube', 'tiktok', 'outreach'] },
  { stage: 'qualify', terms: ['qualify', 'lead research', 'lead score', 'fit', 'source map', 'source register', 'prospect', 'research', 'intel'] },
  { stage: 'schedule', terms: ['schedule', 'calendar', 'meeting', 'follow-up', 'follow up', 'inbox', 'email confirmation', 'meeting notes', 'warm lead'] },
  { stage: 'diagnose', terms: ['diagnose', 'diagnostic', 'audit', 'discovery', 'pain point', 'value evidence', 'assessment'] },
  { stage: 'propose', terms: ['proposal', 'propose', 'offer', 'pricing', 'business model', 'sales script', 'scope of work', 'sow'] },
  { stage: 'close', terms: ['close', 'checkout', 'payment', 'stripe', 'contract', 'signature', 'transaction', 'invoice'] },
  { stage: 'onboard', terms: ['onboard', 'kickoff', 'provision', 'credential', 'intake', 'access setup', 'setup'] },
  { stage: 'deliver', terms: ['deliver', 'build', 'implementation', 'engineering', 'automation', 'n8n', 'workflow', 'client project', 'product automation'] },
  { stage: 'prove', terms: ['prove', 'qa', 'validation', 'report', 'metrics', 'observability', 'trace', 'governance', 'evaluation', 'radar'] },
  { stage: 'retain', terms: ['retain', 'retention', 'continuity', 'weekly update', 'renewal', 'upsell', 'downsell', 'down sell', 'maintenance'] },
]

function formatAge(seconds: number | null | undefined) {
  if (seconds == null) return 'No trace'
  if (seconds < 60) return 'now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function stageSearchText(agent: AgentActivityRadarAgent) {
  return [
    agent.key,
    agent.name,
    agent.pod_key,
    agent.pod_name,
    agent.runtime,
    agent.live_state,
    agent.idle_reason,
    agent.current_work_item?.title,
    agent.current_work_item?.status,
    agent.active_run?.title,
    agent.active_run?.status,
    agent.current_step,
    agent.latest_event?.message,
    agent.linked_goal?.id,
    agent.linked_goal?.title,
    agent.backlog_lane?.key,
    agent.backlog_lane?.label,
  ].filter(Boolean).join(' ').toLowerCase()
}

function lifecycleStageForAgent(agent: AgentActivityRadarAgent): ClientLifecycleStageKey {
  const text = stageSearchText(agent)
  const match = STAGE_KEYWORDS.find(({ terms }) => terms.some((term) => text.includes(term)))
  if (match) return match.stage
  if (agent.pod_key === 'content_production' || agent.pod_key === 'publishing_follow_up') return 'attract'
  if (agent.pod_key === 'research_knowledge') return 'qualify'
  if (agent.pod_key === 'product_automation') return 'deliver'
  if (agent.pod_key === 'strategy_narrative') return 'propose'
  return 'prove'
}

function progressForAgent(agent: AgentActivityRadarAgent) {
  const lane = agent.backlog_lane?.key
  if (lane === 'ready_for_merge') return 92
  if (lane === 'ready_for_review') return 82
  if (lane === 'in_progress') return 64
  if (lane === 'assigned') return 38
  if (lane === 'queued' || lane === 'proposed') return 24
  if (lane === 'blocked') return 42
  if (agent.live_state === 'active') return 68
  if (agent.live_state === 'waiting_for_approval') return 78
  if (agent.live_state === 'blocked' || agent.live_state === 'stale' || agent.live_state === 'failed') return 35
  if (agent.live_state === 'queued') return 22
  return 0
}

function currentWorkLabel(agent: AgentActivityRadarAgent) {
  return agent.current_work_item?.title ?? agent.active_run?.title ?? agent.idle_reason ?? 'No active assignment'
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
            Client-lifecycle command map showing where each agent is working, what progress is visible, and which safe steering actions are available now.
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
          <ClientLifecycleMap
            agents={visibleAgents}
            compact={compact}
            actionLoading={actionLoading}
            onExecuteAction={executeAction}
          />

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

function ClientLifecycleMap({
  agents,
  compact,
  actionLoading,
  onExecuteAction,
}: {
  agents: AgentActivityRadarAgent[]
  compact: boolean
  actionLoading: string | null
  onExecuteAction: (agent: AgentActivityRadarAgent, action: AgentActivitySteerAction) => void
}) {
  const stages = compact ? CLIENT_LIFECYCLE_STAGES.slice(0, 6) : CLIENT_LIFECYCLE_STAGES
  const stageAgents = useMemo(() => {
    const map = new Map<ClientLifecycleStageKey, AgentActivityRadarAgent[]>()
    CLIENT_LIFECYCLE_STAGES.forEach((stage) => map.set(stage.key, []))
    agents.forEach((agent) => {
      const stage = lifecycleStageForAgent(agent)
      map.get(stage)?.push(agent)
    })
    return map
  }, [agents])

  return (
    <div className="mt-5 rounded-xl border border-silicon-slate/70 bg-background/35 p-4" aria-label="Client engagement lifecycle">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client lifecycle</p>
          <h3 className="mt-1 text-lg font-semibold">Agent office map</h3>
        </div>
        <p className="max-w-xl text-xs text-muted-foreground">
          Avatars show the current lifecycle room for each agent. Hover or focus an avatar for the goal, progress, trace, and governed engagement options.
        </p>
      </div>
      <div className={`mt-4 grid gap-3 ${compact ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-5'}`}>
        {stages.map((stage) => {
          const roomAgents = stageAgents.get(stage.key) ?? []
          const averageProgress = roomAgents.length
            ? Math.round(roomAgents.reduce((total, agent) => total + progressForAgent(agent), 0) / roomAgents.length)
            : 0
          return (
            <section
              key={stage.key}
              className={`relative min-h-[158px] overflow-visible rounded-lg border p-3 ${stage.className}`}
              aria-label={`${stage.label} lifecycle stage`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{stage.eyebrow}</p>
                  <h4 className="mt-1 text-sm font-semibold">{stage.label}</h4>
                </div>
                <span className="rounded-full border border-silicon-slate/60 bg-background/55 px-2 py-1 text-[11px] tabular-nums">
                  {roomAgents.length}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{stage.description}</p>
              <div className="mt-3 h-1.5 rounded-full bg-background/55" aria-label={`${stage.label} average progress ${averageProgress}%`}>
                <div className="h-full rounded-full bg-radiant-gold/80" style={{ width: `${averageProgress}%` }} />
              </div>
              <div className="mt-4 flex min-h-[44px] flex-wrap items-center gap-2">
                {roomAgents.length ? roomAgents.map((agent) => (
                  <LifecycleAgentPin
                    key={agent.key}
                    agent={agent}
                    actionLoading={actionLoading}
                    onExecuteAction={onExecuteAction}
                  />
                )) : (
                  <span className="rounded-lg border border-dashed border-silicon-slate/55 bg-background/30 px-2 py-1.5 text-[11px] text-muted-foreground">
                    No assigned agents
                  </span>
                )}
              </div>
            </section>
          )
        })}
      </div>
      {compact ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Full Mission Control shows the complete ten-stage lifecycle.
        </p>
      ) : null}
    </div>
  )
}

function LifecycleAgentPin({
  agent,
  actionLoading,
  onExecuteAction,
}: {
  agent: AgentActivityRadarAgent
  actionLoading: string | null
  onExecuteAction: (agent: AgentActivityRadarAgent, action: AgentActivitySteerAction) => void
}) {
  const progress = progressForAgent(agent)
  const actions = agent.steer_actions.filter((action) => ['open_trace', 'open_kanban', 'open_approval', 'ask_shaka', 'engage_agent'].includes(action.kind)).slice(0, 4)

  return (
    <div className="group relative z-10">
      <button
        type="button"
        className={`rounded-xl border bg-background/60 p-1 transition hover:-translate-y-0.5 hover:border-radiant-gold/70 focus:outline-none focus:ring-2 focus:ring-radiant-gold/70 ${STATE_STYLES[agent.live_state]}`}
        aria-label={`Open ${agent.name} lifecycle detail`}
      >
        <AgentAvatar agentKey={agent.key} size="sm" />
      </button>
      <div className="pointer-events-none absolute left-0 top-12 z-30 w-72 rounded-lg border border-silicon-slate/70 bg-background p-3 text-left opacity-0 shadow-2xl shadow-black/30 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" title={agent.name}>{agent.name}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{agent.pod_name}</p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${STATE_STYLES[agent.live_state]}`}>
            {stateIcon(agent.live_state)}
            {STATE_LABELS[agent.live_state]}
          </span>
        </div>
        <div className="mt-3 rounded-lg border border-silicon-slate/55 bg-silicon-slate/15 p-2">
          <p className="line-clamp-2 text-xs font-medium">{currentWorkLabel(agent)}</p>
          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
            {agent.current_step ?? agent.latest_event?.message ?? 'No current step recorded.'}
          </p>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-silicon-slate/45" aria-label={`${agent.name} progress ${progress}%`}>
            <div className="h-full rounded-full bg-radiant-gold" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {actions.map((action) => action.href ? (
            <Link
              key={action.kind}
              href={action.href}
              aria-label={`${action.label} for ${agent.name}`}
              className="inline-flex items-center gap-1 rounded-md border border-silicon-slate/65 px-2 py-1 text-[11px] hover:border-radiant-gold/55"
            >
              {action.label}
            </Link>
          ) : (
            <button
              key={action.kind}
              type="button"
              aria-label={`${action.label} for ${agent.name}`}
              onClick={() => onExecuteAction(agent, action)}
              disabled={actionLoading === `${agent.key}:${action.kind}`}
              className="inline-flex items-center gap-1 rounded-md border border-silicon-slate/65 px-2 py-1 text-[11px] hover:border-radiant-gold/55 disabled:opacity-60"
            >
              {action.kind === 'ask_shaka' ? <MessageSquare size={12} /> : <Send size={12} />}
              {actionLoading === `${agent.key}:${action.kind}` ? 'Sending...' : action.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Last signal {formatAge(agent.age_seconds)}</p>
      </div>
    </div>
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
