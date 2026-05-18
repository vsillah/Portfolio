'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
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
  Workflow,
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

type GuidedIntakeTemplate = {
  key: string
  label: string
  summary: string
  objective: string
  title: string
  narrative: string
  owner_agent_key: string
  owner_runtime: AgentRuntime
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

type WorkItemQuickAction =
  | 'block'
  | 'validation'
  | 'handoff'
  | 'ready'
  | 'proposal_validation'
  | 'mcp_build_request'
  | 'n8n_activation_review'

type N8nMcpHandoffPacketView = {
  version: string
  action: string
  workflowFamily: string | null
  automationGoalSeedId: string | null
  goalId: string | null
  goalTitle: string | null
  workflow: {
    proposedName: string | null
    existingWorkflowId: string | null
    trigger: string | null
    nodePlan: string[]
  }
  requirements: {
    requiredEnvVars: string[]
    credentialNeeds: string[]
    ingestCallbacks: string[]
    testEvidence: string | null
  }
  approvalGate: string
  rollbackPath: string | null
  guardrails: string[]
  handoffInstructions: string[]
}

type N8nMcpBuildRequestView = {
  requestedAt: string | null
  actorLabel: string | null
  summary: string | null
  packetVersion: string | null
  expectedReturn: string[]
}

type N8nMcpBuildResultView = {
  recordedAt: string | null
  actorLabel: string | null
  resultSummary: string
  workflowId: string | null
  inspectionResult: string | null
  validationResult: string | null
  testEvidence: string | null
  credentialGaps: string[]
  envGaps: string[]
  rollbackNotes: string | null
  activationRequested: boolean
  activationGate: string | null
}

type N8nActivationReviewRequestView = {
  requestedAt: string | null
  actorLabel: string | null
  summary: string | null
  approvalId: string | null
  approvalType: string | null
  workflowId: string | null
  approvalBoundary: string[]
}

const DEFAULT_FORM: WorkItemForm = {
  title: 'Review controller decision packet',
  objective: 'Summarize the decision needed, confirm the evidence source, state the safest next step, and route the packet through the controller before execution continues.',
  owner_agent_key: 'integration-captain',
  owner_runtime: 'codex',
  branch_name: '',
  worktree_path: '',
  expected_files: 'app/admin/agents/coordination/page.tsx\napp/admin/agents/coordination/page.test.tsx',
}

const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
const ARCHIVE_PAGE_SIZE = 3

const OWNER_OPTIONS = [
  { key: 'integration-captain', label: 'Integration Captain' },
  { key: 'chief-of-staff', label: 'Shaka' },
  { key: 'risk-compliance-intelligence', label: 'Moremi' },
  { key: 'automation-systems', label: 'Automation Systems' },
  { key: 'research-source-register', label: 'Research Source Register' },
]

const GUIDED_INTAKE_TEMPLATES: GuidedIntakeTemplate[] = [
  {
    key: 'controller-review',
    label: 'Controller review',
    summary: 'A decision packet needs owner, evidence, recommendation, and approval path.',
    objective: 'Convert an ambiguous decision into a reviewable controller packet.',
    title: DEFAULT_FORM.title,
    narrative: DEFAULT_FORM.objective,
    owner_agent_key: DEFAULT_FORM.owner_agent_key,
    owner_runtime: DEFAULT_FORM.owner_runtime,
    expected_files: DEFAULT_FORM.expected_files,
  },
  {
    key: 'blocker-triage',
    label: 'Blocker triage',
    summary: 'A blocked item needs a named owner decision before work continues.',
    objective: 'Make the blocker, owner, and unblock condition explicit.',
    title: 'Triage blocked Agent Ops work item',
    narrative: 'Identify the blocker, name the owner decision required, confirm the evidence source, and recommend whether to unblock, park, or hand off to the Integration Captain.',
    owner_agent_key: 'integration-captain',
    owner_runtime: 'codex',
    expected_files: 'app/admin/agents/swarm-board/page.tsx\napp/admin/agents/runs/[runId]/page.tsx',
  },
  {
    key: 'validation-handoff',
    label: 'Validation handoff',
    summary: 'A review-ready item needs checks, evidence, and merge readiness summarized.',
    objective: 'Package validation evidence so the captain can make a merge or handoff decision.',
    title: 'Prepare validation handoff packet',
    narrative: 'Collect focused validation results, trace links, PR status, rollback path, and the merge-readiness recommendation before moving the work to the captain lane.',
    owner_agent_key: 'integration-captain',
    owner_runtime: 'codex',
    expected_files: 'app/admin/agents/swarm-board/page.tsx\napp/admin/agents/swarm-board/page.test.tsx',
  },
  {
    key: 'agent-follow-up',
    label: 'Agent follow-up',
    summary: 'An agent needs a concrete follow-up task with acceptance criteria.',
    objective: 'Turn an operator request into bounded work assigned to an agent owner.',
    title: 'Route follow-up task to agent owner',
    narrative: 'Turn the requested follow-up into a bounded task with owner, expected output, acceptance criteria, trace link, and next checkpoint.',
    owner_agent_key: 'chief-of-staff',
    owner_runtime: 'codex',
    expected_files: 'app/admin/agents/standup/page.tsx\napp/admin/agents/swarm-board/page.tsx',
  },
]

const INTAKE_MADLIB_CHIPS = [
  {
    label: 'Decision needed',
    text: 'Decision needed: approve, reject, block, hand off, or request more evidence.',
  },
  {
    label: 'Evidence',
    text: 'Evidence to inspect: trace, PR, validation summary, owner note, and rollback path.',
  },
  {
    label: 'Recommendation',
    text: 'Recommendation: state the safest next step and why it is reversible or approval-gated.',
  },
  {
    label: 'Done when',
    text: 'Done when: the owner, action required, risk, and next checkpoint are clear enough for the controller queue.',
  },
]

function isAutoResearchIdea(item: AgentWorkItem) {
  return item.source_type === VERCEL_AUTORESEARCH_IDEA_SOURCE_TYPE || item.metadata?.autoresearch_idea === true
}

function isN8nWorkflowProposal(item: AgentWorkItem) {
  return item.source_type === 'n8n_workflow_proposal' || item.metadata?.n8n_workflow_proposal === true
}

function textArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function n8nMcpHandoffPacketForProposal(input: {
  item: AgentWorkItem
  action: string
  workflowFamily: string
  goalId: string | null
  goalTitle: string
  requiredEnvVars: string[]
  credentialNeeds: string[]
  nodePlan: string[]
  ingestCallbacks: string[]
  testEvidence: string | null
  rollbackPath: string | null
  approvalGate: string
}): N8nMcpHandoffPacketView {
  const metadata = input.item.metadata ?? {}
  const stored = recordValue(metadata.mcp_handoff_packet)
  const storedWorkflow = recordValue(stored?.workflow)
  const storedRequirements = recordValue(stored?.requirements)
  return {
    version: stringValue(stored?.version) ?? 'agent-ops-n8n-mcp-handoff/v1',
    action: stringValue(stored?.action) ?? input.action.replace(/\s+/g, '_'),
    workflowFamily: stringValue(stored?.workflowFamily) ?? stringValue(metadata.workflow_family) ?? input.workflowFamily.replace(/\s+/g, '_'),
    automationGoalSeedId: stringValue(stored?.automationGoalSeedId) ?? stringValue(metadata.automation_goal_seed_id),
    goalId: stringValue(stored?.goalId) ?? input.goalId,
    goalTitle: stringValue(stored?.goalTitle) ?? input.goalTitle,
    workflow: {
      proposedName: stringValue(storedWorkflow?.proposedName) ?? stringValue(metadata.proposed_workflow_name) ?? input.goalTitle,
      existingWorkflowId: stringValue(storedWorkflow?.existingWorkflowId) ?? stringValue(metadata.existing_workflow_id),
      trigger: stringValue(storedWorkflow?.trigger) ?? stringValue(metadata.trigger),
      nodePlan: textArray(storedWorkflow?.nodePlan).length ? textArray(storedWorkflow?.nodePlan) : input.nodePlan,
    },
    requirements: {
      requiredEnvVars: textArray(storedRequirements?.requiredEnvVars).length ? textArray(storedRequirements?.requiredEnvVars) : input.requiredEnvVars,
      credentialNeeds: textArray(storedRequirements?.credentialNeeds).length ? textArray(storedRequirements?.credentialNeeds) : input.credentialNeeds,
      ingestCallbacks: textArray(storedRequirements?.ingestCallbacks).length ? textArray(storedRequirements?.ingestCallbacks) : input.ingestCallbacks,
      testEvidence: stringValue(storedRequirements?.testEvidence) ?? input.testEvidence,
    },
    approvalGate: stringValue(stored?.approvalGate) ?? input.approvalGate,
    rollbackPath: stringValue(stored?.rollbackPath) ?? input.rollbackPath,
    guardrails: textArray(stored?.guardrails).length ? textArray(stored?.guardrails) : [
      'Use staging, inactive, or inspection-only n8n workflows until the controller explicitly approves activation.',
      'Do not create or rotate credentials from this packet; report credential needs back to Agent Ops.',
      'Do not send outbound email, publish content, mutate production customer data, or enable live schedules without approval.',
      'Use synthetic or test-owned validation data unless the controller approves a narrower live-data drill.',
    ],
    handoffInstructions: textArray(stored?.handoffInstructions).length ? textArray(stored?.handoffInstructions) : [
      'Create or inspect the workflow using the workflow name, trigger, node plan, credential needs, and callback routes in this packet.',
      'Return the n8n workflow id, validation result, test evidence, and rollback notes to the Decision Queue controller.',
      'Attach trace evidence before asking for staging, production activation, credential, outbound, or client-visible approval.',
    ],
  }
}

function n8nMcpBuildRequestForItem(item: AgentWorkItem): N8nMcpBuildRequestView | null {
  const request = recordValue(item.metadata?.mcp_build_request)
  if (!request) return null
  return {
    requestedAt: stringValue(request.requested_at),
    actorLabel: stringValue(request.actor_label),
    summary: stringValue(request.summary),
    packetVersion: stringValue(request.packet_version),
    expectedReturn: textArray(request.expected_return),
  }
}

function n8nMcpBuildResultForItem(item: AgentWorkItem): N8nMcpBuildResultView | null {
  const result = recordValue(item.metadata?.mcp_build_result)
  const resultSummary = stringValue(result?.result_summary)
  if (!result || !resultSummary) return null
  return {
    recordedAt: stringValue(result.recorded_at),
    actorLabel: stringValue(result.actor_label),
    resultSummary,
    workflowId: stringValue(result.workflow_id),
    inspectionResult: stringValue(result.inspection_result),
    validationResult: stringValue(result.validation_result),
    testEvidence: stringValue(result.test_evidence),
    credentialGaps: textArray(result.credential_gaps),
    envGaps: textArray(result.env_gaps),
    rollbackNotes: stringValue(result.rollback_notes),
    activationRequested: result.activation_requested === true,
    activationGate: stringValue(result.activation_gate),
  }
}

function n8nActivationReviewRequestForItem(item: AgentWorkItem): N8nActivationReviewRequestView | null {
  const request = recordValue(item.metadata?.n8n_activation_review_request)
  if (!request) return null
  return {
    requestedAt: stringValue(request.requested_at),
    actorLabel: stringValue(request.actor_label),
    summary: stringValue(request.summary),
    approvalId: stringValue(request.approval_id),
    approvalType: stringValue(request.approval_type),
    workflowId: stringValue(request.workflow_id),
    approvalBoundary: textArray(request.approval_boundary),
  }
}

function n8nProposalElementId(proposalId: string) {
  return `n8n-proposal-${proposalId}`
}

function definitionOfReadyText(item: AgentWorkItem) {
  const criteria = textArray(item.metadata?.definition_of_ready)
  const source = criteria.length ? criteria : VERCEL_AUTORESEARCH_DEFINITION_OF_READY
  return source.map((criterion) => `- ${criterion}`).join('\n')
}

const PRIORITY_RANK: Record<AgentWorkItem['priority'], number> = { urgent: 0, high: 1, medium: 2, low: 3 }
const STATUS_RANK: Record<AgentWorkItemStatus, number> = {
  blocked: 0,
  ready_for_review: 1,
  ready_for_merge: 2,
  proposed: 3,
  queued: 4,
  assigned: 5,
  in_progress: 6,
  merged: 7,
  deployed: 8,
  cancelled: 9,
}

function isTerminalWorkItem(item: AgentWorkItem) {
  return item.status === 'merged' || item.status === 'deployed' || item.status === 'cancelled'
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
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(GUIDED_INTAKE_TEMPLATES[0].key)
  const [archivePage, setArchivePage] = useState(1)
  const [vercelResearchApprovals, setVercelResearchApprovals] = useState<VercelResearchApprovalCard[]>([])
  const [moremiDrillResult, setMoremiDrillResult] = useState<MoremiOperationalDrillResult | null>(null)
  const [shakaReply, setShakaReply] = useState<ShakaContextReply | null>(null)
  const [shakaContextRef, setShakaContextRef] = useState<ShakaContextRef | null>(null)
  const [n8nDeepLink, setN8nDeepLink] = useState<{ proposalId: string | null; goalId: string | null }>({
    proposalId: null,
    goalId: null,
  })

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setN8nDeepLink({
      proposalId: params.get('proposal'),
      goalId: params.get('goal'),
    })
  }, [])

  const summary = useMemo(() => ({
    active: items.filter((item) => !['merged', 'deployed', 'cancelled'].includes(item.status)).length,
    controllerOpen: items.filter((item) => !isTerminalWorkItem(item) && !isN8nWorkflowProposal(item)).length,
    blocked: items.filter((item) => item.status === 'blocked').length,
    review: items.filter((item) => item.status === 'ready_for_review' || item.status === 'ready_for_merge').length,
    approvals: items.filter((item) => Boolean(item.approval_id)).length,
    n8nProposals: items.filter((item) => isN8nWorkflowProposal(item) && !isTerminalWorkItem(item)).length,
  }), [items])

  const autoResearchIdeas = useMemo(() => {
    return items
      .filter(isAutoResearchIdea)
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [items])

  const controllerQueueItems = useMemo(() => {
    return items
      .filter((item) => !isTerminalWorkItem(item) && !isN8nWorkflowProposal(item))
      .sort((a, b) => {
        const statusDelta = STATUS_RANK[a.status] - STATUS_RANK[b.status]
        if (statusDelta !== 0) return statusDelta
        const priorityDelta = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        if (priorityDelta !== 0) return priorityDelta
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      })
      .slice(0, 3)
  }, [items])

  const n8nWorkflowProposals = useMemo(() => {
    return items
      .filter((item) => isN8nWorkflowProposal(item) && !isTerminalWorkItem(item))
      .sort((a, b) => {
        const priorityDelta = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        if (priorityDelta !== 0) return priorityDelta
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      })
  }, [items])

  const archiveTotalPages = Math.max(1, Math.ceil(items.length / ARCHIVE_PAGE_SIZE))
  const archivePageSafe = Math.min(archivePage, archiveTotalPages)
  const archiveStart = items.length ? (archivePageSafe - 1) * ARCHIVE_PAGE_SIZE : 0
  const archiveItems = items.slice(archiveStart, archiveStart + ARCHIVE_PAGE_SIZE)

  useEffect(() => {
    setArchivePage(1)
  }, [status, items.length])

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
      setSelectedTemplateKey(GUIDED_INTAKE_TEMPLATES[0].key)
      await refreshAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create work item')
    } finally {
      setSubmitting(false)
    }
  }

  function selectGuidedTemplate(template: GuidedIntakeTemplate) {
    setSelectedTemplateKey(template.key)
    setForm((prev) => ({
      ...prev,
      title: template.title,
      objective: template.narrative,
      owner_agent_key: template.owner_agent_key,
      owner_runtime: template.owner_runtime,
      expected_files: template.expected_files,
    }))
  }

  function addMadlibText(text: string) {
    setForm((prev) => ({
      ...prev,
      objective: prev.objective.includes(text)
        ? prev.objective
        : `${prev.objective.trim()}${prev.objective.trim() ? '\n' : ''}${text}`,
    }))
  }

  async function quickAction(item: AgentWorkItem, action: WorkItemQuickAction) {
    const note =
      action === 'block'
        ? 'Needs Integration Captain review before proceeding.'
        : action === 'validation'
          ? 'Validation packet recorded from Agent Coordination.'
          : action === 'n8n_activation_review'
            ? 'n8n activation review requested from returned MCP build evidence. Inspect workflow id, validation evidence, credential/env boundary, rollback notes, and approval gate before any workflow activation.'
            : action === 'mcp_build_request'
              ? 'n8n MCP build requested from the structured handoff packet. Create or inspect an inactive staging workflow only; return workflow id, validation evidence, credential gaps, and rollback notes to this controller before activation.'
              : action === 'proposal_validation'
                ? 'n8n proposal packet reviewed. Trigger, credential boundary, callbacks, rollback path, and approval gate are ready for the next controller step.'
                : action === 'ready'
                  ? 'n8n proposal is ready for Kanban execution planning. Keep staging and production activation behind the controller approval gate.'
                  : 'Hand off to Integration Captain for gated review.'
    setActionId(`${action}:${item.id}`)
    setError(null)
    try {
      const path =
        action === 'block'
          ? `/api/admin/agents/work-items/${item.id}/block`
          : action === 'n8n_activation_review'
            ? `/api/admin/agents/work-items/${item.id}/n8n-activation-review`
          : action === 'mcp_build_request'
            ? `/api/admin/agents/work-items/${item.id}/mcp-build-request`
          : action === 'validation' || action === 'proposal_validation'
            ? `/api/admin/agents/work-items/${item.id}/validation`
            : action === 'ready'
              ? `/api/admin/agents/work-items/${item.id}/ready`
              : `/api/admin/agents/work-items/${item.id}/handoff`
      const body =
        action === 'block'
          ? { blocker_summary: note }
          : action === 'n8n_activation_review'
            ? { review_summary: note }
          : action === 'mcp_build_request'
            ? { request_summary: note }
          : action === 'validation'
            ? { validation_summary: note, ready_for_merge: true }
            : action === 'proposal_validation'
              ? { validation_summary: note, ready_for_merge: false }
              : action === 'ready'
                ? { definition_of_ready: note }
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
    <div className="agent-ops-page min-h-screen p-5 text-foreground lg:p-7">
      <div className="mx-auto max-w-7xl">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Agent Operations', href: '/admin/agents' },
          { label: 'Coordination' },
        ]} />

        <header className="agent-ops-surface-header mb-6 mt-5 flex flex-col gap-4 rounded-xl border p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="agent-ops-eyebrow mb-2">
              <ShieldAlert size={16} />
              Agent Ops controller
            </div>
            <h1 className="text-3xl font-bold">Decision Queue Controller</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Approval controller for one decision at a time: executive summary, action required, recommendation, risk, owner, trace, and fixed approve/reject/Ask Shaka controls.
            </p>
          </div>
          <div className="agent-ops-header-actions">
            <Link
              href="/admin/agents"
              className="agent-ops-button-muted"
            >
              <Bot size={16} />
              Mission Control
            </Link>
            <button
              onClick={refreshAll}
              disabled={loading}
              className="agent-ops-button-secondary disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Action required" value={summary.active} />
          <Metric label="Blocked" value={summary.blocked} tone={summary.blocked ? 'red' : 'slate'} />
          <Metric label="Review queue" value={summary.review} tone={summary.review ? 'yellow' : 'slate'} />
          <Metric label="n8n proposals" value={summary.n8nProposals} tone={summary.n8nProposals ? 'yellow' : 'slate'} />
        </div>

        <ControllerDecisionQueuePanel
          items={controllerQueueItems}
          totalOpen={summary.controllerOpen}
          actionId={actionId}
          onAction={quickAction}
          onAskShaka={(workItem) => askShaka(
            'What action is required on this Decision Queue item? Summarize the action required, problem or opportunity, recommendation, risk, owner, evidence, and safest next approval-gated step.',
            { type: 'work_item', id: workItem.id },
          )}
        />

        <N8nWorkflowProposalPanel
          proposals={n8nWorkflowProposals}
          highlightedProposalId={n8nDeepLink.proposalId}
          highlightedGoalId={n8nDeepLink.goalId}
          actionId={actionId}
          onAction={quickAction}
          onAskShaka={(workItem) => askShaka(
            'Review this n8n workflow proposal as a controller packet. Summarize the goal, workflow draft, trigger, credential boundary, expected callbacks, approval gate, rollback path, and safest next step without activating production.',
            { type: 'work_item', id: workItem.id },
          )}
        />

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
          <div className="mb-4">
            <div>
              <h2 className="text-base font-semibold">Create controller packet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use this when a decision, blocker, validation handoff, or agent follow-up is missing from the queue. Pick a template, fill the madlib-style packet, and create tracked work for the controller.
              </p>
            </div>
          </div>

          <form onSubmit={createWorkItem} className="grid gap-4 border-t border-silicon-slate/60 pt-4">
            <div>
              <h2 className="text-base font-semibold">Decision pattern templates</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Each template pre-fills the objective, owner, runtime, and expected evidence. Choose the pattern that matches the operator question.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Guided intake templates">
              {GUIDED_INTAKE_TEMPLATES.map((template) => (
                <button
                  key={template.key}
                  type="button"
                  onClick={() => selectGuidedTemplate(template)}
                  className={`rounded-lg border p-3 text-left transition ${
                    selectedTemplateKey === template.key
                      ? 'border-radiant-gold/60 bg-radiant-gold/15 text-foreground'
                      : 'border-silicon-slate/70 bg-silicon-slate/20 text-muted-foreground hover:border-radiant-gold/35 hover:text-foreground'
                  }`}
                >
                  <span className="text-sm font-semibold">{template.label}</span>
                  <span className="mt-1 block text-xs leading-5">{template.summary}</span>
                  <span className="mt-2 block rounded-md border border-silicon-slate/60 bg-background/35 px-2 py-1 text-xs leading-5 text-muted-foreground">
                    Objective: {template.objective}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid gap-4 rounded-lg border border-silicon-slate/70 bg-background/45 p-4 lg:grid-cols-[1fr_280px]">
              <div className="grid gap-3">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Decision title
                  <input
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-radiant-gold/70"
                  />
                </label>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Narrative packet
                  <textarea
                    value={form.objective}
                    onChange={(event) => setForm((prev) => ({ ...prev, objective: event.target.value }))}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-radiant-gold/70"
                  />
                </label>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Complete the packet</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {INTAKE_MADLIB_CHIPS.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => addMadlibText(chip.text)}
                        className="rounded-full border border-radiant-gold/35 bg-radiant-gold/10 px-2.5 py-1 text-xs text-radiant-gold hover:bg-radiant-gold/15"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid content-start gap-3">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Owner
                  <select
                    value={form.owner_agent_key}
                    onChange={(event) => setForm((prev) => ({ ...prev, owner_agent_key: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-radiant-gold/70"
                  >
                    {OWNER_OPTIONS.map((owner) => (
                      <option key={owner.key} value={owner.key}>{owner.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Runtime
                  <select
                    value={form.owner_runtime}
                    onChange={(event) => setForm((prev) => ({ ...prev, owner_runtime: event.target.value as AgentRuntime }))}
                    className="mt-1 w-full rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-radiant-gold/70"
                  >
                    <option value="codex">codex</option>
                    <option value="n8n">n8n</option>
                    <option value="hermes">hermes</option>
                    <option value="manual">manual</option>
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={submitting || !form.title.trim() || !form.objective.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-radiant-gold/60 bg-radiant-gold/15 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/20 disabled:opacity-50"
                >
                  <Network size={16} />
                  Create controller packet
                </button>
              </div>
            </div>

            <details className="rounded-lg border border-silicon-slate/60 bg-silicon-slate/15 p-3">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-radiant-gold">
                Advanced routing details
              </summary>
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Branch
                  <input
                    value={form.branch_name}
                    onChange={(event) => setForm((prev) => ({ ...prev, branch_name: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                  />
                </label>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Worktree
                  <input
                    value={form.worktree_path}
                    onChange={(event) => setForm((prev) => ({ ...prev, worktree_path: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                  />
                </label>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Expected files
                  <textarea
                    value={form.expected_files}
                    onChange={(event) => setForm((prev) => ({ ...prev, expected_files: event.target.value }))}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                  />
                </label>
              </div>
            </details>
          </form>
        </section>

        {error ? <FailureState message={error} /> : null}

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading coordination work...</div>
        ) : (
          <section className="agent-ops-card mb-6 rounded-lg border p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-base font-semibold">Full work-item archive</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Filter and inspect matching controller items here. The filter applies only to the archive results below.
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                {items.length
                  ? `Showing ${archiveStart + 1}-${Math.min(archiveStart + ARCHIVE_PAGE_SIZE, items.length)} of ${items.length}`
                  : 'Showing 0 of 0'}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2" aria-label="Status filters">
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

            {items.length ? (
              <div className="mt-4 space-y-3">
                {archiveItems.map((item) => (
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
              <div className="mt-4 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 px-4 py-12 text-center text-muted-foreground">
                No agent coordination work items match the current filter.
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setArchivePage((page) => Math.max(1, page - 1))}
                disabled={archivePageSafe <= 1}
                className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {archivePageSafe} of {archiveTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setArchivePage((page) => Math.min(archiveTotalPages, page + 1))}
                disabled={archivePageSafe >= archiveTotalPages}
                className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
              >
                Next
              </button>
            </div>
          </section>
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

function ControllerDecisionQueuePanel({
  items,
  totalOpen,
  actionId,
  onAction,
  onAskShaka,
}: {
  items: AgentWorkItem[]
  totalOpen: number
  actionId: string | null
  onAction: (item: AgentWorkItem, action: 'block' | 'validation' | 'handoff') => void
  onAskShaka: (item: AgentWorkItem) => void
}) {
  return (
    <section className="agent-ops-card mb-6 rounded-lg border border-silicon-slate/70 p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-radiant-gold">Decision queue</p>
          <h2 className="mt-1 text-xl font-semibold">Top controller decisions</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Showing the next three non-terminal items by urgency. Each card states the action required, recommendation, risk, owner, evidence, and the safest control.
          </p>
        </div>
        <div className="rounded-full border border-silicon-slate/70 bg-background/40 px-3 py-1 text-xs text-muted-foreground">
          Showing {items.length} of {totalOpen} open item(s)
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-sm text-green-100">
          No controller decision is waiting. Continue monitoring Mission Control and Agent Kanban.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => {
            const model = decisionQueueModel(item)
            return (
              <article key={item.id} className={`rounded-lg border p-4 ${model.toneClass}`}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={item.status} />
                      <span className="rounded-full border border-radiant-gold/30 bg-radiant-gold/10 px-2 py-1 text-xs text-radiant-gold">
                        {item.priority} priority
                      </span>
                      {item.approval_id ? (
                        <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs text-green-100">
                          approval linked
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <p className="mt-1 max-w-4xl text-sm text-muted-foreground">{item.objective}</p>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <DecisionSummaryBlock label="Action required" value={model.actionRequired} tone={model.tone} />
                      <DecisionSummaryBlock label="Recommendation" value={model.recommendation} tone="yellow" />
                      <DecisionSummaryBlock label="Risk and status" value={model.riskStatus} />
                      <DecisionSummaryBlock label="Evidence home" value={model.evidenceHome} />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                      <SmallField label="Owner" value={item.owner_agent_key ?? item.owner_runtime} />
                      <SmallField label="Source" value={item.source_label ?? item.source_type} />
                      <SmallField label="Updated" value={new Date(item.updated_at).toLocaleString()} />
                      <SmallField label="Worktree" value={item.worktree_path} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 xl:w-72 xl:justify-end">
                    {item.active_run_id ? (
                      <Link
                        href={`/admin/agents/runs/${item.active_run_id}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 px-3 py-2 text-sm hover:border-radiant-gold/60"
                      >
                        Open trace
                        <ArrowRight size={16} />
                      </Link>
                    ) : null}
                    {item.pr_url ? (
                      <Link
                        href={item.pr_url}
                        className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 px-3 py-2 text-sm hover:border-radiant-gold/60"
                      >
                        <GitPullRequest size={16} />
                        PR {item.pr_number ?? ''}
                      </Link>
                    ) : null}
                    <button
                      onClick={() => onAskShaka(item)}
                      disabled={Boolean(actionId)}
                      aria-label={`Ask Shaka about top decision ${item.title}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-50"
                    >
                      <MessageSquare size={16} />
                      Ask Shaka
                    </button>
                    <button
                      onClick={() => onAction(item, model.primaryAction)}
                      disabled={Boolean(actionId)}
                      aria-label={`${model.primaryLabel} ${item.title}`}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-sm disabled:opacity-50 ${model.primaryClass}`}
                    >
                      {model.primaryIcon}
                      {model.primaryLabel}
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

function N8nWorkflowProposalPanel({
  proposals,
  highlightedProposalId,
  highlightedGoalId,
  actionId,
  onAction,
  onAskShaka,
}: {
  proposals: AgentWorkItem[]
  highlightedProposalId: string | null
  highlightedGoalId: string | null
  actionId: string | null
  onAction: (item: AgentWorkItem, action: WorkItemQuickAction) => void
  onAskShaka: (item: AgentWorkItem) => void
}) {
  const highlightedProposal = useMemo(() => {
    if (highlightedProposalId) {
      return proposals.find((item) => item.id === highlightedProposalId) ?? null
    }
    if (highlightedGoalId) {
      return proposals.find((item) => item.metadata?.goal_id === highlightedGoalId) ?? null
    }
    return null
  }, [highlightedGoalId, highlightedProposalId, proposals])

  useEffect(() => {
    if (!highlightedProposal) return
    const target = document.getElementById(n8nProposalElementId(highlightedProposal.id))
    target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [highlightedProposal])

  return (
    <section className="agent-ops-card mb-6 rounded-lg border border-green-500/25 p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-green-100">n8n workflow proposals</p>
          <h2 className="mt-1 text-xl font-semibold">Review automation workflow drafts before staging.</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            These are proposal packets from Standup goals. Review the business goal, workflow plan, credential boundary, callbacks, and rollback path before any staging or production activation is requested.
          </p>
        </div>
        <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs text-green-100">
          {proposals.length} proposal{proposals.length === 1 ? '' : 's'}
        </span>
      </div>

      {proposals.length === 0 ? (
        <p className="rounded-lg border border-silicon-slate/60 bg-background/40 p-3 text-sm text-muted-foreground">
          No n8n workflow proposal is waiting. Draft workflow proposals from the Standup Room when an automation goal needs an n8n plan.
        </p>
      ) : (
        <div className="grid gap-3">
          {proposals.map((item) => {
            const action = stringValue(item.metadata?.n8n_proposal_action)?.replace(/_/g, ' ') ?? 'proposal'
            const workflowFamily = stringValue(item.metadata?.workflow_family)?.replace(/_/g, ' ') ?? 'automation workflow'
            const goalId = stringValue(item.metadata?.goal_id)
            const goalTitle = stringValue(item.metadata?.goal_title) ?? item.title.replace(/^n8n proposal:\s*/i, '')
            const goalSessionHref = stringValue(item.metadata?.goal_session_href)
              ?? (goalId ? `/admin/agents/standup?goal=${encodeURIComponent(goalId)}` : null)
            const goalKanbanHref = goalId ? `/admin/agents/swarm-board?goal=${encodeURIComponent(goalId)}` : '/admin/agents/swarm-board'
            const requiredEnvVars = textArray(item.metadata?.required_env_vars)
            const credentialNeeds = textArray(item.metadata?.credential_needs)
            const nodePlan = textArray(item.metadata?.node_plan)
            const ingestCallbacks = textArray(item.metadata?.ingest_callbacks)
            const testEvidence = stringValue(item.metadata?.test_evidence)
            const rollbackPath = stringValue(item.metadata?.rollback_path) ?? 'Delete the inactive draft workflow and leave production unchanged.'
            const approvalGate = stringValue(item.metadata?.approval_gate)
              ?? 'Production activation, credential changes, outbound sends, public publishing, and client-visible mutation require approval.'
            const mcpBuildRequest = n8nMcpBuildRequestForItem(item)
            const mcpBuildResult = n8nMcpBuildResultForItem(item)
            const activationReviewRequest = n8nActivationReviewRequestForItem(item)
            const mcpBuildGaps = mcpBuildResult
              ? [...mcpBuildResult.credentialGaps, ...mcpBuildResult.envGaps]
              : []
            const hasMcpBuildRequest = Boolean(mcpBuildRequest)
            const hasCleanMcpBuildResult = Boolean(mcpBuildResult && mcpBuildGaps.length === 0)
            const hasActivationReviewRequest = Boolean(activationReviewRequest)
            const canSendToKanban = !['ready_for_review', 'ready_for_merge'].includes(item.status)
            const canValidatePacket = !hasCleanMcpBuildResult && !hasActivationReviewRequest
            const canRequestMcpBuild = !hasMcpBuildRequest && !mcpBuildResult && !hasActivationReviewRequest
            const canRequestActivationReview = hasCleanMcpBuildResult && !hasActivationReviewRequest
            const mcpHandoffPacket = n8nMcpHandoffPacketForProposal({
              item,
              action,
              workflowFamily,
              goalId,
              goalTitle,
              requiredEnvVars,
              credentialNeeds,
              nodePlan,
              ingestCallbacks,
              testEvidence,
              rollbackPath,
              approvalGate,
            })
            const recommendation = item.status === 'ready_for_review' || item.status === 'ready_for_merge'
              ? 'Validate the draft packet and route the next gate through the controller. Do not activate production from this review.'
              : 'Review the proposal as draft-only. Move to validation only after the trigger, credentials, callbacks, and rollback path are clear.'
            const highlighted = highlightedProposal?.id === item.id

            return (
              <article
                key={item.id}
                id={n8nProposalElementId(item.id)}
                data-n8n-proposal-id={item.id}
                data-n8n-goal-id={goalId ?? undefined}
                aria-label={`n8n proposal ${item.title}`}
                className={`rounded-lg border bg-background/55 p-4 scroll-mt-24 ${
                  highlighted
                    ? 'border-radiant-gold/70 shadow-[0_0_0_1px_rgba(221,184,65,0.35),0_0_32px_rgba(221,184,65,0.16)]'
                    : 'border-green-500/25'
                }`}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {highlighted ? (
                        <span className="rounded-full border border-radiant-gold/40 bg-radiant-gold/15 px-2 py-1 text-xs text-radiant-gold">
                          linked from Mission Control
                        </span>
                      ) : null}
                      <StatusBadge status={item.status} />
                      <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs text-green-100">
                        {action}
                      </span>
                      <span className="rounded-full border border-silicon-slate/70 px-2 py-1 text-xs text-muted-foreground">
                        {workflowFamily}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold">{goalTitle}</h3>
                    <p className="mt-1 max-w-4xl text-sm text-muted-foreground">{item.objective}</p>

                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <DecisionSummaryBlock
                        label="Problem or opportunity"
                        value={`This automation goal needs a governed n8n workflow proposal before agents can move from planning into staging. Current request: ${item.title.replace(/^n8n proposal:\s*/i, '')}.`}
                      />
                      <DecisionSummaryBlock
                        label="Controller recommendation"
                        value={recommendation}
                        tone="yellow"
                      />
                      <DecisionSummaryBlock
                        label="Benefits"
                        value="Keeps workflow design traceable to a goal, captures required credentials before staging, and gives the controller a reviewable rollback path."
                        tone="green"
                      />
                      <DecisionSummaryBlock
                        label="Drawbacks and risk"
                        value="The proposal may still need credential review, staging validation, and production activation approval before it can execute real outbound or client-visible work."
                        tone="red"
                      />
                      <DecisionSummaryBlock
                        label="Approval boundary"
                        value={approvalGate}
                        tone="yellow"
                      />
                      <DecisionSummaryBlock
                        label="Rollback"
                        value={rollbackPath}
                      />
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <ListField label="Node plan" values={nodePlan} fallback="No node plan has been attached yet." />
                      <ListField label="Credential and env needs" values={[...credentialNeeds, ...requiredEnvVars.map((envVar) => `Env: ${envVar}`)]} fallback="No credential needs have been declared." />
                      <ListField label="Ingest callbacks" values={ingestCallbacks} fallback="No callback endpoints have been declared." />
                      <DecisionSummaryBlock label="Test evidence" value={testEvidence ?? 'No test evidence has been attached yet.'} />
                    </div>

                    <McpHandoffPacketPanel packet={mcpHandoffPacket} />
                    <McpBuildStatusPanel request={mcpBuildRequest} result={mcpBuildResult} activationReview={activationReviewRequest} />

                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                      <SmallField label="Owner" value={item.owner_agent_key ?? item.owner_runtime} />
                      <SmallField label="Goal" value={goalId} />
                      <SmallField label="Source" value={item.source_label ?? item.source_type} />
                      <SmallField label="Updated" value={new Date(item.updated_at).toLocaleString()} />
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 xl:w-80 xl:justify-end">
                    {goalSessionHref ? (
                      <Link
                        href={goalSessionHref}
                        className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 px-3 py-2 text-sm hover:border-radiant-gold/60"
                      >
                        Goal session
                        <ArrowRight size={16} />
                      </Link>
                    ) : null}
                    <Link
                      href={goalKanbanHref}
                      className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 px-3 py-2 text-sm hover:border-radiant-gold/60"
                    >
                      Goal Kanban
                      <ArrowRight size={16} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => onAskShaka(item)}
                      disabled={Boolean(actionId)}
                      aria-label={`Ask Shaka about n8n proposal ${item.title}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-50"
                    >
                      <MessageSquare size={16} />
                      Ask Shaka
                    </button>
                    {canSendToKanban ? (
                      <button
                        type="button"
                        onClick={() => onAction(item, 'ready')}
                        disabled={Boolean(actionId)}
                        aria-label={`Send n8n proposal to Kanban ${item.title}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-green-500/45 bg-green-500/10 px-3 py-2 text-sm text-green-100 hover:bg-green-500/15 disabled:opacity-50"
                      >
                        <CheckCircle2 size={16} />
                        Send to Kanban
                      </button>
                    ) : null}
                    {canValidatePacket ? (
                      <button
                        type="button"
                        onClick={() => onAction(item, 'proposal_validation')}
                        disabled={Boolean(actionId)}
                        aria-label={`Validate n8n proposal packet ${item.title}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-yellow-500/45 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100 hover:bg-yellow-500/15 disabled:opacity-50"
                      >
                        <ShieldCheck size={16} />
                        Validate packet
                      </button>
                    ) : null}
                    {canRequestMcpBuild ? (
                      <button
                        type="button"
                        onClick={() => onAction(item, 'mcp_build_request')}
                        disabled={Boolean(actionId)}
                        aria-label={`Request n8n MCP build for proposal ${item.title}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-50"
                      >
                        <Workflow size={16} />
                        Request MCP build
                      </button>
                    ) : null}
                    {hasMcpBuildRequest && !mcpBuildResult ? (
                      <span className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/60 bg-black/10 px-3 py-2 text-sm text-muted-foreground">
                        MCP build requested
                      </span>
                    ) : null}
                    {canRequestActivationReview ? (
                      <button
                        type="button"
                        onClick={() => onAction(item, 'n8n_activation_review')}
                        disabled={Boolean(actionId)}
                        aria-label={`Request activation review for n8n proposal ${item.title}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-yellow-500/45 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100 hover:bg-yellow-500/15 disabled:opacity-50"
                      >
                        <ShieldCheck size={16} />
                        Request activation review
                      </button>
                    ) : null}
                    {hasActivationReviewRequest ? (
                      <span className="inline-flex items-center gap-2 rounded-lg border border-yellow-500/35 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100">
                        Activation review requested
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onAction(item, 'block')}
                      disabled={Boolean(actionId)}
                      aria-label={`Request changes for n8n proposal ${item.title}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-500/45 bg-red-500/10 px-3 py-2 text-sm text-red-100 hover:bg-red-500/15 disabled:opacity-50"
                    >
                      <XCircle size={16} />
                      Request changes
                    </button>
                    <button
                      type="button"
                      onClick={() => onAction(item, 'handoff')}
                      disabled={Boolean(actionId)}
                      aria-label={`Hand off n8n proposal ${item.title}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-100 hover:bg-green-500/15 disabled:opacity-50"
                    >
                      <Network size={16} />
                      Hand off
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

function decisionQueueModel(item: AgentWorkItem): {
  actionRequired: string
  recommendation: string
  riskStatus: string
  evidenceHome: string
  tone: 'slate' | 'red' | 'yellow' | 'green'
  toneClass: string
  primaryAction: 'block' | 'validation' | 'handoff'
  primaryLabel: string
  primaryClass: string
  primaryIcon: ReactNode
} {
  const metadataRecommendation = typeof item.metadata?.recommendation === 'string' ? item.metadata.recommendation : null
  const metadataRisk = typeof item.metadata?.risk === 'string' ? item.metadata.risk : null
  const evidenceHome = item.active_run_id
    ? `Trace ${item.active_run_id} owns the evidence.`
    : item.pr_url
      ? `PR ${item.pr_number ?? ''} owns the implementation evidence.`
      : item.validation_summary
        ? 'Validation summary is the current evidence source.'
        : 'No trace or PR evidence is attached yet.'

  if (item.status === 'blocked') {
    return {
      actionRequired: 'Resolve the blocker or hand the item to the Integration Captain with a clear owner decision.',
      recommendation: item.blocker_summary || metadataRecommendation || 'Clarify ownership before any execution continues.',
      riskStatus: `${metadataRisk ?? item.priority} risk; blocked items should not move forward without a controller decision.`,
      evidenceHome,
      tone: 'red',
      toneClass: 'border-red-500/30 bg-background/55',
      primaryAction: 'handoff',
      primaryLabel: 'Handoff',
      primaryClass: 'border-radiant-gold/50 bg-radiant-gold/10 text-radiant-gold hover:bg-radiant-gold/15',
      primaryIcon: <Network size={16} />,
    }
  }

  if (item.status === 'ready_for_review' || item.status === 'ready_for_merge') {
    return {
      actionRequired: item.status === 'ready_for_merge'
        ? 'Confirm the validation packet and route the merge decision through the Integration Captain.'
        : 'Review the validation packet, recommendation, and trace evidence before marking this ready.',
      recommendation: metadataRecommendation || item.validation_summary || 'Validate the evidence, then approve the next gated handoff only if the risk is acceptable.',
      riskStatus: `${metadataRisk ?? item.priority} risk; approval gates remain active until the controller decision is complete.`,
      evidenceHome,
      tone: 'yellow',
      toneClass: 'border-yellow-500/30 bg-background/55',
      primaryAction: 'validation',
      primaryLabel: 'Validate',
      primaryClass: 'border-yellow-500/45 bg-yellow-500/10 text-yellow-100 hover:bg-yellow-500/15',
      primaryIcon: <CheckCircle2 size={16} />,
    }
  }

  if (item.status === 'proposed' || item.status === 'queued') {
    return {
      actionRequired: 'Decide whether this belongs in active Kanban work, needs more evidence, or should stay parked.',
      recommendation: metadataRecommendation || 'Check owner, acceptance criteria, and expected files before routing this into execution.',
      riskStatus: `${metadataRisk ?? item.priority} risk; proposed and queued work should be shaped before agents pick it up.`,
      evidenceHome,
      tone: 'slate',
      toneClass: 'border-silicon-slate/70 bg-background/55',
      primaryAction: 'handoff',
      primaryLabel: 'Handoff',
      primaryClass: 'border-radiant-gold/50 bg-radiant-gold/10 text-radiant-gold hover:bg-radiant-gold/15',
      primaryIcon: <Network size={16} />,
    }
  }

  return {
    actionRequired: 'Monitor progress and intervene only if the trace, blocker, or owner signal changes.',
    recommendation: metadataRecommendation || item.validation_summary || 'Keep this moving in Kanban unless a blocker or approval gate appears.',
    riskStatus: `${metadataRisk ?? item.priority} risk; current status is ${item.status.replace(/_/g, ' ')}.`,
    evidenceHome,
    tone: 'green',
    toneClass: 'border-green-500/30 bg-background/55',
    primaryAction: 'block',
    primaryLabel: 'Block',
    primaryClass: 'border-red-500/45 bg-red-500/10 text-red-100 hover:bg-red-500/15',
    primaryIcon: <AlertTriangle size={16} />,
  }
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
      ? 'border-red-500/35 bg-red-500/5'
      : tone === 'yellow'
        ? 'border-yellow-500/35 bg-yellow-500/5'
        : tone === 'green'
          ? 'border-green-500/35 bg-green-500/5'
          : 'border-silicon-slate/60 bg-background/40'
  return (
    <div className={`rounded-lg border p-3 text-sm ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground/70">{label}</p>
      <p className="mt-1 text-foreground">{value}</p>
    </div>
  )
}

function ListField({ label, values, fallback }: { label: string; values: string[]; fallback: string }) {
  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-background/40 p-3 text-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground/70">{label}</p>
      {values.length ? (
        <ul className="mt-2 space-y-1 text-foreground">
          {values.map((value) => (
            <li key={value} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-radiant-gold/80" />
              <span>{value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-muted-foreground">{fallback}</p>
      )}
    </div>
  )
}

function McpHandoffPacketPanel({ packet }: { packet: N8nMcpHandoffPacketView }) {
  return (
    <div className="mt-3 rounded-lg border border-radiant-gold/35 bg-radiant-gold/10 p-3 text-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-radiant-gold">
            <Workflow size={16} />
            <p className="text-xs font-semibold uppercase tracking-wide">n8n MCP handoff packet</p>
          </div>
          <p className="mt-2 text-foreground">
            Use this structured packet when an agent asks the n8n MCP to create, inspect, or stage the workflow.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {packet.workflow.proposedName ?? 'Unnamed workflow'} · {packet.workflowFamily?.replace(/_/g, ' ') ?? 'workflow family pending'} · {packet.action.replace(/_/g, ' ')}
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-yellow-500/35 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-100">
          activation approval required
        </span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <ListField label="MCP guardrails" values={packet.guardrails.slice(0, 4)} fallback="No guardrails have been declared." />
        <ListField label="Builder return contract" values={packet.handoffInstructions.slice(0, 3)} fallback="No handoff instructions have been declared." />
      </div>
      <details className="mt-3 rounded-lg border border-silicon-slate/60 bg-background/60 p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-radiant-gold">
          View JSON handoff packet
        </summary>
        <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-black/25 p-3 text-xs text-muted-foreground">
          {JSON.stringify(packet, null, 2)}
        </pre>
      </details>
    </div>
  )
}

function McpBuildStatusPanel({
  request,
  result,
  activationReview,
}: {
  request: N8nMcpBuildRequestView | null
  result: N8nMcpBuildResultView | null
  activationReview: N8nActivationReviewRequestView | null
}) {
  if (!request && !result) return null

  const gaps = result ? [...result.credentialGaps, ...result.envGaps] : []
  return (
    <div className="mt-3 rounded-lg border border-blue-400/30 bg-blue-500/10 p-3 text-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-blue-100">
            <Workflow size={16} />
            <p className="text-xs font-semibold uppercase tracking-wide">MCP build status</p>
          </div>
          <p className="mt-2 text-foreground">
            {result
              ? 'Returned build evidence is attached to this controller packet.'
              : 'Build request is waiting for an n8n MCP result packet.'}
          </p>
        </div>
        <span className={`inline-flex w-fit rounded-full border px-2 py-1 text-xs ${
          result
            ? gaps.length
              ? 'border-red-500/35 bg-red-500/10 text-red-100'
              : 'border-green-500/35 bg-green-500/10 text-green-100'
            : 'border-yellow-500/35 bg-yellow-500/10 text-yellow-100'
        }`}>
          {result ? (gaps.length ? 'gaps returned' : 'ready for review') : 'requested'}
        </span>
      </div>

      {request ? (
        <div className="mt-3 rounded-lg border border-silicon-slate/60 bg-background/45 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Build request</p>
          <p className="mt-1 text-foreground">{request.summary ?? 'No request summary was attached.'}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {request.actorLabel ?? 'Unknown requester'}
            {request.requestedAt ? ` · ${new Date(request.requestedAt).toLocaleString()}` : ''}
            {request.packetVersion ? ` · ${request.packetVersion}` : ''}
          </p>
          {request.expectedReturn.length ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Expected return: {request.expectedReturn.join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <DecisionSummaryBlock
            label="Result summary"
            value={result.resultSummary}
            tone={gaps.length ? 'yellow' : 'green'}
          />
          <DecisionSummaryBlock
            label="Workflow or inspection"
            value={result.workflowId ?? result.inspectionResult ?? 'No workflow id or inspection result returned.'}
          />
          <DecisionSummaryBlock
            label="Validation"
            value={result.validationResult ?? 'No validation result returned.'}
          />
          <DecisionSummaryBlock
            label="Test evidence"
            value={result.testEvidence ?? 'No test evidence returned.'}
          />
          <ListField
            label="Credential and env gaps"
            values={[
              ...result.credentialGaps.map((gap) => `Credential: ${gap}`),
              ...result.envGaps.map((gap) => `Env: ${gap}`),
            ]}
            fallback="No credential or env gaps were returned."
          />
          <DecisionSummaryBlock
            label="Rollback and activation gate"
            value={`${result.rollbackNotes ?? 'Rollback notes were not returned.'} ${result.activationRequested ? 'Activation was requested but still requires controller approval.' : result.activationGate ?? 'Activation remains approval-gated.'}`}
            tone={result.activationRequested ? 'yellow' : 'slate'}
          />
        </div>
      ) : null}

      {activationReview ? (
        <div className="mt-3 rounded-lg border border-yellow-500/35 bg-yellow-500/10 p-3">
          <p className="text-xs uppercase tracking-wide text-yellow-100">Activation review requested</p>
          <p className="mt-1 text-foreground">{activationReview.summary ?? 'Review returned MCP build evidence before any activation decision.'}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activationReview.actorLabel ?? 'Unknown requester'}
            {activationReview.requestedAt ? ` · ${new Date(activationReview.requestedAt).toLocaleString()}` : ''}
            {activationReview.approvalId ? ` · approval ${activationReview.approvalId}` : ''}
            {activationReview.approvalType ? ` · ${activationReview.approvalType}` : ''}
            {activationReview.workflowId ? ` · ${activationReview.workflowId}` : ''}
          </p>
          <ListField
            label="Approval boundary"
            values={activationReview.approvalBoundary}
            fallback="Production activation, credentials, outbound sends, schedules, and client-visible mutation remain approval-gated."
          />
        </div>
      ) : null}
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
