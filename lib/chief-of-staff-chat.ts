import { generateJsonCompletion } from '@/lib/llm-dispatch'
import {
  endAgentRun,
  markAgentRunFailed,
  recordAgentEvent,
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'
import {
  actionRequiresApproval,
  getApprovalGate,
  type AgentAction,
} from '@/lib/agent-policy'
import { getAgentByKey } from '@/lib/agent-organization'
import {
  listCodexAutomationInventory,
  type CodexAutomationInventory,
} from '@/lib/codex-automation-inventory'
import { supabaseAdmin } from '@/lib/supabase'

export type ChiefOfStaffChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ChiefOfStaffChatRequest = {
  message: string
  history?: ChiefOfStaffChatMessage[]
  userId?: string
}

export type ChiefOfStaffChatResponse = {
  runId: string
  reply: string
  suggestedActions: string[]
  actionProposals: ChiefOfStaffActionProposal[]
  agentEngagements: ChiefOfStaffAgentEngagementProposal[]
  model: string
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
  provider: string | null
  model: string | null
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
  activeRuns: AgentRunSummaryRow[]
  recentFailures: AgentRunSummaryRow[]
  pendingApprovals: AgentApprovalSummaryRow[]
  costEvents24h: {
    count: number
    totalUsd: number
    providers: string[]
    models: string[]
  }
  automationContext: ChiefOfStaffAutomationContext
}

const DEFAULT_MODEL = 'gpt-4o-mini'
const CHIEF_OF_STAFF_ACTIONS: AgentAction[] = [
  'read_files',
  'write_files',
  'external_api_call',
  'client_data_access',
  'known_workflow_db_write',
  'unknown_db_write',
  'publish_public_content',
  'send_email',
  'production_config_change',
  'public_content_from_private_material',
]

function sinceHours(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function assertDatabase() {
  if (!supabaseAdmin) {
    throw new Error('Database not available')
  }
  return supabaseAdmin
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

function isAgentAction(value: unknown): value is AgentAction {
  return typeof value === 'string' && CHIEF_OF_STAFF_ACTIONS.includes(value as AgentAction)
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
      .select('amount, provider, model')
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

  return {
    generatedAt: new Date().toISOString(),
    activeRuns: (activeRes.data ?? []) as AgentRunSummaryRow[],
    recentFailures: (failedRes.data ?? []) as AgentRunSummaryRow[],
    pendingApprovals: (approvalsRes.data ?? []) as AgentApprovalSummaryRow[],
    costEvents24h: {
      count: costRows.length,
      totalUsd: Number(totalUsd.toFixed(4)),
      providers: Array.from(new Set(costRows.map((row) => row.provider).filter(Boolean) as string[])),
      models: Array.from(new Set(costRows.map((row) => row.model).filter(Boolean) as string[])),
    },
    automationContext: summarizeAutomationContext(automationInventory),
  }
}

export function buildChiefOfStaffPrompt(context: ChiefOfStaffContext, history: ChiefOfStaffChatMessage[]) {
  return {
    systemPrompt: [
      'You are the Chief of Staff Agent for Vambah and AmaduTown.',
      'Your job is to translate executive intent into clear priorities, operational status, escalation decisions, and next actions.',
      'Use only the provided operating context. If the user asks for production mutations, sending messages, publishing, or config changes, explain that approval is required and suggest the approval path.',
      'Be concise, direct, and operational. Do not pretend to have run tools that are not in the context.',
      'Automation context is a summarized, read-only inventory. Use it to identify risky automations, missing context, duplicate jobs, and when the Automation Systems Agent should be engaged.',
      'When proposing an executable next step, include a typed action proposal. The proposal is only a recommendation; it does not execute work.',
      'When the next step should be handled by one of the mapped agents, include an agent_engagements proposal with the exact agent_key.',
      'Use only these action ids: read_files, write_files, external_api_call, client_data_access, known_workflow_db_write, unknown_db_write, publish_public_content, send_email, production_config_change, public_content_from_private_material.',
      'Use only these agent keys when recommending an agent engagement: chief-of-staff, research-source-register, private-knowledge-librarian, voice-content-architect, content-repurposing, engineering-copilot, automation-systems, agent-tooling-parity, website-product-copy, inbox-follow-up.',
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
  const run = await startAgentRun({
    agentKey: 'chief-of-staff',
    runtime: 'codex',
    kind: 'chief_of_staff_chat',
    title: 'Chief of Staff chat',
    status: 'running',
    subject: { type: 'admin_chat', id: input.userId ?? 'admin', label: 'Admin chat' },
    triggerSource: 'admin_chief_of_staff_chat',
    triggeredByUserId: input.userId,
    currentStep: 'Collecting operating context',
    metadata: { message_preview: message.slice(0, 240) },
  })

  try {
    const context = await collectChiefOfStaffContext()
    await recordAgentStep({
      runId: run.id,
      stepKey: 'collect_context',
      name: 'Collected operating context',
      status: 'completed',
      inputSummary: message.slice(0, 500),
      outputSummary: `${context.activeRuns.length} active, ${context.recentFailures.length} failed/stale, ${context.pendingApprovals.length} approvals`,
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
    const completion = await generateJsonCompletion({
      model,
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      temperature: 0.3,
      maxTokens: 900,
      costContext: {
        agentRunId: run.id,
        reference: { type: 'agent', id: 'chief-of-staff' },
        metadata: { operation: 'chief_of_staff_chat' },
      },
    })

    const parsed = parseChiefOfStaffJson(completion.content)
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
        suggested_actions: parsed.suggestedActions,
        action_proposals: parsed.actionProposals,
        agent_engagements: parsed.agentEngagements,
      },
    })

    await endAgentRun({
      runId: run.id,
      status: 'completed',
      currentStep: 'Reply ready',
      outcome: {
        reply_preview: parsed.reply.slice(0, 500),
        suggested_actions: parsed.suggestedActions,
        action_proposals: parsed.actionProposals,
        agent_engagements: parsed.agentEngagements,
      },
    })

    return {
      runId: run.id,
      reply: parsed.reply,
      suggestedActions: parsed.suggestedActions,
      actionProposals: parsed.actionProposals,
      agentEngagements: parsed.agentEngagements,
      model,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chief of Staff chat failed'
    await markAgentRunFailed(run.id, message, { source: 'chief_of_staff_chat' }).catch(() => {})
    throw error
  }
}
