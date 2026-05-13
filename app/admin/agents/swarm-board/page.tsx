'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Bot,
  Columns,
  GitPullRequest,
  LayoutDashboard,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import type {
  AgentOrgBoardActivity,
  AgentOrgBoardAgent,
  AgentOrgBoardLane,
  AgentOrgBoardSnapshot,
  AgentOrgBoardTask,
  AgentSwarmBoardSnapshot,
  SwarmBoardCard,
} from '@/lib/agent-swarm-board'

type BoardSnapshot = AgentSwarmBoardSnapshot & {
  ok?: boolean
  organization?: AgentOrgBoardSnapshot
}

type BoardMode = 'kanban' | 'hive' | 'agents' | 'war-room' | 'client-builder'

const MODES: Array<{ key: BoardMode; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'kanban', label: 'Kanban lanes', icon: LayoutDashboard },
  { key: 'hive', label: 'Activity board', icon: Activity },
  { key: 'agents', label: 'Agent roster', icon: Users },
  { key: 'war-room', label: 'War room board', icon: MessageSquare },
  { key: 'client-builder', label: 'Client builder board', icon: Columns },
]

export default function AgentSwarmBoardPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AgentSwarmBoardContent />
    </ProtectedRoute>
  )
}

function AgentSwarmBoardContent() {
  const [snapshot, setSnapshot] = useState<BoardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<BoardMode>('kanban')
  const [activityFilter, setActivityFilter] = useState('all')

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
      setError(err instanceof Error ? err.message : 'Failed to load agent organization board')
      setSnapshot(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBoard()
  }, [fetchBoard])

  const organization = snapshot?.organization
  const filteredActivity = useMemo(() => {
    const rows = organization?.activity ?? []
    if (activityFilter === 'all') return rows
    return rows.filter((row) => row.podKey === activityFilter || row.agentKey === activityFilter)
  }, [activityFilter, organization?.activity])

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-8">
      <div className="mx-auto max-w-[1680px]">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Agent Operations', href: '/admin/agents' },
          { label: 'Agent Kanban' },
        ]} />

        <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 text-sm text-radiant-gold">
              <Bot size={16} />
              ATAS Agent Ops drilldown
            </div>
            <h1 className="text-3xl font-bold">Agent Kanban</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Agent Org Board work lanes for ownership, blockers, validation, traces, and pull requests across the Portfolio agent team.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/agents"
              className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 py-2 text-sm hover:border-radiant-gold/60"
            >
              <ShieldCheck size={16} />
              Agent Ops
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
        </header>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading agent organization board...</div>
        ) : error ? (
          <FailureState message={error} />
        ) : snapshot && organization ? (
          <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/15 p-3">
              <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Board views</p>
              <div className="space-y-1" role="tablist" aria-label="Agent board views">
                {MODES.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.key}
                      onClick={() => setMode(item.key)}
                      role="tab"
                      aria-selected={mode === item.key}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                        mode === item.key
                          ? 'bg-radiant-gold/15 text-radiant-gold'
                          : 'text-muted-foreground hover:bg-silicon-slate/30 hover:text-foreground'
                      }`}
                    >
                      <Icon size={16} />
                      {item.label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-3 px-2 text-xs leading-relaxed text-muted-foreground">
                Kanban lanes are the default work drilldown. Other views summarize the same org snapshot from different board angles.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <RailMetric label="Live" value={organization.summary.live_agents} />
                <RailMetric label="Active" value={organization.summary.active_work_items} />
                <RailMetric label="Blocked" value={organization.summary.blocked_work_items} />
                <RailMetric label="Merge" value={organization.summary.ready_for_merge} />
              </div>
            </aside>

            <main className="min-w-0">
              {mode === 'kanban' && <KanbanBoard organization={organization} />}
              {mode === 'hive' && (
                <HiveMind
                  organization={organization}
                  rows={filteredActivity}
                  activityFilter={activityFilter}
                  onFilterChange={setActivityFilter}
                />
              )}
              {mode === 'agents' && <AgentsGrid agents={organization.agents} />}
              {mode === 'war-room' && <WarRoom organization={organization} />}
              {mode === 'client-builder' && <ClientBuilderBoard snapshot={snapshot} />}
            </main>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function KanbanBoard({ organization }: { organization: AgentOrgBoardSnapshot }) {
  return (
    <div className="space-y-4" role="tabpanel" aria-label="Kanban lanes">
      <SummaryStrip organization={organization} />
      <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/15 p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Agent Org Board</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Work-lane Kanban organized by agent ownership. Use each card to inspect the trace, PR, owner, blocker, validation, and current status before handoff or merge review.
            </p>
          </div>
          <Badge label="default Kanban view" />
        </div>
      </section>
      <div className="grid gap-3 xl:grid-cols-4">
        {organization.lanes.map((lane) => (
          <TaskLane key={lane.key} lane={lane} />
        ))}
      </div>
    </div>
  )
}

function SummaryStrip({ organization }: { organization: AgentOrgBoardSnapshot }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      <MetricCard label="Agents" value={organization.summary.agents} />
      <MetricCard label="Live" value={organization.summary.live_agents} tone="green" />
      <MetricCard label="Work items" value={organization.summary.active_work_items} />
      <MetricCard label="Unassigned" value={organization.summary.unassigned_work_items} tone={organization.summary.unassigned_work_items ? 'yellow' : 'slate'} />
      <MetricCard label="Blocked" value={organization.summary.blocked_work_items} tone={organization.summary.blocked_work_items ? 'red' : 'slate'} />
      <MetricCard label="Ready merge" value={organization.summary.ready_for_merge} tone={organization.summary.ready_for_merge ? 'yellow' : 'slate'} />
      <MetricCard label="Approvals" value={organization.summary.pending_approvals} tone={organization.summary.pending_approvals ? 'yellow' : 'slate'} />
    </div>
  )
}

function TaskLane({ lane }: { lane: AgentOrgBoardLane }) {
  return (
    <section className="min-h-[420px] rounded-lg border border-silicon-slate/70 bg-silicon-slate/15" aria-label={`${lane.label} lane`}>
      <div className="border-b border-silicon-slate/60 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words font-semibold" title={lane.label}>{lane.label}</h2>
            <p className="mt-1 break-words text-xs text-muted-foreground" title={lane.agentName}>{lane.agentName}</p>
          </div>
          <span className="rounded-full border border-silicon-slate/70 px-2 py-1 text-xs text-muted-foreground">
            {lane.tasks.length}
          </span>
        </div>
      </div>
      <div className="space-y-3 p-3">
        {lane.tasks.length ? (
          lane.tasks.map((task) => <WorkItemCard key={task.id} task={task} />)
        ) : (
          <p className="rounded-lg border border-dashed border-silicon-slate/60 px-3 py-8 text-center text-sm text-muted-foreground">
            No active tasks in this lane
          </p>
        )}
      </div>
    </section>
  )
}

function WorkItemCard({ task }: { task: AgentOrgBoardTask }) {
  return (
    <article className="rounded-lg border border-silicon-slate/70 bg-background/70 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold" title={task.title}>{task.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">Status:</span> {task.status.replace(/_/g, ' ')}
          </p>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs ${priorityClass(task.priority)}`}>{task.priority}</span>
      </div>
      {task.objective && <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{task.objective}</p>}
      <dl className="grid gap-2 text-xs">
        <CardDetail label="Trace" value={task.activeRunId ?? 'No active trace'} />
        <CardDetail label="Owner" value={task.ownerAgentName} />
        {task.ownerRuntime && <CardDetail label="Runtime" value={task.ownerRuntime} />}
        {task.branchName && <CardDetail label="Branch" value={task.branchName} />}
        {task.overlapGroup && <CardDetail label="Overlap" value={task.overlapGroup} />}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {task.branchName && <Badge label={task.branchName} />}
        {task.ownerRuntime && <Badge label={task.ownerRuntime} />}
      </div>
      {task.blockerSummary && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
          <span className="font-semibold">Blocker:</span> {task.blockerSummary}
        </p>
      )}
      {task.validationSummary && (
        <p className="mt-3 rounded-lg border border-green-500/30 bg-green-500/10 p-2 text-xs text-green-200">
          <span className="font-semibold">Validation:</span> {task.validationSummary}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{formatRelative(task.updatedAt)}</span>
        {task.prUrl ? (
          <a
            href={task.prUrl}
            aria-label={`Open pull request ${task.prNumber ?? ''} for ${task.title}`.trim()}
            className="inline-flex items-center gap-1 text-radiant-gold hover:underline"
          >
            <GitPullRequest size={13} />
            PR {task.prNumber}
          </a>
        ) : (
          <span>PR: none</span>
        )}
        {task.activeRunId ? (
          <a
            href={`/admin/agents/runs/${task.activeRunId}`}
            aria-label={`Open trace ${task.activeRunId} for ${task.title}`}
            className="inline-flex items-center gap-1 text-radiant-gold hover:underline"
          >
            Trace
          </a>
        ) : null}
      </div>
    </article>
  )
}

function CardDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-2 rounded-lg border border-silicon-slate/60 bg-silicon-slate/10 px-2 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground/85" title={value}>{value}</dd>
    </div>
  )
}

function HiveMind({
  organization,
  rows,
  activityFilter,
  onFilterChange,
}: {
  organization: AgentOrgBoardSnapshot
  rows: AgentOrgBoardActivity[]
  activityFilter: string
  onFilterChange: (value: string) => void
}) {
  const filters = [
    { key: 'all', label: 'All' },
    ...Array.from(new Map(organization.agents.map((agent) => [agent.podKey, agent.podName])).entries()).map(([key, label]) => ({ key, label: label.replace(/ Pod$/, '') })),
  ]

  return (
    <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/15">
      <div className="flex flex-col gap-3 border-b border-silicon-slate/60 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Hive Mind</h2>
          <p className="mt-1 text-sm text-muted-foreground">{organization.summary.activity_entries} entries across the shared Agent Ops trace.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => onFilterChange(filter.key)}
              aria-pressed={activityFilter === filter.key}
              className={`rounded-lg border px-3 py-2 text-sm ${
                activityFilter === filter.key
                  ? 'border-radiant-gold/60 bg-radiant-gold/15 text-radiant-gold'
                  : 'border-silicon-slate/70 bg-background/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-silicon-slate/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Summary</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr key={row.id} className="border-b border-silicon-slate/40">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatRelative(row.occurredAt)}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-radiant-gold" />
                    {row.agentName}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.action}</td>
                <td className="px-4 py-3">
                  <span className="line-clamp-2">{row.summary}</span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No activity matches this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function AgentsGrid({ agents }: { agents: AgentOrgBoardAgent[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {agents.map((agent) => (
        <article key={agent.key} className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/15 p-4">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-radiant-gold/30 bg-radiant-gold/10 text-radiant-gold">
              <Bot size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate font-semibold" title={agent.name}>{agent.name}</h2>
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${agent.live ? 'bg-green-400' : 'bg-silicon-slate'}`} />
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{agent.podName}</p>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge label={agent.runtime} />
            <Badge label={agent.status} />
            <Badge label={agent.live ? 'running' : 'idle'} />
          </div>
          <div className="mb-4 rounded-lg border border-silicon-slate/60 bg-background/50 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Today turns</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{agent.todayTurns}</p>
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground">{agent.latestAction}</p>
          <div className="mt-4">
            {agent.latestRunId ? (
              <Link
                href={`/admin/agents/runs/${agent.latestRunId}`}
                aria-label={`Open latest trace for ${agent.name}`}
                className="inline-flex items-center gap-2 text-sm text-radiant-gold hover:underline"
              >
                Open latest trace
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground">No trace yet</span>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}

function WarRoom({ organization }: { organization: AgentOrgBoardSnapshot }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-3">
        {organization.warRoom.roster.map((agent) => (
          <article key={agent.key} className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/15 p-4">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-silicon-slate/70 bg-background/60">
                <Bot size={18} />
              </div>
              <div>
                <p className="font-semibold" title={agent.name}>{agent.name}</p>
                <p className="text-xs text-muted-foreground">{agent.podName}</p>
              </div>
            </div>
            <p className="line-clamp-2 text-xs text-muted-foreground">{agent.latestAction}</p>
          </article>
        ))}
      </aside>
      <section className="flex min-h-[640px] flex-col rounded-lg border border-silicon-slate/70 bg-silicon-slate/15">
        <div className="flex items-center justify-between border-b border-silicon-slate/60 p-4">
          <div>
            <h2 className="text-xl font-semibold">War Room</h2>
            <p className="text-sm text-muted-foreground">Coordinate through Agent Ops records and Slack commands.</p>
          </div>
          <Badge label="text mode" />
        </div>
        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <div>
            <Sparkles className="mx-auto mb-4 text-radiant-gold" size={28} />
            <h3 className="text-lg font-semibold">Start with a specific question.</h3>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">{organization.warRoom.suggestedPrompt}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {organization.warRoom.commands.map((command) => <Badge key={command} label={command} />)}
            </div>
          </div>
        </div>
        <div className="border-t border-silicon-slate/60 p-4">
          <div className="flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-background/60 px-3 py-3 text-sm text-muted-foreground">
            Message the team from Slack with /agent captain, /agent work, or /agent blockers.
          </div>
        </div>
      </section>
    </div>
  )
}

function ClientBuilderBoard({ snapshot }: { snapshot: AgentSwarmBoardSnapshot }) {
  const cards = snapshot.columns.flatMap((column) => column.cards)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Clients" value={snapshot.summary.clients} />
        <MetricCard label="Active" value={snapshot.summary.active} />
        <MetricCard label="Failed/stale" value={snapshot.summary.failed_or_stale} tone={snapshot.summary.failed_or_stale ? 'red' : 'slate'} />
        <MetricCard label="Approvals" value={snapshot.summary.pending_approvals} tone={snapshot.summary.pending_approvals ? 'yellow' : 'slate'} />
        <MetricCard label="Isolation gaps" value={snapshot.summary.isolation_failures} tone={snapshot.summary.isolation_failures ? 'red' : 'slate'} />
        <MetricCard label="Autonomous" value={snapshot.summary.autonomous_ready} tone="green" />
      </div>
      <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/15 p-4">
        <div className="mb-4 flex items-center gap-2">
          <Columns size={18} className="text-radiant-gold" />
          <div>
            <h2 className="font-semibold">Client AI Agent Org Builder</h2>
            <p className="text-sm text-muted-foreground">Client roadmap and provisioning work projected into the same board language.</p>
          </div>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {cards.length ? cards.map((card) => <ClientSwarmCard key={card.id} card={card} />) : (
            <p className="rounded-lg border border-dashed border-silicon-slate/60 px-3 py-10 text-center text-sm text-muted-foreground">No client AI builder work is active.</p>
          )}
        </div>
      </section>
    </div>
  )
}

function ClientSwarmCard({ card }: { card: SwarmBoardCard }) {
  return (
    <article className="rounded-lg border border-silicon-slate/70 bg-background/70 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold" title={card.projectName}>{card.projectName}</h3>
          <p className="mt-1 truncate text-xs text-muted-foreground" title={card.clientName}>{card.clientName}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs ${priorityClass(card.priority)}`}>{card.priority}</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <Badge label={card.currentAgentLabel} />
        <Badge label={card.statusLabel} />
        <Badge label={card.isolationStatus.replace(/_/g, ' ')} />
      </div>
      <p className="mb-3 rounded-lg border border-silicon-slate/60 bg-silicon-slate/15 p-3 text-sm">{card.nextAction}</p>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <MiniMetric label="Active" value={card.activeRuns} />
        <MiniMetric label="Failed" value={card.failedOrStaleRuns} />
        <MiniMetric label="Approvals" value={card.pendingApprovals} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 break-words">{card.connectorSummary}</span>
        <Link
          href={card.latestRunId ? `/admin/agents/runs/${card.latestRunId}` : card.href}
          aria-label={card.latestRunId ? `Open latest trace for ${card.projectName}` : `Open client project ${card.projectName}`}
          className="shrink-0 text-radiant-gold hover:underline"
        >
          {card.latestRunId ? 'Open trace' : 'Open project'}
        </Link>
      </div>
    </article>
  )
}

function RailMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-background/50 p-2">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
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
    <span
      title={label}
      className="inline-block max-w-full truncate rounded-full border border-silicon-slate/70 bg-silicon-slate/20 px-2 py-1 text-xs text-muted-foreground"
    >
      {label}
    </span>
  )
}

function FailureState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-red-200">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <AlertTriangle size={18} />
        Failed to load Agent Org Board
      </div>
      <p className="text-sm text-red-100/80">{message}</p>
    </div>
  )
}

function priorityClass(priority: SwarmBoardCard['priority'] | AgentOrgBoardTask['priority']) {
  if (priority === 'urgent' || priority === 'high') return 'bg-red-500/15 text-red-300 border border-red-500/30'
  if (priority === 'medium') return 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30'
  return 'bg-green-500/15 text-green-300 border border-green-500/30'
}

function formatRelative(value: string) {
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return value
  const delta = Date.now() - time
  const minutes = Math.max(0, Math.round(delta / 60000))
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}
