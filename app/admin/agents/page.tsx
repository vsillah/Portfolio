'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Columns,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Gauge,
  Maximize2,
  Network,
  Play,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Users,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import AgentAvatar from '@/components/admin/AgentAvatar'
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
  quality_summary: {
    window_hours: number
    generated_at: string
    rubric_count: number
    evaluation_count: number
    average_score: number | null
    pass_rate: number | null
    by_agent: Array<{
      agent_key: string
      evaluation_count: number
      average_score: number | null
      pass_rate: number | null
      latest_score: number | null
      latest_evaluated_at: string | null
    }>
    needs_coaching: Array<{
      agent_key: string
      rubric_key: string
      rubric_name: string
      latest_score: number | null
      threshold: number
      reason: string
      run_id: string | null
      evaluated_at: string | null
    }>
    rubric_trends: Array<{
      rubric_key: string
      rubric_name: string
      agent_key: string
      workflow_key: string | null
      latest_score: number | null
      average_score: number | null
      pass_rate: number | null
      evaluation_count: number
      threshold: number
      latest_evaluated_at: string | null
      direction: 'up' | 'down' | 'flat' | 'unknown'
    }>
  }
  operating_signals: Array<{
    run_id: string
    kind: 'morning_review' | 'deployment_watch' | 'ai_risk_signal_monitor'
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

type OperatorRun = {
  id: string
  kind: string
  title: string
  runtime: string
  status: string
  current_step: string | null
  started_at: string
  completed_at: string | null
  stale: boolean
}

type MoremiMonitorReview = {
  has_monitor: boolean
  run: {
    id: string
    status: string
    overall: string | null
    generated_at: string | null
    completed_at: string | null
    href: string
  } | null
  warnings: string[]
  warning_count: number
  enabled_source_feed_count: number
  disabled_source_feed_count: number
  safety_boundary: string | null
  linked_work_items: Array<{
    id: string
    title: string
    status: string
    owner_agent_key: string | null
  }>
}

type AutomationGoalSummary = {
  id: string
  tier: 1 | 2
  title: string
  objective: string
  workflowFamily: string
  automationLevel: 'full_internal' | 'draft_to_review' | 'approval_gated' | 'discovery_only'
  ownerAgentKey: string
  collaboratorAgentKeys: string[]
  sourceRoutes: string[]
  sourceDocs: string[]
  n8nWorkflows: string[]
  approvalGate: string
  nextAction: string
  requiresNewWorkflow: boolean
  seeded: boolean
  seeded_child_count: number
  seeded_parent_work_item: {
    id: string
    status: string
    metadata?: Record<string, unknown>
  } | null
  n8n_proposal_count?: number
  latest_n8n_proposal?: {
    id: string
    title: string
    status: string
    priority?: string
    metadata?: Record<string, unknown>
  } | null
}

type OperatorActionKind = 'morning-review' | 'hermes' | 'approval-drill' | 'runtime-evaluation'

const OPERATOR_ACTIONS: Array<{
  kind: OperatorActionKind
  label: string
  purpose: string
  runKind: string
  windowLabel: string
  isAvailable: (now: Date) => boolean
  windowKey: (now: Date) => string
}> = [
  {
    kind: 'morning-review',
    label: 'Morning review',
    purpose: 'Polls current Agent Ops health, stale runs, approvals, and operating signals.',
    runKind: 'agent_ops_morning_review',
    windowLabel: 'Weekdays, 6-11 AM',
    isAvailable: (now) => isWeekday(now) && now.getHours() >= 6 && now.getHours() < 11,
    windowKey: (now) => `${localDateKey(now)}:morning`,
  },
  {
    kind: 'hermes',
    label: 'Hermes health',
    purpose: 'Checks Hermes runtime health and records the result as an agent trace.',
    runKind: 'system_health_summary',
    windowLabel: 'Every 4 hours',
    isAvailable: () => true,
    windowKey: (now) => `${localDateKey(now)}:${Math.floor(now.getHours() / 4)}`,
  },
  {
    kind: 'approval-drill',
    label: 'Approval drill',
    purpose: 'Creates a synthetic approval-path check without production mutation.',
    runKind: 'approval_gate_drill',
    windowLabel: 'Weekdays, 9 AM-5 PM',
    isAvailable: (now) => isWeekday(now) && now.getHours() >= 9 && now.getHours() < 17,
    windowKey: (now) => `${localDateKey(now)}:business-day`,
  },
  {
    kind: 'runtime-evaluation',
    label: 'Runtime probe',
    purpose: 'Runs a read-only OpenCode/runtime probe for execution-path readiness.',
    runKind: 'runtime_evaluation',
    windowLabel: 'Weekdays, 9 AM-6 PM',
    isAvailable: (now) => isWeekday(now) && now.getHours() >= 9 && now.getHours() < 18,
    windowKey: (now) => `${localDateKey(now)}:${Math.floor(now.getHours() / 6)}`,
  },
]

export default function AgentOperationsPage() {
  const [snapshot, setSnapshot] = useState<MissionSnapshot | null>(null)
  const [moremiReview, setMoremiReview] = useState<MoremiMonitorReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [moremiReviewLoading, setMoremiReviewLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [command, setCommand] = useState('')
  const [chiefLoading, setChiefLoading] = useState(false)
  const [chiefReply, setChiefReply] = useState<ChiefReply | null>(null)
  const [warRoomLoading, setWarRoomLoading] = useState<'standup' | 'discuss' | null>(null)
  const [warRoomResult, setWarRoomResult] = useState<WarRoomResult | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<{ label: string; runId: string; kind?: OperatorActionKind } | null>(null)
  const [inboxRoutingId, setInboxRoutingId] = useState<string | null>(null)
  const [engagementLoadingKey, setEngagementLoadingKey] = useState<string | null>(null)
  const [moremiReviewConfirm, setMoremiReviewConfirm] = useState(false)
  const [inboxPage, setInboxPage] = useState(0)
  const [operatorRuns, setOperatorRuns] = useState<OperatorRun[]>([])
  const [automationGoals, setAutomationGoals] = useState<AutomationGoalSummary[]>([])
  const [automationGoalsLoading, setAutomationGoalsLoading] = useState(false)
  const [automationSeedLoading, setAutomationSeedLoading] = useState(false)
  const [automationGoalPage, setAutomationGoalPage] = useState(0)

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

  const loadMoremiReview = useCallback(async () => {
    setMoremiReviewLoading(true)
    try {
      const response = await authedFetch('/api/admin/agents/risk-compliance/monitor?review=latest')
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setMoremiReview(body.review)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Moremi review')
    } finally {
      setMoremiReviewLoading(false)
    }
  }, [authedFetch])

  const loadOperatorRuns = useCallback(async () => {
    try {
      const response = await authedFetch('/api/admin/agents/runs?kind=operator_checks&limit=75')
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setOperatorRuns(body.runs || [])
    } catch {
      setOperatorRuns([])
    }
  }, [authedFetch])

  const loadAutomationGoals = useCallback(async () => {
    setAutomationGoalsLoading(true)
    try {
      const response = await authedFetch('/api/admin/agents/automation-goals?tier=1')
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setAutomationGoals(Array.isArray(body.goals) ? body.goals : [])
    } catch {
      setAutomationGoals([])
    } finally {
      setAutomationGoalsLoading(false)
    }
  }, [authedFetch])

  useEffect(() => {
    loadMissionControl()
    loadMoremiReview()
    loadOperatorRuns()
    loadAutomationGoals()
  }, [loadMissionControl, loadMoremiReview, loadOperatorRuns, loadAutomationGoals])

  async function refreshMissionControl() {
    await Promise.all([loadMissionControl(), loadMoremiReview(), loadOperatorRuns(), loadAutomationGoals()])
  }

  async function askChiefOfStaff(message: string) {
    const trimmedMessage = message.trim()
    if (!trimmedMessage) return

    setChiefLoading(true)
    setChiefReply(null)
    setError(null)
    try {
      const response = await authedFetch('/api/admin/agents/chief-of-staff/chat', {
        method: 'POST',
        body: JSON.stringify({ message: trimmedMessage }),
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

  async function submitChiefOfStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = command.trim()
    if (!message) return
    await askChiefOfStaff(message)
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

  async function runOperatorAction(kind: OperatorActionKind) {
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
      setActionResult({ label: OPERATOR_ACTIONS.find((action) => action.kind === kind)?.label ?? kind.replace(/-/g, ' '), runId: body.run_id, kind })
      await Promise.all([loadMissionControl(), loadOperatorRuns()])
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

  async function createMoremiWarningWorkItems() {
    if (!moremiReviewConfirm) {
      setMoremiReviewConfirm(true)
      return
    }

    setActionLoading('moremi-review')
    setActionResult(null)
    setError(null)
    try {
      const response = await authedFetch('/api/admin/agents/risk-compliance/monitor', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_moremi_warning_work_items',
          confirmation: 'create_moremi_warning_work_items',
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setMoremiReview(body.review)
      setMoremiReviewConfirm(false)
      setActionResult({ label: `Moremi proposed ${body.work_items?.length ?? 0} work item(s)`, runId: body.review?.run?.id ?? 'moremi' })
      await loadMissionControl()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Moremi review action failed')
    } finally {
      setActionLoading(null)
    }
  }

  async function seedTierOneAutomationGoals() {
    setAutomationSeedLoading(true)
    setActionResult(null)
    setError(null)
    try {
      const response = await authedFetch('/api/admin/agents/automation-goals/seed', {
        method: 'POST',
        body: JSON.stringify({
          tier: 1,
          confirmation: 'seed_agent_automation_goals',
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setActionResult({ label: `seeded ${body.seeded_goals?.length ?? 0} automation goal(s)`, runId: body.seeded_goals?.[0]?.parent_work_item?.active_run_id ?? 'automation-goals' })
      await Promise.all([loadAutomationGoals(), loadMissionControl()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Automation goal seeding failed')
    } finally {
      setAutomationSeedLoading(false)
    }
  }

  const rosterCount = snapshot?.roster.flatMap((pod) => pod.agents).filter((agent) => agent.status !== 'planned').length ?? 0
  const decisionQueueCount = snapshot?.status_strip.pending_approvals ?? snapshot?.status_strip.waiting_for_approval ?? 0
  const kanbanSignalCount = (snapshot?.status_strip.running ?? 0) + (snapshot?.status_strip.queued ?? 0)
  const healthLabel = (snapshot?.status_strip.failed ?? 0) || (snapshot?.status_strip.stale ?? 0) ? 'Needs review' : 'Read-only healthy'
  const failedOrStaleCount = (snapshot?.status_strip.failed ?? 0) + (snapshot?.status_strip.stale ?? 0)
  const deadLetterCount = snapshot?.dead_letter_queue.length ?? 0
  const engagementCount = snapshot?.engagement_queue.length ?? 0
  const operatingSignalCount = snapshot?.operating_signals.length ?? 0
  const moremiWarningCount = moremiReview?.warning_count ?? 0
  const qualityScore = snapshot?.quality_summary.average_score === null || snapshot?.quality_summary.average_score === undefined
    ? 'No score'
    : snapshot.quality_summary.average_score.toFixed(1)
  const qualityDetail = snapshot?.quality_summary.evaluation_count
    ? `${snapshot.quality_summary.evaluation_count} evaluation(s)`
    : 'Chat Eval home'
  const ragStatus = snapshot?.knowledge_governance
    ? snapshot.knowledge_governance.validation.ok ? 'Ready' : 'Blocked'
    : 'Open Brain'
  const inboxItems = snapshot?.agent_inbox ?? []
  const inboxPageCount = Math.max(1, Math.ceil(inboxItems.length / 3))
  const visibleInboxItems = inboxItems.slice(inboxPage * 3, inboxPage * 3 + 3)
  const automationGoalPageCount = Math.max(1, Math.ceil(automationGoals.length / 3))
  const visibleAutomationGoals = automationGoals.slice(automationGoalPage * 3, automationGoalPage * 3 + 3)
  const primaryWorkHomes = [
    {
      eyebrow: 'Decision Queue',
      title: 'Approval controller',
      href: '/admin/agents/coordination',
      metric: `${decisionQueueCount} waiting`,
      icon: <ShieldCheck size={18} />,
    },
    {
      eyebrow: 'Agent Kanban',
      title: 'Work by state, owner, and blocker',
      href: '/admin/agents/swarm-board',
      metric: `${kanbanSignalCount} moving`,
      icon: <Columns size={18} />,
    },
    {
      eyebrow: 'Run Console',
      title: 'Trace, evaluation, and dead-letter history',
      href: '/admin/agents/runs',
      metric: `${failedOrStaleCount} review`,
      icon: <Activity size={18} />,
    },
    {
      eyebrow: 'Automation Context',
      title: 'Recurring jobs and scheduled operators',
      href: '/admin/agents/automations',
      metric: 'Scheduled',
      icon: <Clock3 size={18} />,
    },
    {
      eyebrow: 'Open Brain',
      title: 'Memory and RAG governance',
      href: '/admin/agents/open-brain',
      metric: ragStatus,
      icon: <Network size={18} />,
    },
  ] as const
  const operationalSignalHomes = [
    {
      title: 'Cost Intelligence',
      detail: `$${(snapshot?.status_strip.cost_today ?? 0).toFixed(4)} today`,
      href: '/admin/cost-revenue',
      icon: <CircleDollarSign size={16} />,
    },
    {
      title: 'Quality Signals',
      detail: `${qualityScore} · ${qualityDetail}`,
      href: '/admin/chat-eval',
      icon: <Gauge size={16} />,
    },
    {
      title: 'Deployment Watcher',
      detail: operatingSignalCount ? `${operatingSignalCount} signal(s)` : 'Trace home',
      href: '/admin/agents/runs',
      icon: <Radio size={16} />,
    },
    {
      title: 'Moremi Warning Review',
      detail: moremiWarningCount ? `${moremiWarningCount} warning(s)` : 'Read-only monitor',
      href: moremiReview?.run?.href ?? '/admin/agents/coordination',
      icon: moremiWarningCount ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />,
    },
    {
      title: 'Engagement Work Queue',
      detail: engagementCount ? `${engagementCount} request(s)` : 'Kanban and traces',
      href: engagementCount ? '/admin/agents/runs' : '/admin/agents/swarm-board',
      icon: <ClipboardList size={16} />,
    },
    {
      title: 'Dead-Letter Monitor',
      detail: deadLetterCount ? `${deadLetterCount} failed or stale` : 'No dead letters',
      href: '/admin/agents/runs',
      icon: deadLetterCount ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />,
    },
  ] as const

  useEffect(() => {
    setInboxPage((page) => Math.min(page, Math.max(inboxPageCount - 1, 0)))
  }, [inboxPageCount])

  useEffect(() => {
    setAutomationGoalPage((page) => Math.min(page, Math.max(automationGoalPageCount - 1, 0)))
  }, [automationGoalPageCount])

  return (
    <ProtectedRoute requireAdmin>
      <div className="agent-ops-page min-h-screen p-5 text-foreground lg:p-7">
        <div className="max-w-7xl mx-auto">
          <Breadcrumbs items={[{ label: 'Admin Dashboard', href: '/admin' }, { label: 'Agent Operations' }]} />

          {error ? (
            <div className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <section className="agent-ops-panel mt-5 rounded-xl border">
            <div className="flex flex-col gap-4 border-b border-silicon-slate/60 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agent Operations</p>
                <h2 className="mt-1 text-2xl font-bold">Mission Control</h2>
              </div>
              <div className="flex flex-wrap gap-2" aria-label="Mission Control actions">
                <button
                  type="button"
                  onClick={refreshMissionControl}
                  disabled={loading || moremiReviewLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-background/60 px-3 py-2 text-sm hover:border-radiant-gold/60 disabled:opacity-60"
                >
                  <RefreshCw size={16} className={loading || moremiReviewLoading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div>
                <div className="grid gap-4">
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4" aria-label="Mission Control status blocks">
                    <MissionStatusCard
                      as="link"
                      href="/admin/agents/coordination"
                      icon={<ShieldCheck size={18} />}
                      label="Decision Queue"
                      value={decisionQueueCount}
                      detail="Open controller"
                      status={decisionQueueCount ? 'Needs decision' : 'Clear'}
                      tone={decisionQueueCount ? 'yellow' : 'green'}
                    />
                    <MissionStatusCard
                      as="link"
                      href="/admin/agents/swarm-board"
                      icon={<Columns size={18} />}
                      label="Kanban"
                      value={kanbanSignalCount}
                      detail="Work items"
                      status="Open board"
                      tone="blue"
                    />
                    <MissionStatusCard
                      as="link"
                      href="/admin/agents/swarm-board"
                      icon={<Users size={18} />}
                      label="Agents"
                      value={rosterCount}
                      detail="Roster"
                      status="Board home"
                      tone="neutral"
                    />
                    <MissionStatusCard
                      as="link"
                      href="/admin/agents/runs"
                      icon={<Radio size={18} />}
                      label="Health"
                      value={healthLabel}
                      detail={`${snapshot?.status_strip.failed ?? 0} failed, ${snapshot?.status_strip.stale ?? 0} stale`}
                      status="Trace home"
                      tone={healthLabel === 'Read-only healthy' ? 'green' : 'red'}
                    />
                  </div>
                </div>

                <DailyBriefPanel
                  brief={snapshot?.daily_brief ?? null}
                  loading={loading}
                  activeRuns={snapshot?.status_strip.active ?? 0}
                  failedOrStaleRuns={failedOrStaleCount}
                  pendingApprovals={decisionQueueCount}
                  costToday={snapshot?.status_strip.cost_today ?? 0}
                />

                <div className="agent-ops-command-card mt-5 rounded-lg border p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-radiant-gold">Ask Shaka</p>
                      <h3 className="mt-2 text-xl font-semibold">What should I pay attention to before approving this queue?</h3>
                    </div>
                  </div>
                  <form onSubmit={submitChiefOfStaff} className="mt-3 flex flex-col gap-3 md:flex-row">
                    <div className="relative min-h-[48px] flex-1">
                      <input
                        value={command}
                        onChange={(event) => setCommand(event.target.value)}
                        aria-label="Ask Shaka"
                        placeholder="Ask about blockers, owners, risk, next action, or summarize active agents..."
                        className="h-full min-h-[48px] w-full rounded-lg border border-silicon-slate/70 bg-background/70 px-3 pr-12 text-sm outline-none focus:border-radiant-gold/70"
                      />
                      <Link
                        href="/admin/agents/chief-of-staff"
                        aria-label="Expand Shaka chat"
                        title="Expand Shaka chat"
                        className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-silicon-slate/60 bg-background/70 text-muted-foreground hover:border-radiant-gold/60 hover:text-radiant-gold"
                      >
                        <Maximize2 size={15} />
                      </Link>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={chiefLoading || !command.trim()}
                        className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/60 bg-radiant-gold px-4 py-2 text-sm font-semibold text-silicon-slate hover:bg-radiant-gold/90 disabled:opacity-60"
                      >
                        <Send size={16} />
                        Ask
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
                  <div className="mt-3 flex flex-wrap gap-2" aria-label="Ask Shaka quick prompts">
                    <QuickPrompt label="Summarize today" disabled={chiefLoading} onClick={() => askChiefOfStaff('Summarize today. What needs attention, what can wait, and what should I do next?')} />
                    <QuickPrompt label="Find blockers" disabled={chiefLoading} onClick={() => askChiefOfStaff('Find the most important blockers across Agent Ops and tell me where to handle each one.')} />
                    <QuickPrompt label="Who owns this?" disabled={chiefLoading} onClick={() => askChiefOfStaff('Who owns the current Agent Ops work, and which L2 or L3 surface should I use for follow-up?')} />
                  </div>

                  {chiefReply ? (
                    <>
                      <ResultPanel
                        title="Shaka"
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

              </div>

              <aside className="space-y-4">
                <div className="agent-ops-card rounded-lg border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-radiant-gold">Agent interaction</p>
                  <div className="mt-3 grid gap-3">
                    <Link href="/admin/agents/swarm-board" className="block rounded-lg border border-radiant-gold/45 bg-radiant-gold/10 p-3 shadow-gold-glow-sm hover:bg-radiant-gold/15">
                      <p className="font-semibold">Open Agent Kanban</p>
                      <p className="mt-1 text-sm text-muted-foreground">Review work lanes, roster, blockers, traces, validation, and PRs.</p>
                    </Link>
                    <Link href="/admin/agents/standup" className="block rounded-lg border border-radiant-gold/60 bg-radiant-gold p-3 text-left text-silicon-slate hover:bg-radiant-gold/90">
                      <p className="font-semibold">Open Standup Room</p>
                      <p className="mt-1 text-sm">Ask agents, start standup, and turn goals into tracked work.</p>
                    </Link>
                    <Link href="/admin/agents/runs" className="block rounded-lg border border-silicon-slate/60 bg-background/40 p-3 hover:border-radiant-gold/50">
                      <p className="font-semibold">Open Run Console</p>
                      <p className="mt-1 text-sm text-muted-foreground">Inspect traces, evaluations, dead letters, and artifacts.</p>
                    </Link>
                    <OperatorChecksPanel
                      actions={OPERATOR_ACTIONS}
                      loadingKind={actionLoading as OperatorActionKind | null}
                      result={actionResult?.kind ? actionResult : null}
                      runs={operatorRuns}
                      onRun={runOperatorAction}
                    />
                    <AutomationGoalsPanel
                      goals={visibleAutomationGoals}
                      allGoals={automationGoals}
                      loading={automationGoalsLoading}
                      seeding={automationSeedLoading}
                      page={automationGoalPage}
                      pageCount={automationGoalPageCount}
                      onSeedTierOne={seedTierOneAutomationGoals}
                      onPrevious={() => setAutomationGoalPage((page) => Math.max(page - 1, 0))}
                      onNext={() => setAutomationGoalPage((page) => Math.min(page + 1, automationGoalPageCount - 1))}
                    />
                    {moremiReview?.has_monitor ? (
                      <button
                        type="button"
                        onClick={createMoremiWarningWorkItems}
                        disabled={!moremiReview.warning_count || actionLoading === 'moremi-review'}
                        className="rounded-lg border border-silicon-slate/60 bg-background/40 p-3 text-left hover:border-radiant-gold/50 disabled:opacity-60"
                      >
                        <p className="font-semibold">{moremiReviewConfirm ? 'Confirm Moremi work items' : 'Route Moremi warnings'}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{moremiReview.warning_count} warning(s), {moremiReview.linked_work_items.length} linked item(s).</p>
                      </button>
                    ) : null}
                    {actionResult ? (
                      <Link href={`/admin/agents/runs/${actionResult.runId}`} className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200 hover:underline">
                        Open {actionResult.label} run
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="agent-ops-card rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-radiant-gold">Agent Inbox</p>
                      <p className="mt-1 text-xs text-muted-foreground">Three visible at a time.</p>
                    </div>
                    <PagerControls
                      label="Agent Inbox"
                      page={inboxPage}
                      pageCount={inboxPageCount}
                      itemCount={inboxItems.length}
                      pageSize={3}
                      onPrevious={() => setInboxPage((page) => Math.max(page - 1, 0))}
                      onNext={() => setInboxPage((page) => Math.min(page + 1, inboxPageCount - 1))}
                    />
                  </div>
                  <div className="mt-3 space-y-2">
                    {visibleInboxItems.length ? visibleInboxItems.map((item) => (
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

              </aside>
            </div>
          </section>

          <section className="agent-ops-panel mt-5 rounded-xl border p-5" aria-label="Agent Ops signal homes">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-radiant-gold">Signal homes</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use Mission Control for triage; use these homes for deeper review, recovery, and governance.
                </p>
              </div>
              <Link href="/admin/agents/runs" className="inline-flex w-fit items-center gap-2 rounded-lg border border-silicon-slate/70 bg-background/55 px-3 py-2 text-sm hover:border-radiant-gold/55">
                Trace history
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Primary work homes</p>
                <div className="grid gap-2">
                  {primaryWorkHomes.map((home) => (
                    <SignalRouteCard
                      key={home.eyebrow}
                      title={home.eyebrow}
                      detail={`${home.title} · ${home.metric}`}
                      href={home.href}
                      icon={home.icon}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operating signal homes</p>
                <div className="grid gap-2">
                  {operationalSignalHomes.map((home) => (
                    <SignalRouteCard key={home.title} {...home} />
                  ))}
                  <SignalRouteCard
                    title="Latest Activity"
                    detail={`${snapshot?.latest_events.length ?? 0} recent event(s)`}
                    href="/admin/agents/runs"
                    icon={<Activity size={16} />}
                  />
                </div>
              </div>
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

function PagerControls({
  label,
  page,
  pageCount,
  itemCount,
  pageSize = 3,
  onPrevious,
  onNext,
}: {
  label: string
  page: number
  pageCount: number
  itemCount: number
  pageSize?: number
  onPrevious: () => void
  onNext: () => void
}) {
  const start = itemCount ? page * pageSize + 1 : 0
  const end = itemCount ? Math.min(itemCount, (page + 1) * pageSize) : 0
  const pageLabel = itemCount ? `Showing ${start}-${end} of ${itemCount} · ${page + 1}/${pageCount}` : '0 items'
  const pagingDisabled = itemCount <= pageSize

  return (
    <div className="inline-flex items-center gap-2 text-xs text-muted-foreground" aria-label={`${label} pagination`}>
      <span>{pageLabel}</span>
      <div className="inline-flex overflow-hidden rounded-full border border-silicon-slate/60 bg-black/10">
        <button
          type="button"
          onClick={onPrevious}
          disabled={page <= 0 || pagingDisabled}
          className="inline-flex h-7 w-7 items-center justify-center hover:bg-radiant-gold/10 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={`Previous ${label} page`}
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= pageCount - 1 || pagingDisabled}
          className="inline-flex h-7 w-7 items-center justify-center border-l border-silicon-slate/60 hover:bg-radiant-gold/10 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={`Next ${label} page`}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

function SignalRouteCard({ title, detail, href, icon }: { title: string; detail: string; href: string; icon: ReactNode }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-lg border border-silicon-slate/60 bg-background/35 p-3 hover:border-radiant-gold/50">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-radiant-gold">{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      <ArrowRight size={14} className="shrink-0 text-muted-foreground" />
    </Link>
  )
}

function OperatorChecksPanel({
  actions,
  loadingKind,
  result,
  runs,
  onRun,
}: {
  actions: typeof OPERATOR_ACTIONS
  loadingKind: OperatorActionKind | null
  result: { label: string; runId: string; kind?: OperatorActionKind } | null
  runs: OperatorRun[]
  onRun: (kind: OperatorActionKind) => void
}) {
  const now = new Date()
  const pageSize = 2
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(actions.length / pageSize))
  const visibleActions = actions.slice(page * pageSize, page * pageSize + pageSize)

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, Math.max(pageCount - 1, 0)))
  }, [pageCount])

  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-background/35 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-radiant-gold">Operator checks</p>
          <p className="mt-1 text-xs text-muted-foreground">Scheduled manual triggers with duplicate-run guards.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <PagerControls
            label="Operator checks"
            page={page}
            pageCount={pageCount}
            itemCount={actions.length}
            pageSize={pageSize}
            onPrevious={() => setPage((currentPage) => Math.max(currentPage - 1, 0))}
            onNext={() => setPage((currentPage) => Math.min(currentPage + 1, pageCount - 1))}
          />
          <Link href="/admin/agents/runs?kind=operator_checks" className="text-xs text-radiant-gold hover:underline">Full history</Link>
        </div>
      </div>

      <div className="mt-3 grid gap-2" aria-label="Operator checks">
        {visibleActions.map((action) => {
          const actionRuns = runs.filter((run) => run.kind === action.runKind)
          const latest = actionRuns[0] ?? null
          const activeRun = actionRuns.find((run) => isActiveOperatorRun(run)) ?? null
          const available = action.isAvailable(now)
          const alreadyTriggered = Boolean(latest && action.windowKey(new Date(latest.started_at)) === action.windowKey(now))
          const loading = loadingKind === action.kind
          const disabledReason = activeRun
            ? 'Already running'
            : alreadyTriggered
              ? 'Run complete for this window'
              : !available
                ? 'Outside run window'
                : null
          const progress = operatorProgress(activeRun ?? latest)
          const canRun = !loadingKind && available && !alreadyTriggered && !activeRun
          const latestResult = result?.kind === action.kind ? result : null

          return (
            <div
              key={action.kind}
              className={`rounded-lg border p-3 ${canRun ? 'border-radiant-gold/45 bg-radiant-gold/10' : activeRun ? 'border-sky-400/35 bg-sky-500/10' : 'border-silicon-slate/60 bg-black/10'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{action.label}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{action.purpose}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRun(action.kind)}
                  disabled={!canRun || loading}
                  className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-2.5 py-1.5 text-xs text-radiant-gold hover:bg-radiant-gold/15 disabled:border-silicon-slate/50 disabled:bg-black/10 disabled:text-muted-foreground disabled:opacity-70"
                  title={disabledReason ?? `Run ${action.label}`}
                >
                  {loading ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
                  Run
                </button>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/25">
                <div className={`h-full rounded-full ${activeRun ? 'bg-sky-300' : progress === 100 ? 'bg-emerald-300' : 'bg-radiant-gold'}`} style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{disabledReason ?? 'Available now'}</span>
                <span>{action.windowLabel}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                {latest ? (
                  <Link href={`/admin/agents/runs/${latest.id}`} className="text-radiant-gold hover:underline">
                    Latest: {formatOperatorRunStatus(latest)}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">No prior run</span>
                )}
                <Link href={`/admin/agents/runs?kind=${action.runKind}`} className="text-muted-foreground hover:text-radiant-gold">
                  View history
                </Link>
              </div>
              {latestResult ? (
                <Link href={`/admin/agents/runs/${latestResult.runId}`} className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 hover:underline">
                  <span>Open {latestResult.label} run</span>
                  <ArrowRight size={14} />
                </Link>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AutomationGoalsPanel({
  goals,
  allGoals,
  loading,
  seeding,
  page,
  pageCount,
  onSeedTierOne,
  onPrevious,
  onNext,
}: {
  goals: AutomationGoalSummary[]
  allGoals: AutomationGoalSummary[]
  loading: boolean
  seeding: boolean
  page: number
  pageCount: number
  onSeedTierOne: () => void
  onPrevious: () => void
  onNext: () => void
}) {
  const seededCount = allGoals.filter((goal) => goal.seeded).length
  const allSeeded = allGoals.length > 0 && seededCount === allGoals.length

  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-background/35 p-3" aria-label="Automation to-do">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-radiant-gold">Automation to-do</p>
          <p className="mt-1 text-xs text-muted-foreground">Seed reviewable goals for workflows agents can automate.</p>
        </div>
        <button
          type="button"
          onClick={onSeedTierOne}
          disabled={loading || seeding || allSeeded}
          className="inline-flex items-center gap-1 rounded-md border border-radiant-gold/50 bg-radiant-gold/10 px-2.5 py-1.5 text-xs font-medium text-radiant-gold hover:bg-radiant-gold/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {seeding ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
          Seed Tier 1
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <StatusOnlyPill tone={allSeeded ? 'green' : 'yellow'}>
          {seededCount}/{allGoals.length} seeded
        </StatusOnlyPill>
        <PagerControls
          label="Automation goals"
          page={page}
          pageCount={pageCount}
          itemCount={allGoals.length}
          pageSize={3}
          onPrevious={onPrevious}
          onNext={onNext}
        />
      </div>

      <div className="mt-3 space-y-2">
        {loading ? (
          <p className="rounded-lg border border-silicon-slate/50 bg-black/10 p-3 text-sm text-muted-foreground">
            Loading automation goals.
          </p>
        ) : goals.length ? goals.map((goal) => (
          <AutomationGoalRow key={goal.id} goal={goal} />
        )) : (
          <p className="rounded-lg border border-silicon-slate/50 bg-black/10 p-3 text-sm text-muted-foreground">
            No automation goal seeds are available.
          </p>
        )}
      </div>
    </div>
  )
}

function AutomationGoalRow({ goal }: { goal: AutomationGoalSummary }) {
  const goalId = `automation:${goal.id}`
  const metadata = goal.seeded_parent_work_item?.metadata ?? {}
  const proposal = goal.latest_n8n_proposal ?? null
  const proposalCount = goal.n8n_proposal_count ?? 0
  const standupHref = typeof metadata.goal_session_href === 'string'
    ? metadata.goal_session_href
    : `/admin/agents/standup?goal=${encodeURIComponent(goalId)}`
  const kanbanHref = typeof metadata.goal_kanban_href === 'string'
    ? metadata.goal_kanban_href
    : `/admin/agents/swarm-board?goal=${encodeURIComponent(goalId)}`
  const tone = goal.seeded ? 'green' : goal.requiresNewWorkflow ? 'yellow' : 'blue'

  return (
    <div className="rounded-lg border border-silicon-slate/55 bg-black/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-radiant-gold">{goal.workflowFamily.replace(/_/g, ' ')}</p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold">{goal.title}</p>
        </div>
        <StatusOnlyPill tone={tone}>{goal.seeded ? 'Seeded' : goal.requiresNewWorkflow ? 'Needs workflow' : 'Ready'}</StatusOnlyPill>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{goal.nextAction}</p>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
        <span className="rounded-full border border-silicon-slate/50 bg-background/40 px-2 py-0.5">{goal.ownerAgentKey.replace(/-/g, ' ')}</span>
        <span className="rounded-full border border-silicon-slate/50 bg-background/40 px-2 py-0.5">{goal.automationLevel.replace(/_/g, ' ')}</span>
        {goal.n8nWorkflows.length ? (
          <span className="rounded-full border border-silicon-slate/50 bg-background/40 px-2 py-0.5">{goal.n8nWorkflows.length} n8n workflow(s)</span>
        ) : null}
        {proposalCount ? (
          <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-green-100">
            {proposalCount} proposal{proposalCount === 1 ? '' : 's'}
          </span>
        ) : goal.requiresNewWorkflow ? (
          <span className="rounded-full border border-radiant-gold/35 bg-radiant-gold/10 px-2 py-0.5 text-radiant-gold">
            proposal needed
          </span>
        ) : null}
      </div>
      {proposal ? (
        <div className="mt-3 rounded-md border border-green-500/25 bg-green-500/5 p-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-green-100">n8n proposal in controller</p>
            <StatusOnlyPill tone={proposal.status === 'blocked' ? 'red' : proposal.status === 'ready_for_review' || proposal.status === 'ready_for_merge' ? 'yellow' : 'green'}>
              {proposal.status.replace(/_/g, ' ')}
            </StatusOnlyPill>
          </div>
          <p className="mt-1 line-clamp-1 text-muted-foreground">{proposal.title}</p>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{goal.seeded_child_count} task(s)</span>
        <div className="flex gap-3">
          <Link href={standupHref} className="text-radiant-gold hover:underline">
            Standup
          </Link>
          {proposal ? (
            <Link href="/admin/agents/coordination" className="text-radiant-gold hover:underline">
              Review proposal
            </Link>
          ) : null}
          <Link href={kanbanHref} className="text-radiant-gold hover:underline">
            Kanban
          </Link>
        </div>
      </div>
    </div>
  )
}

function isWeekday(value: Date) {
  const day = value.getDay()
  return day >= 1 && day <= 5
}

function localDateKey(value: Date) {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isActiveOperatorRun(run: OperatorRun) {
  return run.stale || ['queued', 'running', 'waiting_for_approval'].includes(run.status)
}

function operatorProgress(run: OperatorRun | null) {
  if (!run) return 0
  if (run.stale) return 80
  if (run.status === 'queued') return 20
  if (run.status === 'running') return 55
  if (run.status === 'waiting_for_approval') return 75
  return 100
}

function formatOperatorRunStatus(run: OperatorRun) {
  const status = run.stale ? 'stale' : run.status.replace(/_/g, ' ')
  return `${status} · ${formatTime(run.started_at)}`
}

function splitBriefSummary(value: string | null | undefined) {
  if (!value) return []
  return value
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4)
}

function briefSourceLabel(brief: MissionSnapshot['daily_brief'] | null) {
  return brief?.generated_from === 'standup' ? 'Latest standup' : 'Current traces'
}

function buildBriefSnapshotItems(brief: MissionSnapshot['daily_brief'] | null, loading: boolean) {
  if (loading) return ['Loading today’s operating snapshot.']

  const narrativeLines = splitBriefSummary(brief?.synthesis).slice(0, 2)
  const signalLines = (brief?.signals ?? [])
    .filter((signal) => signal.trim())
    .filter((signal) => !/\b(active|partial|running|queued|failed|stale|attention queue|pending approvals?|cost)\b/i.test(signal))
    .slice(0, 2)

  const items = [...narrativeLines, ...signalLines]

  if (brief?.updated_at) {
    items.push(`Updated ${formatTime(brief.updated_at)} from ${briefSourceLabel(brief).toLowerCase()}.`)
  }

  return items.length ? items.slice(0, 4) : ['No brief narrative is available yet. Run standup when you want a fresh operator snapshot.']
}

function inferActionHref(text: string) {
  const normalized = text.toLowerCase()
  if (normalized.includes('kanban') || normalized.includes('lane') || normalized.includes('owner')) return '/admin/agents/swarm-board'
  if (normalized.includes('approval') || normalized.includes('decision') || normalized.includes('queue')) return '/admin/agents/coordination'
  if (normalized.includes('trace') || normalized.includes('run') || normalized.includes('stale') || normalized.includes('failed')) return '/admin/agents/runs'
  if (normalized.includes('cost') || normalized.includes('spend')) return '/admin/cost-revenue'
  return '/admin/agents/standup'
}

function getBriefNextAction({
  brief,
  activeRuns,
  failedOrStaleRuns,
  pendingApprovals,
}: {
  brief: MissionSnapshot['daily_brief'] | null
  activeRuns: number
  failedOrStaleRuns: number
  pendingApprovals: number
}) {
  if (pendingApprovals) {
    return {
      label: 'Open Decision Queue',
      detail: `${pendingApprovals} approval ${pendingApprovals === 1 ? 'needs' : 'items need'} a human decision.`,
      href: '/admin/agents/coordination',
    }
  }

  if (failedOrStaleRuns) {
    return {
      label: 'Review failed or stale runs',
      detail: `${failedOrStaleRuns} trace ${failedOrStaleRuns === 1 ? 'needs' : 'items need'} review before the queue is clean.`,
      href: '/admin/agents/runs?status=needs_review',
    }
  }

  if (activeRuns) {
    return {
      label: 'Inspect active runs',
      detail: `${activeRuns} live or queued ${activeRuns === 1 ? 'trace is' : 'traces are'} still moving.`,
      href: '/admin/agents/runs?active=true',
    }
  }

  const actionText = brief?.next_actions?.find((item) => item.trim()) ?? 'Open Standup Room'

  return {
    label: actionText.replace(/\.$/, ''),
    detail: 'Next best action from the current operating brief.',
    href: inferActionHref(actionText),
  }
}

function QuickPrompt({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-radiant-gold/30 bg-background/40 px-3 py-1.5 text-xs text-radiant-gold hover:bg-radiant-gold/15 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  )
}

function SignalHomeLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-radiant-gold hover:underline">
      {label}
      <ArrowRight size={12} />
    </Link>
  )
}

function DrilldownHomeCard({ eyebrow, title, body, href, cta }: { eyebrow: string; title: string; body: string; href: string; cta: string }) {
  return (
    <Link href={href} className="agent-ops-drill-card block rounded-lg border p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-radiant-gold">{eyebrow}</p>
      <h3 className="mt-2 text-xl font-semibold">{title}</h3>
      <p className="mt-2 min-h-[48px] text-sm leading-6 text-muted-foreground">{body}</p>
      <span className="mt-4 inline-flex rounded-lg border border-radiant-gold/40 bg-radiant-gold/10 px-3 py-2 text-sm font-medium text-radiant-gold">
        {cta}
      </span>
    </Link>
  )
}

function MissionStatusCard({
  as = 'status',
  href,
  icon,
  label,
  value,
  detail,
  status,
  tone,
}: {
  as?: 'link' | 'status'
  href?: string
  icon: ReactNode
  label: string
  value: string | number
  detail: string
  status: string
  tone: 'green' | 'yellow' | 'red' | 'blue' | 'neutral'
}) {
  const content = (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-2 text-radiant-gold">
          {icon}
          <p className="text-xs font-semibold uppercase tracking-wider">{label}</p>
        </div>
        <StatusOnlyPill tone={tone}>{status}</StatusOnlyPill>
      </div>
      <p className="mt-4 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </>
  )

  if (as === 'link' && href) {
    return (
      <Link href={href} className={`agent-ops-metric agent-ops-metric-${tone} block min-w-0 rounded-lg border p-4`}>
        {content}
      </Link>
    )
  }

  return (
    <div className={`agent-ops-metric agent-ops-metric-${tone} min-w-0 rounded-lg border p-4`} aria-label={`${label} status`}>
      {content}
    </div>
  )
}

function StatusOnlyPill({ children, tone }: { children: ReactNode; tone: 'green' | 'yellow' | 'red' | 'blue' | 'neutral' }) {
  const toneClass = {
    green: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
    yellow: 'border-yellow-400/40 bg-yellow-500/10 text-yellow-100',
    red: 'border-red-400/40 bg-red-500/10 text-red-200',
    blue: 'border-sky-400/40 bg-sky-500/10 text-sky-200',
    neutral: 'border-silicon-slate/60 bg-black/20 text-muted-foreground',
  }[tone]

  return (
    <span className={`w-fit max-w-full rounded-full border px-2.5 py-1 text-left text-xs font-medium ${toneClass}`} data-status-only="true">
      {children}
    </span>
  )
}

function MiniMetric({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: 'default' | 'yellow' | 'green' }) {
  const toneClass = tone === 'yellow' ? 'text-yellow-200' : tone === 'green' ? 'text-emerald-200' : 'text-foreground'
  return (
    <div className="rounded-lg border border-silicon-slate/50 bg-black/10 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}

function DailyBriefPanel({
  brief,
  loading,
  activeRuns,
  failedOrStaleRuns,
  pendingApprovals,
  costToday,
}: {
  brief: MissionSnapshot['daily_brief'] | null
  loading: boolean
  activeRuns: number
  failedOrStaleRuns: number
  pendingApprovals: number
  costToday: number
}) {
  const routeCards = [
    {
      label: 'Active runs',
      value: activeRuns,
      detail: 'Live or queued traces',
      href: '/admin/agents/runs?active=true',
      tone: 'blue',
    },
    {
      label: 'Failed or stale runs',
      value: failedOrStaleRuns,
      detail: 'Needs trace review',
      href: '/admin/agents/runs?status=needs_review',
      tone: failedOrStaleRuns ? 'red' : 'green',
    },
    {
      label: 'Pending approvals',
      value: pendingApprovals,
      detail: 'Controller queue',
      href: '/admin/agents/coordination',
      tone: pendingApprovals ? 'yellow' : 'green',
    },
    {
      label: 'Cost today',
      value: `$${costToday.toFixed(4)}`,
      detail: 'Spend analysis',
      href: '/admin/cost-revenue',
      tone: 'neutral',
    },
  ] as const
  const snapshotItems = buildBriefSnapshotItems(brief, loading)
  const nextAction = getBriefNextAction({ brief, activeRuns, failedOrStaleRuns, pendingApprovals })

  return (
    <section className="agent-ops-card mt-5 rounded-lg border p-4" aria-label="Daily Operating Brief">
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-radiant-gold">
            <Sparkles size={18} />
            <h2 className="font-semibold">Daily Operating Brief</h2>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)]">
        <div className="rounded-lg border border-silicon-slate/55 bg-black/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Snapshot</p>
            <StatusOnlyPill tone="neutral">{briefSourceLabel(brief)}</StatusOnlyPill>
          </div>
          <ul className="mt-3 space-y-2">
            {snapshotItems.map((item) => (
              <li key={item} className="rounded-md border border-silicon-slate/45 bg-background/35 px-3 py-2 text-sm leading-6 text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <Link
          href={nextAction.href}
          className="group flex min-h-full flex-col justify-between rounded-lg border border-radiant-gold/45 bg-radiant-gold/10 p-3 transition hover:border-radiant-gold/70 hover:bg-radiant-gold/15"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-radiant-gold">Next best action</p>
            <p className="mt-3 text-base font-semibold">{nextAction.label}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{nextAction.detail}</p>
          </div>
          <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-radiant-gold">
            Open next step
            <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
          </div>
        </Link>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attention routes</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {routeCards.map((card) => (
            <BriefRouteCard key={card.label} {...card} />
          ))}
        </div>
      </div>
    </section>
  )
}

function BriefRouteCard({
  label,
  value,
  detail,
  href,
  tone,
}: {
  label: string
  value: string | number
  detail: string
  href: string
  tone: 'blue' | 'green' | 'red' | 'yellow' | 'neutral'
}) {
  const toneClass = {
    blue: 'border-sky-400/30 bg-sky-500/10',
    green: 'border-emerald-400/30 bg-emerald-500/10',
    red: 'border-red-400/35 bg-red-500/10',
    yellow: 'border-yellow-400/35 bg-yellow-500/10',
    neutral: 'border-silicon-slate/60 bg-black/10',
  }[tone]

  return (
    <Link href={href} className={`group rounded-lg border p-3 transition hover:border-radiant-gold/60 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <ArrowRight size={14} className="mt-1 shrink-0 text-muted-foreground group-hover:text-radiant-gold" />
      </div>
    </Link>
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
        <div>
          <div className="flex items-center gap-2 text-radiant-gold">
            <CircleDollarSign size={18} />
            <h2 className="font-semibold">Cost Intelligence</h2>
          </div>
          <div className="mt-2">
            <SignalHomeLink href="/admin/cost-revenue" label="Cost & Revenue owns spend analysis" />
          </div>
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

function QualitySignalsPanel({ summary }: { summary: MissionSnapshot['quality_summary'] | null }) {
  const hasEvaluations = Boolean(summary?.evaluation_count)
  const qualityScore = summary?.average_score === null || summary?.average_score === undefined
    ? 'No score'
    : `${summary.average_score.toFixed(1)}`
  const passRate = summary?.pass_rate === null || summary?.pass_rate === undefined
    ? 'No pass rate'
    : `${Math.round(summary.pass_rate * 100)}%`

  return (
    <section className="mt-5 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-radiant-gold">
            <Gauge size={18} />
            <h2 className="font-semibold">Quality Signals</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Rubric-backed scoring for agent output quality, coaching needs, and trend visibility.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <SignalHomeLink href="/admin/chat-eval" label="Chat Eval owns rubric management" />
            <SignalHomeLink href="/admin/agents/runs" label="Run detail owns agent evaluations" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <CostChip label={`${summary?.window_hours ?? 24}h score`} value={qualityScore} />
          <CostChip label="Pass rate" value={passRate} />
          <CostChip label="Rubrics" value={summary?.rubric_count ?? 0} />
          <CostChip label="Evaluations" value={summary?.evaluation_count ?? 0} />
        </div>
      </div>

      {hasEvaluations ? (
        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-silicon-slate/50 bg-black/10 p-3">
            <div className="flex items-center gap-2 text-yellow-200">
              <TrendingDown size={16} />
              <p className="text-sm font-semibold">Needs Coaching</p>
            </div>
            <div className="mt-3 space-y-2">
              {summary?.needs_coaching.length ? summary.needs_coaching.slice(0, 4).map((item) => (
                <Link
                  key={`${item.agent_key}-${item.rubric_key}`}
                  href={item.run_id ? `/admin/agents/runs/${item.run_id}` : '/admin/agents'}
                  className="block rounded-lg border border-yellow-400/20 bg-yellow-500/5 p-3 text-sm hover:border-yellow-400/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{item.agent_key.replace(/-/g, ' ')}</p>
                    <span className="rounded-full border border-yellow-400/40 bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-100">
                      {item.latest_score === null ? 'No score' : `${item.latest_score.toFixed(1)} / ${item.threshold.toFixed(0)}`}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-muted-foreground">{item.rubric_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                </Link>
              )) : (
                <p className="rounded-lg border border-silicon-slate/50 bg-background/30 p-3 text-sm text-muted-foreground">
                  No coaching signals in the current window.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-silicon-slate/50 bg-black/10 p-3">
            <p className="text-sm font-semibold">Rubric Trends</p>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {(summary?.rubric_trends ?? []).slice(0, 6).map((trend) => (
                <div key={trend.rubric_key} className="rounded-lg border border-silicon-slate/50 bg-background/30 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{trend.rubric_name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{trend.agent_key.replace(/-/g, ' ')}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${trend.latest_score !== null && trend.latest_score < trend.threshold ? 'border-yellow-400/40 bg-yellow-500/10 text-yellow-100' : 'border-silicon-slate/50 bg-black/10 text-muted-foreground'}`}>
                      {trend.latest_score === null ? 'Pending' : trend.latest_score.toFixed(1)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{trend.evaluation_count} eval(s)</span>
                    <span>Pass {trend.pass_rate === null ? '-' : `${Math.round(trend.pass_rate * 100)}%`}</span>
                    <span>{trend.direction}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-silicon-slate/50 bg-black/10 p-3 text-sm text-muted-foreground">
          No evaluations recorded yet. Run a rubric evaluation from a trace detail page or the evaluation API to establish the first quality baseline.
        </p>
      )}
    </section>
  )
}

function OperatingSignalsPanel({ signals }: { signals: MissionSnapshot['operating_signals'] }) {
  if (!signals.length) return null

  return (
    <section className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
      {signals.map((signal) => {
        const signalText = signal.signal.toLowerCase()
        const isHealthy =
          (signal.status === 'completed' || signalText.includes('success')) &&
          !signalText.includes('warning') &&
          !signalText.includes('failed')
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

function MoremiReviewPanel({
  review,
  loading,
  confirm,
  actionLoading,
  onCreate,
  onCancel,
}: {
  review: MoremiMonitorReview | null
  loading: boolean
  confirm: boolean
  actionLoading: boolean
  onCreate: () => void
  onCancel: () => void
}) {
  const hasWarnings = (review?.warning_count ?? 0) > 0
  const linkedCount = review?.linked_work_items.length ?? 0

  return (
    <section className="mt-5 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-radiant-gold">
            {hasWarnings ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
            <h2 className="font-semibold">Moremi Warning Review</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Converts the latest read-only AI risk monitor warnings into proposed Agent Ops work items only after explicit confirmation.
          </p>
        </div>
        {review?.run ? (
          <Link
            href={review.run.href}
            className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-background/60 px-3 py-2 text-sm hover:border-radiant-gold/60"
          >
            Latest trace
            <ArrowRight size={16} />
          </Link>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading latest Moremi review...</p>
      ) : !review?.has_monitor ? (
        <p className="mt-3 rounded-lg border border-silicon-slate/50 bg-black/10 p-3 text-sm text-muted-foreground">
          No Moremi monitor trace exists yet. Run the scheduled monitor or wait for the next read-only review before creating work items.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <MiniMetric label="Status" value={review.run?.overall ?? review.run?.status ?? 'unknown'} />
            <MiniMetric label="Warnings" value={review.warning_count} tone={hasWarnings ? 'yellow' : 'green'} />
            <MiniMetric label="Enabled feeds" value={review.enabled_source_feed_count} />
            <MiniMetric label="Disabled feeds" value={review.disabled_source_feed_count} tone={review.disabled_source_feed_count ? 'yellow' : undefined} />
            <MiniMetric label="Linked work" value={linkedCount} />
          </div>

          {review.warnings.length ? (
            <div className="mt-4 rounded-lg border border-silicon-slate/50 bg-black/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Warnings</p>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {review.warnings.slice(0, 5).map((warning) => (
                  <li key={warning} className="flex gap-2">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-radiant-gold" />
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {review.linked_work_items.length ? (
            <div className="mt-4 rounded-lg border border-silicon-slate/50 bg-black/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Linked proposed work</p>
              <div className="mt-2 space-y-2 text-sm">
                {review.linked_work_items.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-foreground">{item.title}</span>
                    <span className="rounded-full border border-silicon-slate/50 bg-black/10 px-2.5 py-1 text-xs text-muted-foreground">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
              <Link href="/admin/agents/coordination" className="mt-3 inline-flex items-center gap-2 text-sm text-radiant-gold hover:underline">
                Open Agent Coordination
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-silicon-slate/50 bg-black/10 p-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              {confirm
                ? 'Confirming creates or reuses proposed work items only. Remediation and production changes remain approval-gated.'
                : 'Review warnings first, then create proposed work items when they need tracked follow-through.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {confirm ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-background/60 px-3 py-2 text-sm hover:border-radiant-gold/60"
                >
                  Cancel
                </button>
              ) : null}
              <button
                type="button"
                onClick={onCreate}
                disabled={!hasWarnings || actionLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-60"
              >
                <ClipboardList size={16} />
                {confirm ? 'Confirm proposed work items' : 'Create proposed work items'}
              </button>
            </div>
          </div>
        </>
      )}
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
          <div className="mt-2">
            <SignalHomeLink href="/admin/agents/open-brain" label="Open Brain owns memory and knowledge follow-up" />
          </div>
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
            <div className="flex min-w-0 gap-3">
              <AgentAvatar agentKey={agent.agentKey} size="sm" />
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
              <AgentAvatar agentKey={item.agent_key} size="sm" />
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
        <div className="flex min-w-0 gap-3">
          <AgentAvatar agentKey={item.agent_key} size="sm" />
          <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityPill priority={item.priority} />
            <span className="text-xs text-muted-foreground">{item.agent_name}</span>
          </div>
          <p className="mt-2 font-medium">{item.title}</p>
          <p className="mt-1 line-clamp-2 text-muted-foreground">{item.reason}</p>
          <p className="mt-2 text-xs text-muted-foreground">{item.pod}</p>
          </div>
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
