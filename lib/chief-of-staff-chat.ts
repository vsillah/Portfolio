import { generateJsonCompletion } from '@/lib/llm-dispatch'
import {
  endAgentRun,
  markAgentRunFailed,
  recordAgentEvent,
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'
import {
  AGENT_ACTIONS,
  actionRequiresApproval,
  getApprovalGate,
  type AgentAction,
} from '@/lib/agent-policy'
import {
  applyDelegationDecisionToEngagements,
  evaluateAgentDelegationPolicy,
} from '@/lib/agent-delegation-policy'
import {
  AGENT_DECISION_TRUST_EVENT,
  buildDelegationDecisionTrustFrame,
  type AgentDecisionFrame,
} from '@/lib/agent-decision-trust'
import {
  recommendDecisionTrustEnforcement,
  type DecisionTrustEnforcementRecommendation,
} from '@/lib/agent-decision-trust-enforcement'
import {
  evaluateAgentBudget,
  type AgentBudgetDecision,
} from '@/lib/agent-budget-policy'
import { AGENT_ORGANIZATION, AGENT_PODS, getAgentByKey } from '@/lib/agent-organization'
import {
  listCodexAutomationInventory,
  type CodexAutomationInventory,
} from '@/lib/codex-automation-inventory'
import { supabaseAdmin } from '@/lib/supabase'

export type ChiefOfStaffChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ChiefOfStaffContextRef = {
  type: 'run' | 'work_item' | 'approval'
  id: string
}

export type ChiefOfStaffChatRequest = {
  message: string
  history?: ChiefOfStaffChatMessage[]
  userId?: string
  triggerSource?: string
  contextRef?: ChiefOfStaffContextRef | null
}

export type ChiefOfStaffChatResponse = {
  runId: string
  reply: string
  suggestedActions: string[]
  actionProposals: ChiefOfStaffActionProposal[]
  agentEngagements: ChiefOfStaffAgentEngagementProposal[]
  model: string
  budgetDecision: AgentBudgetDecision
}

export type ChiefOfStaffActionProposal = {
  label: string
  description: string
  action: AgentAction
  approvalType: string | null
  requiresApproval: boolean
  riskLevel: 'low' | 'medium' | 'high'
}

export type ChiefOfStaffAgentEngagementProposal = {
  agentKey: string
  agentName: string
  label: string
  rationale: string
  status: 'active' | 'partial' | 'planned'
  executionMode: 'read_only' | 'queued_for_review'
}

type AgentRunSummaryRow = {
  id: string
  agent_key: string | null
  runtime: string
  title: string
  status: string
  current_step: string | null
  error_message: string | null
  started_at: string
}

type AgentApprovalSummaryRow = {
  run_id: string
  approval_type: string
  status: string
  requested_at: string
}

type CostSummaryRow = {
  amount: number | string | null
  metadata?: Record<string, unknown> | null
}

export type ChiefOfStaffAutomationContext = {
  available: boolean
  reason: string | null
  sourceDirectory: string
  generatedAt: string
  overview: CodexAutomationInventory['overview']
  hiddenCount: number
  highRiskAutomations: Array<{
    id: string
    name: string
    category: string
    boundary: string
    contextHealth: string
    missingQuestions: string[]
  }>
  contextGapAutomations: Array<{
    id: string
    name: string
    category: string
    riskLevel: string
    contextHealth: string
    missingQuestions: string[]
    recommendations: string[]
  }>
  duplicateCandidates: Array<{
    id: string
    name: string
    category: string
  }>
}

export type ChiefOfStaffContext = {
  generatedAt: string
  agentRoutingCatalog: ChiefOfStaffAgentRoutingEntry[]
  activeRuns: AgentRunSummaryRow[]
  recentFailures: AgentRunSummaryRow[]
  pendingApprovals: AgentApprovalSummaryRow[]
  scopedContext: ChiefOfStaffScopedContext | null
  costEvents24h: {
    count: number
    totalUsd: number
    providers: string[]
    models: string[]
  }
  automationContext: ChiefOfStaffAutomationContext
}

export type ChiefOfStaffAgentRoutingEntry = {
  key: string
  name: string
  pod: string
  status: 'active' | 'partial' | 'planned'
  primaryRuntime: string
  responsibility: string
  engagementPath: string
  approvalGate: string
  activeWorkflowCount: number
}

export type ChiefOfStaffScopedContext = {
  ref: ChiefOfStaffContextRef
  available: boolean
  label: string
  summary: string
  actionRequired: boolean
  recommendation: string
  riskStatus: string
  owner: string | null
  status: string | null
  evidenceLinks: string[]
  records: Record<string, unknown>
}

const DEFAULT_MODEL = 'gpt-4o-mini'
const DEFAULT_MAX_TOKENS = 900
const CHIEF_OF_STAFF_ACTIONS: readonly AgentAction[] = AGENT_ACTIONS

function sinceHours(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function assertDatabase() {
  if (!supabaseAdmin) {
    throw new Error('Database not available')
  }
  return supabaseAdmin
}

function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4)
}

export function evaluateChiefOfStaffBudget(input: {
  model: string
  systemPrompt: string
  userPrompt: string
  maxTokens?: number
}): AgentBudgetDecision {
  return evaluateAgentBudget({
    runtime: 'codex',
    model: input.model,
    estimatedInputTokens: estimateTokensFromText(`${input.systemPrompt}\n${input.userPrompt}`),
    maxTokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
    metadata: { operation: 'chief_of_staff_chat' },
  })
}

export function getChiefOfStaffAgentRoutingCatalog(): ChiefOfStaffAgentRoutingEntry[] {
  return AGENT_ORGANIZATION.map((agent) => ({
    key: agent.key,
    name: agent.name,
    pod: AGENT_PODS.find((pod) => pod.key === agent.podKey)?.name ?? agent.podKey,
    status: agent.status,
    primaryRuntime: agent.primaryRuntime,
    responsibility: agent.responsibility,
    engagementPath: agent.engagementPath,
    approvalGate: agent.approvalGate,
    activeWorkflowCount: agent.n8nWorkflows.filter((workflow) => workflow.active).length,
  }))
}

export function normalizeChiefOfStaffHistory(
  history: ChiefOfStaffChatMessage[] | undefined,
): ChiefOfStaffChatMessage[] {
  return (history ?? [])
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 2000),
    }))
    .filter((message) => message.content.length > 0)
    .slice(-8)
}

export function normalizeChiefOfStaffContextRef(value: unknown): ChiefOfStaffContextRef | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const type = record.type
  const id = typeof record.id === 'string' ? record.id.trim() : ''
  if ((type !== 'run' && type !== 'work_item' && type !== 'approval') || !id) return null
  return { type, id: id.slice(0, 160) }
}

export function getChiefOfStaffTriggeredByUserId(userId: string | undefined) {
  if (!userId) return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
    ? userId
    : null
}

function isAgentAction(value: unknown): value is AgentAction {
  return typeof value === 'string' && CHIEF_OF_STAFF_ACTIONS.includes(value as AgentAction)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function compactValue(value: unknown): unknown {
  if (typeof value === 'string') return value.length > 900 ? `${value.slice(0, 900)}...` : value
  if (Array.isArray(value)) return value.slice(0, 8).map(compactValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 20)
        .map(([key, item]) => [key, compactValue(item)]),
    )
  }
  return value
}

function pickCompactRecord(row: unknown, keys: string[]): Record<string, unknown> | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  return Object.fromEntries(
    keys
      .filter((key) => key in record)
      .map((key) => [key, compactValue(record[key])]),
  )
}

function statusRequiresAction(status: unknown) {
  return typeof status === 'string' && [
    'pending',
    'queued',
    'running',
    'waiting_for_approval',
    'failed',
    'stale',
    'blocked',
    'ready_for_review',
    'ready_for_merge',
    'proposed',
  ].includes(status)
}

function scopedUnavailable(ref: ChiefOfStaffContextRef, label: string): ChiefOfStaffScopedContext {
  return {
    ref,
    available: false,
    label,
    summary: 'The requested context was not found or is not available to Shaka.',
    actionRequired: false,
    recommendation: 'Refresh the page and confirm the source record still exists before taking action.',
    riskStatus: 'unknown',
    owner: null,
    status: null,
    evidenceLinks: [],
    records: {},
  }
}

export function buildChiefOfStaffScopedContextFromRows(input: {
  ref: ChiefOfStaffContextRef
  run?: Record<string, unknown> | null
  workItem?: Record<string, unknown> | null
  approval?: Record<string, unknown> | null
  steps?: Record<string, unknown>[]
  events?: Record<string, unknown>[]
}): ChiefOfStaffScopedContext {
  const run = input.run ?? null
  const workItem = input.workItem ?? null
  const approval = input.approval ?? null
  const primary = input.ref.type === 'run' ? run : input.ref.type === 'work_item' ? workItem : approval
  if (!primary) {
    return scopedUnavailable(input.ref, `${input.ref.type.replace(/_/g, ' ')} ${input.ref.id}`)
  }

  const status = String(primary.status ?? run?.status ?? workItem?.status ?? approval?.status ?? '')
  const title = String(primary.title ?? primary.approval_type ?? primary.id ?? input.ref.id)
  const owner = String(workItem?.owner_agent_key ?? run?.agent_key ?? run?.runtime ?? '') || null
  const actionRequired = statusRequiresAction(status)
  const riskStatus = String(
    asRecord(workItem?.metadata).risk
      ?? asRecord(approval?.metadata).risk_level
      ?? asRecord(approval?.metadata).risk
      ?? (approval ? approval.approval_type : null)
      ?? (status === 'failed' || status === 'stale' || status === 'blocked' ? 'elevated' : 'normal'),
  )
  const recommendation = String(
    asRecord(workItem?.metadata).recommendation
      ?? workItem?.validation_summary
      ?? (approval && approval.status === 'pending' ? 'Review the approval payload, trace evidence, and risk boundary before approving or rejecting.' : null)
      ?? (run && (run.status === 'failed' || run.status === 'stale') ? 'Inspect the latest events and route recovery through the existing Agent Ops approval path.' : null)
      ?? 'Summarize the evidence, confirm whether action is required, and keep any mutation behind the existing approval gates.'
  )

  const evidenceLinks = Array.from(new Set([
    run?.id ? `/admin/agents/runs/${String(run.id)}` : null,
    workItem?.id ? '/admin/agents/coordination' : null,
    approval?.run_id ? `/admin/agents/runs/${String(approval.run_id)}` : null,
  ].filter((link): link is string => Boolean(link))))

  const summaryParts = [
    `${input.ref.type.replace(/_/g, ' ')}: ${title}`,
    status ? `status: ${status}` : null,
    owner ? `owner: ${owner}` : null,
    actionRequired ? 'action required' : 'no immediate action indicated',
  ].filter(Boolean)

  return {
    ref: input.ref,
    available: true,
    label: title,
    summary: summaryParts.join(' / '),
    actionRequired,
    recommendation,
    riskStatus,
    owner,
    status: status || null,
    evidenceLinks,
    records: {
      run: pickCompactRecord(run, ['id', 'agent_key', 'runtime', 'kind', 'title', 'status', 'current_step', 'error_message', 'started_at', 'completed_at', 'outcome', 'metadata']),
      workItem: pickCompactRecord(workItem, ['id', 'title', 'objective', 'status', 'priority', 'owner_agent_key', 'owner_runtime', 'active_run_id', 'approval_id', 'branch_name', 'pr_url', 'blocker_summary', 'validation_summary', 'metadata', 'updated_at']),
      approval: pickCompactRecord(approval, ['id', 'run_id', 'approval_type', 'status', 'requested_by', 'requested_at', 'decided_at', 'decision_notes', 'metadata']),
      latestSteps: (input.steps ?? []).slice(0, 5).map((step) => pickCompactRecord(step, ['id', 'step_key', 'name', 'status', 'output_summary', 'started_at', 'completed_at'])),
      latestEvents: (input.events ?? []).slice(-5).map((event) => pickCompactRecord(event, ['id', 'event_type', 'severity', 'message', 'occurred_at', 'metadata'])),
    },
  }
}

function parseRiskLevel(value: unknown, requiresApproval: boolean): ChiefOfStaffActionProposal['riskLevel'] {
  if (value === 'low' || value === 'medium' || value === 'high') return value
  return requiresApproval ? 'high' : 'medium'
}

function parseActionProposals(parsed: { action_proposals?: unknown }): ChiefOfStaffActionProposal[] {
  if (!Array.isArray(parsed.action_proposals)) return []

  return parsed.action_proposals
    .flatMap((proposal): ChiefOfStaffActionProposal[] => {
      if (!proposal || typeof proposal !== 'object') return []
      const raw = proposal as Record<string, unknown>
      if (!isAgentAction(raw.action)) return []

      const label = typeof raw.label === 'string' ? raw.label.trim() : ''
      const description = typeof raw.description === 'string' ? raw.description.trim() : ''
      if (!label || !description) return []

      const gate = getApprovalGate(raw.action)
      const requiresApproval = gate ? true : actionRequiresApproval('codex', raw.action)

      return [
        {
          label: label.slice(0, 120),
          description: description.slice(0, 400),
          action: raw.action,
          approvalType: gate?.approvalType ?? null,
          requiresApproval,
          riskLevel: parseRiskLevel(raw.risk_level, requiresApproval),
        },
      ]
    })
    .slice(0, 5)
}

function parseAgentEngagements(parsed: { agent_engagements?: unknown }): ChiefOfStaffAgentEngagementProposal[] {
  if (!Array.isArray(parsed.agent_engagements)) return []

  const seen = new Set<string>()
  return parsed.agent_engagements
    .flatMap((proposal): ChiefOfStaffAgentEngagementProposal[] => {
      if (!proposal || typeof proposal !== 'object') return []
      const raw = proposal as Record<string, unknown>
      const agentKey = typeof raw.agent_key === 'string' ? raw.agent_key.trim() : ''
      if (!agentKey || seen.has(agentKey)) return []

      const agent = getAgentByKey(agentKey)
      if (!agent) return []
      seen.add(agentKey)

      const label = typeof raw.label === 'string' && raw.label.trim()
        ? raw.label.trim()
        : `Run ${agent.name}`
      const rationale = typeof raw.rationale === 'string' && raw.rationale.trim()
        ? raw.rationale.trim()
        : agent.responsibility

      return [
        {
          agentKey: agent.key,
          agentName: agent.name,
          label: label.slice(0, 120),
          rationale: rationale.slice(0, 400),
          status: agent.status,
          executionMode: agent.status === 'planned' ? 'queued_for_review' : 'read_only',
        },
      ]
    })
    .slice(0, 4)
}

export function summarizeAutomationContext(inventory: CodexAutomationInventory): ChiefOfStaffAutomationContext {
  const automations = inventory.automations
  const missingQuestions = (automation: CodexAutomationInventory['automations'][number]) =>
    automation.contextQuestions
      .filter((question) => !question.answered)
      .map((question) => question.id)

  if (!inventory.available) {
    return {
      available: false,
      reason: inventory.reason ?? 'Automation inventory is unavailable.',
      sourceDirectory: inventory.sourceDirectory,
      generatedAt: inventory.generatedAt,
      overview: inventory.overview,
      hiddenCount: inventory.hiddenCount,
      highRiskAutomations: [],
      contextGapAutomations: [],
      duplicateCandidates: [],
    }
  }

  return {
    available: true,
    reason: null,
    sourceDirectory: inventory.sourceDirectory,
    generatedAt: inventory.generatedAt,
    overview: inventory.overview,
    hiddenCount: inventory.hiddenCount,
    highRiskAutomations: automations
      .filter((automation) => automation.riskLevel === 'high')
      .slice(0, 6)
      .map((automation) => ({
        id: automation.id,
        name: automation.name,
        category: automation.category,
        boundary: automation.managementBoundary,
        contextHealth: automation.contextHealth,
        missingQuestions: missingQuestions(automation),
      })),
    contextGapAutomations: automations
      .filter((automation) => automation.contextQuestions.some((question) => !question.answered))
      .sort((a, b) => {
        const healthRank = { red: 0, yellow: 1, green: 2 }
        return healthRank[a.contextHealth] - healthRank[b.contextHealth] || b.contextGaps.length - a.contextGaps.length
      })
      .slice(0, 6)
      .map((automation) => ({
        id: automation.id,
        name: automation.name,
        category: automation.category,
        riskLevel: automation.riskLevel,
        contextHealth: automation.contextHealth,
        missingQuestions: missingQuestions(automation),
        recommendations: automation.contextQuestions
          .filter((question) => !question.answered)
          .map((question) => question.recommendation)
          .slice(0, 3),
      })),
    duplicateCandidates: automations
      .filter((automation) => automation.duplicateCandidate)
      .slice(0, 8)
      .map((automation) => ({
        id: automation.id,
        name: automation.name,
        category: automation.category,
      })),
  }
}

export function parseChiefOfStaffJson(content: string): {
  reply: string
  suggestedActions: string[]
  actionProposals: ChiefOfStaffActionProposal[]
  agentEngagements: ChiefOfStaffAgentEngagementProposal[]
} {
  const parsed = JSON.parse(content) as {
    reply?: unknown
    suggested_actions?: unknown
    action_proposals?: unknown
    agent_engagements?: unknown
  }
  const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : ''
  if (!reply) {
    throw new Error('Chief of Staff response missing reply')
  }

  const suggestedActions = Array.isArray(parsed.suggested_actions)
    ? parsed.suggested_actions
        .filter((action): action is string => typeof action === 'string')
        .map((action) => action.trim())
        .filter(Boolean)
        .slice(0, 5)
    : []

  return {
    reply,
    suggestedActions,
    actionProposals: parseActionProposals(parsed),
    agentEngagements: parseAgentEngagements(parsed),
  }
}

export async function collectChiefOfStaffContext(): Promise<ChiefOfStaffContext> {
  const db = assertDatabase()
  const since = sinceHours(24)

  const [activeRes, failedRes, approvalsRes, costsRes, automationInventory] = await Promise.all([
    db
      .from('agent_runs')
      .select('id, agent_key, runtime, title, status, current_step, error_message, started_at')
      .in('status', ['queued', 'running', 'waiting_for_approval'])
      .order('started_at', { ascending: false })
      .limit(10),
    db
      .from('agent_runs')
      .select('id, agent_key, runtime, title, status, current_step, error_message, started_at')
      .in('status', ['failed', 'stale'])
      .gte('started_at', since)
      .order('started_at', { ascending: false })
      .limit(10),
    db
      .from('agent_approvals')
      .select('run_id, approval_type, status, requested_at')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
      .limit(10),
    db
      .from('cost_events')
      .select('amount, metadata')
      .gte('occurred_at', since)
      .limit(100),
    listCodexAutomationInventory(),
  ])

  for (const result of [activeRes, failedRes, approvalsRes, costsRes]) {
    if (result.error) {
      throw new Error(result.error.message)
    }
  }

  const costRows = (costsRes.data ?? []) as CostSummaryRow[]
  const totalUsd = costRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
  const costProviders = costRows
    .map((row) => row.metadata?.provider)
    .filter((provider): provider is string => typeof provider === 'string' && provider.length > 0)
  const costModels = costRows
    .map((row) => row.metadata?.model)
    .filter((model): model is string => typeof model === 'string' && model.length > 0)

  return {
    generatedAt: new Date().toISOString(),
    agentRoutingCatalog: getChiefOfStaffAgentRoutingCatalog(),
    activeRuns: (activeRes.data ?? []) as AgentRunSummaryRow[],
    recentFailures: (failedRes.data ?? []) as AgentRunSummaryRow[],
    pendingApprovals: (approvalsRes.data ?? []) as AgentApprovalSummaryRow[],
    scopedContext: null,
    costEvents24h: {
      count: costRows.length,
      totalUsd: Number(totalUsd.toFixed(4)),
      providers: Array.from(new Set(costProviders)),
      models: Array.from(new Set(costModels)),
    },
    automationContext: summarizeAutomationContext(automationInventory),
  }
}

export async function collectChiefOfStaffScopedContext(
  contextRef: ChiefOfStaffContextRef | null | undefined,
): Promise<ChiefOfStaffScopedContext | null> {
  if (!contextRef) return null
  const db = assertDatabase()

  if (contextRef.type === 'run') {
    const runRes = await db.from('agent_runs').select('*').eq('id', contextRef.id).maybeSingle()
    if (runRes.error) throw new Error(runRes.error.message)
    if (!runRes.data) return scopedUnavailable(contextRef, `run ${contextRef.id}`)

    const [stepsRes, eventsRes, approvalsRes, workItemsRes] = await Promise.all([
      db.from('agent_run_steps').select('*').eq('run_id', contextRef.id).order('started_at', { ascending: true }).limit(8),
      db.from('agent_run_events').select('*').eq('run_id', contextRef.id).order('occurred_at', { ascending: true }).limit(12),
      db.from('agent_approvals').select('*').eq('run_id', contextRef.id).order('requested_at', { ascending: false }).limit(5),
      db.from('agent_work_items').select('*').eq('active_run_id', contextRef.id).order('updated_at', { ascending: false }).limit(1),
    ])
    for (const result of [stepsRes, eventsRes, approvalsRes, workItemsRes]) {
      if (result.error) throw new Error(result.error.message)
    }
    return buildChiefOfStaffScopedContextFromRows({
      ref: contextRef,
      run: runRes.data as Record<string, unknown>,
      workItem: ((workItemsRes.data ?? [])[0] ?? null) as Record<string, unknown> | null,
      approval: ((approvalsRes.data ?? [])[0] ?? null) as Record<string, unknown> | null,
      steps: (stepsRes.data ?? []) as Record<string, unknown>[],
      events: (eventsRes.data ?? []) as Record<string, unknown>[],
    })
  }

  if (contextRef.type === 'work_item') {
    const workItemRes = await db.from('agent_work_items').select('*').eq('id', contextRef.id).maybeSingle()
    if (workItemRes.error) throw new Error(workItemRes.error.message)
    const workItem = (workItemRes.data ?? null) as Record<string, unknown> | null
    if (!workItem) return scopedUnavailable(contextRef, `work item ${contextRef.id}`)

    const activeRunId = typeof workItem.active_run_id === 'string' ? workItem.active_run_id : null
    const approvalId = typeof workItem.approval_id === 'string' ? workItem.approval_id : null
    const [runRes, approvalRes] = await Promise.all([
      activeRunId ? db.from('agent_runs').select('*').eq('id', activeRunId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      approvalId ? db.from('agent_approvals').select('*').eq('id', approvalId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ])
    for (const result of [runRes, approvalRes]) {
      if (result.error) throw new Error(result.error.message)
    }
    return buildChiefOfStaffScopedContextFromRows({
      ref: contextRef,
      run: (runRes.data ?? null) as Record<string, unknown> | null,
      workItem,
      approval: (approvalRes.data ?? null) as Record<string, unknown> | null,
    })
  }

  const approvalRes = await db.from('agent_approvals').select('*').eq('id', contextRef.id).maybeSingle()
  if (approvalRes.error) throw new Error(approvalRes.error.message)
  const approval = (approvalRes.data ?? null) as Record<string, unknown> | null
  if (!approval) return scopedUnavailable(contextRef, `approval ${contextRef.id}`)

  const runId = typeof approval.run_id === 'string' ? approval.run_id : null
  const [runRes, workItemsRes] = await Promise.all([
    runId ? db.from('agent_runs').select('*').eq('id', runId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    db.from('agent_work_items').select('*').eq('approval_id', contextRef.id).order('updated_at', { ascending: false }).limit(1),
  ])
  for (const result of [runRes, workItemsRes]) {
    if (result.error) throw new Error(result.error.message)
  }
  return buildChiefOfStaffScopedContextFromRows({
    ref: contextRef,
    run: (runRes.data ?? null) as Record<string, unknown> | null,
    workItem: ((workItemsRes.data ?? [])[0] ?? null) as Record<string, unknown> | null,
    approval,
  })
}

export function buildChiefOfStaffPrompt(context: ChiefOfStaffContext, history: ChiefOfStaffChatMessage[]) {
  const agentKeys = context.agentRoutingCatalog.map((agent) => agent.key)

  return {
    systemPrompt: [
      'You are the Shaka (Zulu) - Chief of Staff for Vambah and AmaduTown.',
      'Your job is to translate executive intent into clear priorities, operational status, escalation decisions, and next actions.',
      'Use only the provided operating context. If the user asks for production mutations, sending messages, publishing, or config changes, explain that approval is required and suggest the approval path.',
      'When scopedContext is present, answer about that specific run, work item, or approval before giving broader operating guidance.',
      'For scopedContext, clearly state whether action is required, the recommended next step, the risk/status, the owner when known, and the evidence link path. Do not approve, reject, retry, merge, deploy, or mutate anything yourself.',
      'Be concise, direct, and operational. Do not pretend to have run tools that are not in the context.',
      'Automation context is a summarized, read-only inventory. Use it to identify risky automations, missing context, duplicate jobs, and when the Yaa Asantewaa (Ashanti) - Automation Systems should be engaged.',
      'When proposing an executable next step, include a typed action proposal. The proposal is only a recommendation; it does not execute work.',
      'You are the front-door router for the agent organization. When the user asks who should handle work, choose the best mapped agent from the routing catalog.',
      'When the next step should be handled by one of the mapped agents, include an agent_engagements proposal with the exact agent_key.',
      'Agent engagement proposals are checked against deterministic governance routing before they are surfaced.',
      'Prefer active or partial agents for immediate read-only engagement. Planned agents can be recommended, but label them as queued for review in your reply.',
      'If several agents could help, pick one primary next agent and at most two supporting agents.',
      'Use only these action ids: read_files, write_files, external_api_call, client_data_access, known_workflow_db_write, unknown_db_write, publish_public_content, send_email, production_config_change, public_content_from_private_material.',
      `Use only these agent keys when recommending an agent engagement: ${agentKeys.join(', ')}.`,
      'Return JSON only with keys: reply, suggested_actions, action_proposals, agent_engagements.',
    ].join('\n'),
    userPrompt: JSON.stringify(
      {
        current_context: context,
        recent_chat_history: history,
        response_contract: {
          reply: 'A concise answer to the user. Prefer concrete status, blockers, and next steps.',
          suggested_actions: 'Up to five short actions the user can take or ask the agent to do next.',
          action_proposals: [
            {
              label: 'Short button label for a concrete proposed action.',
              description: 'One sentence describing the proposed action and why it is useful.',
              action: 'One allowed action id. Use approval-gated ids for risky work.',
              risk_level: 'low, medium, or high.',
            },
          ],
          agent_engagements: [
            {
              agent_key: 'A mapped agent key when a read-only agent run is the right next step.',
              label: 'Short button label.',
              rationale: 'One sentence explaining why this agent should be engaged.',
            },
          ],
        },
      },
      null,
      2,
    ),
  }
}

export async function runChiefOfStaffChat(input: ChiefOfStaffChatRequest): Promise<ChiefOfStaffChatResponse> {
  const message = input.message.trim()
  if (!message) {
    throw new Error('Message is required')
  }

  const history = normalizeChiefOfStaffHistory(input.history)
  const contextRef = input.contextRef ?? null
  const run = await startAgentRun({
    agentKey: 'chief-of-staff',
    runtime: 'codex',
    kind: 'chief_of_staff_chat',
    title: 'Chief of Staff chat',
    status: 'running',
    subject: contextRef
      ? { type: `admin_chat:${contextRef.type}`, id: contextRef.id, label: `Scoped ${contextRef.type.replace(/_/g, ' ')}` }
      : { type: 'admin_chat', id: input.userId ?? 'admin', label: 'Admin chat' },
    triggerSource: input.triggerSource ?? 'admin_chief_of_staff_chat',
    triggeredByUserId: getChiefOfStaffTriggeredByUserId(input.userId),
    currentStep: 'Collecting operating context',
    metadata: { message_preview: message.slice(0, 240), context_ref: contextRef },
  })

  try {
    const [context, scopedContext] = await Promise.all([
      collectChiefOfStaffContext(),
      collectChiefOfStaffScopedContext(contextRef),
    ])
    context.scopedContext = scopedContext
    await recordAgentStep({
      runId: run.id,
      stepKey: 'collect_context',
      name: 'Collected operating context',
      status: 'completed',
      inputSummary: message.slice(0, 500),
      outputSummary: scopedContext
        ? `${context.activeRuns.length} active, ${context.recentFailures.length} failed/stale, ${context.pendingApprovals.length} approvals; scoped ${scopedContext.ref.type}: ${scopedContext.label}`
        : `${context.activeRuns.length} active, ${context.recentFailures.length} failed/stale, ${context.pendingApprovals.length} approvals`,
      metadata: scopedContext ? { scoped_context: scopedContext } : undefined,
    })

    await recordAgentEvent({
      runId: run.id,
      eventType: 'chief_of_staff_message_received',
      severity: 'info',
      message: message.slice(0, 500),
    })

    const prompt = buildChiefOfStaffPrompt(context, [
      ...history,
      { role: 'user', content: message },
    ])
    const model = process.env.CHIEF_OF_STAFF_AGENT_MODEL || DEFAULT_MODEL
    const budgetDecision = evaluateChiefOfStaffBudget({
      model,
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      maxTokens: DEFAULT_MAX_TOKENS,
    })

    await recordAgentStep({
      runId: run.id,
      stepKey: 'budget_check',
      name: 'Checked Chief of Staff budget',
      status: budgetDecision.status === 'blocked' ? 'failed' : 'completed',
      outputSummary: budgetDecision.reason,
      metadata: {
        budget_status: budgetDecision.status,
        estimated_cost_usd: budgetDecision.estimatedCostUsd,
        warning_usd: budgetDecision.warningUsd,
        limit_usd: budgetDecision.limitUsd,
        rule_key: budgetDecision.rule.key,
      },
    })

    if (budgetDecision.status !== 'allowed') {
      await recordAgentEvent({
        runId: run.id,
        eventType: 'agent_budget_policy_decision',
        severity: budgetDecision.status === 'blocked' ? 'error' : 'warning',
        message: budgetDecision.reason,
        metadata: {
          budget_status: budgetDecision.status,
          estimated_cost_usd: budgetDecision.estimatedCostUsd,
          warning_usd: budgetDecision.warningUsd,
          limit_usd: budgetDecision.limitUsd,
          rule_key: budgetDecision.rule.key,
          model,
        },
      })
    }

    if (budgetDecision.status === 'blocked') {
      throw new Error(budgetDecision.reason)
    }

    const completion = await generateJsonCompletion({
      model,
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      temperature: 0.3,
      maxTokens: DEFAULT_MAX_TOKENS,
      costContext: {
        agentRunId: run.id,
        reference: { type: 'agent', id: 'chief-of-staff' },
        metadata: {
          operation: 'chief_of_staff_chat',
          context_ref: contextRef,
          budget_status: budgetDecision.status,
          budget_rule_key: budgetDecision.rule.key,
          estimated_cost_usd: budgetDecision.estimatedCostUsd,
        },
      },
    })

    const parsed = parseChiefOfStaffJson(completion.content)
    const delegationDecision = parsed.agentEngagements.length
      ? evaluateAgentDelegationPolicy({
          message,
          proposedAgentKeys: parsed.agentEngagements.map((engagement) => engagement.agentKey),
        })
      : null
    const agentEngagements = applyDelegationDecisionToEngagements(parsed.agentEngagements, delegationDecision)
    let delegationDecisionTrustFrame: AgentDecisionFrame | null = null
    let delegationDecisionTrustEnforcement: DecisionTrustEnforcementRecommendation | null = null

    if (delegationDecision) {
      delegationDecisionTrustFrame = buildDelegationDecisionTrustFrame({
        decision: delegationDecision,
        runId: run.id,
      })
      delegationDecisionTrustEnforcement = recommendDecisionTrustEnforcement({
        frame: delegationDecisionTrustFrame,
        mode: 'advisory',
      })
      await recordAgentEvent({
        runId: run.id,
        eventType: 'delegation_decision_recorded',
        severity: delegationDecision.risk_class === 'payment_spend' || delegationDecision.risk_class === 'production_mutation'
          ? 'warning'
          : 'info',
        message: delegationDecision.reason,
        metadata: {
          selected_agent_key: delegationDecision.selected_agent_key,
          selected_agent_name: delegationDecision.selected_agent_name,
          alternatives_considered: delegationDecision.alternatives_considered,
          task_type: delegationDecision.task_type,
          risk_class: delegationDecision.risk_class,
          required_evidence: delegationDecision.required_evidence,
          fallback_agent_key: delegationDecision.fallback_agent_key,
          approval_gate: delegationDecision.approval_gate,
          confidence: delegationDecision.confidence,
          decision_trust_enforcement: delegationDecisionTrustEnforcement,
        },
      }).catch(() => {})
      await recordAgentEvent({
        runId: run.id,
        eventType: AGENT_DECISION_TRUST_EVENT,
        severity: delegationDecisionTrustFrame.recommended_gate === 'block'
          ? 'error'
          : delegationDecisionTrustFrame.recommended_gate === 'human_review'
            ? 'warning'
            : 'info',
        message: `${delegationDecisionTrustFrame.selected_candidate}: ${delegationDecisionTrustFrame.recommended_gate}`,
        metadata: delegationDecisionTrustFrame,
      }).catch(() => {})
    }

    await recordAgentStep({
      runId: run.id,
      stepKey: 'generate_reply',
      name: 'Generated Chief of Staff reply',
      status: 'completed',
      tokensIn: completion.usage?.prompt_tokens ?? completion.usage?.input_tokens ?? null,
      tokensOut: completion.usage?.completion_tokens ?? completion.usage?.output_tokens ?? null,
      outputSummary: parsed.reply.slice(0, 500),
      metadata: {
        model,
        budget_decision: {
          status: budgetDecision.status,
          estimatedCostUsd: budgetDecision.estimatedCostUsd,
          ruleKey: budgetDecision.rule.key,
        },
        suggested_actions: parsed.suggestedActions,
        action_proposals: parsed.actionProposals,
        agent_engagements: agentEngagements,
        delegation_decision: delegationDecision,
        decision_trust_enforcement: delegationDecisionTrustEnforcement,
        context_ref: contextRef,
      },
    })

    await endAgentRun({
      runId: run.id,
      status: 'completed',
      currentStep: 'Reply ready',
      outcome: {
        reply_preview: parsed.reply.slice(0, 500),
        budget_decision: {
          status: budgetDecision.status,
          estimatedCostUsd: budgetDecision.estimatedCostUsd,
          ruleKey: budgetDecision.rule.key,
        },
        suggested_actions: parsed.suggestedActions,
        action_proposals: parsed.actionProposals,
        agent_engagements: agentEngagements,
        delegation_decision: delegationDecision,
        decision_trust_enforcement: delegationDecisionTrustEnforcement,
        context_ref: contextRef,
      },
    })

    return {
      runId: run.id,
      reply: parsed.reply,
      suggestedActions: parsed.suggestedActions,
      actionProposals: parsed.actionProposals,
      agentEngagements,
      model,
      budgetDecision,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chief of Staff chat failed'
    await markAgentRunFailed(run.id, message, { source: 'chief_of_staff_chat' }).catch(() => {})
    throw error
  }
}
