import { generateJsonCompletion } from '@/lib/llm-dispatch'
import {
  endAgentRun,
  markAgentRunFailed,
  recordAgentEvent,
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'
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
  model: string
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
}

const DEFAULT_MODEL = 'gpt-4o-mini'

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

export function parseChiefOfStaffJson(content: string): { reply: string; suggestedActions: string[] } {
  const parsed = JSON.parse(content) as { reply?: unknown; suggested_actions?: unknown }
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

  return { reply, suggestedActions }
}

export async function collectChiefOfStaffContext(): Promise<ChiefOfStaffContext> {
  const db = assertDatabase()
  const since = sinceHours(24)

  const [activeRes, failedRes, approvalsRes, costsRes] = await Promise.all([
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
  }
}

export function buildChiefOfStaffPrompt(context: ChiefOfStaffContext, history: ChiefOfStaffChatMessage[]) {
  return {
    systemPrompt: [
      'You are the Chief of Staff Agent for Vambah and AmaduTown.',
      'Your job is to translate executive intent into clear priorities, operational status, escalation decisions, and next actions.',
      'Use only the provided operating context. If the user asks for production mutations, sending messages, publishing, or config changes, explain that approval is required and suggest the approval path.',
      'Be concise, direct, and operational. Do not pretend to have run tools that are not in the context.',
      'Return JSON only with keys: reply, suggested_actions.',
    ].join('\n'),
    userPrompt: JSON.stringify(
      {
        current_context: context,
        recent_chat_history: history,
        response_contract: {
          reply: 'A concise answer to the user. Prefer concrete status, blockers, and next steps.',
          suggested_actions: 'Up to five short actions the user can take or ask the agent to do next.',
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
      metadata: { model, suggested_actions: parsed.suggestedActions },
    })

    await endAgentRun({
      runId: run.id,
      status: 'completed',
      currentStep: 'Reply ready',
      outcome: {
        reply_preview: parsed.reply.slice(0, 500),
        suggested_actions: parsed.suggestedActions,
      },
    })

    return {
      runId: run.id,
      reply: parsed.reply,
      suggestedActions: parsed.suggestedActions,
      model,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chief of Staff chat failed'
    await markAgentRunFailed(run.id, message, { source: 'chief_of_staff_chat' }).catch(() => {})
    throw error
  }
}
