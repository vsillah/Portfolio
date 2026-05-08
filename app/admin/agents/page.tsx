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
  Columns,
  CircleDollarSign,
  ClipboardList,
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

type CostSummaryGroup = {
  key: string
  label: string
  amount: number
  event_count: number
  run_count: number
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
  daily_brief: {
    headline: string
    synthesis: string
    generated_from: 'standup' | 'current_state'
    run_id: string | null
    updated_at: string
    signals: string[]
    next_actions: string[]
  }
  cost_summary: {
    window_hours: number
    total: number
    event_count: number
    linked_event_count: number
    unlinked_event_count: number
    by_runtime: CostSummaryGroup[]
    by_agent: CostSummaryGroup[]
    by_workflow: CostSummaryGroup[]
    by_client_project: CostSummaryGroup[]
    by_artifact_type: CostSummaryGroup[]
  }
  operating_signals: Array<{
    run_id: string
    kind: 'morning_review' | 'deployment_watch'
    title: string
    status: string
    signal: string
    summary: string
    updated_at: string
    href: string
    details: string[]
  }>
  knowledge_governance: {
    targetIndex: string
    legacyIndex: string
    mode: string
    approvalGate: string
    manifest: {
      sourceCount: number
      approvedSourceCount: number
      excludedSourceCount: number
      countsByNamespace: Record<string, number>
      countsByPrivacyTier: Record<string, number>
    }
    validation: {
      ok: boolean
      errors: string[]
      warnings: string[]
      publicUnsafeApprovedCount: number
    }
  }
  agent_inbox: Array<{
    id: string
    priority: 'high' | 'medium' | 'low'
    agent_key: string
    agent_name: string
    pod: string
    title: string
    reason: string
    action_label: string
    href: string
    source_run_id: string | null
  }>
  engagement_queue: Array<{
    run_id: string
    agent_key: string
    agent_name: string
    owner_label: string
    pod: string
    runtime: string
    status: string
    current_step: string | null
    execution_mode: string
    requested_from: string | null
    source_label: string
    source_inbox_item_id: string | null
    source_run_id: string | null
    note: string | null
    next_action: string | null
    started_at: string
    completed_at: string | null
  }>
  dead_letter_queue: Array<{
    run_id: string
    agent_key: string
    agent_name: string
    pod: string
    runtime: string
    status: string
    title: string
    reason: string
    age_hours: number
    source_label: string
    routed: boolean
    routed_run_id: string | null
    routed_kind: string | null
    routed_status: string | null
    recovery_retry_attempt: number | null
    recovery_earliest_retry_at: string | null
    recovery_backoff_active: boolean
    next_action: string
    href: string
  }>
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
  const [inboxRoutingId, setInboxRoutingId] = useState<string | null>(null)
  const [engagementLoadingKey, setEngagementLoadingKey] = useState<string | null>(null)
  const [recoveryLoadingRunId, setRecoveryLoadingRunId] = useState<string | null>(null)

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

  async function routeInboxItem(item: MissionSnapshot['agent_inbox'][number]) {
    setInboxRoutingId(item.id)
    setActionResult(null)
    setError(null)
    try {
      const response = await authedFetch('/api/admin/agents/inbox', {
        method: 'POST',
        body: JSON.stringify({ item_id: item.id }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setActionResult({ label: `routed ${item.agent_name}`, runId: body.run_id })
      await loadMissionControl()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Agent Inbox routing failed')
    } finally {
      setInboxRoutingId(null)
    }
  }

  async function launchAgentEngagement(agentKey: string, label: string, note?: string) {
    setEngagementLoadingKey(agentKey)
    setActionResult(null)
    setError(null)
    try {
      const response = await authedFetch('/api/admin/agents/engage', {
        method: 'POST',
        body: JSON.stringify({
          agent_key: agentKey,
          note: note ? `Chief of Staff recommended: ${note}` : undefined,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setActionResult({ label, runId: body.run_id })
      await loadMissionControl()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Agent engagement launch failed')
    } finally {
      setEngagementLoadingKey(null)
    }
  }

  async function requestRunRecovery(item: MissionSnapshot['dead_letter_queue'][number]) {
    setRecoveryLoadingRunId(item.run_id)
    setActionResult(null)
    setError(null)
    try {
      const response = await authedFetch(`/api/admin/agents/runs/${item.run_id}/retry`, {
        method: 'POST',
        body: JSON.stringify({
          note: `Mission Control recovery request for ${item.status} ${item.runtime} run.`,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setActionResult({ label: `recovery for ${item.agent_name}`, runId: body.run_id })
      await loadMissionControl()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request recovery')
    } finally {
      setRecoveryLoadingRunId(null)
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
              <Link href="/admin/agents/swarm-board" className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-background/60 px-3 py-2 text-sm hover:border-radiant-gold/60">
                <Columns size={16} />
                Swarm Board
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

          <DailyBriefPanel brief={snapshot?.daily_brief ?? null} loading={loading} />
          <CostSummaryPanel summary={snapshot?.cost_summary ?? null} />
          <OperatingSignalsPanel signals={snapshot?.operating_signals ?? []} />
          <KnowledgeGovernancePanel governance={snapshot?.knowledge_governance ?? null} />

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
                <>
                  <ResultPanel
                    title="Chief of Staff"
                    href={`/admin/agents/runs/${chiefReply.run_id}`}
                    body={chiefReply.reply}
                    items={chiefReply.suggested_actions}
                  />
                  <AgentEngagementRecommendations
                    recommendations={chiefReply.agent_engagements}
                    loadingKey={engagementLoadingKey}
                    onLaunch={(agent) => launchAgentEngagement(agent.agentKey, agent.agentName, agent.rationale)}
                  />
                </>
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
                  <ClipboardList size={18} />
                  <h2 className="font-semibold">Agent Inbox</h2>
                </div>
                <Link href="/admin/agents/runs" className="text-xs text-radiant-gold hover:underline">Open all</Link>
              </div>
              <div className="mt-3 space-y-2">
                {snapshot?.agent_inbox.length ? snapshot.agent_inbox.slice(0, 5).map((item) => (
                  <InboxRow
                    key={item.id}
                    item={item}
                    routing={inboxRoutingId === item.id}
                    onRoute={() => routeInboxItem(item)}
                  />
                )) : (
                  <p className="rounded-lg border border-silicon-slate/50 bg-black/10 p-3 text-sm text-muted-foreground">
                    No agent inbox items need attention.
                  </p>
                )}
              </div>
            </div>
          </section>

          <EngagementQueuePanel items={snapshot?.engagement_queue ?? []} />

          <DeadLetterPanel
            items={snapshot?.dead_letter_queue ?? []}
            recoveryLoadingRunId={recoveryLoadingRunId}
            onRecover={requestRunRecovery}
          />

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
                <ControlLink href="/admin/agents/swarm-board" label="Client Swarm Board" />
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

function DailyBriefPanel({ brief, loading }: { brief: MissionSnapshot['daily_brief'] | null; loading: boolean }) {
  return (
    <section className="mt-5 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-radiant-gold">
            <Sparkles size={18} />
            <h2 className="font-semibold">Daily Operating Brief</h2>
          </div>
          <p className="mt-2 text-lg font-semibold">
            {brief?.headline ?? (loading ? 'Loading today’s agent brief...' : 'Run a standup to create today’s operating brief')}
          </p>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
            {brief?.synthesis ?? 'Mission Control will summarize standups, blockers, approvals, cost, and next actions here.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <span className="rounded-full border border-silicon-slate/60 bg-black/10 px-2.5 py-1 text-xs text-muted-foreground">
            {brief?.generated_from === 'standup' ? 'From latest standup' : 'From current traces'}
          </span>
          {brief?.run_id ? (
            <Link href={`/admin/agents/runs/${brief.run_id}`} className="rounded-full border border-radiant-gold/50 bg-radiant-gold/10 px-2.5 py-1 text-xs text-radiant-gold hover:bg-radiant-gold/15">
              Open brief trace
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-wrap gap-2">
          {(brief?.signals ?? ['0 active run(s)', '0 failed or stale run(s)', '0 pending approval(s)']).map((signal) => (
            <span key={signal} className="rounded-full border border-silicon-slate/50 bg-black/10 px-2.5 py-1 text-xs text-muted-foreground">
              {signal}
            </span>
          ))}
        </div>
        <div className="space-y-1">
          {(brief?.next_actions ?? ['Run War Room standup.']).slice(0, 3).map((action) => (
            <p key={action} className="text-sm text-muted-foreground">
              {action}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}

function CostSummaryPanel({ summary }: { summary: MissionSnapshot['cost_summary'] | null }) {
  if (!summary || summary.total <= 0 || summary.event_count === 0) return null

  const topRuntime = summary.by_runtime[0]
  const topAgent = summary.by_agent[0]
  const topWorkflow = summary.by_workflow[0]
  const topClientProject = summary.by_client_project[0]
  const topArtifactType = summary.by_artifact_type[0]
  const linkedPercent = summary.event_count
    ? Math.round((summary.linked_event_count / summary.event_count) * 100)
    : 0

  return (
    <section className="mt-5 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-radiant-gold">
          <CircleDollarSign size={18} />
          <h2 className="font-semibold">Cost Intelligence</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <CostChip label={`${summary.window_hours}h total`} value={`$${summary.total.toFixed(4)}`} />
          <CostChip label="Linked traces" value={`${linkedPercent}%`} />
          {summary.unlinked_event_count ? <CostChip label="Unlinked events" value={summary.unlinked_event_count} /> : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-5">
        <CostSummaryCard title="Runtime" group={topRuntime} />
        <CostSummaryCard title="Agent" group={topAgent} />
        <CostSummaryCard title="Workflow" group={topWorkflow} />
        <CostSummaryCard title="Client / Project" group={topClientProject} />
        <CostSummaryCard title="Artifact" group={topArtifactType} />
      </div>
    </section>
  )
}

function CostChip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="rounded-full border border-silicon-slate/50 bg-black/10 px-2.5 py-1">
      {label}: <span className="text-foreground">{value}</span>
    </span>
  )
}

function CostSummaryCard({ title, group }: { title: string; group: CostSummaryGroup | undefined }) {
  return (
    <div className="rounded-lg border border-silicon-slate/50 bg-black/10 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-2 truncate text-sm font-medium">{group?.label ?? 'No signal'}</p>
      <p className="mt-1 text-lg font-semibold">{group ? `$${group.amount.toFixed(4)}` : '$0.0000'}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {group ? `${group.event_count} event(s), ${group.run_count} run(s)` : 'No linked cost events'}
      </p>
    </div>
  )
}

function OperatingSignalsPanel({ signals }: { signals: MissionSnapshot['operating_signals'] }) {
  if (!signals.length) return null

  return (
    <section className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
      {signals.map((signal) => {
        const isHealthy = signal.status === 'completed' || signal.signal.toLowerCase().includes('success')
        return (
          <Link
            key={`${signal.kind}-${signal.run_id}`}
            href={signal.href}
            className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4 hover:border-radiant-gold/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-radiant-gold">
                  {isHealthy ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  <h2 className="font-semibold">{signal.title}</h2>
                </div>
                <p className="mt-2 text-lg font-semibold">{signal.signal}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{signal.summary}</p>
              </div>
              <span className="shrink-0 rounded-full border border-silicon-slate/50 bg-black/10 px-2.5 py-1 text-xs text-muted-foreground">
                {formatTime(signal.updated_at)}
              </span>
            </div>
            {signal.details.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {signal.details.slice(0, 3).map((detail) => (
                  <span key={detail} className="rounded-full border border-silicon-slate/50 bg-black/10 px-2.5 py-1 text-xs text-muted-foreground">
                    {detail}
                  </span>
                ))}
              </div>
            ) : null}
          </Link>
        )
      })}
    </section>
  )
}

function KnowledgeGovernancePanel({ governance }: { governance: MissionSnapshot['knowledge_governance'] | null }) {
  if (!governance) return null
  const statusTone = governance.validation.ok ? 'text-emerald-200' : 'text-red-200'
  const namespaces = Object.entries(governance.manifest.countsByNamespace)
    .filter(([, count]) => count > 0)
    .map(([namespace, count]) => `${namespace}: ${count}`)

  return (
    <section className="mt-5 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-radiant-gold">
            <ShieldCheck size={18} />
            <h2 className="font-semibold">RAG Knowledge Governance</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {governance.targetIndex} is staged in {governance.mode.replace(/_/g, ' ')}; {governance.legacyIndex} remains legacy read-only.
          </p>
        </div>
        <Link href="/api/admin/rag-health" className="rounded-full border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-1.5 text-xs text-radiant-gold hover:bg-radiant-gold/15">
          RAG health
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={<ClipboardList size={16} />} label="Sources" value={governance.manifest.sourceCount} />
        <MetricCard icon={<CheckCircle2 size={16} />} label="Approved" value={governance.manifest.approvedSourceCount} />
        <MetricCard icon={<AlertTriangle size={16} />} label="Violations" value={governance.validation.errors.length + governance.validation.publicUnsafeApprovedCount} tone={governance.validation.ok ? 'default' : 'red'} />
        <MetricCard icon={<ShieldCheck size={16} />} label="Status" value={governance.validation.ok ? 'Ready' : 'Blocked'} />
      </div>
      <div className="mt-3 rounded-lg border border-silicon-slate/50 bg-black/10 p-3 text-sm">
        <p className={`font-medium ${statusTone}`}>
          {governance.validation.ok ? 'Manifest validation is clean.' : governance.validation.errors[0]}
        </p>
        <p className="mt-1 text-muted-foreground">
          {namespaces.length ? namespaces.join(' | ') : 'No manifest namespaces populated yet.'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Approval gate: {governance.approvalGate.replace(/_/g, ' ')}
        </p>
      </div>
    </section>
  )
}

function AgentEngagementRecommendations({
  recommendations,
  loadingKey,
  onLaunch,
}: {
  recommendations: ChiefReply['agent_engagements']
  loadingKey: string | null
  onLaunch: (agent: ChiefReply['agent_engagements'][number]) => void
}) {
  if (!recommendations.length) return null

  return (
    <div className="mt-3 grid grid-cols-1 gap-2">
      {recommendations.slice(0, 4).map((agent) => (
        <div key={`${agent.agentKey}-${agent.label}`} className="rounded-lg border border-radiant-gold/20 bg-radiant-gold/5 p-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{agent.agentName}</p>
                <span className="rounded-full border border-silicon-slate/50 bg-black/10 px-2 py-0.5 text-xs text-muted-foreground">
                  {agent.executionMode.replace(/_/g, ' ')}
                </span>
                <span className="rounded-full border border-silicon-slate/50 bg-black/10 px-2 py-0.5 text-xs text-muted-foreground">
                  {agent.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{agent.rationale}</p>
            </div>
            <button
              type="button"
              onClick={() => onLaunch(agent)}
              disabled={loadingKey === agent.agentKey}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-60"
            >
              {loadingKey === agent.agentKey ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Run read-only
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function EngagementQueuePanel({ items }: { items: MissionSnapshot['engagement_queue'] }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [agentFilter, setAgentFilter] = useState('all')
  const [runtimeFilter, setRuntimeFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState('all')

  const statusOptions = useMemo(() => uniqueQueueValues(items.map((item) => item.status)), [items])
  const agentOptions = useMemo(() => {
    const byKey = new Map(items.map((item) => [item.agent_key, item.agent_name]))
    return Array.from(byKey.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [items])
  const runtimeOptions = useMemo(() => uniqueQueueValues(items.map((item) => item.runtime)), [items])
  const sourceOptions = useMemo(() => uniqueQueueValues(items.map((item) => item.source_label)), [items])
  const modeOptions = useMemo(() => uniqueQueueValues(items.map((item) => item.execution_mode)), [items])

  const filteredItems = useMemo(() => items.filter((item) => (
    (statusFilter === 'all' || item.status === statusFilter) &&
    (agentFilter === 'all' || item.agent_key === agentFilter) &&
    (runtimeFilter === 'all' || item.runtime === runtimeFilter) &&
    (sourceFilter === 'all' || item.source_label === sourceFilter) &&
    (modeFilter === 'all' || item.execution_mode === modeFilter)
  )), [agentFilter, items, modeFilter, runtimeFilter, sourceFilter, statusFilter])

  const visibleItems = filteredItems.slice(0, 6)
  const activeFilterCount = [statusFilter, agentFilter, runtimeFilter, sourceFilter, modeFilter].filter((filter) => filter !== 'all').length

  function clearFilters() {
    setStatusFilter('all')
    setAgentFilter('all')
    setRuntimeFilter('all')
    setSourceFilter('all')
    setModeFilter('all')
  }

  return (
    <section className="mt-5 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-radiant-gold">
          <ClipboardList size={18} />
          <h2 className="font-semibold">Engagement Work Queue</h2>
        </div>
        <Link href="/admin/agents/runs" className="text-xs text-radiant-gold hover:underline">
          Open run console
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-5">
        <QueueFilter label="Status" value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
        <QueueFilter label="Agent" value={agentFilter} onChange={setAgentFilter} options={agentOptions.map(([value, label]) => ({ value, label }))} />
        <QueueFilter label="Runtime" value={runtimeFilter} onChange={setRuntimeFilter} options={runtimeOptions} />
        <QueueFilter label="Source" value={sourceFilter} onChange={setSourceFilter} options={sourceOptions} />
        <QueueFilter label="Mode" value={modeFilter} onChange={setModeFilter} options={modeOptions} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Showing {visibleItems.length} of {filteredItems.length} filtered request(s), {items.length} total.
        </span>
        {activeFilterCount ? (
          <button type="button" onClick={clearFilters} className="text-radiant-gold hover:underline">
            Clear {activeFilterCount} filter(s)
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
        {visibleItems.length ? visibleItems.map((item) => (
          <Link
            key={item.run_id}
            href={`/admin/agents/runs/${item.run_id}`}
            className="rounded-lg border border-silicon-slate/50 bg-black/10 p-3 text-sm hover:border-radiant-gold/50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{item.agent_name}</span>
              <span className="rounded-full border border-silicon-slate/50 bg-black/10 px-2 py-0.5 text-xs text-muted-foreground">
                {item.status.replace(/_/g, ' ')}
              </span>
              <span className="rounded-full border border-silicon-slate/50 bg-black/10 px-2 py-0.5 text-xs text-muted-foreground">
                {item.runtime}
              </span>
              <span className="rounded-full border border-silicon-slate/50 bg-black/10 px-2 py-0.5 text-xs text-muted-foreground">
                {item.execution_mode.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <QueueDetail label="Owner" value={item.owner_label} />
              <QueueDetail label="Source" value={item.source_label} />
              <QueueDetail label="Pod" value={item.pod} />
              <QueueDetail label="Requested" value={formatTime(item.started_at)} />
            </div>
            <p className="mt-3 line-clamp-2 text-muted-foreground">
              <span className="font-medium text-foreground/80">Next action: </span>
              {item.next_action ?? item.current_step ?? 'Engagement request is queued for review.'}
            </p>
            {item.source_run_id ? (
              <p className="mt-2 text-xs text-radiant-gold">Source trace linked</p>
            ) : null}
          </Link>
        )) : items.length ? (
          <p className="rounded-lg border border-silicon-slate/50 bg-black/10 p-3 text-sm text-muted-foreground">
            No engagement requests match the current filters.
          </p>
        ) : (
          <p className="rounded-lg border border-silicon-slate/50 bg-black/10 p-3 text-sm text-muted-foreground">
            No routed agent engagements yet. Use Chief of Staff recommendations, Agent Inbox routing, or Slack `/agent run`.
          </p>
        )}
      </div>
    </section>
  )
}

function DeadLetterPanel({
  items,
  recoveryLoadingRunId,
  onRecover,
}: {
  items: MissionSnapshot['dead_letter_queue']
  recoveryLoadingRunId: string | null
  onRecover: (item: MissionSnapshot['dead_letter_queue'][number]) => void
}) {
  if (!items.length) return null

  return (
    <section className="mt-5 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-radiant-gold">
          <AlertTriangle size={18} />
          <h2 className="font-semibold">Dead-Letter Monitor</h2>
        </div>
        <Link href="/admin/agents/runs" className="text-xs text-radiant-gold hover:underline">
          Open failed runs
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Failed and stale traces stay here until they have a routed engagement or are resolved. This is derived from Agent Ops traces, not a separate queue table.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.run_id}
            className="rounded-lg border border-silicon-slate/50 bg-black/10 p-3 text-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{item.title}</span>
              <span className={`rounded-full border px-2 py-0.5 text-xs ${item.routed ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200' : 'border-red-400/40 bg-red-500/10 text-red-200'}`}>
                {item.routed
                  ? item.recovery_backoff_active
                    ? 'recovery waiting'
                    : item.routed_kind === 'agent_recovery_request'
                      ? 'recovery routed'
                      : 'routed'
                  : 'unrouted'}
              </span>
              <span className="rounded-full border border-silicon-slate/50 bg-black/10 px-2 py-0.5 text-xs text-muted-foreground">
                {item.status}
              </span>
              <span className="rounded-full border border-silicon-slate/50 bg-black/10 px-2 py-0.5 text-xs text-muted-foreground">
                {item.runtime}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <QueueDetail label="Owner" value={item.agent_name} />
              <QueueDetail label="Source" value={item.source_label} />
              <QueueDetail label="Pod" value={item.pod} />
              <QueueDetail label="Age" value={`${item.age_hours}h`} />
              {item.routed_status ? <QueueDetail label="Routed status" value={item.routed_status} /> : null}
              {item.recovery_retry_attempt ? <QueueDetail label="Retry attempt" value={String(item.recovery_retry_attempt)} /> : null}
              {item.recovery_earliest_retry_at ? <QueueDetail label="Earliest retry" value={formatTime(item.recovery_earliest_retry_at)} /> : null}
            </div>
            <p className="mt-3 line-clamp-2 text-muted-foreground">{item.reason}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                href={item.routed_run_id ? `/admin/agents/runs/${item.routed_run_id}` : item.href}
                className="inline-flex items-center gap-1 rounded-md border border-radiant-gold/40 bg-radiant-gold/10 px-2.5 py-1 text-xs text-radiant-gold hover:bg-radiant-gold/15"
              >
                {item.routed ? 'Open routed trace' : 'Open source trace'}
                <ArrowRight size={12} />
              </Link>
              {!item.routed ? (
                <button
                  type="button"
                  onClick={() => onRecover(item)}
                  disabled={recoveryLoadingRunId === item.run_id}
                  className="inline-flex items-center gap-1 rounded-md border border-silicon-slate/60 bg-background/50 px-2.5 py-1 text-xs hover:border-radiant-gold/50 disabled:opacity-60"
                >
                  <RefreshCw size={12} className={recoveryLoadingRunId === item.run_id ? 'animate-spin' : ''} />
                  Request retry
                </button>
              ) : null}
              <span className="text-xs text-muted-foreground">{item.next_action}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function uniqueQueueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b))
}

function QueueFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<string | { value: string; label: string }>
}) {
  return (
    <label className="text-xs text-muted-foreground">
      <span className="mb-1 block font-medium text-foreground/80">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-silicon-slate/70 bg-background/70 px-2 text-sm outline-none focus:border-radiant-gold/70"
      >
        <option value="all">All {label.toLowerCase()}</option>
        {options.map((option) => {
          const optionValue = typeof option === 'string' ? option : option.value
          const optionLabel = typeof option === 'string' ? option : option.label
          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel.replace(/_/g, ' ')}
            </option>
          )
        })}
      </select>
    </label>
  )
}

function QueueDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-medium text-foreground/80">{label}</p>
      <p className="mt-0.5 truncate">{value.replace(/_/g, ' ')}</p>
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

function InboxRow({
  item,
  routing,
  onRoute,
}: {
  item: MissionSnapshot['agent_inbox'][number]
  routing: boolean
  onRoute: () => void
}) {
  return (
    <div className="rounded-lg border border-silicon-slate/50 bg-black/10 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityPill priority={item.priority} />
            <span className="text-xs text-muted-foreground">{item.agent_name}</span>
          </div>
          <p className="mt-2 font-medium">{item.title}</p>
          <p className="mt-1 line-clamp-2 text-muted-foreground">{item.reason}</p>
          <p className="mt-2 text-xs text-muted-foreground">{item.pod}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={onRoute}
            disabled={routing}
            className="inline-flex items-center gap-1 rounded-md border border-radiant-gold/50 bg-radiant-gold/10 px-2 py-1 text-xs text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-60"
          >
            {routing ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Route
          </button>
          <Link href={item.href} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-radiant-gold">
            {item.action_label}
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}

function PriorityPill({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  const className =
    priority === 'high'
      ? 'border-red-400/40 bg-red-500/10 text-red-200'
      : priority === 'medium'
        ? 'border-yellow-400/40 bg-yellow-500/10 text-yellow-200'
        : 'border-silicon-slate/60 bg-black/20 text-muted-foreground'

  return <span className={`rounded-full border px-2 py-0.5 text-xs ${className}`}>{priority}</span>
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
