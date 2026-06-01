'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Bot,
  Columns,
  ExternalLink,
  Filter,
  GitPullRequest,
  LayoutDashboard,
  MessageSquare,
  Network,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Users,
  Workflow,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import AgentAvatar from '@/components/admin/AgentAvatar'
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
type AttentionFilter = 'all' | 'blocked' | 'review' | 'unassigned'
type DependencyFilter = 'all' | 'waiting' | 'blocking' | 'handoffs'
type BoardAction = {
  task: AgentOrgBoardTask
  lane: Pick<AgentOrgBoardLane, 'key' | 'label' | 'tasks'>
  nextAction: ReturnType<typeof nextActionForTask>
}
type StatusSwimlane = {
  key: 'todo' | 'in_progress' | 'blocked' | 'complete'
  label: string
  description: string
  statuses: AgentOrgBoardTask['status'][]
  tasks: AgentOrgBoardTask[]
}

const STATUS_SWIMLANES: Array<Omit<StatusSwimlane, 'tasks'>> = [
  {
    key: 'todo',
    label: 'To Do',
    description: 'Queued, proposed, or assigned work that has not started.',
    statuses: ['proposed', 'queued', 'assigned'],
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    description: 'Active work, validation, and review-ready cards moving toward handoff.',
    statuses: ['in_progress', 'ready_for_review', 'ready_for_merge'],
  },
  {
    key: 'blocked',
    label: 'Blocked',
    description: 'Work that needs an owner decision, recovery action, or blocker removal.',
    statuses: ['blocked'],
  },
  {
    key: 'complete',
    label: 'Complete',
    description: 'Merged, deployed, or cancelled work retained when present in the board snapshot.',
    statuses: ['merged', 'deployed', 'cancelled'],
  },
]

const MODES: Array<{ key: BoardMode; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'kanban', label: 'Kanban lanes', icon: LayoutDashboard },
  { key: 'hive', label: 'Activity board', icon: Activity },
  { key: 'agents', label: 'Agent roster', icon: Users },
  { key: 'war-room', label: 'War room board', icon: MessageSquare },
  { key: 'client-builder', label: 'Client builder board', icon: Columns },
]

const STATUS_FILTERS: Array<'all' | AgentOrgBoardTask['status']> = [
  'all',
  'proposed',
  'queued',
  'assigned',
  'in_progress',
  'blocked',
  'ready_for_review',
  'ready_for_merge',
]

const ATTENTION_FILTERS: Array<{ key: AttentionFilter; label: string }> = [
  { key: 'all', label: 'All work' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'review', label: 'Review ready' },
  { key: 'unassigned', label: 'Unassigned' },
]

const DEPENDENCY_FILTERS: Array<{ key: DependencyFilter; label: string }> = [
  { key: 'all', label: 'All dependencies' },
  { key: 'waiting', label: 'Waiting on upstream' },
  { key: 'blocking', label: 'Blocking downstream' },
  { key: 'handoffs', label: 'Handoffs pending' },
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
  const [selectedGoalId, setSelectedGoalId] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | AgentOrgBoardTask['status']>('all')
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>('all')
  const [dependencyFilter, setDependencyFilter] = useState<DependencyFilter>('all')

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
    window.scrollTo({ top: 0, left: 0 })
    const params = new URLSearchParams(window.location.search)
    const goalId = params.get('goal')
    if (goalId) setSelectedGoalId(goalId)
    fetchBoard()
  }, [fetchBoard])

  const organization = snapshot?.organization
  const filteredActivity = useMemo(() => {
    const rows = organization?.activity ?? []
    if (activityFilter === 'all') return rows
    return rows.filter((row) => row.podKey === activityFilter || row.agentKey === activityFilter)
  }, [activityFilter, organization?.activity])

  return (
    <div className="agent-ops-page min-h-screen p-5 text-foreground lg:p-7">
      <div className="mx-auto max-w-[1680px]">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Agent Operations', href: '/admin/agents' },
          { label: 'Agent Kanban' },
        ]} />

        <header className="agent-ops-surface-header mb-5 mt-5 flex flex-col gap-4 rounded-xl border p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="agent-ops-eyebrow mb-2">
              <Bot size={16} />
              ATAS Agent Ops drilldown
            </div>
            <h1 className="text-3xl font-bold">Agent Kanban</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Work by status swimlane with owner badges on each card. This is the drilldown for standup output, active work, trace links, validation, and pull requests across the Portfolio agent team.
            </p>
          </div>
          <div className="agent-ops-header-actions">
            <Link
              href="/admin/agents"
              className="agent-ops-button-muted"
            >
              <ShieldCheck size={16} />
              Agent Ops
            </Link>
            <button
              onClick={fetchBoard}
              disabled={loading}
              className="agent-ops-button-secondary disabled:opacity-60"
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
            <aside className="agent-ops-card rounded-lg border p-3">
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
                Kanban lanes are the default work drilldown. Alternate views summarize the same org snapshot without replacing the primary lane model.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <RailMetric label="Live" value={organization.summary.live_agents} />
                <RailMetric label="Active" value={organization.summary.active_work_items} />
                <RailMetric label="Blocked" value={organization.summary.blocked_work_items} />
                <RailMetric label="Merge" value={organization.summary.ready_for_merge} />
              </div>
            </aside>

            <main className="min-w-0">
              {mode === 'kanban' && (
                <KanbanBoard
                  organization={organization}
                  selectedGoalId={selectedGoalId}
                  ownerFilter={ownerFilter}
                  statusFilter={statusFilter}
                  attentionFilter={attentionFilter}
                  dependencyFilter={dependencyFilter}
                  onGoalChange={setSelectedGoalId}
                  onOwnerChange={setOwnerFilter}
                  onStatusChange={setStatusFilter}
                  onAttentionChange={setAttentionFilter}
                  onDependencyChange={setDependencyFilter}
                  onClearFilters={() => {
                    setSelectedGoalId('all')
                    setOwnerFilter('all')
                    setStatusFilter('all')
                    setAttentionFilter('all')
                    setDependencyFilter('all')
                  }}
                />
              )}
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

function KanbanBoard({
  organization,
  selectedGoalId,
  ownerFilter,
  statusFilter,
  attentionFilter,
  dependencyFilter,
  onGoalChange,
  onOwnerChange,
  onStatusChange,
  onAttentionChange,
  onDependencyChange,
  onClearFilters,
}: {
  organization: AgentOrgBoardSnapshot
  selectedGoalId: string
  ownerFilter: string
  statusFilter: 'all' | AgentOrgBoardTask['status']
  attentionFilter: AttentionFilter
  dependencyFilter: DependencyFilter
  onGoalChange: (value: string) => void
  onOwnerChange: (value: string) => void
  onStatusChange: (value: 'all' | AgentOrgBoardTask['status']) => void
  onAttentionChange: (value: AttentionFilter) => void
  onDependencyChange: (value: DependencyFilter) => void
  onClearFilters: () => void
}) {
  const [dependencyDrawerTaskId, setDependencyDrawerTaskId] = useState<string | null>(null)
  const allTasks = useMemo(() => organization.lanes.flatMap((lane) => lane.tasks), [organization.lanes])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const workItemId = params.get('work_item')
    if (workItemId && allTasks.some((task) => task.id === workItemId)) {
      setDependencyDrawerTaskId(workItemId)
    }
  }, [allTasks])
  const ownerOptions = useMemo(() => {
    const options = new Map<string, string>()
    for (const task of allTasks) {
      if (task.ownerAgentKey) options.set(task.ownerAgentKey, task.ownerAgentName)
    }
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [allTasks])
  const visibleTasks = useMemo(() => {
    return allTasks.filter((task) => {
        if (selectedGoalId !== 'all' && task.goal?.id !== selectedGoalId) return false
        if (ownerFilter !== 'all') {
          if (ownerFilter === 'unassigned') {
            if (task.ownerAgentKey) return false
          } else if (task.ownerAgentKey !== ownerFilter) {
            return false
          }
        }
        if (statusFilter !== 'all' && task.status !== statusFilter) return false
        if (attentionFilter === 'blocked' && task.status !== 'blocked') return false
        if (attentionFilter === 'review' && task.status !== 'ready_for_review' && task.status !== 'ready_for_merge') return false
        if (attentionFilter === 'unassigned' && task.ownerAgentKey) return false
        if (dependencyFilter === 'waiting' && !((task.dependencyIds ?? []).length || (task.dependencies ?? []).length)) return false
        if (dependencyFilter === 'blocking' && !(task.dependents ?? []).some((dependent) => dependent.blocking)) return false
        if (dependencyFilter === 'handoffs' && !(task.handoffs ?? []).some((handoff) => handoff.status === 'pending')) return false
        return true
    })
  }, [allTasks, attentionFilter, dependencyFilter, ownerFilter, selectedGoalId, statusFilter])
  const statusLanes = useMemo(() => {
    return STATUS_SWIMLANES.map((lane) => ({
      ...lane,
      tasks: visibleTasks
        .filter((task) => lane.statuses.includes(task.status))
        .sort(sortTasksForLane),
    }))
  }, [visibleTasks])
  const filteredTasks = visibleTasks
  const boardActions = useMemo(() => buildBoardActions(statusLanes), [statusLanes])
  const dependencyDrawerTask = allTasks.find((task) => task.id === dependencyDrawerTaskId) ?? null
  const selectedGoal = organization.summary.goals.find((goal) => goal.id === selectedGoalId) ?? null
  const filtersActive = selectedGoalId !== 'all' || ownerFilter !== 'all' || statusFilter !== 'all' || attentionFilter !== 'all' || dependencyFilter !== 'all'

  return (
    <div className="space-y-4" role="tabpanel" aria-label="Kanban lanes">
      <SummaryStrip organization={organization} />
      <BoardActionQueue actions={boardActions} filtersActive={filtersActive} totalCount={filteredTasks.length} />
      <DependencyRadiators organization={organization} onOpenFirst={() => {
        const firstDependencyTask = allTasks.find((task) => (task.dependencyIds ?? []).length || (task.dependents ?? []).length || (task.handoffs ?? []).length)
        if (firstDependencyTask) setDependencyDrawerTaskId(firstDependencyTask.id)
      }} />
      {dependencyDrawerTask ? (
        <DependencyDrawer task={dependencyDrawerTask} onClose={() => setDependencyDrawerTaskId(null)} />
      ) : null}
      <GoalRadiators
        organization={organization}
        selectedGoalId={selectedGoalId}
        onGoalChange={onGoalChange}
      />
      <HighSignalInsightsRail insights={organization.highSignalInsights ?? []} />
      <KanbanFilterPanel
        goals={organization.summary.goals}
        ownerOptions={ownerOptions}
        selectedGoalId={selectedGoalId}
        ownerFilter={ownerFilter}
        statusFilter={statusFilter}
        attentionFilter={attentionFilter}
        dependencyFilter={dependencyFilter}
        filteredCount={filteredTasks.length}
        totalCount={allTasks.length}
        onGoalChange={onGoalChange}
        onOwnerChange={onOwnerChange}
        onStatusChange={onStatusChange}
        onAttentionChange={onAttentionChange}
        onDependencyChange={onDependencyChange}
        onClearFilters={onClearFilters}
      />
      {selectedGoal ? <SelectedGoalPanel goal={selectedGoal} tasks={filteredTasks} /> : null}
      <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/15 p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Work by status, owner, and blocker</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Default Kanban uses fixed status swimlanes: To Do, In Progress, Blocked, and Complete. Owner badges on each card show who is responsible without changing the board layout.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {filtersActive ? <Badge label={`${filteredTasks.length}/${allTasks.length} visible`} /> : null}
            <Badge label="default Kanban view" />
          </div>
        </div>
      </section>
      <div className="grid items-start gap-3 xl:grid-cols-4">
        {statusLanes.map((lane) => (
          <TaskLane key={lane.key} lane={lane} onOpenDependencies={setDependencyDrawerTaskId} />
        ))}
      </div>
    </div>
  )
}

function BoardActionQueue({
  actions,
  filtersActive,
  totalCount,
}: {
  actions: BoardAction[]
  filtersActive: boolean
  totalCount: number
}) {
  return (
    <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/15 p-4" aria-label="Kanban action queue">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-radiant-gold" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-radiant-gold">Board action queue</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Start here for blocked work, review-ready cards, missing owners, and cards that need validation before handoff.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge label={filtersActive ? `${totalCount} filtered cards` : `${totalCount} visible cards`} />
          <Badge label={`${actions.length} action candidates`} />
        </div>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {actions.length ? actions.map(({ task, lane, nextAction }) => (
          <article key={task.id} className="rounded-lg border border-silicon-slate/70 bg-background/70 p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{lane.label}</p>
                <h3 className="mt-1 break-words text-sm font-semibold" title={task.title}>{task.title}</h3>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${priorityClass(task.priority)}`}>{task.priority}</span>
            </div>
            <div className={`rounded-lg border p-2 text-xs ${nextAction.tone}`}>
              <p className="font-semibold">{nextAction.label}</p>
              <p className="mt-1 text-foreground/80">{nextAction.detail}</p>
            </div>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <CardDetail label="Owner" value={task.ownerAgentName} />
              <CardDetail label="Age" value={task.completedAt ? `Cycle ${formatHours(task.createdAt, task.completedAt)}` : formatHours(task.createdAt)} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {task.goal ? (
                <Link href={task.goal.sessionHref} className="inline-flex items-center gap-1 rounded-lg border border-radiant-gold/45 px-2 py-2 text-radiant-gold hover:bg-radiant-gold/15">
                  Goal
                  <ExternalLink size={12} />
                </Link>
              ) : null}
              {task.activeRunId ? (
                <Link href={`/admin/agents/runs/${task.activeRunId}`} className="inline-flex items-center gap-1 rounded-lg border border-radiant-gold/45 px-2 py-2 text-radiant-gold hover:bg-radiant-gold/15">
                  Open trace
                  <ExternalLink size={12} />
                </Link>
              ) : null}
              {task.prUrl ? (
                <a href={task.prUrl} className="inline-flex items-center gap-1 rounded-lg border border-silicon-slate/70 px-2 py-2 text-radiant-gold hover:border-radiant-gold/45">
                  <GitPullRequest size={13} />
                  PR {task.prNumber ?? ''}
                </a>
              ) : null}
              {!task.activeRunId && !task.prUrl ? (
                <span className="rounded-lg border border-silicon-slate/60 px-2 py-2 text-muted-foreground">Evidence link pending</span>
              ) : null}
            </div>
          </article>
        )) : (
          <div className="rounded-lg border border-dashed border-silicon-slate/60 p-4 text-sm text-muted-foreground xl:col-span-3">
            No blocked, review-ready, unassigned, or validation-missing work is visible in the current scope.
          </div>
        )}
      </div>
    </section>
  )
}

function DependencyRadiators({
  organization,
  onOpenFirst,
}: {
  organization: AgentOrgBoardSnapshot
  onOpenFirst: () => void
}) {
  const metrics = organization.summary.dependencies ?? {
    waiting_on: 0,
    blocking_downstream: 0,
    pending_handoffs: 0,
    blocked_by_dependency: 0,
  }
  const totalSignals = metrics.waiting_on + metrics.blocking_downstream + metrics.pending_handoffs
  return (
    <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/15 p-4" aria-label="Dependency tracing">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Network size={16} className="text-radiant-gold" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-radiant-gold">Dependency tracing</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Shows work waiting on upstream cards, cards blocking downstream work, and open handoffs between agents.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenFirst}
          disabled={!totalSignals}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-radiant-gold/50 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15 disabled:border-silicon-slate/60 disabled:text-muted-foreground disabled:opacity-60"
        >
          Inspect dependency
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <MetricCard label="Waiting on" value={metrics.waiting_on} tone={metrics.waiting_on ? 'yellow' : 'slate'} />
        <MetricCard label="Blocking" value={metrics.blocking_downstream} tone={metrics.blocking_downstream ? 'yellow' : 'slate'} />
        <MetricCard label="Handoffs" value={metrics.pending_handoffs} tone={metrics.pending_handoffs ? 'yellow' : 'slate'} />
        <MetricCard label="Blocked by dependency" value={metrics.blocked_by_dependency} tone={metrics.blocked_by_dependency ? 'red' : 'slate'} />
      </div>
    </section>
  )
}

function DependencyDrawer({ task, onClose }: { task: AgentOrgBoardTask; onClose: () => void }) {
  const dependencies = task.dependencies ?? []
  const dependents = task.dependents ?? []
  const handoffs = task.handoffs ?? []
  const unresolvedIds = (task.dependencyIds ?? []).filter((id) => !dependencies.some((dependency) => dependency.id === id))
  return (
    <section className="rounded-lg border border-radiant-gold/45 bg-radiant-gold/10 p-4" aria-label="Dependency detail drawer">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-radiant-gold">Dependency detail</p>
          <h2 className="mt-1 text-lg font-semibold">{task.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {task.ownerAgentName} · {task.status.replace(/_/g, ' ')}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg border border-silicon-slate/70 px-3 py-2 text-sm hover:border-radiant-gold/60">
          Close
        </button>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <DependencyColumn
          title="Waiting on"
          empty="No resolved upstream dependencies."
          items={dependencies.map((dependency) => ({
            id: dependency.id,
            title: dependency.title,
            detail: `${dependency.ownerAgentName} · ${dependency.status.replace(/_/g, ' ')}`,
            href: dependency.href,
            tone: dependency.blocking ? 'yellow' : 'slate',
          }))}
        />
        <DependencyColumn
          title="Blocking downstream"
          empty="No downstream cards depend on this work."
          items={dependents.map((dependent) => ({
            id: dependent.id,
            title: dependent.title,
            detail: `${dependent.ownerAgentName} · ${dependent.status.replace(/_/g, ' ')}`,
            href: dependent.href,
            tone: dependent.blocking ? 'yellow' : 'slate',
          }))}
        />
        <DependencyColumn
          title="Agent handoffs"
          empty="No handoffs recorded for this card."
          items={handoffs.map((handoff) => ({
            id: handoff.id,
            title: `${handoff.fromAgentName} to ${handoff.toAgentName}`,
            detail: `${handoff.status}${handoff.summary ? ` · ${handoff.summary}` : ''}`,
            href: handoff.runId ? `/admin/agents/runs/${handoff.runId}` : null,
            tone: handoff.status === 'pending' ? 'yellow' : 'slate',
          }))}
        />
      </div>
      {unresolvedIds.length ? (
        <div className="mt-3 rounded-lg border border-silicon-slate/60 bg-background/55 p-3 text-xs text-muted-foreground">
          <span className="font-semibold text-radiant-gold">Unresolved dependency IDs: </span>
          {unresolvedIds.join(', ')}
        </div>
      ) : null}
    </section>
  )
}

function DependencyColumn({
  title,
  empty,
  items,
}: {
  title: string
  empty: string
  items: Array<{ id: string; title: string; detail: string; href: string | null; tone: 'yellow' | 'slate' }>
}) {
  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-background/55 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-radiant-gold">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => {
          const className = `block rounded-lg border p-2 text-sm ${
            item.tone === 'yellow'
              ? 'border-yellow-500/35 bg-yellow-500/10 text-yellow-100'
              : 'border-silicon-slate/60 bg-silicon-slate/10 text-foreground'
          }`
          const content = (
            <>
              <p className="font-semibold">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
            </>
          )
          return item.href ? (
            <Link key={item.id} href={item.href} className={className}>
              {content}
            </Link>
          ) : (
            <div key={item.id} className={className}>{content}</div>
          )
        }) : <p className="text-sm text-muted-foreground">{empty}</p>}
      </div>
    </div>
  )
}

function GoalRadiators({
  organization,
  selectedGoalId,
  onGoalChange,
}: {
  organization: AgentOrgBoardSnapshot
  selectedGoalId: string
  onGoalChange: (value: string) => void
}) {
  const wipAlerts = organization.summary.wip.filter((lane) => lane.overLimit).slice(0, 3)
  const goals = organization.summary.goals.slice(0, 3)
  return (
    <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/15 p-4" aria-label="Goal and Kanban metrics">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-radiant-gold">Goal progress</h2>
            <Link href="/admin/agents/standup" className="text-xs text-radiant-gold hover:underline">Open Standup Room</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {goals.length ? goals.map((goal) => (
              <button
                key={goal.id}
                type="button"
                onClick={() => onGoalChange(selectedGoalId === goal.id ? 'all' : goal.id)}
                aria-pressed={selectedGoalId === goal.id}
                className={`rounded-lg border p-3 text-left transition ${
                  selectedGoalId === goal.id
                    ? 'border-radiant-gold/70 bg-radiant-gold/15 shadow-[0_0_24px_rgba(222,184,65,0.12)]'
                    : 'border-silicon-slate/60 bg-background/60 hover:border-radiant-gold/45'
                }`}
              >
                <p className="line-clamp-1 text-sm font-semibold">{goal.title}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-silicon-slate/70">
                  <div className="h-full bg-radiant-gold" style={{ width: `${goal.progress}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{goal.progress}% · {goal.open} open · {goal.blocked} blocked</p>
                {goal.nextStageGate ? (
                  <p className="mt-1 line-clamp-1 text-xs text-radiant-gold">Next gate: {goal.nextStageGate.label}</p>
                ) : null}
              </button>
            )) : (
              <p className="rounded-lg border border-dashed border-silicon-slate/60 p-3 text-sm text-muted-foreground md:col-span-3">
                Goal-tagged cards will appear after a Standup Room goal is approved.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-silicon-slate/60 bg-background/60 p-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-radiant-gold">WIP limits</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {wipAlerts.length
              ? `${wipAlerts.length} lane(s) are above configured limit.`
              : 'All visible lanes are within configured WIP limits.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {organization.summary.wip.slice(0, 5).map((lane) => (
              <span key={lane.laneKey} className={`rounded-full border px-2 py-1 text-xs ${lane.overLimit ? 'border-red-500/50 text-red-200' : 'border-silicon-slate/60 text-muted-foreground'}`}>
                {lane.label}: {lane.count}/{lane.limit}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function HighSignalInsightsRail({ insights }: { insights: AgentOrgBoardSnapshot['highSignalInsights'] }) {
  if (!insights.length) return null
  return (
    <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/15 p-4" aria-label="High-signal AI insights">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-radiant-gold">
            <Target size={16} />
            <h2 className="text-sm font-semibold uppercase tracking-wide">High-signal AI insights</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Engagement-ranked themes from published AI insight content. Use these as inputs for goal selection and content-format bakeoffs.
          </p>
        </div>
        <Link href="/admin/social-content?status=published&platform=linkedin" className="text-sm text-radiant-gold hover:underline">
          Open Social Content
        </Link>
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-3">
        {insights.slice(0, 3).map((insight) => (
          <Link key={insight.contentId} href={insight.bestContentHref} className="rounded-lg border border-silicon-slate/60 bg-background/45 p-3 transition hover:border-radiant-gold/60">
            <div className="flex items-start justify-between gap-3">
              <p className="line-clamp-2 text-sm font-semibold">{insight.theme}</p>
              <span className="rounded-full border border-radiant-gold/45 bg-radiant-gold/10 px-2 py-1 text-xs font-semibold text-radiant-gold">{insight.score}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{insight.title}</p>
            <p className="mt-3 text-xs font-semibold text-radiant-gold">{insight.recommendationLabel}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function KanbanFilterPanel({
  goals,
  ownerOptions,
  selectedGoalId,
  ownerFilter,
  statusFilter,
  attentionFilter,
  dependencyFilter,
  filteredCount,
  totalCount,
  onGoalChange,
  onOwnerChange,
  onStatusChange,
  onAttentionChange,
  onDependencyChange,
  onClearFilters,
}: {
  goals: AgentOrgBoardSnapshot['summary']['goals']
  ownerOptions: Array<[string, string]>
  selectedGoalId: string
  ownerFilter: string
  statusFilter: 'all' | AgentOrgBoardTask['status']
  attentionFilter: AttentionFilter
  dependencyFilter: DependencyFilter
  filteredCount: number
  totalCount: number
  onGoalChange: (value: string) => void
  onOwnerChange: (value: string) => void
  onStatusChange: (value: 'all' | AgentOrgBoardTask['status']) => void
  onAttentionChange: (value: AttentionFilter) => void
  onDependencyChange: (value: DependencyFilter) => void
  onClearFilters: () => void
}) {
  return (
    <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/15 p-4" aria-label="Kanban filters">
      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-radiant-gold" />
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-radiant-gold">Board scope</h2>
            <p className="text-sm text-muted-foreground">Filter by goal, owner, status, attention state, or dependency relationship without leaving the Kanban surface.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{filteredCount}/{totalCount} visible</span>
          <button type="button" onClick={onClearFilters} className="text-radiant-gold hover:underline">
            Clear filters
          </button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">
          Goal
          <select
            value={selectedGoalId}
            onChange={(event) => onGoalChange(event.target.value)}
            className="mt-1 w-full rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-radiant-gold/70"
          >
            <option value="all">All goals</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>{goal.title}</option>
            ))}
          </select>
        </label>
        <label className="text-xs uppercase tracking-wide text-muted-foreground">
          Owner
          <select
            value={ownerFilter}
            onChange={(event) => onOwnerChange(event.target.value)}
            className="mt-1 w-full rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-radiant-gold/70"
          >
            <option value="all">All owners</option>
            <option value="unassigned">Unassigned</option>
            {ownerOptions.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs uppercase tracking-wide text-muted-foreground">
          Status
          <select
            value={statusFilter}
            onChange={(event) => onStatusChange(event.target.value as 'all' | AgentOrgBoardTask['status'])}
            className="mt-1 w-full rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-radiant-gold/70"
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </label>
        <label className="text-xs uppercase tracking-wide text-muted-foreground">
          Attention
          <select
            value={attentionFilter}
            onChange={(event) => onAttentionChange(event.target.value as AttentionFilter)}
            className="mt-1 w-full rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-radiant-gold/70"
          >
            {ATTENTION_FILTERS.map((filter) => (
              <option key={filter.key} value={filter.key}>{filter.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs uppercase tracking-wide text-muted-foreground">
          Dependencies
          <select
            value={dependencyFilter}
            onChange={(event) => onDependencyChange(event.target.value as DependencyFilter)}
            className="mt-1 w-full rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-radiant-gold/70"
          >
            {DEPENDENCY_FILTERS.map((filter) => (
              <option key={filter.key} value={filter.key}>{filter.label}</option>
            ))}
          </select>
        </label>
      </div>
    </section>
  )
}

function SelectedGoalPanel({ goal, tasks }: { goal: AgentOrgBoardSnapshot['summary']['goals'][number]; tasks: AgentOrgBoardTask[] }) {
  const orderedTasks = [...tasks]
    .filter((task) => task.goal?.id === goal.id)
    .sort((a, b) => (a.goal?.sequence ?? 999) - (b.goal?.sequence ?? 999))
  const isAutomationGoal = Boolean(goal.automationGoalSeedId || goal.id.startsWith('automation:'))
  return (
    <section className="rounded-lg border border-radiant-gold/35 bg-radiant-gold/10 p-4" aria-label="Selected goal work">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-radiant-gold">Selected goal</p>
              <h2 className="mt-1 text-xl font-semibold">{goal.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {goal.completed}/{goal.total} complete · {goal.open} open · {goal.blocked} blocked
              </p>
              {goal.nextStageGate ? (
                <p className="mt-2 text-sm text-radiant-gold">
                  Next gate: {goal.nextStageGate.label} · before {goal.nextStageGate.requiredBefore.replace(/_/g, ' ')}
                </p>
              ) : null}
            </div>
            <Link href={goal.sessionHref} className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15">
              Open goal session
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {goal.draftTraceHref && <AuditLink href={goal.draftTraceHref} label="Draft trace" />}
            {goal.approvalTraceHref && <AuditLink href={goal.approvalTraceHref} label="Approval trace" />}
            {goal.latestTraceHref && <AuditLink href={goal.latestTraceHref} label="Latest room trace" />}
            {!goal.draftTraceHref && !goal.approvalTraceHref && !goal.latestTraceHref ? (
              <span className="rounded-full border border-silicon-slate/60 px-2 py-1 text-muted-foreground">Audit traces pending</span>
            ) : null}
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-silicon-slate/70">
            <div className="h-full bg-radiant-gold" style={{ width: `${goal.progress}%` }} />
          </div>
          {isAutomationGoal && (
            <div className="mt-4 rounded-lg border border-silicon-slate/60 bg-background/55 p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-radiant-gold">
                    <Workflow size={15} />
                    <p className="text-xs font-semibold uppercase tracking-wide">Automation workflow</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {goal.nextAction ?? 'Use the Standup Room to ask the automation agent for a governed n8n workflow proposal.'}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {goal.n8nWorkflows.length ? `${goal.n8nWorkflows.length} known n8n workflow(s)` : 'No existing n8n workflow mapped yet'} · {goal.approvalGate ?? 'Activation remains approval-gated.'}
                  </p>
                </div>
                <Link href={goal.sessionHref} className="inline-flex items-center justify-center gap-2 rounded-lg border border-radiant-gold/50 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15">
                  Draft proposal in Standup
                </Link>
              </div>
            </div>
          )}
          <div className="mt-4 grid gap-2">
            {orderedTasks.length ? orderedTasks.map((task) => (
              <div key={task.id} className="grid gap-2 rounded-lg border border-silicon-slate/60 bg-background/55 p-3 text-sm md:grid-cols-[48px_minmax(0,1fr)_140px] md:items-center">
                <span className="text-xs font-semibold uppercase tracking-wide text-radiant-gold">
                  {task.goal?.sequence ? `#${task.goal.sequence}` : 'Task'}
                </span>
                <div className="min-w-0">
                  <p className="break-words font-medium">{task.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{task.ownerAgentName} · {task.status.replace(/_/g, ' ')}</p>
                  {task.goal?.n8nProposal ? (
                    <Link href={task.goal.n8nProposal.controllerHref} className="mt-1 inline-flex text-xs text-radiant-gold hover:underline">
                      n8n proposal · open controller
                    </Link>
                  ) : null}
                </div>
                <div className="flex gap-2 md:justify-end">
                  {task.activeRunId ? <Link href={`/admin/agents/runs/${task.activeRunId}`} className="text-xs text-radiant-gold hover:underline">Trace</Link> : null}
                  {task.prUrl ? <a href={task.prUrl} className="text-xs text-radiant-gold hover:underline">PR</a> : null}
                </div>
              </div>
            )) : (
              <p className="rounded-lg border border-dashed border-silicon-slate/60 p-3 text-sm text-muted-foreground">
                No visible cards match this goal and the current filters.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-silicon-slate/60 bg-background/55 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-radiant-gold">
            <Timer size={15} />
            Burndown
          </h3>
          <div className="mt-3 space-y-2">
            {goal.burndown.length ? goal.burndown.map((point, index) => {
              const max = Math.max(...goal.burndown.map((item) => item.remaining), 1)
              return (
                <div key={`${point.label}-${index}`} className="grid grid-cols-[64px_minmax(0,1fr)_32px] items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{point.label}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-silicon-slate/70">
                    <div className="h-full bg-radiant-gold/80" style={{ width: `${Math.max(8, (point.remaining / max) * 100)}%` }} />
                  </div>
                  <span className="text-right tabular-nums">{point.remaining}</span>
                </div>
              )
            }) : (
              <p className="text-sm text-muted-foreground">Burndown appears after goal-tagged work starts moving.</p>
            )}
          </div>
          {(goal.stageGates ?? []).length ? (
            <div className="mt-4 border-t border-silicon-slate/50 pt-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-radiant-gold">Stage gates</h3>
              <div className="mt-2 space-y-2">
                {(goal.stageGates ?? []).slice(0, 4).map((gate) => (
                  <div key={gate.key} className="rounded-md border border-silicon-slate/55 bg-background/45 p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{gate.label}</span>
                      <span className="text-muted-foreground">{gate.status.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">Before {gate.requiredBefore.replace(/_/g, ' ')}{gate.approvalRequired ? ' · approval gate' : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function AuditLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded-full border border-radiant-gold/35 bg-radiant-gold/10 px-2 py-1 text-radiant-gold hover:bg-radiant-gold/15">
      {label}
    </Link>
  )
}

function SummaryStrip({ organization }: { organization: AgentOrgBoardSnapshot }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      <MetricCard label="Agents" value={organization.summary.agents} />
      <MetricCard label="Live" value={organization.summary.live_agents} tone="green" />
      <MetricCard label="Work items" value={organization.summary.active_work_items} />
      <MetricCard label="Unassigned" value={organization.summary.unassigned_work_items} tone={organization.summary.unassigned_work_items ? 'yellow' : 'slate'} />
      <MetricCard label="Blocked" value={organization.summary.blocked_work_items} tone={organization.summary.blocked_work_items ? 'red' : 'slate'} />
      <MetricCard label="Ready merge" value={organization.summary.ready_for_merge} tone={organization.summary.ready_for_merge ? 'yellow' : 'slate'} />
      <MetricCard label="Approvals" value={organization.summary.pending_approvals} tone={organization.summary.pending_approvals ? 'yellow' : 'slate'} />
      <MetricCard label="Goals" value={organization.summary.active_goals} tone={organization.summary.active_goals ? 'yellow' : 'slate'} />
    </div>
  )
}

function TaskLane({ lane, onOpenDependencies }: { lane: StatusSwimlane; onOpenDependencies: (taskId: string) => void }) {
  const isEmpty = lane.tasks.length === 0
  const blocked = lane.tasks.filter((task) => task.status === 'blocked').length
  const review = lane.tasks.filter((task) => task.status === 'ready_for_review' || task.status === 'ready_for_merge').length
  return (
    <section className={`rounded-lg border border-silicon-slate/70 bg-silicon-slate/15 ${isEmpty ? 'min-h-[132px] opacity-70' : 'min-h-[420px]'}`} aria-label={`${lane.label} lane`} data-collapsed={isEmpty ? 'true' : 'false'}>
      <div className={`${isEmpty ? '' : 'border-b border-silicon-slate/60'} p-3`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words font-semibold" title={lane.label}>{lane.label}</h2>
            <p className="mt-1 break-words text-xs text-muted-foreground" title={lane.description}>{lane.description}</p>
          </div>
          <span className="rounded-full border border-silicon-slate/70 px-2 py-1 text-xs text-muted-foreground">
            {lane.tasks.length}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {blocked ? <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-200">{blocked} blocked</span> : null}
          {review ? <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-100">{review} review</span> : null}
          {isEmpty ? (
            <span className="rounded-full border border-silicon-slate/60 bg-silicon-slate/10 px-2 py-1 text-xs text-muted-foreground">Collapsed empty lane</span>
          ) : null}
          {!isEmpty && !blocked && !review ? <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs text-green-200">within flow</span> : null}
        </div>
      </div>
      {!isEmpty ? (
        <div className="space-y-3 p-3">
          {lane.tasks.map((task) => <WorkItemCard key={task.id} task={task} onOpenDependencies={onOpenDependencies} />)}
        </div>
      ) : null}
    </section>
  )
}

function sortTasksForLane(a: AgentOrgBoardTask, b: AgentOrgBoardTask) {
  const rank: Record<AgentOrgBoardTask['priority'], number> = { urgent: 0, high: 1, medium: 2, low: 3 }
  return rank[a.priority] - rank[b.priority] || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
}

function buildBoardActions(lanes: Array<Pick<AgentOrgBoardLane, 'key' | 'label' | 'tasks'>>): BoardAction[] {
  return lanes
    .flatMap((lane) => lane.tasks.map((task) => ({ task, lane, nextAction: nextActionForTask(task) })))
    .filter(({ task }) => {
      if (task.status === 'blocked' || task.status === 'ready_for_review' || task.status === 'ready_for_merge') return true
      if (!task.ownerAgentKey) return true
      if ((task.dependencies ?? []).some((dependency) => dependency.blocking)) return true
      if ((task.handoffs ?? []).some((handoff) => handoff.status === 'pending')) return true
      if (!task.validationSummary && (task.status === 'in_progress' || task.status === 'assigned')) return true
      return false
    })
    .sort((a, b) => actionRank(a.task) - actionRank(b.task) || new Date(a.task.updatedAt).getTime() - new Date(b.task.updatedAt).getTime())
    .slice(0, 3)
}

function actionRank(task: AgentOrgBoardTask) {
  if (task.status === 'blocked') return 0
  if (task.status === 'ready_for_merge') return 1
  if (task.status === 'ready_for_review') return 2
  if ((task.dependencies ?? []).some((dependency) => dependency.blocking)) return 3
  if ((task.handoffs ?? []).some((handoff) => handoff.status === 'pending')) return 4
  if (!task.ownerAgentKey) return 5
  if (!task.validationSummary) return 6
  return 7
}

function WorkItemCard({ task, onOpenDependencies }: { task: AgentOrgBoardTask; onOpenDependencies: (taskId: string) => void }) {
  const nextAction = nextActionForTask(task)
  const n8nProposal = task.goal?.n8nProposal ?? null
  const dependencyIds = task.dependencyIds ?? []
  const resolvedDependencies = task.dependencies ?? []
  const dependents = task.dependents ?? []
  const pendingHandoffs = (task.handoffs ?? []).filter((handoff) => handoff.status === 'pending')
  const expectedFiles = task.expectedFiles ?? []
  const acceptanceCriteria = task.acceptanceCriteria ?? []
  return (
    <article className="rounded-lg border border-silicon-slate/70 bg-background/70 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className="break-words text-sm font-semibold leading-snug"
            title={task.title}
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {task.title}
          </p>
          <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-silicon-slate/70 bg-silicon-slate/20 px-1.5 py-0.5 text-foreground/85">
              <AgentAvatar agentKey={task.ownerAgentKey} size="sm" className="h-5 w-5 rounded-md text-[8px]" />
              <span className="truncate">{displayDetailValue('Owner', task.ownerAgentName)}</span>
            </span>
            <span className="shrink-0 rounded-full border border-silicon-slate/60 bg-silicon-slate/10 px-1.5 py-0.5">
              {task.status.replace(/_/g, ' ')}
            </span>
            <span className="shrink-0">
              {task.completedAt ? `Cycle ${formatHours(task.createdAt, task.completedAt)}` : `Age ${formatHours(task.createdAt)}`}
            </span>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] ${priorityClass(task.priority)}`}>{task.priority}</span>
      </div>
      {task.goal && (
        <Link
          href={task.goal.sessionHref}
          className="mt-1.5 inline-flex max-w-full items-center rounded-full border border-radiant-gold/40 bg-radiant-gold/10 px-1.5 py-0.5 text-[11px] text-radiant-gold hover:bg-radiant-gold/15"
        >
          <span className="truncate">Goal: {task.goal.title}</span>
        </Link>
      )}
      {task.goal?.nextStageGate ? (
        <div className="mt-1.5 inline-flex max-w-full rounded-full border border-silicon-slate/60 bg-silicon-slate/15 px-1.5 py-0.5 text-[11px] text-muted-foreground">
          <span className="truncate">Next gate: {task.goal.nextStageGate.label}</span>
        </div>
      ) : null}
      {n8nProposal ? (
        <div className="mt-1.5 flex items-center gap-1.5 rounded-md border border-radiant-gold/35 bg-radiant-gold/10 px-1.5 py-1 text-[11px] text-radiant-gold">
          <Workflow size={12} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate" title={n8nProposal.proposedWorkflowName ?? undefined}>
            n8n proposal · {formatProposalAction(n8nProposal.action)}
            {n8nProposal.proposedWorkflowName ? ` · ${n8nProposal.proposedWorkflowName}` : ''}
          </span>
          <Link
            href={n8nProposal.controllerHref}
            className="shrink-0 rounded border border-radiant-gold/40 px-1.5 py-0.5 hover:bg-radiant-gold/15"
          >
            Controller
          </Link>
        </div>
      ) : null}
      {dependencyIds.length || dependents.length || pendingHandoffs.length ? (
        <button
          type="button"
          onClick={() => onOpenDependencies(task.id)}
          className="mt-1.5 flex w-full items-center gap-1.5 rounded-md border border-silicon-slate/60 bg-silicon-slate/15 px-1.5 py-1 text-left text-[11px] text-muted-foreground hover:border-radiant-gold/45 hover:text-foreground"
          aria-label={`Open dependency details for ${task.title}`}
        >
          <Network size={12} className="shrink-0 text-radiant-gold" />
          <span className="font-semibold text-radiant-gold">Dependencies</span>
          {dependencyIds.length ? <span>{dependencyIds.length} upstream</span> : null}
          {dependents.length ? <span>{dependents.length} downstream</span> : null}
          {pendingHandoffs.length ? <span>{pendingHandoffs.length} handoff</span> : null}
        </button>
      ) : null}

      <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
        <span className={`min-w-0 flex-1 truncate rounded-md border px-1.5 py-1 ${nextAction.tone}`} title={nextAction.detail}>
          {nextAction.label}
        </span>
        {task.activeRunId ? (
          <a
            href={`/admin/agents/runs/${task.activeRunId}`}
            aria-label={`Open trace ${task.activeRunId} for ${task.title}`}
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-radiant-gold/45 bg-radiant-gold/10 px-1.5 py-1 text-radiant-gold hover:bg-radiant-gold/15"
          >
            Trace
          </a>
        ) : (
          <span className="inline-flex shrink-0 items-center justify-center rounded-md border border-dashed border-silicon-slate/50 bg-transparent px-1.5 py-1 text-muted-foreground/75" aria-label={`Trace unavailable for ${task.title}`}>
            No trace
          </span>
        )}
        {task.prUrl ? (
          <a
            href={task.prUrl}
            aria-label={`Open pull request ${task.prNumber ?? ''} for ${task.title}`.trim()}
            className="inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-silicon-slate/70 bg-silicon-slate/20 px-1.5 py-1 text-radiant-gold hover:border-radiant-gold/45"
          >
            <GitPullRequest size={13} />
            PR
          </a>
        ) : (
          <span className="inline-flex shrink-0 items-center justify-center rounded-md border border-dashed border-silicon-slate/50 bg-transparent px-1.5 py-1 text-muted-foreground/75" aria-label={`Pull request unavailable for ${task.title}`}>
            No PR
          </span>
        )}
      </div>

      <details className="mt-1.5 border-t border-silicon-slate/50 pt-1.5">
        <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-radiant-gold">Details</summary>
        <div className="mt-2 space-y-2">
          {task.objective && <p className="line-clamp-3 text-xs text-muted-foreground">{task.objective}</p>}
          <p className={`rounded-lg border p-2 text-xs ${nextAction.tone}`}>
            <span className="font-semibold">{nextAction.label}: </span>
            {nextAction.detail}
          </p>
          <dl className="grid gap-2 text-xs">
            <CardDetail label="Trace" value={task.activeRunId ?? 'No active trace'} />
            <CardDetail label="Owner" value={task.ownerAgentName} />
            {task.ownerRuntime && <CardDetail label="Runtime" value={task.ownerRuntime} />}
            {task.branchName && <CardDetail label="Branch" value={task.branchName} />}
            {task.overlapGroup && <CardDetail label="Overlap" value={task.overlapGroup} />}
            {dependencyIds.length ? <CardDetail label="Waiting on" value={resolvedDependencies.length ? resolvedDependencies.map((dependency) => dependency.title).join(', ') : dependencyIds.join(', ')} /> : null}
            {dependents.length ? <CardDetail label="Blocking" value={dependents.map((dependent) => dependent.title).join(', ')} /> : null}
            {pendingHandoffs.length ? <CardDetail label="Handoffs" value={pendingHandoffs.map((handoff) => `${handoff.fromAgentName} to ${handoff.toAgentName}`).join(', ')} /> : null}
            {expectedFiles.length ? <CardDetail label="Expected files" value={expectedFiles.slice(0, 4).join(', ')} /> : null}
          </dl>
          {acceptanceCriteria.length ? (
            <div className="rounded-lg border border-silicon-slate/60 bg-silicon-slate/10 p-2 text-xs">
              <p className="font-semibold text-muted-foreground">Acceptance criteria</p>
              <ul className="mt-1 space-y-1 text-foreground/85">
                {acceptanceCriteria.slice(0, 4).map((criterion) => (
                  <li key={criterion}>{criterion}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {task.blockerSummary && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
              <span className="font-semibold">Blocker:</span> {task.blockerSummary}
            </p>
          )}
          {task.validationSummary && (
            <p className="rounded-lg border border-green-500/30 bg-green-500/10 p-2 text-xs text-green-200">
              <span className="font-semibold">Validation:</span> {task.validationSummary}
            </p>
          )}
        </div>
      </details>
    </article>
  )
}

function nextActionForTask(task: AgentOrgBoardTask) {
  const dependencyIds = task.dependencyIds ?? []
  const blockingDependencies = (task.dependencies ?? []).filter((dependency) => dependency.blocking)
  const pendingHandoffs = (task.handoffs ?? []).filter((handoff) => handoff.status === 'pending')
  if (blockingDependencies.length && !['merged', 'deployed', 'cancelled'].includes(task.status)) {
    return {
      label: 'Check dependencies',
      detail: `Waiting on ${blockingDependencies.map((dependency) => dependency.title).slice(0, 2).join(', ')} before handoff.`,
      tone: 'border-yellow-500/35 bg-yellow-500/10 text-yellow-100',
    }
  }
  if (dependencyIds.length && !['merged', 'deployed', 'cancelled'].includes(task.status)) {
    return {
      label: 'Verify dependency',
      detail: `This card references ${dependencyIds.length} upstream dependency${dependencyIds.length === 1 ? '' : 'ies'}; confirm the dependency link before handoff.`,
      tone: 'border-yellow-500/35 bg-yellow-500/10 text-yellow-100',
    }
  }
  if (pendingHandoffs.length) {
    return {
      label: 'Accept handoff',
      detail: `${pendingHandoffs[0].fromAgentName} handed this to ${pendingHandoffs[0].toAgentName}. Confirm ownership and next step.`,
      tone: 'border-yellow-500/35 bg-yellow-500/10 text-yellow-100',
    }
  }
  if (task.status === 'blocked') {
    return {
      label: 'Resolve blocker',
      detail: task.blockerSummary ?? 'Open the trace or owner lane and clear the blocker before routing forward.',
      tone: 'border-red-500/35 bg-red-500/10 text-red-200',
    }
  }
  if (task.status === 'ready_for_merge' || task.status === 'ready_for_review') {
    return task.prUrl
      ? {
          label: 'Review PR',
          detail: `Review PR ${task.prNumber ?? ''}, validation, and merge readiness.`,
          tone: 'border-yellow-500/35 bg-yellow-500/10 text-yellow-100',
        }
      : {
          label: 'Attach PR',
          detail: 'This item is review-ready but does not have a pull request attached.',
          tone: 'border-yellow-500/35 bg-yellow-500/10 text-yellow-100',
        }
  }
  if (task.status === 'queued' || task.status === 'proposed' || !task.ownerAgentKey) {
    return {
      label: 'Assign owner',
      detail: 'Move this work from intake into an owner lane before implementation starts.',
      tone: 'border-silicon-slate/60 bg-silicon-slate/15 text-foreground',
    }
  }
  if (task.activeRunId) {
    return {
      label: 'Open trace',
      detail: 'Inspect the current trace for live status, evidence, and next step.',
      tone: 'border-radiant-gold/35 bg-radiant-gold/10 text-radiant-gold',
    }
  }
  if (!task.validationSummary) {
    return {
      label: 'Add validation summary',
      detail: 'Record focused validation before handing this work to review.',
      tone: 'border-silicon-slate/60 bg-silicon-slate/15 text-foreground',
    }
  }
  return {
    label: 'Continue work',
    detail: 'Keep the owner, trace, and validation packet current as this item moves.',
    tone: 'border-silicon-slate/60 bg-silicon-slate/15 text-foreground',
  }
}

function displayDetailValue(label: string, value: string) {
  if (label !== 'Owner') return value
  if (value.includes(' - ')) return value
  if (!/^[a-z0-9_-]+$/i.test(value)) return value

  const minorWords = new Set(['and', 'for', 'in', 'of', 'the', 'to'])
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .map((word, index) => {
      const lower = word.toLowerCase()
      if (index > 0 && minorWords.has(lower)) return lower
      return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`
    })
    .join(' ')
}

function CardDetail({ label, value }: { label: string; value: string }) {
  const displayValue = displayDetailValue(label, value)
  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-silicon-slate/10 px-2.5 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 min-w-0 break-words text-xs leading-snug text-foreground/85" title={value}>{displayValue}</dd>
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
            <AgentAvatar agentKey={agent.key} size="lg" />
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
              <AgentAvatar agentKey={agent.key} size="sm" />
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
            <p className="text-sm text-muted-foreground">Recent standup-room commands, traces, and team prompts.</p>
          </div>
          <Badge label={`${organization.warRoom.recentRuns.length} trace(s)`} />
        </div>
        <div className="flex-1 space-y-4 p-4">
          <div className="rounded-lg border border-silicon-slate/70 bg-background/55 p-4 text-center">
            <Sparkles className="mx-auto mb-4 text-radiant-gold" size={28} />
            <h3 className="text-lg font-semibold">Start with a specific question.</h3>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">{organization.warRoom.suggestedPrompt}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {organization.warRoom.commands.map((command) => <Badge key={command} label={command} />)}
            </div>
          </div>
          <div className="rounded-lg border border-silicon-slate/70 bg-background/55 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-radiant-gold">Recent room traces</h3>
              <Link href="/admin/agents/runs" className="text-xs text-radiant-gold hover:underline">View all traces</Link>
            </div>
            <div className="space-y-2">
              {organization.warRoom.recentRuns.length ? organization.warRoom.recentRuns.map((run) => (
                <article key={run.id} className="grid gap-3 rounded-lg border border-silicon-slate/60 bg-silicon-slate/15 p-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge label={run.command.replace(/_/g, ' ')} />
                      <Badge label={run.status} />
                      {run.goalId ? <Badge label={`goal ${run.goalId}`} /> : null}
                    </div>
                    <p className="mt-2 font-medium">{run.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{run.summary}</p>
                  </div>
                  <Link href={`/admin/agents/runs/${run.id}`} className="inline-flex items-center justify-end gap-2 text-radiant-gold hover:underline">
                    Open trace
                  </Link>
                </article>
              )) : (
                <div className="rounded-lg border border-dashed border-silicon-slate/60 p-4 text-sm text-muted-foreground">
                  No standup-room traces yet. Start a standup or ask an agent to create the first room trace.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-silicon-slate/60 p-4">
          <div className="flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-background/60 px-3 py-3 text-sm text-muted-foreground">
            Use the Standup Room for interactive questions; Slack commands remain available for mobile check-ins.
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

function formatProposalAction(action: string | null) {
  return action ? action.replace(/_/g, ' ') : 'review'
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

function formatHours(start: string, end?: string | null) {
  const startTime = new Date(start).getTime()
  const endTime = end ? new Date(end).getTime() : Date.now()
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return formatRelative(start)
  const hours = Math.round(((endTime - startTime) / 3_600_000) * 10) / 10
  return hours < 24 ? `${hours}h` : `${Math.round((hours / 24) * 10) / 10}d`
}
