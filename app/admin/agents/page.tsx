'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  MessageSquare,
  Network,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'

type MissionRun = {
  id: string
  agent_key: string | null
  runtime: string
  kind: string
  title: string
  status: string
  subject_label: string | null
  current_step: string | null
  error_message: string | null
  started_at: string
  completed_at: string | null
  cost_total: number
}

type MissionSnapshot = {
  generated_at: string
  status_strip: {
    active: number
    queued: number
    running: number
    waiting_for_approval: number
    failed: number
    stale: number
    cost_today: number
    pending_approvals: number
  }
  roster: Array<{
    key: string
    name: string
    purpose: string
    agents: Array<{
      key: string
      name: string
      pod: string
      status: 'active' | 'partial' | 'planned'
      runtime: string
      responsibility: string
      active_workflow_count: number
      latest_run: MissionRun | null
    }>
  }>
  attention_queue: MissionRun[]
  active_runs: MissionRun[]
  latest_events: Array<{
    run_id: string
    event_type: string
    severity: string
    message: string | null
    occurred_at: string
  }>
  latest_standup: MissionRun | null
}

type WarRoomResult = {
  run_id: string
  command: 'standup' | 'discuss'
  synthesis: string
  updates: Array<{
    agent_key: string
    agent_name: string
    pod: string
    runtime: string
    status: string
    update: string
    next_action: string
    approval_gate: string
  }>
}

type ChiefReply = {
  run_id: string
  reply: string
  suggested_actions: string[]
  agent_engagements: Array<{
    agentKey: string
    agentName: string
    label: string
    rationale: string
    status: string
    executionMode: string
  }>
}

export default function AgentOperationsPage() {
  const [snapshot, setSnapshot] = useState<MissionSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [command, setCommand] = useState('')
  const [chiefLoading, setChiefLoading] = useState(false)
  const [chiefReply, setChiefReply] = useState<ChiefReply | null>(null)
  const [warRoomLoading, setWarRoomLoading] = useState<'standup' | 'discuss' | null>(null)
  const [warRoomResult, setWarRoomResult] = useState<WarRoomResult | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<{ label: string; runId: string } | null>(null)

  const authedFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const session = await getCurrentSession()
    if (!session?.access_token) throw new Error('Missing admin session')
    return fetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    })
  }, [])

  const loadMissionControl = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await authedFetch('/api/admin/agents/mission-control')
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setSnapshot(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Mission Control')
    } finally {
      setLoading(false)
    }
  }, [authedFetch])

  useEffect(() => {
    loadMissionControl()
  }, [loadMissionControl])

  async function submitChiefOfStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = command.trim()
    if (!message) return

    setChiefLoading(true)
    setChiefReply(null)
    setError(null)
    try {
      const response = await authedFetch('/api/admin/agents/chief-of-staff/chat', {
        method: 'POST',
        body: JSON.stringify({ message }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setChiefReply(body)
      setCommand('')
      await loadMissionControl()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chief of Staff command failed')
    } finally {
      setChiefLoading(false)
    }
  }

  async function runWarRoom(commandName: 'standup' | 'discuss') {
    const message = commandName === 'discuss' ? command.trim() : ''
    if (commandName === 'discuss' && !message) {
      setError('Add a discussion question first.')
      return
    }

    setWarRoomLoading(commandName)
    setWarRoomResult(null)
    setError(null)
    try {
      const response = await authedFetch('/api/admin/agents/war-room', {
        method: 'POST',
        body: JSON.stringify({ command: commandName, message }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setWarRoomResult(body)
      if (commandName === 'discuss') setCommand('')
      await loadMissionControl()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'War Room command failed')
    } finally {
      setWarRoomLoading(null)
    }
  }

  async function runOperatorAction(kind: 'morning-review' | 'hermes' | 'approval-drill' | 'runtime-evaluation') {
    const paths = {
      'morning-review': '/api/admin/agents/morning-review',
      hermes: '/api/admin/agents/hermes/system-health',
      'approval-drill': '/api/admin/agents/approval-drill',
      'runtime-evaluation': '/api/admin/agents/runtime-evaluation',
    }
    const bodies = {
      'morning-review': undefined,
      hermes: undefined,
      'approval-drill': { approval_type: 'production_config_change', note: 'Approval drill from Mission Control.' },
      'runtime-evaluation': { runtime: 'opencode' },
    }

    setActionLoading(kind)
    setActionResult(null)
    setError(null)
    try {
      const response = await authedFetch(paths[kind], {
        method: 'POST',
        body: bodies[kind] ? JSON.stringify(bodies[kind]) : undefined,
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setActionResult({ label: kind.replace(/-/g, ' '), runId: body.run_id })
      await loadMissionControl()
    } catch (err) {
      setError(err instanceof Error ? err.message : `${kind} failed`)
    } finally {
      setActionLoading(null)
    }
  }

  const topAgents = useMemo(
    () => snapshot?.roster.flatMap((pod) => pod.agents).filter((agent) => agent.status !== 'planned').slice(0, 10) ?? [],
    [snapshot],
  )

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-background text-foreground p-5 lg:p-7">
        <div className="max-w-7xl mx-auto">
          <Breadcrumbs items={[{ label: 'Admin Dashboard', href: '/admin' }, { label: 'Agent Operations' }]} />

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-radiant-gold">Mission Control</p>
              <h1 className="mt-1 text-3xl font-bold">Agent Operations</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                One command surface for agent status, standups, blockers, and traceable engagement across Codex, n8n, Hermes, OpenCode, and manual work.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadMissionControl}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-background/60 px-3 py-2 text-sm hover:border-radiant-gold/60 disabled:opacity-60"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <Link href="/admin/agents/runs" className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15">
                <Activity size={16} />
                Runs
              </Link>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-7">
            <MetricCard icon={<Radio size={16} />} label="Active" value={snapshot?.status_strip.active ?? 0} />
            <MetricCard icon={<Clock3 size={16} />} label="Running" value={snapshot?.status_strip.running ?? 0} />
            <MetricCard icon={<ShieldCheck size={16} />} label="Approvals" value={snapshot?.status_strip.pending_approvals ?? 0} />
            <MetricCard icon={<AlertTriangle size={16} />} label="Failed" value={snapshot?.status_strip.failed ?? 0} tone="red" />
            <MetricCard icon={<AlertTriangle size={16} />} label="Stale" value={snapshot?.status_strip.stale ?? 0} tone="yellow" />
            <MetricCard icon={<CircleDollarSign size={16} />} label="Cost today" value={`$${(snapshot?.status_strip.cost_today ?? 0).toFixed(4)}`} />
            <MetricCard icon={<Users size={16} />} label="Agents" value={topAgents.length} />
          </section>

          <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/25 p-4">
              <div className="flex items-center gap-2 text-radiant-gold">
                <MessageSquare size={18} />
                <h2 className="font-semibold">Chief of Staff Command</h2>
              </div>
              <form onSubmit={submitChiefOfStaff} className="mt-3 flex flex-col gap-3 md:flex-row">
                <input
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="Ask what needs attention, or type a topic for /discuss..."
                  className="min-h-[44px] flex-1 rounded-lg border border-silicon-slate/70 bg-background/70 px-3 text-sm outline-none focus:border-radiant-gold/70"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={chiefLoading || !command.trim()}
                    className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-60"
                  >
                    <Send size={16} />
                    Ask
                  </button>
                  <button
                    type="button"
                    onClick={() => runWarRoom('standup')}
                    disabled={warRoomLoading !== null}
                    className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-background/60 px-3 py-2 text-sm hover:border-radiant-gold/60 disabled:opacity-60"
                  >
                    <Sparkles size={16} />
                    Standup
                  </button>
                  <button
                    type="button"
                    onClick={() => runWarRoom('discuss')}
                    disabled={warRoomLoading !== null || !command.trim()}
                    className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-background/60 px-3 py-2 text-sm hover:border-radiant-gold/60 disabled:opacity-60"
                  >
                    <Users size={16} />
                    Discuss
                  </button>
                </div>
              </form>

              {chiefReply ? (
                <ResultPanel
                  title="Chief of Staff"
                  href={`/admin/agents/runs/${chiefReply.run_id}`}
                  body={chiefReply.reply}
                  items={chiefReply.agent_engagements.map((agent) => `${agent.agentName}: ${agent.rationale}`)}
                />
              ) : null}

              {warRoomResult ? (
                <ResultPanel
                  title={warRoomResult.command === 'standup' ? 'War Room Standup' : 'War Room Discussion'}
                  href={`/admin/agents/runs/${warRoomResult.run_id}`}
                  body={warRoomResult.synthesis}
                  items={warRoomResult.updates.map((update) => `${update.agent_name}: ${update.update}`)}
                />
              ) : null}
            </div>

            <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/25 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-radiant-gold">
                  <AlertTriangle size={18} />
                  <h2 className="font-semibold">Attention Queue</h2>
                </div>
                <Link href="/admin/agents/runs" className="text-xs text-radiant-gold hover:underline">Open all</Link>
              </div>
              <div className="mt-3 space-y-2">
                {snapshot?.attention_queue.length ? snapshot.attention_queue.slice(0, 5).map((run) => (
                  <RunRow key={run.id} run={run} />
                )) : (
                  <p className="rounded-lg border border-silicon-slate/50 bg-black/10 p-3 text-sm text-muted-foreground">
                    No failed, stale, approval-waiting, or high-cost runs need attention.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_0.8fr]">
            <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
              <div className="flex items-center gap-2 text-radiant-gold">
                <Network size={18} />
                <h2 className="font-semibold">Agent Roster</h2>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                {topAgents.map((agent) => (
                  <div key={agent.key} className="rounded-lg border border-silicon-slate/50 bg-black/10 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{agent.name}</p>
                      <StatusPill status={agent.status} />
                      <span className="rounded-full border border-silicon-slate/50 px-2 py-0.5 text-xs text-muted-foreground">
                        {agent.runtime}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{agent.responsibility}</p>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{agent.active_workflow_count} active workflow(s)</span>
                      {agent.latest_run ? (
                        <Link href={`/admin/agents/runs/${agent.latest_run.id}`} className="text-radiant-gold hover:underline">
                          {agent.latest_run.status.replace(/_/g, ' ')}
                        </Link>
                      ) : (
                        <span>No recent trace</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
              <div className="flex items-center gap-2 text-radiant-gold">
                <Bot size={18} />
                <h2 className="font-semibold">Drilldowns & Controls</h2>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <ControlLink href="/admin/agents/chief-of-staff" label="Chief of Staff Chat" />
                <ControlLink href="/admin/agents/runs" label="Run Console" />
                <ControlLink href="/admin/agents/automations" label="Automation Context" />
                <ActionButton label="Morning review" loading={actionLoading === 'morning-review'} onClick={() => runOperatorAction('morning-review')} />
                <ActionButton label="Hermes health" loading={actionLoading === 'hermes'} onClick={() => runOperatorAction('hermes')} />
                <ActionButton label="Approval drill" loading={actionLoading === 'approval-drill'} onClick={() => runOperatorAction('approval-drill')} />
                <ActionButton label="OpenCode probe" loading={actionLoading === 'runtime-evaluation'} onClick={() => runOperatorAction('runtime-evaluation')} />
              </div>
              {actionResult ? (
                <Link href={`/admin/agents/runs/${actionResult.runId}`} className="mt-3 block rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 hover:underline">
                  Open {actionResult.label} run
                </Link>
              ) : null}
            </div>
          </section>

          <section className="mt-5 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
            <div className="flex items-center gap-2 text-radiant-gold">
              <Activity size={18} />
              <h2 className="font-semibold">Latest Activity</h2>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
              {snapshot?.latest_events.length ? snapshot.latest_events.slice(0, 6).map((event) => (
                <Link key={`${event.run_id}-${event.occurred_at}-${event.event_type}`} href={`/admin/agents/runs/${event.run_id}`} className="rounded-lg border border-silicon-slate/50 bg-black/10 p-3 text-sm hover:border-radiant-gold/50">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{event.event_type}</p>
                    <span className="text-xs text-muted-foreground">{formatTime(event.occurred_at)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-muted-foreground">{event.message || event.severity}</p>
                </Link>
              )) : (
                <p className="text-sm text-muted-foreground">No recent agent events found.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </ProtectedRoute>
  )
}

function MetricCard({ icon, label, value, tone = 'default' }: { icon: ReactNode; label: string; value: string | number; tone?: 'default' | 'red' | 'yellow' }) {
  const toneClass = tone === 'red' ? 'text-red-200' : tone === 'yellow' ? 'text-yellow-200' : 'text-foreground'
  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-silicon-slate/20 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}

function StatusPill({ status }: { status: 'active' | 'partial' | 'planned' }) {
  const className =
    status === 'active'
      ? 'border-green-400/40 bg-green-500/10 text-green-200'
      : status === 'partial'
        ? 'border-yellow-400/40 bg-yellow-500/10 text-yellow-200'
        : 'border-silicon-slate/60 bg-black/20 text-muted-foreground'

  return <span className={`rounded-full border px-2 py-0.5 text-xs ${className}`}>{status}</span>
}

function RunRow({ run }: { run: MissionRun }) {
  return (
    <Link href={`/admin/agents/runs/${run.id}`} className="block rounded-lg border border-silicon-slate/50 bg-black/10 p-3 text-sm hover:border-radiant-gold/50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{run.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{run.runtime} · {run.status.replace(/_/g, ' ')}</p>
        </div>
        <ArrowRight size={16} className="shrink-0 text-muted-foreground" />
      </div>
      {run.current_step ? <p className="mt-2 text-muted-foreground">{run.current_step}</p> : null}
      {run.error_message ? <p className="mt-2 text-red-200">{run.error_message}</p> : null}
    </Link>
  )
}

function ResultPanel({ title, href, body, items }: { title: string; href: string; body: string; items: string[] }) {
  return (
    <div className="mt-4 rounded-lg border border-silicon-slate/60 bg-background/45 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{title}</p>
        <Link href={href} className="text-xs text-radiant-gold hover:underline">Open trace</Link>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      {items.length ? (
        <div className="mt-3 space-y-1">
          {items.slice(0, 5).map((item) => (
            <p key={item} className="text-xs text-muted-foreground">{item}</p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ControlLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center justify-between gap-2 rounded-lg border border-silicon-slate/60 bg-black/10 px-3 py-2 text-sm hover:border-radiant-gold/60">
      {label}
      <ArrowRight size={14} />
    </Link>
  )
}

function ActionButton({ label, loading, onClick }: { label: string; loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center justify-between gap-2 rounded-lg border border-silicon-slate/60 bg-black/10 px-3 py-2 text-sm hover:border-radiant-gold/60 disabled:opacity-60"
    >
      {label}
      {loading ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
    </button>
  )
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
