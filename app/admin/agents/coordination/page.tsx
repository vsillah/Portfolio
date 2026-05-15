'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Bot,
  CheckCircle2,
  GitPullRequest,
  MessageSquare,
  Network,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import AgentAvatar from '@/components/admin/AgentAvatar'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import type { AgentRuntime } from '@/lib/agent-run'
import type { AgentWorkItem, AgentWorkItemStatus } from '@/lib/agent-work-items'
import type { VercelResearchProposal } from '@/lib/vercel-deployment-research'
import { VERCEL_AUTORESEARCH_DEFINITION_OF_READY, VERCEL_AUTORESEARCH_IDEA_SOURCE_TYPE } from '@/lib/vercel-autoresearch-ideas'

const STATUSES: Array<'all' | AgentWorkItemStatus> = [
  'all',
  'proposed',
  'queued',
  'assigned',
  'in_progress',
  'blocked',
  'ready_for_review',
  'ready_for_merge',
  'merged',
  'deployed',
  'cancelled',
]

type WorkItemForm = {
  title: string
  objective: string
  owner_agent_key: string
  owner_runtime: AgentRuntime
  branch_name: string
  worktree_path: string
  expected_files: string
}

type VercelResearchApprovalCard = {
  approvalId: string
  runId: string
  workItemId: string
  status: string
  requestedAt: string
  proposal: VercelResearchProposal
  notification: {
    slackSentAt: string | null
    slackSkippedAt: string | null
  }
  workItem: {
    id: string
    title: string
    status: string
    active_run_id: string | null
    approval_id: string | null
    updated_at: string
  } | null
}

type MoremiOperationalDrillResult = {
  work_item: AgentWorkItem
  assessment: {
    classification: string
    severity: string
    recommendedNextAction: string
  }
  verification: {
    admin_path: string
    slack_command: string
    expected_status: string
  }
}

type ShakaContextRef = {
  type: 'work_item' | 'approval'
  id: string
}

type ShakaContextReply = {
  run_id: string
  reply: string
  suggested_actions: string[]
}

const DEFAULT_FORM: WorkItemForm = {
  title: '',
  objective: '',
  owner_agent_key: 'chief-of-staff',
  owner_runtime: 'codex',
  branch_name: '',
  worktree_path: '',
  expected_files: '',
}

const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const

function isAutoResearchIdea(item: AgentWorkItem) {
  return item.source_type === VERCEL_AUTORESEARCH_IDEA_SOURCE_TYPE || item.metadata?.autoresearch_idea === true
}

function textArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

function definitionOfReadyText(item: AgentWorkItem) {
  const criteria = textArray(item.metadata?.definition_of_ready)
  const source = criteria.length ? criteria : VERCEL_AUTORESEARCH_DEFINITION_OF_READY
  return source.map((criterion) => `- ${criterion}`).join('\n')
}

export default function AgentCoordinationPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AgentCoordinationContent />
    </ProtectedRoute>
  )
}

function AgentCoordinationContent() {
  const [items, setItems] = useState<AgentWorkItem[]>([])
  const [status, setStatus] = useState<'all' | AgentWorkItemStatus>('all')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<WorkItemForm>(DEFAULT_FORM)
  const [vercelResearchApprovals, setVercelResearchApprovals] = useState<VercelResearchApprovalCard[]>([])
  const [moremiDrillResult, setMoremiDrillResult] = useState<MoremiOperationalDrillResult | null>(null)
  const [shakaReply, setShakaReply] = useState<ShakaContextReply | null>(null)
  const [shakaContextRef, setShakaContextRef] = useState<ShakaContextRef | null>(null)

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

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = status === 'all' ? '' : `?status=${status}`
      const response = await authedFetch(`/api/admin/agents/work-items${query}`)
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setItems(body.work_items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load work items')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [authedFetch, status])

  const loadVercelResearchApprovals = useCallback(async () => {
    try {
      const response = await authedFetch('/api/admin/agents/vercel-research/proposals')
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setVercelResearchApprovals(body.approvals ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Vercel AutoResearch approvals')
      setVercelResearchApprovals([])
    }
  }, [authedFetch])

  useEffect(() => {
    loadItems()
    loadVercelResearchApprovals()
  }, [loadItems, loadVercelResearchApprovals])

  const summary = useMemo(() => ({
    active: items.filter((item) => !['merged', 'deployed', 'cancelled'].includes(item.status)).length,
    blocked: items.filter((item) => item.status === 'blocked').length,
    review: items.filter((item) => item.status === 'ready_for_review' || item.status === 'ready_for_merge').length,
    approvals: items.filter((item) => Boolean(item.approval_id)).length,
  }), [items])

  const autoResearchIdeas = useMemo(() => {
    const rank: Record<AgentWorkItem['priority'], number> = { urgent: 0, high: 1, medium: 2, low: 3 }
    return items
      .filter(isAutoResearchIdea)
      .sort((a, b) => rank[a.priority] - rank[b.priority] || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [items])

  async function refreshAll() {
    await Promise.all([loadItems(), loadVercelResearchApprovals()])
  }

  async function createWorkItem(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const response = await authedFetch('/api/admin/agents/work-items', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          objective: form.objective,
          owner_agent_key: form.owner_agent_key,
          owner_runtime: form.owner_runtime,
          branch_name: form.branch_name || null,
          worktree_path: form.worktree_path || null,
          expected_files: form.expected_files.split('\n').map((line) => line.trim()).filter(Boolean),
          source_type: 'admin_agent_coordination',
          source_label: 'Agent Coordination',
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setForm(DEFAULT_FORM)
      await refreshAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create work item')
    } finally {
      setSubmitting(false)
    }
  }

  async function quickAction(item: AgentWorkItem, action: 'block' | 'validation' | 'handoff') {
    const note =
      action === 'block'
        ? 'Needs Integration Captain review before proceeding.'
        : action === 'validation'
          ? 'Validation packet recorded from Agent Coordination.'
          : 'Hand off to Integration Captain for gated review.'
    setActionId(`${action}:${item.id}`)
    setError(null)
    try {
      const path =
        action === 'block'
          ? `/api/admin/agents/work-items/${item.id}/block`
          : action === 'validation'
            ? `/api/admin/agents/work-items/${item.id}/validation`
            : `/api/admin/agents/work-items/${item.id}/handoff`
      const body =
        action === 'block'
          ? { blocker_summary: note }
          : action === 'validation'
            ? { validation_summary: note, ready_for_merge: true }
            : {
                to_agent_key: 'integration-captain',
                to_runtime: 'codex',
                summary: note,
                acceptance_criteria: 'Review PR, checks, deployment gates, and merge eligibility.',
              }
      const response = await authedFetch(path, { method: 'POST', body: JSON.stringify(body) })
      const responseBody = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(responseBody.error || `HTTP ${response.status}`)
      await refreshAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionId(null)
    }
  }

  async function prioritizeWorkItem(item: AgentWorkItem, priority: AgentWorkItem['priority']) {
    setActionId(`priority:${item.id}`)
    setError(null)
    try {
      const response = await authedFetch(`/api/admin/agents/work-items/${item.id}/priority`, {
        method: 'POST',
        body: JSON.stringify({
          priority,
          note: `AutoResearch idea priority set to ${priority} from Decision Queue Controller.`,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      await refreshAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Priority update failed')
    } finally {
      setActionId(null)
    }
  }

  async function markReadyForKanban(item: AgentWorkItem) {
    setActionId(`ready:${item.id}`)
    setError(null)
    try {
      const response = await authedFetch(`/api/admin/agents/work-items/${item.id}/ready`, {
        method: 'POST',
        body: JSON.stringify({
          definition_of_ready: definitionOfReadyText(item),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      await refreshAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ready-for-Kanban update failed')
    } finally {
      setActionId(null)
    }
  }

  async function decideVercelResearchApproval(card: VercelResearchApprovalCard, status: 'approved' | 'rejected') {
    setActionId(`${status}:${card.approvalId}`)
    setError(null)
    try {
      const response = await authedFetch(`/api/admin/agents/runs/${card.runId}/approval`, {
        method: 'POST',
        body: JSON.stringify({
          approval_id: card.approvalId,
          status,
          decision_notes:
            status === 'approved'
              ? 'Approved Vercel AutoResearch proposal from Agent Coordination.'
              : 'Rejected Vercel AutoResearch proposal from Agent Coordination.',
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      await refreshAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval update failed')
    } finally {
      setActionId(null)
    }
  }

  async function runMoremiOperationalDrill() {
    setActionId('moremi-drill')
    setError(null)
    try {
      const response = await authedFetch('/api/admin/agents/risk-compliance/drill', {
        method: 'POST',
        body: JSON.stringify({ confirmation: 'run_moremi_operational_drill' }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setMoremiDrillResult(body)
      await refreshAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Moremi drill failed')
    } finally {
      setActionId(null)
    }
  }

  async function askShaka(message: string, contextRef: ShakaContextRef) {
    setActionId(`shaka:${contextRef.type}:${contextRef.id}`)
    setShakaReply(null)
    setShakaContextRef(contextRef)
    setError(null)
    try {
      const response = await authedFetch('/api/admin/agents/chief-of-staff/chat', {
        method: 'POST',
        body: JSON.stringify({
          message,
          context_ref: contextRef,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setShakaReply(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Shaka context request failed')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="agent-ops-page min-h-screen text-foreground p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Agent Operations', href: '/admin/agents' },
          { label: 'Coordination' },
        ]} />

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 text-sm text-radiant-gold">
              <ShieldAlert size={16} />
              Agent Ops controller
            </div>
            <h1 className="text-3xl font-bold">Decision Queue Controller</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Approval controller for one decision at a time: executive summary, action required, recommendation, risk, owner, trace, and fixed approve/reject/Ask Shaka controls.
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
              onClick={refreshAll}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        <section className="agent-ops-command-card mb-6 rounded-xl border p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-radiant-gold">Approval controller</p>
          <h2 className="mt-2 text-2xl font-bold">Start with the decision, then inspect the trace.</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
            Mission Control routes here when a human decision is required. This page keeps approval cards and work-item decisions above secondary queue tools.
          </p>
        </section>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Action required" value={summary.active} />
          <Metric label="Blocked" value={summary.blocked} tone={summary.blocked ? 'red' : 'slate'} />
          <Metric label="Review queue" value={summary.review} tone={summary.review ? 'yellow' : 'slate'} />
          <Metric label="Approval-linked" value={summary.approvals} tone={summary.approvals ? 'green' : 'slate'} />
        </div>

        <VercelResearchApprovalPanel
          approvals={vercelResearchApprovals}
          actionId={actionId}
          onDecision={decideVercelResearchApproval}
          onAskShaka={(card) => askShaka(
            'Should I approve, reject, run another test, or close this approval request? Summarize the experiment, objective, goal, current run, distance from goal, recommendation, risk, evidence, and safest next step.',
            { type: 'approval', id: card.approvalId },
          )}
        />

        <AutoResearchIdeaInboxPanel
          ideas={autoResearchIdeas}
          actionId={actionId}
          onPrioritize={prioritizeWorkItem}
          onReadyForKanban={markReadyForKanban}
          onAskShaka={(item) => askShaka(
            'Should this AutoResearch idea be prioritized or marked ready for the Kanban inbox? Summarize the definition of ready, risk, owner lane, and safest next step.',
            { type: 'work_item', id: item.id },
          )}
        />

        <MoremiOperationalDrillPanel
          result={moremiDrillResult}
          running={actionId === 'moremi-drill'}
          onRun={runMoremiOperationalDrill}
        />

        {shakaReply && shakaContextRef ? (
          <ShakaContextResponse
            reply={shakaReply}
            disabled={Boolean(actionId)}
            onSuggestedAction={(action) => askShaka(action, shakaContextRef)}
          />
        ) : null}

        <section className="agent-ops-card mb-6 rounded-lg border p-4">
          <div className="mb-4 flex flex-col gap-3">
            <div>
              <h2 className="text-base font-semibold">Secondary queue tools</h2>
              <p className="mt-1 text-sm text-muted-foreground">Filter or create controller work items after reviewing action-required cards above.</p>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Status filters">
            {STATUSES.map((item) => (
              <button
                key={item}
                onClick={() => setStatus(item)}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  status === item
                    ? 'border-radiant-gold/60 bg-radiant-gold/15 text-radiant-gold'
                    : 'border-silicon-slate/70 bg-silicon-slate/20 text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.replace(/_/g, ' ')}
              </button>
            ))}
            </div>
          </div>

          <form onSubmit={createWorkItem} className="grid gap-3 border-t border-silicon-slate/60 pt-4 lg:grid-cols-3">
            <div className="lg:col-span-3">
              <h2 className="text-base font-semibold">Create controller work item</h2>
              <p className="mt-1 text-sm text-muted-foreground">Open a decision packet with owner, objective, expected files, branch, and worktree context.</p>
            </div>
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Work item title"
              className="rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm"
            />
            <input
              value={form.owner_agent_key}
              onChange={(event) => setForm((prev) => ({ ...prev, owner_agent_key: event.target.value }))}
              placeholder="owner agent key"
              className="rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm"
            />
            <select
              value={form.owner_runtime}
              onChange={(event) => setForm((prev) => ({ ...prev, owner_runtime: event.target.value as AgentRuntime }))}
              aria-label="owner runtime"
              className="rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm"
            >
              <option value="codex">codex</option>
              <option value="n8n">n8n</option>
              <option value="hermes">hermes</option>
              <option value="manual">manual</option>
            </select>
            <input
              value={form.branch_name}
              onChange={(event) => setForm((prev) => ({ ...prev, branch_name: event.target.value }))}
              placeholder="branch name"
              className="rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm"
            />
            <textarea
              value={form.objective}
              onChange={(event) => setForm((prev) => ({ ...prev, objective: event.target.value }))}
              placeholder="Objective and acceptance criteria"
              rows={3}
              className="rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm lg:col-span-2"
            />
            <div className="grid gap-3">
              <input
                value={form.worktree_path}
                onChange={(event) => setForm((prev) => ({ ...prev, worktree_path: event.target.value }))}
                placeholder="worktree path"
                className="rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm"
              />
              <textarea
                value={form.expected_files}
                onChange={(event) => setForm((prev) => ({ ...prev, expected_files: event.target.value }))}
                placeholder="expected files, one per line"
                rows={2}
                className="rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={submitting || !form.title.trim() || !form.objective.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-radiant-gold/60 bg-radiant-gold/15 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/20 disabled:opacity-50"
              >
                <Network size={16} />
                Create work item
              </button>
            </div>
          </form>
        </section>

        {error ? <FailureState message={error} /> : null}

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading coordination work...</div>
        ) : items.length ? (
          <div className="space-y-3">
            {items.map((item) => (
              <WorkItemCard
                key={item.id}
                item={item}
                actionId={actionId}
                onAction={quickAction}
                onAskShaka={(workItem) => askShaka(
                  'What action is required on this work item? Summarize the recommendation, risk, evidence, and next approval-safe step.',
                  { type: 'work_item', id: workItem.id },
                )}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 px-4 py-12 text-center text-muted-foreground">
            No agent coordination work items match the current filter.
          </div>
        )}
      </div>
    </div>
  )
}

function MoremiOperationalDrillPanel({
  result,
  running,
  onRun,
}: {
  result: MoremiOperationalDrillResult | null
  running: boolean
  onRun: () => void
}) {
  return (
    <section className="mb-6 rounded-lg border border-green-500/30 bg-green-500/5 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-green-100">
            <ShieldCheck size={18} />
            Moremi controller drill
          </div>
          <h2 className="font-semibold">Moremi operational drill</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Creates or reuses one proposed, synthetic Moremi work item. This validates the Agent Coordination and Slack visibility path without production remediation, external sends, or client-data access.
          </p>
        </div>
        <button
          onClick={onRun}
          disabled={running}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-100 hover:bg-green-500/15 disabled:opacity-50"
        >
          <RefreshCw size={16} className={running ? 'animate-spin' : ''} />
          Run drill
        </button>
      </div>

      {result ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <SmallField label="Work item" value={result.work_item.title} />
          <SmallField label="Status" value={result.work_item.status} />
          <SmallField label="Recommendation" value={result.assessment.recommendedNextAction} />
          <SmallField label="Slack check" value={result.verification.slack_command} />
          <div className="rounded-lg border border-green-500/20 bg-background/40 p-3 text-sm lg:col-span-3">
            <p className="font-medium text-green-100">Drill created or reused</p>
            <p className="mt-1 text-muted-foreground">
              {result.assessment.classification.replace(/_/g, ' ')} / {result.assessment.severity}. Expected visibility: {result.verification.expected_status} in Agent Coordination and Slack.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function AutoResearchIdeaInboxPanel({
  ideas,
  actionId,
  onPrioritize,
  onReadyForKanban,
  onAskShaka,
}: {
  ideas: AgentWorkItem[]
  actionId: string | null
  onPrioritize: (item: AgentWorkItem, priority: AgentWorkItem['priority']) => void
  onReadyForKanban: (item: AgentWorkItem) => void
  onAskShaka: (item: AgentWorkItem) => void
}) {
  const proposed = ideas.filter((item) => item.status === 'proposed').length
  const queued = ideas.filter((item) => item.status === 'queued').length
  return (
    <section className="mb-6 rounded-lg border border-blue-400/30 bg-blue-400/5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">AutoResearch idea inbox</p>
          <h2 className="mt-1 font-semibold">Prioritize ideas before they enter the Kanban board.</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Proposed ideas stay here for admin ordering. Marking one ready moves it to the Kanban inbox as queued work so agents can pick up the top item when current work clears.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-2 py-1 text-blue-100">{ideas.length} ideas</span>
          <span className="rounded-full border border-silicon-slate/70 px-2 py-1 text-muted-foreground">{proposed} proposed</span>
          <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-green-100">{queued} Kanban-ready</span>
        </div>
      </div>

      {ideas.length === 0 ? (
        <p className="rounded-lg border border-silicon-slate/60 bg-background/40 p-3 text-sm text-muted-foreground">
          No Vercel AutoResearch ideas have been seeded yet. Run <code className="font-mono">npm run deploy:research:seed-ideas</code> to create the inbox items.
        </p>
      ) : (
        <div className="grid gap-3">
          {ideas.map((item) => {
            const readyForKanban = item.status !== 'proposed'
            const criteria = textArray(item.metadata?.definition_of_ready)
            const recommendation = typeof item.metadata?.recommendation === 'string'
              ? item.metadata.recommendation
              : 'Review this idea against the definition of ready before moving it into Kanban.'
            return (
              <article key={item.id} className="rounded-lg border border-blue-400/20 bg-background/55 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={item.status} />
                      <span className="rounded-full border border-radiant-gold/30 bg-radiant-gold/10 px-2 py-1 text-xs text-radiant-gold">
                        {item.priority} priority
                      </span>
                      {readyForKanban ? (
                        <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs text-green-100">
                          ready for Kanban
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <p className="mt-1 max-w-4xl text-sm text-muted-foreground">{item.objective}</p>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <DecisionSummaryBlock label="Admin recommendation" value={recommendation} />
                      <DecisionSummaryBlock label="Definition of ready" value={criteria.length ? criteria.join('\n') : VERCEL_AUTORESEARCH_DEFINITION_OF_READY.join('\n')} tone="yellow" />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 lg:w-72 lg:justify-end">
                    <label className="min-w-32 text-xs uppercase tracking-wide text-muted-foreground">
                      Priority
                      <select
                        value={item.priority}
                        onChange={(event) => onPrioritize(item, event.target.value as AgentWorkItem['priority'])}
                        disabled={Boolean(actionId)}
                        aria-label={`Prioritize ${item.title}`}
                        className="mt-1 w-full rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                      >
                        {PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>{priority}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      onClick={() => onReadyForKanban(item)}
                      disabled={Boolean(actionId) || readyForKanban}
                      aria-label={`Mark ${item.title} ready for Kanban`}
                      className="inline-flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-100 hover:bg-green-500/15 disabled:opacity-50"
                    >
                      <CheckCircle2 size={16} />
                      Ready for Kanban
                    </button>
                    <button
                      onClick={() => onAskShaka(item)}
                      disabled={Boolean(actionId)}
                      aria-label={`Ask Shaka about ${item.title}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-50"
                    >
                      <MessageSquare size={16} />
                      Ask Shaka
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function ShakaContextResponse({
  reply,
  disabled,
  onSuggestedAction,
}: {
  reply: ShakaContextReply
  disabled?: boolean
  onSuggestedAction: (action: string) => void
}) {
  return (
    <section className="mb-6 rounded-lg border border-radiant-gold/35 bg-radiant-gold/10 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-radiant-gold">
            <MessageSquare size={18} />
            <h2 className="font-semibold">Shaka context answer</h2>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{reply.reply}</p>
        </div>
        <Link
          href={`/admin/agents/runs/${reply.run_id}`}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-radiant-gold/50 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15"
        >
          Open Shaka trace
          <ArrowRight size={16} />
        </Link>
      </div>
      {reply.suggested_actions.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {reply.suggested_actions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onSuggestedAction(action)}
              disabled={disabled}
              aria-label={`Ask Shaka follow-up: ${action}`}
              className="rounded-full border border-radiant-gold/30 bg-background/40 px-2.5 py-1 text-xs text-radiant-gold hover:bg-radiant-gold/15 focus:outline-none focus:ring-2 focus:ring-radiant-gold/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {action}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function VercelResearchApprovalPanel({
  approvals,
  actionId,
  onDecision,
  onAskShaka,
}: {
  approvals: VercelResearchApprovalCard[]
  actionId: string | null
  onDecision: (card: VercelResearchApprovalCard, status: 'approved' | 'rejected') => void
  onAskShaka: (card: VercelResearchApprovalCard) => void
}) {
  return (
    <section className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BellRing size={18} className="text-yellow-200" />
          <div>
            <h2 className="font-semibold text-yellow-100">Vercel AutoResearch approvals decision queue</h2>
            <p className="text-sm text-muted-foreground">Approval cards ready for controller review, recommendation, risk check, and trace follow-up.</p>
          </div>
        </div>
        <span className="rounded-full border border-yellow-500/30 px-2 py-1 text-xs text-yellow-100">
          {approvals.length} pending
        </span>
      </div>

      {approvals.length === 0 ? (
        <p className="rounded-lg border border-silicon-slate/60 bg-background/40 p-3 text-sm text-muted-foreground">
          No Vercel AutoResearch proposal is waiting for approval.
        </p>
      ) : (
        <div className="grid gap-4">
          {approvals.map((card) => {
            const decision = card.proposal.decisionFrame
            return (
            <article key={card.approvalId} className="rounded-lg border border-yellow-500/25 bg-background/55 p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-100">
                  {card.proposal.riskLevel} risk
                </span>
                <span className="rounded-full border border-silicon-slate/70 px-2 py-1 text-xs text-muted-foreground">
                  {card.proposal.approvalState.replace(/_/g, ' ')}
                </span>
                {card.notification.slackSentAt ? (
                  <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs text-green-100">
                    Slack notified
                  </span>
                ) : null}
              </div>
              <h3 className="text-xl font-semibold">{card.proposal.title}</h3>
              <div className="mt-4 grid gap-3">
                <DecisionSummaryBlock
                  label="Experiment"
                  value={decision?.experiment ?? card.proposal.hypothesis}
                />
                <DecisionSummaryBlock
                  label="Objective"
                  value={decision?.objective ?? card.proposal.expectedImpact}
                />
                <div className="grid gap-2 md:grid-cols-2">
                  <DecisionSummaryBlock
                    label="Goal"
                    value={decision?.target ?? 'No explicit goal recorded for this proposal.'}
                    tone="yellow"
                  />
                  <DecisionSummaryBlock
                    label="Current run"
                    value={decision?.currentRun ?? card.proposal.evidence.join('; ')}
                  />
                  <DecisionSummaryBlock
                    label="Distance from goal"
                    value={decision?.distanceFromGoal ?? 'No goal-distance calculation was recorded.'}
                    tone={decision?.goalStatus === 'blocked' ? 'red' : decision?.goalStatus === 'watch' ? 'yellow' : 'green'}
                  />
                  <DecisionSummaryBlock
                    label="Recommended next step"
                    value={decision?.recommendation ?? card.proposal.approvalQuestion}
                    tone="yellow"
                  />
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-silicon-slate/60 bg-background/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Decision choices</p>
                <div className="mt-2 grid gap-2">
                  {(decision?.decisionOptions ?? [
                    { label: 'Approve', when: card.proposal.approvalQuestion },
                    { label: 'Reject', when: 'Use when the evidence is not strong enough or the risk boundary is unclear.' },
                  ]).map((option) => (
                    <div key={option.label} className="rounded-md border border-silicon-slate/60 px-3 py-2 text-sm">
                      <p className="font-medium text-foreground">{option.label}</p>
                      <p className="text-muted-foreground">{option.when}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <SmallField label="Work item" value={card.workItem?.title ?? card.workItemId} />
                <SmallField label="Status" value={card.workItem?.status ?? card.status} />
                <SmallField label="Requested" value={new Date(card.requestedAt).toLocaleString()} />
                <SmallField label="Trace" value={card.runId} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-silicon-slate/60 pt-4">
                <button
                  onClick={() => onDecision(card, 'approved')}
                  disabled={Boolean(actionId)}
                  className="inline-flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-100 hover:bg-green-500/15 disabled:opacity-50"
                >
                  <CheckCircle2 size={16} />
                  Approve
                </button>
                <button
                  onClick={() => onDecision(card, 'rejected')}
                  disabled={Boolean(actionId)}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100 hover:bg-red-500/15 disabled:opacity-50"
                >
                  <XCircle size={16} />
                  Reject
                </button>
                <Link
                  href={`/admin/agents/runs/${card.runId}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 px-3 py-2 text-sm hover:border-radiant-gold/60"
                >
                  Evidence
                  <ArrowRight size={16} />
                </Link>
                <button
                  onClick={() => onAskShaka(card)}
                  disabled={Boolean(actionId)}
                  className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-50"
                >
                  <MessageSquare size={16} />
                  Ask Shaka
                </button>
              </div>
            </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function WorkItemCard({
  item,
  actionId,
  onAction,
  onAskShaka,
}: {
  item: AgentWorkItem
  actionId: string | null
  onAction: (item: AgentWorkItem, action: 'block' | 'validation' | 'handoff') => void
  onAskShaka: (item: AgentWorkItem) => void
}) {
  const recommendation = typeof item.metadata?.recommendation === 'string'
    ? item.metadata.recommendation
    : item.validation_summary || 'Review owner packet, trace evidence, and next gate before changing status.'
  const risk = typeof item.metadata?.risk === 'string'
    ? item.metadata.risk
    : item.approval_id
      ? 'approval linked'
      : item.priority
  const ownerAgentKey = item.owner_agent_key || null

  return (
    <article className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          {ownerAgentKey ? <AgentAvatar agentKey={ownerAgentKey} size="md" /> : null}
          <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <span className="rounded-full border border-silicon-slate/70 px-2 py-1 text-xs text-muted-foreground">
              {item.owner_runtime}
            </span>
            {item.owner_agent_key ? (
              <span className="rounded-full border border-silicon-slate/70 px-2 py-1 text-xs text-muted-foreground">
                {item.owner_agent_key}
              </span>
            ) : null}
            <span className="rounded-full border border-radiant-gold/30 bg-radiant-gold/10 px-2 py-1 text-xs text-radiant-gold">
              risk: {risk}
            </span>
          </div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Executive summary</p>
          <h2 className="mt-1 text-lg font-semibold">{item.title}</h2>
          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">{item.objective}</p>
          <div className="mt-3 rounded-lg border border-radiant-gold/20 bg-radiant-gold/5 p-3 text-sm">
            <p className="font-medium text-radiant-gold">Controller recommendation</p>
            <p className="mt-1 text-muted-foreground">{recommendation}</p>
          </div>
          <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
            <SmallField label="Owner" value={item.owner_agent_key} />
            <SmallField label="Status" value={item.status} />
            <SmallField label="Branch" value={item.branch_name} />
            <SmallField label="Worktree" value={item.worktree_path} />
            <SmallField label="Trace" value={item.active_run_id} />
            <SmallField label="Updated" value={new Date(item.updated_at).toLocaleString()} />
          </div>
          {item.blocker_summary || item.validation_summary ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {item.blocker_summary ? <Callout icon="warn" label="Blocker" value={item.blocker_summary} /> : null}
              {item.validation_summary ? <Callout icon="check" label="Validation" value={item.validation_summary} /> : null}
            </div>
          ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:min-w-64 lg:justify-end">
          {item.pr_url ? (
            <Link
              href={item.pr_url}
              className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 px-3 py-2 text-sm hover:border-radiant-gold/60"
            >
              <GitPullRequest size={16} />
              PR {item.pr_number ?? ''}
            </Link>
          ) : null}
          {item.active_run_id ? (
            <Link
              href={`/admin/agents/runs/${item.active_run_id}`}
              className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 px-3 py-2 text-sm hover:border-radiant-gold/60"
            >
              Trace
              <ArrowRight size={16} />
            </Link>
          ) : null}
          <button
            onClick={() => onAskShaka(item)}
            disabled={Boolean(actionId)}
            aria-label={`Ask Shaka about ${item.title}`}
            className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold shadow-sm hover:bg-radiant-gold/15 disabled:opacity-50"
          >
            <MessageSquare size={16} />
            Ask Shaka
          </button>
          <button
            onClick={() => onAction(item, 'block')}
            disabled={Boolean(actionId)}
            aria-label={`Block ${item.title}`}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/45 bg-red-500/10 px-3 py-2 text-sm text-red-100 shadow-sm hover:bg-red-500/15 disabled:opacity-50"
          >
            <AlertTriangle size={16} />
            Block
          </button>
          <button
            onClick={() => onAction(item, 'validation')}
            disabled={Boolean(actionId)}
            aria-label={`Record validation for ${item.title}`}
            className="inline-flex items-center gap-2 rounded-lg border border-yellow-500/45 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100 shadow-sm hover:bg-yellow-500/15 disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            Validate
          </button>
          <button
            onClick={() => onAction(item, 'handoff')}
            disabled={Boolean(actionId)}
            aria-label={`Handoff ${item.title}`}
            className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold shadow-sm hover:bg-radiant-gold/15 disabled:opacity-50"
          >
            <Network size={16} />
            Handoff
          </button>
        </div>
      </div>
    </article>
  )
}

function Metric({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'red' | 'yellow' | 'green' }) {
  const toneClass =
    tone === 'red'
      ? 'border-red-500/35 text-red-200'
      : tone === 'yellow'
        ? 'border-yellow-500/35 text-yellow-100'
        : tone === 'green'
          ? 'border-green-500/35 text-green-100'
          : 'border-silicon-slate/70'
  return (
    <div className={`rounded-lg border bg-silicon-slate/20 p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'blocked'
      ? 'border-red-500/40 bg-red-500/10 text-red-200'
      : status === 'ready_for_merge'
        ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-100'
        : status === 'deployed' || status === 'merged'
          ? 'border-green-500/40 bg-green-500/10 text-green-100'
          : 'border-silicon-slate/70 bg-silicon-slate/20 text-muted-foreground'
  return <span className={`rounded-full border px-2 py-1 text-xs ${tone}`}>{status.replace(/_/g, ' ')}</span>
}

function DecisionSummaryBlock({
  label,
  value,
  tone = 'slate',
}: {
  label: string
  value: string
  tone?: 'slate' | 'red' | 'yellow' | 'green'
}) {
  const toneClass =
    tone === 'red'
      ? 'border-red-500/35 bg-red-500/10'
      : tone === 'yellow'
        ? 'border-yellow-500/35 bg-yellow-500/10'
        : tone === 'green'
          ? 'border-green-500/35 bg-green-500/10'
          : 'border-silicon-slate/60 bg-background/40'
  return (
    <div className={`rounded-lg border p-3 text-sm ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground/70">{label}</p>
      <p className="mt-1 text-foreground">{value}</p>
    </div>
  )
}

function SmallField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <span className="block uppercase tracking-wide text-muted-foreground/70">{label}</span>
      <span className="block truncate">{value || 'Not set'}</span>
    </div>
  )
}

function Callout({ icon, label, value }: { icon: 'warn' | 'check'; label: string; value: string }) {
  const Icon = icon === 'warn' ? AlertTriangle : CheckCircle2
  return (
    <div className="flex gap-2 rounded-lg border border-silicon-slate/70 bg-background/50 p-3 text-sm">
      <Icon size={16} className={icon === 'warn' ? 'text-red-300' : 'text-green-300'} />
      <div>
        <p className="font-medium">{label}</p>
        <p className="mt-1 text-muted-foreground">{value}</p>
      </div>
    </div>
  )
}

function FailureState({ message }: { message: string }) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-100">
      <ShieldCheck size={18} />
      <div>
        <p className="font-medium">Coordination layer unavailable</p>
        <p className="mt-1 text-sm text-red-100/80">{message}</p>
      </div>
    </div>
  )
}
