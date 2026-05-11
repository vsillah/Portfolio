'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  FileText,
  ListChecks,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import type {
  AutomationBoundary,
  AutomationCategory,
  AutomationContextHealth,
  CodexAutomationRepairPriority,
  AutomationRiskLevel,
  MemoryOrganizationTaskStatus,
} from '@/lib/codex-automation-inventory'

type AutomationProfile = {
  id: string
  name: string
  kind: string
  status: string
  schedule: string | null
  model: string | null
  reasoningEffort: string | null
  executionEnvironment: string | null
  cwds: string[]
  createdAt: number | null
  updatedAt: number | null
  category: AutomationCategory
  riskLevel: AutomationRiskLevel
  portfolioRelated: boolean
  sourceFile: string
  controlDocs: string[]
  promptExcerpt: string
  duplicateCandidate: boolean
  managementBoundary: AutomationBoundary
  contextHealth: AutomationContextHealth
  contextGaps: string[]
  contextQuestions: {
    id: string
    question: string
    answered: boolean
    answer: string | null
    recommendation: string
  }[]
  contextProfile: {
    purpose: string | null
    operatingRhythm: string | null
    recurringDecisions: string | null
    inputs: string[]
    dependencies: string[]
    frictionPoints: string[]
    authorityBoundary: AutomationBoundary
    expectedOutputs: string[]
    escalationTrigger: string | null
    governingDocs: string[]
  }
}

type AutomationInventoryResponse = {
  available: boolean
  reason?: string
  sourceDirectory: string
  generatedAt: string
  automations: AutomationProfile[]
  hiddenCount: number
  overview: {
    total: number
    active: number
    paused: number
    duplicateCandidates: number
    highRisk: number
    missingContext: number
  }
  progress: {
    label: string
    percent: number
    completedTasks: number
    totalTasks: number
    tasks: {
      id: string
      label: string
      description: string
      status: MemoryOrganizationTaskStatus
      progress: number
    }[]
  }
  repairPackets: {
    automationId: string
    automationName: string
    priority: CodexAutomationRepairPriority
    summary: string
    missingQuestions: string[]
    recommendedActions: string[]
    governingDocCandidates: string[]
    sourceFile: string
    operationalBoundary: string
  }[]
  workspaceRoots: {
    available: boolean
    reason?: string
    generatedAt: string
    expectedRoot: string
    stateDatabase: string
    globalStateFile: string
    savedWorkspaceRoots: string[]
    activeWorkspaceRoots: string[]
    projectOrderRoots: string[]
    threadRoots: {
      cwd: string
      activeCount: number
      portfolioRoot: boolean
    }[]
    overview: {
      activeThreads: number
      portfolioThreads: number
      nonPortfolioThreads: number
      savedRootDrift: number
      activeRootDrift: number
      projectOrderDrift: number
    }
    health: AutomationContextHealth
    warnings: string[]
    operationalBoundary: string
  }
}

type AutomationActionStatus = 'open' | 'in_progress' | 'blocked' | 'done' | 'dismissed'
type AutomationActionItem = {
  id: string
  automationId: string
  automationName: string
  statusColor: 'green' | 'yellow' | 'red' | 'unknown'
  headline: string
  summary: string
  kind: 'blocker_or_approval' | 'next_run_focus'
  text: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  actionStatus: AutomationActionStatus
  owner: string | null
  note: string | null
  linkedWorkItemId: string | null
  firstSeenAt: string
  lastSeenAt: string
  occurrenceCount: number
  sourceFiles: string[]
  latestSourceFile: string
  codexThreadHint: string | null
}

type AutomationActionTrackerResponse = {
  available: boolean
  reason?: string
  generatedAt: string
  sourceDirectory: string
  stateFile: string
  actions: AutomationActionItem[]
  recentNotifications: {
    automationId: string
    automationName: string
    ranAtUtc: string
    status: string
    headline: string
    sourceFile: string
    actionCount: number
  }[]
  summary: {
    total: number
    open: number
    inProgress: number
    blocked: number
    done: number
    dismissed: number
    urgent: number
    high: number
  }
}

const ALL = 'all'
const CATEGORIES = [ALL, 'Operations', 'Credentials', 'Model Ops', 'Organization', 'Content/Voice', 'Subscriptions', 'Other'] as const
const STATUSES = [ALL, 'ACTIVE', 'PAUSED'] as const
const RISKS = [ALL, 'low', 'medium', 'high'] as const
const CONTEXT_HEALTH = [ALL, 'green', 'yellow', 'red'] as const
const EMPTY_AUTOMATIONS: AutomationProfile[] = []
type ViewMode = 'actions' | 'inventory' | 'context-gaps' | 'repair-packets'

export default function AgentAutomationsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AgentAutomationsContent />
    </ProtectedRoute>
  )
}

function AgentAutomationsContent() {
  const [inventory, setInventory] = useState<AutomationInventoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionTracker, setActionTracker] = useState<AutomationActionTrackerResponse | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>(ALL)
  const [status, setStatus] = useState<(typeof STATUSES)[number]>(ALL)
  const [risk, setRisk] = useState<(typeof RISKS)[number]>(ALL)
  const [contextHealth, setContextHealth] = useState<(typeof CONTEXT_HEALTH)[number]>(ALL)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('actions')

  const fetchInventory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const headers = { Authorization: `Bearer ${session.access_token}` }
      const [inventoryRes, actionsRes] = await Promise.all([
        fetch('/api/admin/agents/automations', { headers }),
        fetch('/api/admin/agents/automation-actions', { headers }),
      ])
      const body = await inventoryRes.json().catch(() => ({}))
      if (!inventoryRes.ok) throw new Error(body.error || `HTTP ${inventoryRes.status}`)
      setInventory(body)
      const actionsBody = await actionsRes.json().catch(() => ({}))
      if (actionsRes.ok) {
        setActionTracker(actionsBody)
        setActionError(null)
      } else {
        setActionTracker(null)
        setActionError(actionsBody.error || `HTTP ${actionsRes.status}`)
      }
      const first = body.automations?.[0]?.id
      setSelectedId((current) => current || first || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load automation inventory')
      setInventory(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateAction = useCallback(async (action: AutomationActionItem, status: AutomationActionStatus, note?: string | null) => {
    setActionLoadingId(action.id)
    setActionError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch('/api/admin/agents/automation-actions', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action_id: action.id, status, note }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      await fetchInventory()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update action')
    } finally {
      setActionLoadingId(null)
    }
  }, [fetchInventory])

  const promoteAction = useCallback(async (action: AutomationActionItem) => {
    setActionLoadingId(action.id)
    setActionError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch('/api/admin/agents/automation-actions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action_id: action.id }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      await fetchInventory()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create Agent Ops work item')
    } finally {
      setActionLoadingId(null)
    }
  }, [fetchInventory])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  const automations = useMemo(() => inventory?.automations || EMPTY_AUTOMATIONS, [inventory?.automations])
  const filtered = useMemo(() => {
    return automations.filter((automation) => {
      if (category !== ALL && automation.category !== category) return false
      if (status !== ALL && automation.status !== status) return false
      if (risk !== ALL && automation.riskLevel !== risk) return false
      if (contextHealth !== ALL && automation.contextHealth !== contextHealth) return false
      return true
    })
  }, [automations, category, status, risk, contextHealth])

  const selected = automations.find((automation) => automation.id === selectedId) || filtered[0] || null
  const contextGapAutomations = useMemo(() => {
    return automations
      .filter((automation) => automation.contextQuestions.some((question) => !question.answered))
      .sort((a, b) => {
        const healthRank = { red: 0, yellow: 1, green: 2 }
        return healthRank[a.contextHealth] - healthRank[b.contextHealth] || b.contextGaps.length - a.contextGaps.length
      })
  }, [automations])
  const duplicateWarnings = automations.filter((automation) => automation.duplicateCandidate)
  const workspaceWarnings = automations.filter((automation) => !automation.cwds.some((cwd) => cwd.includes('/Projects/Portfolio')))
  const authorityWarnings = automations.filter(
    (automation) => automation.riskLevel === 'high' && automation.contextGaps.includes('missing authority boundary'),
  )
  const docWarnings = automations.filter((automation) => automation.controlDocs.length === 0)

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Agent Operations', href: '/admin/agents' },
          { label: 'Automation Context' },
        ]} />

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">Automation Context</h1>
            <p className="text-muted-foreground text-sm max-w-3xl">
              Local-first inventory for Portfolio-related Codex automations, their risk boundaries, and the context agents need before acting.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/agents"
              className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 py-2 text-sm hover:border-radiant-gold/60"
            >
              <Bot size={16} />
              Agent Operations
            </Link>
            <button
              onClick={fetchInventory}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading automation inventory...</div>
        ) : error ? (
          <FailureState title="Failed to load automation inventory" message={error} />
        ) : inventory && !inventory.available ? (
          <UnavailableState inventory={inventory} />
        ) : inventory ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3 mb-6">
              <MetricCard label="Portfolio automations" value={inventory.overview.total} />
              <MetricCard label="Active" value={inventory.overview.active} tone="green" />
              <MetricCard label="Open actions" value={actionTracker?.summary.open ?? 0} tone={(actionTracker?.summary.open ?? 0) ? 'yellow' : 'slate'} />
              <MetricCard label="Blocked actions" value={actionTracker?.summary.blocked ?? 0} tone={(actionTracker?.summary.blocked ?? 0) ? 'red' : 'slate'} />
              <MetricCard label="Duplicates" value={inventory.overview.duplicateCandidates} tone={inventory.overview.duplicateCandidates ? 'yellow' : 'slate'} />
              <MetricCard label="High risk" value={inventory.overview.highRisk} tone={inventory.overview.highRisk ? 'red' : 'slate'} />
              <MetricCard label="Missing context" value={inventory.overview.missingContext} tone={inventory.overview.missingContext ? 'yellow' : 'slate'} />
            </div>

            <WarningPanels
              hiddenCount={inventory.hiddenCount}
              duplicateWarnings={duplicateWarnings}
              workspaceWarnings={workspaceWarnings}
              authorityWarnings={authorityWarnings}
              docWarnings={docWarnings}
            />

            <WorkspaceRootVisibility report={inventory.workspaceRoots} />

            <MemoryOrganizationProgress progress={inventory.progress} />

            <div className="mb-6 inline-flex rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-1">
              <button
                onClick={() => setViewMode('actions')}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${viewMode === 'actions' ? 'bg-radiant-gold/15 text-radiant-gold' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <ClipboardList size={16} />
                Action Tracker
              </button>
              <button
                onClick={() => setViewMode('inventory')}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${viewMode === 'inventory' ? 'bg-radiant-gold/15 text-radiant-gold' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <FileText size={16} />
                Inventory
              </button>
              <button
                onClick={() => setViewMode('context-gaps')}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${viewMode === 'context-gaps' ? 'bg-radiant-gold/15 text-radiant-gold' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <ListChecks size={16} />
                Context Gaps
              </button>
              <button
                onClick={() => setViewMode('repair-packets')}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${viewMode === 'repair-packets' ? 'bg-radiant-gold/15 text-radiant-gold' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <ShieldAlert size={16} />
                Repair Packets
              </button>
            </div>

            <section className="mb-6 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
              <div className="mb-4 flex items-center gap-2 text-radiant-gold">
                <SlidersHorizontal size={18} />
                <h2 className="font-semibold">Filters</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <FilterSelect label="Category" value={category} values={CATEGORIES} onChange={(value) => setCategory(value as (typeof CATEGORIES)[number])} />
                <FilterSelect label="Status" value={status} values={STATUSES} onChange={(value) => setStatus(value as (typeof STATUSES)[number])} />
                <FilterSelect label="Risk" value={risk} values={RISKS} onChange={(value) => setRisk(value as (typeof RISKS)[number])} />
                <FilterSelect
                  label="Context health"
                  value={contextHealth}
                  values={CONTEXT_HEALTH}
                  onChange={(value) => setContextHealth(value as (typeof CONTEXT_HEALTH)[number])}
                />
              </div>
            </section>

            {viewMode === 'actions' ? (
              <AutomationActionsView
                tracker={actionTracker}
                error={actionError}
                actionLoadingId={actionLoadingId}
                onUpdate={updateAction}
                onPromote={promoteAction}
              />
            ) : viewMode === 'inventory' ? (
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6">
                <AutomationTable automations={filtered} selectedId={selected?.id || null} onSelect={setSelectedId} />
                {selected ? <ContextReadiness automation={selected} /> : null}
              </div>
            ) : viewMode === 'context-gaps' ? (
              <ContextGapsView
                automations={contextGapAutomations}
                onSelect={(id) => {
                  setSelectedId(id)
                  setViewMode('inventory')
                }}
              />
            ) : (
              <RepairPacketsView packets={inventory.repairPackets} />
            )}

            <p className="mt-5 text-xs text-muted-foreground">
              Source: {inventory.sourceDirectory}. Generated {formatDateTime(inventory.generatedAt)}. Prompt excerpts are sanitized and truncated.
            </p>
          </>
        ) : null}
      </div>
    </div>
  )
}

function AutomationTable({
  automations,
  selectedId,
  onSelect,
}: {
  automations: AutomationProfile[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (automations.length === 0) {
    return (
      <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-8 text-center text-muted-foreground">
        No automations match the current filters.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-silicon-slate/70">
      <table className="w-full text-sm">
        <thead className="bg-silicon-slate/40 text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Automation</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            <th className="text-left px-4 py-3 font-medium">Schedule</th>
            <th className="text-left px-4 py-3 font-medium">Category</th>
            <th className="text-left px-4 py-3 font-medium">Risk</th>
            <th className="text-left px-4 py-3 font-medium">Context</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-silicon-slate/60">
          {automations.map((automation) => (
            <tr
              key={automation.id}
              className={`cursor-pointer hover:bg-silicon-slate/20 ${selectedId === automation.id ? 'bg-radiant-gold/10' : ''}`}
              onClick={() => onSelect(automation.id)}
            >
              <td className="px-4 py-3">
                <p className="font-medium">{automation.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{automation.id}</p>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{automation.promptExcerpt || 'No prompt excerpt available.'}</p>
              </td>
              <td className="px-4 py-3"><StatusBadge status={automation.status} /></td>
              <td className="px-4 py-3 text-muted-foreground">{formatSchedule(automation.schedule)}</td>
              <td className="px-4 py-3">{automation.category}</td>
              <td className="px-4 py-3"><RiskBadge risk={automation.riskLevel} /></td>
              <td className="px-4 py-3"><ContextBadge health={automation.contextHealth} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AutomationActionsView({
  tracker,
  error,
  actionLoadingId,
  onUpdate,
  onPromote,
}: {
  tracker: AutomationActionTrackerResponse | null
  error: string | null
  actionLoadingId: string | null
  onUpdate: (action: AutomationActionItem, status: AutomationActionStatus, note?: string | null) => void
  onPromote: (action: AutomationActionItem) => void
}) {
  if (error) {
    return <FailureState title="Failed to load automation actions" message={error} />
  }

  if (!tracker) {
    return (
      <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-8 text-center text-muted-foreground">
        Loading automation action tracker...
      </div>
    )
  }

  if (!tracker.available) {
    return <FailureState title="Automation action tracker unavailable" message={tracker.reason || 'Local notification state could not be read.'} />
  }

  const activeActions = tracker.actions.filter((action) => action.actionStatus !== 'dismissed')

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-radiant-gold">
              <ClipboardList size={18} />
              <h2 className="font-semibold">Automation Action Tracker</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Converts daily automation blockers and next-run focus items into a local working queue. Status, notes, and Agent Ops links are written to {tracker.stateFile}; summarized progress is exported for the next automation pass.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-right text-xs">
            <DetailPill label="Tracked" value={String(tracker.summary.total)} />
            <DetailPill label="In progress" value={String(tracker.summary.inProgress)} />
            <DetailPill label="Done" value={String(tracker.summary.done)} />
          </div>
        </div>
      </div>

      {activeActions.length === 0 ? (
        <div className="rounded-lg border border-green-400/30 bg-green-500/10 p-6 text-green-100">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 size={18} />
            No active automation actions are waiting on the tracker.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
          <div className="space-y-4">
            {activeActions.map((action) => (
              <AutomationActionCard
                key={action.id}
                action={action}
                loading={actionLoadingId === action.id}
                onUpdate={onUpdate}
                onPromote={onPromote}
              />
            ))}
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
              <h3 className="mb-3 text-sm font-semibold text-radiant-gold">Recent Automation Reports</h3>
              <div className="space-y-3">
                {tracker.recentNotifications.slice(0, 8).map((notification) => (
                  <div key={notification.sourceFile} className="rounded-md border border-silicon-slate/50 bg-black/10 p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{notification.automationName}</p>
                      <StatusColorBadge status={notification.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">{notification.headline}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {notification.actionCount} action(s) · {formatDateTime(notification.ranAtUtc)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  )
}

function AutomationActionCard({
  action,
  loading,
  onUpdate,
  onPromote,
}: {
  action: AutomationActionItem
  loading: boolean
  onUpdate: (action: AutomationActionItem, status: AutomationActionStatus, note?: string | null) => void
  onPromote: (action: AutomationActionItem) => void
}) {
  const [note, setNote] = useState(action.note ?? '')

  useEffect(() => {
    setNote(action.note ?? '')
  }, [action.note, action.id])

  return (
    <article className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ActionStatusBadge status={action.actionStatus} />
            <ActionPriorityBadge priority={action.priority} />
            <StatusColorBadge status={action.statusColor} />
            <span className="rounded-full border border-silicon-slate/60 bg-black/10 px-2 py-1 text-xs text-muted-foreground">
              {action.kind === 'blocker_or_approval' ? 'Blocker or approval' : 'Next run focus'}
            </span>
          </div>
          <h3 className="text-base font-semibold">{action.text}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{action.summary || action.headline}</p>
        </div>
        {action.linkedWorkItemId ? (
          <Link
            href="/admin/agents/coordination"
            className="inline-flex items-center gap-2 rounded-lg border border-green-400/40 bg-green-500/10 px-3 py-2 text-sm text-green-100 hover:underline"
          >
            Open work item
            <ArrowRight size={15} />
          </Link>
        ) : (
          <button
            onClick={() => onPromote(action)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-60"
          >
            <PlayCircle size={15} />
            Create work item
          </button>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <DetailPill label="Automation" value={action.automationName} />
        <DetailPill label="Seen" value={`${action.occurrenceCount}x`} />
        <DetailPill label="First seen" value={formatDateShort(action.firstSeenAt)} />
        <DetailPill label="Last seen" value={formatDateShort(action.lastSeenAt)} />
      </div>

      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Progress note for next automation run</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          className="w-full rounded-lg border border-silicon-slate/70 bg-background px-3 py-2 text-sm"
          placeholder="Add what changed, what is blocked, or what the next run should check."
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onUpdate(action, 'in_progress', note)}
          disabled={loading}
          className="rounded-lg border border-silicon-slate/70 bg-background px-3 py-2 text-sm hover:border-radiant-gold/60 disabled:opacity-60"
        >
          Mark in progress
        </button>
        <button
          onClick={() => onUpdate(action, 'blocked', note)}
          disabled={loading}
          className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100 hover:bg-red-500/15 disabled:opacity-60"
        >
          Mark blocked
        </button>
        <button
          onClick={() => onUpdate(action, 'done', note)}
          disabled={loading}
          className="rounded-lg border border-green-400/40 bg-green-500/10 px-3 py-2 text-sm text-green-100 hover:bg-green-500/15 disabled:opacity-60"
        >
          Mark done
        </button>
        <button
          onClick={() => onUpdate(action, 'dismissed', note)}
          disabled={loading}
          className="rounded-lg border border-silicon-slate/70 bg-black/10 px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          Dismiss
        </button>
      </div>
    </article>
  )
}

function WorkspaceRootVisibility({ report }: { report: AutomationInventoryResponse['workspaceRoots'] }) {
  if (!report.available) {
    return (
      <section className="mb-6 rounded-lg border border-yellow-400/40 bg-yellow-500/10 p-5 text-yellow-100">
        <div className="mb-2 flex items-center gap-2 font-medium">
          <ShieldAlert size={18} />
          Codex workspace-root visibility unavailable
        </div>
        <p className="text-sm">{report.reason || 'Local Codex workspace state could not be read from this environment.'}</p>
        <p className="mt-3 text-xs text-yellow-100/80">Expected root: {report.expectedRoot}</p>
      </section>
    )
  }

  const driftCount = report.overview.nonPortfolioThreads + report.overview.savedRootDrift + report.overview.activeRootDrift + report.overview.projectOrderDrift

  return (
    <section className="mb-6 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-radiant-gold">Codex Workspace Roots</h2>
            <ContextBadge health={report.health} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Read-only view of Codex Desktop roots and active thread placement. Expected root: {report.expectedRoot}.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right text-xs">
          <DetailPill label="Active threads" value={String(report.overview.activeThreads)} />
          <DetailPill label="Portfolio" value={String(report.overview.portfolioThreads)} />
          <DetailPill label="Drift" value={String(driftCount)} />
        </div>
      </div>

      {report.warnings.length > 0 ? (
        <div className="mb-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
          {report.warnings.map((warning) => (
            <div key={warning} className="rounded-lg border border-yellow-400/30 bg-yellow-500/10 p-3 text-sm text-yellow-100">
              <div className="flex items-center gap-2"><AlertTriangle size={16} /> {warning}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-green-400/30 bg-green-500/10 p-3 text-sm text-green-100">
          <div className="flex items-center gap-2"><CheckCircle2 size={16} /> Active Codex roots are aligned with Portfolio.</div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
        <div className="overflow-hidden rounded-lg border border-silicon-slate/70">
          <table className="w-full text-sm">
            <thead className="bg-silicon-slate/40 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Thread root</th>
                <th className="text-left px-4 py-3 font-medium">Active chats</th>
                <th className="text-left px-4 py-3 font-medium">Alignment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-silicon-slate/60">
              {report.threadRoots.length > 0 ? report.threadRoots.map((root) => (
                <tr key={root.cwd}>
                  <td className="px-4 py-3 break-all">{root.cwd}</td>
                  <td className="px-4 py-3">{root.activeCount}</td>
                  <td className="px-4 py-3">
                    {root.portfolioRoot ? <ContextBadge health="green" /> : <ContextBadge health="yellow" />}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td className="px-4 py-3 text-muted-foreground" colSpan={3}>No active thread roots were found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 text-sm">
          <ContextList label="Saved workspace roots" values={report.savedWorkspaceRoots} />
          <ContextList label="Active workspace roots" values={report.activeWorkspaceRoots} />
          <ContextList label="Project order roots" values={report.projectOrderRoots} />
          <div className="rounded-lg border border-silicon-slate/60 bg-black/10 p-3 text-xs text-muted-foreground">
            {report.operationalBoundary}
          </div>
        </div>
      </div>
    </section>
  )
}

function MemoryOrganizationProgress({ progress }: { progress: AutomationInventoryResponse['progress'] }) {
  return (
    <section className="mb-6 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-radiant-gold">
            <ListChecks size={18} />
            <h2 className="font-semibold">{progress.label}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {progress.completedTasks} of {progress.totalTasks} workflow tasks complete. This progress is computed from the current read-only inventory.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{progress.percent}%</p>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">overall readiness</p>
        </div>
      </div>

      <div className="mb-5 h-3 overflow-hidden rounded-full bg-black/30">
        <div
          className="h-full rounded-full bg-radiant-gold transition-all"
          style={{ width: `${Math.max(0, Math.min(progress.percent, 100))}%` }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {progress.tasks.map((task) => (
          <div key={task.id} className="rounded-lg border border-silicon-slate/60 bg-background/50 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{task.label}</h3>
              <TaskStatusBadge status={task.status} />
            </div>
            <p className="min-h-[40px] text-xs text-muted-foreground">{task.description}</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/30">
                <div
                  className={`h-full rounded-full ${task.status === 'completed' ? 'bg-green-400' : task.status === 'blocked' ? 'bg-red-400' : 'bg-yellow-300'}`}
                  style={{ width: `${Math.max(0, Math.min(task.progress, 100))}%` }}
                />
              </div>
              <span className="w-10 text-right text-xs text-muted-foreground">{task.progress}%</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ContextReadiness({ automation }: { automation: AutomationProfile }) {
  const profile = automation.contextProfile

  return (
    <aside className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5 h-fit">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{automation.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground break-all">{automation.sourceFile}</p>
        </div>
        <ContextBadge health={automation.contextHealth} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 text-xs">
        <DetailPill label="Boundary" value={automation.managementBoundary} />
        <DetailPill label="Runtime" value={automation.executionEnvironment || 'unknown'} />
        <DetailPill label="Model" value={automation.model || 'unknown'} />
        <DetailPill label="Reasoning" value={automation.reasoningEffort || 'unknown'} />
      </div>

      {automation.contextGaps.length > 0 ? (
        <section className="mb-5 rounded-lg border border-yellow-400/30 bg-yellow-500/10 p-3">
          <div className="mb-2 flex items-center gap-2 text-yellow-200">
            <AlertTriangle size={16} />
            <h3 className="font-medium">Context gaps</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {automation.contextGaps.map((gap) => (
              <span key={gap} className="rounded-full border border-yellow-400/30 bg-black/20 px-2 py-1 text-xs text-yellow-100">
                {gap}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <div className="space-y-4 text-sm">
        <ContextBlock label="Purpose" value={profile.purpose} />
        <ContextBlock label="Operating rhythm" value={profile.operatingRhythm} />
        <ContextBlock label="Recurring decisions" value={profile.recurringDecisions} />
        <ContextList label="Inputs and source paths" values={profile.inputs} />
        <ContextList label="Dependencies" values={profile.dependencies} />
        <ContextList label="Friction points" values={profile.frictionPoints} />
        <ContextList label="Expected outputs" values={profile.expectedOutputs} />
        <ContextBlock label="Escalation trigger" value={profile.escalationTrigger} />
        <ContextList label="Governing docs, skills, and runbooks" values={profile.governingDocs} />
      </div>
    </aside>
  )
}

function ContextGapsView({
  automations,
  onSelect,
}: {
  automations: AutomationProfile[]
  onSelect: (id: string) => void
}) {
  if (automations.length === 0) {
    return (
      <div className="rounded-lg border border-green-400/30 bg-green-500/10 p-6 text-green-100">
        <div className="flex items-center gap-2 font-medium">
          <CheckCircle2 size={18} />
          All visible automations answer the current context-readiness questions.
        </div>
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
        <div className="flex items-center gap-2 text-radiant-gold">
          <ListChecks size={18} />
          <h2 className="font-semibold">Context Gaps Workflow</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Read-only readiness review for the seven operating-context questions. Missing answers are recommendations only; v1 does not write back to TOML, docs, or skills.
        </p>
      </div>

      {automations.map((automation) => {
        const missing = automation.contextQuestions.filter((question) => !question.answered)
        return (
          <article key={automation.id} className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold">{automation.name}</h3>
                  <ContextBadge health={automation.contextHealth} />
                  <RiskBadge risk={automation.riskLevel} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground break-all">{automation.sourceFile}</p>
              </div>
              <button
                onClick={() => onSelect(automation.id)}
                className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-background px-3 py-2 text-sm hover:border-radiant-gold/60"
              >
                View inventory details
                <ArrowRight size={15} />
              </button>
            </div>

            <div className="mb-4 rounded-lg border border-yellow-400/30 bg-yellow-500/10 p-3 text-sm text-yellow-100">
              <span className="font-medium">{missing.length} missing answer(s): </span>
              {missing.map((question) => question.id).join(', ')}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {automation.contextQuestions.map((question) => (
                <div
                  key={question.id}
                  className={`rounded-lg border p-4 ${
                    question.answered
                      ? 'border-green-400/20 bg-green-500/5'
                      : 'border-yellow-400/30 bg-yellow-500/10'
                  }`}
                >
                  <div className="mb-2 flex items-start gap-2">
                    {question.answered ? (
                      <CheckCircle2 className="mt-0.5 shrink-0 text-green-300" size={16} />
                    ) : (
                      <AlertTriangle className="mt-0.5 shrink-0 text-yellow-300" size={16} />
                    )}
                    <h4 className="text-sm font-medium">{question.question}</h4>
                  </div>
                  {question.answered ? (
                    <p className="text-sm text-muted-foreground">{question.answer}</p>
                  ) : (
                    <p className="text-sm text-yellow-100">{question.recommendation}</p>
                  )}
                </div>
              ))}
            </div>
          </article>
        )
      })}
    </section>
  )
}

function RepairPacketsView({ packets }: { packets: AutomationInventoryResponse['repairPackets'] }) {
  if (packets.length === 0) {
    return (
      <div className="rounded-lg border border-green-400/30 bg-green-500/10 p-6 text-green-100">
        <div className="flex items-center gap-2 font-medium">
          <CheckCircle2 size={18} />
          No repair packets are needed for the current automation inventory.
        </div>
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
        <div className="flex items-center gap-2 text-radiant-gold">
          <ShieldAlert size={18} />
          <h2 className="font-semibold">Repair Packets</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Read-only next-action packets for automations with missing context, duplicate risk, or incomplete governing references. These packets do not write to Codex memory or automation state.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {packets.map((packet) => (
          <article key={packet.automationId} className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold">{packet.automationName}</h3>
                  <RepairPriorityBadge priority={packet.priority} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{packet.automationId}</p>
              </div>
              <p className="text-xs text-muted-foreground break-all md:max-w-[260px]">{packet.sourceFile}</p>
            </div>

            <p className="mb-4 text-sm text-foreground">{packet.summary}</p>

            <div className="mb-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Missing readiness</h4>
              {packet.missingQuestions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {packet.missingQuestions.map((question) => (
                    <span key={question} className="rounded-full border border-yellow-400/30 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-100">
                      {question}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No missing questions; packet exists for duplicate or overlap review.</p>
              )}
            </div>

            <ContextList label="Recommended actions" values={packet.recommendedActions} />
            <div className="mt-4">
              <ContextList label="Governing doc candidates" values={packet.governingDocCandidates} />
            </div>

            <div className="mt-4 rounded-lg border border-silicon-slate/60 bg-black/10 p-3 text-xs text-muted-foreground">
              {packet.operationalBoundary}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function WarningPanels({
  hiddenCount,
  duplicateWarnings,
  workspaceWarnings,
  authorityWarnings,
  docWarnings,
}: {
  hiddenCount: number
  duplicateWarnings: AutomationProfile[]
  workspaceWarnings: AutomationProfile[]
  authorityWarnings: AutomationProfile[]
  docWarnings: AutomationProfile[]
}) {
  const warnings = [
    duplicateWarnings.length ? `${duplicateWarnings.length} duplicate or overlapping automation candidate(s)` : null,
    workspaceWarnings.length ? `${workspaceWarnings.length} automation(s) missing the Portfolio workspace path` : null,
    authorityWarnings.length ? `${authorityWarnings.length} high-risk automation(s) missing explicit authority boundaries` : null,
    docWarnings.length ? `${docWarnings.length} automation(s) without governing docs, skills, or runbooks` : null,
    hiddenCount ? `${hiddenCount} non-Portfolio automation(s) hidden by default` : null,
  ].filter(Boolean) as string[]

  if (warnings.length === 0) {
    return (
      <div className="mb-6 rounded-lg border border-green-400/30 bg-green-500/10 p-4 text-sm text-green-100">
        <div className="flex items-center gap-2 font-medium"><CheckCircle2 size={18} /> No automation inventory warnings found.</div>
      </div>
    )
  }

  return (
    <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
      {warnings.map((warning) => (
        <div key={warning} className="rounded-lg border border-yellow-400/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
          <div className="flex items-center gap-2 font-medium"><AlertTriangle size={18} /> {warning}</div>
        </div>
      ))}
    </div>
  )
}

function MetricCard({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'green' | 'yellow' | 'red' | 'slate' }) {
  const toneClass =
    tone === 'green' ? 'text-green-300' : tone === 'yellow' ? 'text-yellow-300' : tone === 'red' ? 'text-red-300' : 'text-foreground'
  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-silicon-slate/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  values,
  onChange,
}: {
  label: string
  value: string
  values: readonly string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-silicon-slate/70 bg-background px-3 py-2 text-sm"
      >
        {values.map((option) => (
          <option key={option} value={option}>{option === ALL ? `All ${label.toLowerCase()}` : option}</option>
        ))}
      </select>
    </label>
  )
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === 'ACTIVE'
      ? 'border-green-400/40 bg-green-500/10 text-green-200'
      : status === 'PAUSED'
        ? 'border-yellow-400/40 bg-yellow-500/10 text-yellow-200'
        : 'border-silicon-slate/60 bg-black/20 text-muted-foreground'
  return <span className={`rounded-full border px-2 py-1 text-xs ${className}`}>{status}</span>
}

function RiskBadge({ risk }: { risk: AutomationRiskLevel }) {
  const className =
    risk === 'high'
      ? 'border-red-400/40 bg-red-500/10 text-red-200'
      : risk === 'medium'
        ? 'border-yellow-400/40 bg-yellow-500/10 text-yellow-200'
        : 'border-green-400/40 bg-green-500/10 text-green-200'
  return <span className={`rounded-full border px-2 py-1 text-xs ${className}`}>{risk}</span>
}

function RepairPriorityBadge({ priority }: { priority: CodexAutomationRepairPriority }) {
  const className =
    priority === 'high'
      ? 'border-red-400/40 bg-red-500/10 text-red-200'
      : priority === 'medium'
        ? 'border-yellow-400/40 bg-yellow-500/10 text-yellow-200'
        : 'border-green-400/40 bg-green-500/10 text-green-200'
  return <span className={`rounded-full border px-2 py-1 text-xs ${className}`}>{priority} priority</span>
}

function ContextBadge({ health }: { health: AutomationContextHealth }) {
  const icon = health === 'green' ? <CheckCircle2 size={13} /> : health === 'yellow' ? <AlertTriangle size={13} /> : <XCircle size={13} />
  const className =
    health === 'green'
      ? 'border-green-400/40 bg-green-500/10 text-green-200'
      : health === 'yellow'
        ? 'border-yellow-400/40 bg-yellow-500/10 text-yellow-200'
        : 'border-red-400/40 bg-red-500/10 text-red-200'
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${className}`}>{icon}{health}</span>
}

function TaskStatusBadge({ status }: { status: MemoryOrganizationTaskStatus }) {
  const className =
    status === 'completed'
      ? 'border-green-400/40 bg-green-500/10 text-green-200'
      : status === 'blocked'
        ? 'border-red-400/40 bg-red-500/10 text-red-200'
        : status === 'in_progress'
          ? 'border-yellow-400/40 bg-yellow-500/10 text-yellow-200'
          : 'border-silicon-slate/60 bg-black/20 text-muted-foreground'
  return <span className={`rounded-full border px-2 py-1 text-[11px] ${className}`}>{status.replace('_', ' ')}</span>
}

function ActionStatusBadge({ status }: { status: AutomationActionStatus }) {
  const className =
    status === 'done'
      ? 'border-green-400/40 bg-green-500/10 text-green-200'
      : status === 'blocked'
        ? 'border-red-400/40 bg-red-500/10 text-red-200'
        : status === 'in_progress'
          ? 'border-yellow-400/40 bg-yellow-500/10 text-yellow-200'
          : status === 'dismissed'
            ? 'border-silicon-slate/60 bg-black/20 text-muted-foreground'
            : 'border-radiant-gold/40 bg-radiant-gold/10 text-radiant-gold'
  return <span className={`rounded-full border px-2 py-1 text-xs ${className}`}>{status.replace('_', ' ')}</span>
}

function ActionPriorityBadge({ priority }: { priority: AutomationActionItem['priority'] }) {
  const className =
    priority === 'urgent'
      ? 'border-red-400/50 bg-red-500/15 text-red-100'
      : priority === 'high'
        ? 'border-yellow-400/40 bg-yellow-500/10 text-yellow-100'
        : priority === 'medium'
          ? 'border-blue-400/40 bg-blue-500/10 text-blue-100'
          : 'border-silicon-slate/60 bg-black/20 text-muted-foreground'
  return <span className={`rounded-full border px-2 py-1 text-xs ${className}`}>{priority}</span>
}

function StatusColorBadge({ status }: { status: string }) {
  const className =
    status === 'green'
      ? 'border-green-400/40 bg-green-500/10 text-green-200'
      : status === 'yellow'
        ? 'border-yellow-400/40 bg-yellow-500/10 text-yellow-200'
        : status === 'red'
          ? 'border-red-400/40 bg-red-500/10 text-red-200'
          : 'border-silicon-slate/60 bg-black/20 text-muted-foreground'
  return <span className={`rounded-full border px-2 py-1 text-xs ${className}`}>{status}</span>
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-silicon-slate/50 bg-black/10 p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  )
}

function ContextBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h3>
      <p className={value ? 'text-foreground' : 'text-muted-foreground'}>{value || 'Not found in the current automation context.'}</p>
    </section>
  )
}

function ContextList({ label, values }: { label: string; values: string[] }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h3>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span key={value} className="rounded-md border border-silicon-slate/50 bg-black/10 px-2 py-1 text-xs break-all">
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">Not found in the current automation context.</p>
      )}
    </section>
  )
}

function FailureState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-5 text-red-300">
      <div className="flex items-center gap-2 font-medium"><AlertTriangle size={18} /> {title}</div>
      <p className="text-sm mt-1">{message}</p>
    </div>
  )
}

function UnavailableState({ inventory }: { inventory: AutomationInventoryResponse }) {
  return (
    <div className="rounded-lg border border-yellow-400/40 bg-yellow-500/10 p-5 text-yellow-100">
      <div className="mb-2 flex items-center gap-2 font-medium">
        <ShieldAlert size={18} />
        Local automation inventory unavailable
      </div>
      <p className="text-sm">
        {inventory.reason || 'The local Codex automation directory cannot be read from this environment.'}
      </p>
      <p className="mt-3 flex items-center gap-2 text-xs text-yellow-100/80">
        <FileText size={14} />
        Expected source: {inventory.sourceDirectory}
      </p>
    </div>
  )
}

function formatSchedule(schedule: string | null) {
  if (!schedule) return '-'
  return schedule
    .replace('FREQ=', '')
    .replace(/;BY/g, ' · BY')
    .replace(/;INTERVAL=/g, ' · every ')
}

function formatDateTime(value: string | number | null) {
  if (!value) return '-'
  const date = typeof value === 'number' ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatDateShort(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}
