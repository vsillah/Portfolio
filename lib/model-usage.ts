import { computeAnthropicCost, computeOpenAICost, type Usage } from '@/lib/cost-calculator'

export type ModelUsageProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'codex'
  | 'claude_code'
  | 'open_source'
  | 'local'
  | 'other'

export type ModelUsageRuntime = 'codex' | 'n8n' | 'hermes' | 'opencode' | 'manual' | 'api' | 'local' | 'other'
export type ModelUsageTaskCategory =
  | 'research'
  | 'coding'
  | 'qa'
  | 'planning'
  | 'social'
  | 'video'
  | 'outreach'
  | 'automation'
  | 'rag'
  | 'client_ops'
  | 'other'

export type ModelUsageCostBasis = 'metered' | 'catalog_priced' | 'subscription_prorated' | 'local_estimated' | 'inferred'
export type ModelUsageConfidence = 'high' | 'medium' | 'low'

export type ModelUsageLedgerEvent = {
  id: string
  occurredAt: string
  provider: ModelUsageProvider
  runtime: ModelUsageRuntime
  model: string
  taskCategory: ModelUsageTaskCategory
  agentKey: string | null
  clientProjectId: string | null
  clientLabel: string
  actionLabel: string
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  reasoningTokens: number
  totalTokens: number
  acceptedOutputCount: number
  resolvedWorkItemCount: number
  retryCount: number
  costUsd: number
  costBasis: ModelUsageCostBasis
  confidence: ModelUsageConfidence
  sourceTrace: {
    type: string
    id: string | null
    href?: string | null
  }
  pricingSnapshot?: Record<string, unknown>
  scrubbed: boolean
}

export type ModelUsageSubscriptionAllocation = {
  id: string
  provider: ModelUsageProvider
  runtime: ModelUsageRuntime | 'any'
  accountLabel: string
  monthlyCostUsd: number
  periodStart: string
  periodEnd: string
  allocationBasis: 'token_share' | 'event_share' | 'manual_weight'
  confidence: ModelUsageConfidence
  notes?: string | null
}

export type ModelUsageSummaryGroup = {
  key: string
  label: string
  totalTokens: number
  costUsd: number
  eventCount: number
  acceptedOutputCount: number
  efficiencyScore: number
}

export type ModelUsageRecommendation = {
  id: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  action: string
  rationale: string
  affectedEventIds: string[]
  approvalRequired: boolean
}

export type ModelUsageSnapshot = {
  generatedAt: string
  window: { from: string; to: string }
  totals: {
    eventCount: number
    totalTokens: number
    inputTokens: number
    outputTokens: number
    costUsd: number
    meteredCostUsd: number
    allocatedCostUsd: number
    inferredCostUsd: number
    acceptedOutputCount: number
    tokensPerAcceptedOutput: number | null
    costPerAcceptedOutput: number | null
  }
  byProvider: ModelUsageSummaryGroup[]
  byModel: ModelUsageSummaryGroup[]
  byRuntime: ModelUsageSummaryGroup[]
  byTaskCategory: ModelUsageSummaryGroup[]
  byClientProject: ModelUsageSummaryGroup[]
  heatmap: Array<{ date: string; totalTokens: number; costUsd: number; eventCount: number; level: number }>
  trend: Array<{ date: string; totalTokens: number; costUsd: number; eventCount: number }>
  topDays: Array<{ date: string; totalTokens: number; costUsd: number; eventCount: number; primaryActivity: string }>
  topTransactions: ModelUsageLedgerEvent[]
  recommendations: ModelUsageRecommendation[]
  events: ModelUsageLedgerEvent[]
  clientSafeEvents: ModelUsageLedgerEvent[]
}

export type ModelPricingSnapshot = {
  provider: ModelUsageProvider
  model: string
  inputUsdPer1MTokens: number
  outputUsdPer1MTokens: number
  sourceUrl: string
  effectiveFrom: string
  pricingState: 'current' | 'needs_review' | 'fallback'
}

export const MODEL_PRICING_CATALOG: ModelPricingSnapshot[] = [
  { provider: 'openai', model: 'gpt-4o', inputUsdPer1MTokens: 2.5, outputUsdPer1MTokens: 10, sourceUrl: 'https://openai.com/api/pricing/', effectiveFrom: '2024-01-01', pricingState: 'needs_review' },
  { provider: 'openai', model: 'gpt-4o-mini', inputUsdPer1MTokens: 0.15, outputUsdPer1MTokens: 0.6, sourceUrl: 'https://openai.com/api/pricing/', effectiveFrom: '2024-01-01', pricingState: 'needs_review' },
  { provider: 'anthropic', model: 'claude-sonnet-4-20250514', inputUsdPer1MTokens: 3, outputUsdPer1MTokens: 15, sourceUrl: 'https://www.anthropic.com/pricing', effectiveFrom: '2025-05-14', pricingState: 'needs_review' },
  { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', inputUsdPer1MTokens: 3, outputUsdPer1MTokens: 15, sourceUrl: 'https://www.anthropic.com/pricing', effectiveFrom: '2024-10-22', pricingState: 'needs_review' },
  { provider: 'anthropic', model: 'claude-3-5-haiku-20241022', inputUsdPer1MTokens: 0.8, outputUsdPer1MTokens: 4, sourceUrl: 'https://www.anthropic.com/pricing', effectiveFrom: '2024-10-22', pricingState: 'needs_review' },
  { provider: 'google', model: 'gemini-2.5-pro', inputUsdPer1MTokens: 1.25, outputUsdPer1MTokens: 10, sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing', effectiveFrom: '2025-01-01', pricingState: 'needs_review' },
  { provider: 'google', model: 'gemini-2.5-flash', inputUsdPer1MTokens: 0.3, outputUsdPer1MTokens: 2.5, sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing', effectiveFrom: '2025-01-01', pricingState: 'needs_review' },
]

function roundUsd(value: number) {
  return Math.round(value * 10_000) / 10_000
}

function safeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function inferModelUsageProvider(sourceOrModel: string | null | undefined): ModelUsageProvider {
  const value = (sourceOrModel ?? '').toLowerCase()
  if (value.includes('claude_code') || value.includes('claude-code')) return 'claude_code'
  if (value.includes('anthropic') || value.includes('claude')) return 'anthropic'
  if (value.includes('openai') || value.includes('gpt')) return 'openai'
  if (value.includes('google') || value.includes('gemini')) return 'google'
  if (value.includes('codex')) return 'codex'
  if (value.includes('ollama') || value.includes('local')) return 'local'
  if (value.includes('open_source') || value.includes('open-weight')) return 'open_source'
  return 'other'
}

export function inferTaskCategory(metadata: Record<string, unknown> | null | undefined): ModelUsageTaskCategory {
  const joined = [
    metadata?.task_category,
    metadata?.operation,
    metadata?.workflow_key,
    metadata?.artifact_type,
    metadata?.reference_type,
  ].filter(Boolean).join(' ').toLowerCase()

  if (/research|audit|source|meeting/.test(joined)) return 'research'
  if (/video|prompt_format|ideas/.test(joined)) return 'video'
  if (/social|linkedin|content|post/.test(joined)) return 'social'
  if (/outreach|lead|email|gmail/.test(joined)) return 'outreach'
  if (/qa|test|smoke|validation|diagnose/.test(joined)) return 'qa'
  if (/roadmap|plan|decision|strategy/.test(joined)) return 'planning'
  if (/rag|vector|retrieval|pinecone/.test(joined)) return 'rag'
  if (/client|provision|ops/.test(joined)) return 'client_ops'
  if (/automation|n8n|workflow/.test(joined)) return 'automation'
  if (/code|coding|implementation/.test(joined)) return 'coding'
  return 'other'
}

export function computeModelUsageCost(
  usage: Usage,
  provider: ModelUsageProvider,
  model: string,
): { costUsd: number; pricingSnapshot: ModelPricingSnapshot | null; costBasis: ModelUsageCostBasis } {
  if (provider === 'openai') {
    return { costUsd: roundUsd(computeOpenAICost(usage, model)), pricingSnapshot: pricingFor(provider, model), costBasis: 'catalog_priced' }
  }
  if (provider === 'anthropic') {
    return { costUsd: roundUsd(computeAnthropicCost(usage, model)), pricingSnapshot: pricingFor(provider, model), costBasis: 'catalog_priced' }
  }
  const pricing = pricingFor(provider, model)
  if (!pricing) return { costUsd: 0, pricingSnapshot: null, costBasis: provider === 'local' || provider === 'open_source' ? 'local_estimated' : 'inferred' }
  const input = usage.prompt_tokens ?? usage.input_tokens ?? 0
  const output = usage.completion_tokens ?? usage.output_tokens ?? 0
  return {
    costUsd: roundUsd((input / 1_000_000) * pricing.inputUsdPer1MTokens + (output / 1_000_000) * pricing.outputUsdPer1MTokens),
    pricingSnapshot: pricing,
    costBasis: 'catalog_priced',
  }
}

export function pricingFor(provider: ModelUsageProvider, model: string): ModelPricingSnapshot | null {
  return MODEL_PRICING_CATALOG.find((item) => item.provider === provider && item.model === model) ?? null
}

export function applySubscriptionAllocations(
  events: ModelUsageLedgerEvent[],
  allocations: ModelUsageSubscriptionAllocation[],
): ModelUsageLedgerEvent[] {
  if (events.length === 0 || allocations.length === 0) return events
  return events.map((event) => ({ ...event }))
    .map((event) => {
      const matching = allocations.filter((allocation) => (
        allocation.provider === event.provider &&
        (allocation.runtime === 'any' || allocation.runtime === event.runtime) &&
        event.occurredAt >= allocation.periodStart &&
        event.occurredAt <= allocation.periodEnd
      ))
      if (matching.length === 0) return event
      const totalTokenBasis = events
        .filter((candidate) => candidate.provider === event.provider && candidate.occurredAt >= matching[0].periodStart && candidate.occurredAt <= matching[0].periodEnd)
        .reduce((sum, candidate) => sum + Math.max(candidate.totalTokens, 1), 0)
      const allocated = matching.reduce((sum, allocation) => {
        const share = Math.max(event.totalTokens, 1) / Math.max(totalTokenBasis, 1)
        return sum + allocation.monthlyCostUsd * share
      }, 0)
      if (allocated <= 0) return event
      return {
        ...event,
        costUsd: roundUsd(event.costUsd + allocated),
        costBasis: event.costUsd > 0 ? event.costBasis : 'subscription_prorated',
        confidence: event.confidence === 'low' || matching.some((allocation) => allocation.confidence === 'low') ? 'low' : 'medium',
        pricingSnapshot: {
          ...event.pricingSnapshot,
          subscriptionAllocation: matching.map((allocation) => ({
            id: allocation.id,
            accountLabel: allocation.accountLabel,
            monthlyCostUsd: allocation.monthlyCostUsd,
            allocationBasis: allocation.allocationBasis,
            confidence: allocation.confidence,
          })),
        },
      }
    })
}

export function buildModelUsageSnapshotFromEvents(input: {
  events: ModelUsageLedgerEvent[]
  allocations?: ModelUsageSubscriptionAllocation[]
  from: string
  to: string
  generatedAt?: string
}): ModelUsageSnapshot {
  const events = applySubscriptionAllocations(input.events, input.allocations ?? [])
    .filter((event) => event.occurredAt >= input.from && event.occurredAt <= input.to)
    .sort((a, b) => b.totalTokens - a.totalTokens)
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const acceptedOutputCount = events.reduce((sum, event) => sum + event.acceptedOutputCount, 0)
  const totalTokens = events.reduce((sum, event) => sum + event.totalTokens, 0)
  const costUsd = roundUsd(events.reduce((sum, event) => sum + event.costUsd, 0))
  const totals = {
    eventCount: events.length,
    totalTokens,
    inputTokens: events.reduce((sum, event) => sum + event.inputTokens, 0),
    outputTokens: events.reduce((sum, event) => sum + event.outputTokens, 0),
    costUsd,
    meteredCostUsd: roundUsd(events.filter((event) => event.costBasis === 'metered' || event.costBasis === 'catalog_priced').reduce((sum, event) => sum + event.costUsd, 0)),
    allocatedCostUsd: roundUsd(events.filter((event) => event.costBasis === 'subscription_prorated').reduce((sum, event) => sum + event.costUsd, 0)),
    inferredCostUsd: roundUsd(events.filter((event) => event.costBasis === 'inferred' || event.costBasis === 'local_estimated').reduce((sum, event) => sum + event.costUsd, 0)),
    acceptedOutputCount,
    tokensPerAcceptedOutput: acceptedOutputCount > 0 ? Math.round(totalTokens / acceptedOutputCount) : null,
    costPerAcceptedOutput: acceptedOutputCount > 0 ? roundUsd(costUsd / acceptedOutputCount) : null,
  }

  const trend = buildDailyTrend(events)
  return {
    generatedAt,
    window: { from: input.from, to: input.to },
    totals,
    byProvider: groupEvents(events, (event) => event.provider, (event) => labelForKey(event.provider)),
    byModel: groupEvents(events, (event) => event.model, (event) => event.model),
    byRuntime: groupEvents(events, (event) => event.runtime, (event) => labelForKey(event.runtime)),
    byTaskCategory: groupEvents(events, (event) => event.taskCategory, (event) => labelForKey(event.taskCategory)),
    byClientProject: groupEvents(events, (event) => event.clientProjectId ?? 'portfolio', (event) => event.clientLabel),
    heatmap: trend.map((day) => ({ ...day, level: heatmapLevel(day.totalTokens, trend) })),
    trend,
    topDays: trend
      .slice()
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .slice(0, 10)
      .map((day) => ({
        ...day,
        primaryActivity: primaryActivityForDay(events, day.date),
      })),
    topTransactions: events.slice(0, 25),
    recommendations: buildModelUsageRecommendations(events),
    events,
    clientSafeEvents: events.map(scrubClientSafeEvent),
  }
}

function groupEvents(
  events: ModelUsageLedgerEvent[],
  keyFor: (event: ModelUsageLedgerEvent) => string,
  labelFor: (event: ModelUsageLedgerEvent) => string,
): ModelUsageSummaryGroup[] {
  const groups = new Map<string, ModelUsageSummaryGroup>()
  for (const event of events) {
    const key = keyFor(event)
    const existing = groups.get(key) ?? {
      key,
      label: labelFor(event),
      totalTokens: 0,
      costUsd: 0,
      eventCount: 0,
      acceptedOutputCount: 0,
      efficiencyScore: 0,
    }
    existing.totalTokens += event.totalTokens
    existing.costUsd = roundUsd(existing.costUsd + event.costUsd)
    existing.eventCount += 1
    existing.acceptedOutputCount += event.acceptedOutputCount
    existing.efficiencyScore = efficiencyScore(existing.totalTokens, existing.costUsd, existing.acceptedOutputCount)
    groups.set(key, existing)
  }
  return [...groups.values()].sort((a, b) => b.totalTokens - a.totalTokens)
}

function buildDailyTrend(events: ModelUsageLedgerEvent[]) {
  const byDate = new Map<string, { date: string; totalTokens: number; costUsd: number; eventCount: number }>()
  for (const event of events) {
    const date = event.occurredAt.slice(0, 10)
    const row = byDate.get(date) ?? { date, totalTokens: 0, costUsd: 0, eventCount: 0 }
    row.totalTokens += event.totalTokens
    row.costUsd = roundUsd(row.costUsd + event.costUsd)
    row.eventCount += 1
    byDate.set(date, row)
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function heatmapLevel(tokens: number, trend: Array<{ totalTokens: number }>) {
  const max = Math.max(...trend.map((day) => day.totalTokens), 0)
  if (tokens <= 0 || max <= 0) return 0
  return Math.max(1, Math.min(4, Math.ceil((tokens / max) * 4)))
}

function primaryActivityForDay(events: ModelUsageLedgerEvent[], date: string) {
  const groups = groupEvents(events.filter((event) => event.occurredAt.startsWith(date)), (event) => event.taskCategory, (event) => labelForKey(event.taskCategory))
  return groups[0]?.label ?? 'No categorized activity'
}

function efficiencyScore(tokens: number, costUsd: number, acceptedOutputs: number) {
  if (tokens <= 0 || acceptedOutputs <= 0) return 0
  const tokensPerOutput = tokens / acceptedOutputs
  const costPenalty = costUsd > 0 ? Math.log10(costUsd + 1) : 0
  return Math.round(Math.max(0, 100 - tokensPerOutput / 10_000 - costPenalty * 10))
}

function labelForKey(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function buildModelUsageRecommendations(events: ModelUsageLedgerEvent[]): ModelUsageRecommendation[] {
  const recommendations: ModelUsageRecommendation[] = []
  const highInputEvents = events.filter((event) => event.inputTokens > 100_000 && event.inputTokens > event.outputTokens * 8)
  if (highInputEvents.length > 0) {
    recommendations.push({
      id: 'context-slimming',
      severity: 'warning',
      title: 'Slim repeated context before the next run',
      action: 'Move reusable context into RAG, summaries, or project memory and pass only the task-specific delta.',
      rationale: `${highInputEvents.length} transaction(s) used heavy input context relative to output.`,
      affectedEventIds: highInputEvents.slice(0, 10).map((event) => event.id),
      approvalRequired: false,
    })
  }
  const lowConfidence = events.filter((event) => event.confidence === 'low')
  if (lowConfidence.length > 0) {
    recommendations.push({
      id: 'usage-source-confidence',
      severity: 'info',
      title: 'Improve usage source confidence',
      action: 'Attach exact provider usage exports or audited session logs for low-confidence model spend.',
      rationale: `${lowConfidence.length} transaction(s) are currently inferred or subscription-prorated with low confidence.`,
      affectedEventIds: lowConfidence.slice(0, 10).map((event) => event.id),
      approvalRequired: false,
    })
  }
  const expensiveResearch = events.filter((event) => event.taskCategory === 'research' && event.costUsd > 2)
  if (expensiveResearch.length > 0) {
    recommendations.push({
      id: 'research-model-bakeoff',
      severity: 'warning',
      title: 'Run a research model bakeoff',
      action: 'Compare the same research packet across a lower-cost model, cached RAG, and the incumbent model before changing routing.',
      rationale: `${expensiveResearch.length} research transaction(s) crossed the V1 cost threshold.`,
      affectedEventIds: expensiveResearch.slice(0, 10).map((event) => event.id),
      approvalRequired: true,
    })
  }
  return recommendations
}

function scrubClientSafeEvent(event: ModelUsageLedgerEvent): ModelUsageLedgerEvent {
  return {
    ...event,
    actionLabel: event.taskCategory === 'other' ? 'Model usage transaction' : `${labelForKey(event.taskCategory)} transaction`,
    sourceTrace: { type: event.sourceTrace.type, id: event.sourceTrace.id ? 'redacted' : null, href: null },
    pricingSnapshot: event.pricingSnapshot ? { confidence: event.confidence, costBasis: event.costBasis } : undefined,
    scrubbed: true,
  }
}

type ModelUsageEventRow = {
  id: string
  occurred_at: string
  provider: string | null
  runtime: string | null
  model: string | null
  task_category: string | null
  agent_key: string | null
  client_project_id: string | null
  client_label: string | null
  action_label: string | null
  input_tokens: number | null
  output_tokens: number | null
  cached_tokens: number | null
  reasoning_tokens: number | null
  total_tokens: number | null
  accepted_output_count: number | null
  resolved_work_item_count: number | null
  retry_count: number | null
  cost_usd: number | null
  cost_basis: string | null
  confidence: string | null
  source_type: string | null
  source_id: string | null
  source_href: string | null
  pricing_snapshot: Record<string, unknown> | null
  scrubbed: boolean | null
}

type CostEventRow = {
  id: string
  occurred_at: string
  source: string | null
  amount: number | string | null
  reference_type: string | null
  reference_id: string | null
  agent_run_id: string | null
  metadata: Record<string, unknown> | null
}

type SubscriptionAllocationRow = {
  id: string
  provider: string | null
  runtime: string | null
  account_label: string | null
  monthly_cost_usd: number | null
  period_start: string
  period_end: string
  allocation_basis: string | null
  confidence: string | null
  notes: string | null
}

export async function buildModelUsageSnapshot(input?: {
  from?: string
  to?: string
  clientProjectId?: string
}): Promise<ModelUsageSnapshot> {
  const { supabaseAdmin } = await import('@/lib/supabase')
  if (!supabaseAdmin) throw new Error('Database not available')
  const now = new Date()
  const to = input?.to ? endOfDayIso(input.to) : now.toISOString()
  const from = input?.from ? startOfDayIso(input.from) : new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString()

  let usageQuery = supabaseAdmin
    .from('model_usage_events')
    .select('*')
    .gte('occurred_at', from)
    .lte('occurred_at', to)
    .order('occurred_at', { ascending: false })
    .limit(1000)
  if (input?.clientProjectId) usageQuery = usageQuery.eq('client_project_id', input.clientProjectId)

  const [usageResult, costResult, allocationResult] = await Promise.all([
    usageQuery,
    supabaseAdmin.from('cost_events').select('id, occurred_at, source, amount, reference_type, reference_id, agent_run_id, metadata').gte('occurred_at', from).lte('occurred_at', to).order('occurred_at', { ascending: false }).limit(1000),
    supabaseAdmin.from('model_usage_subscription_allocations').select('*').lte('period_start', to).gte('period_end', from).eq('active', true),
  ])

  const ledgerEvents = (usageResult.error ? [] : ((usageResult.data ?? []) as ModelUsageEventRow[]).map(modelUsageEventFromRow))
  const fallbackEvents = (costResult.error ? [] : ((costResult.data ?? []) as CostEventRow[]).map(modelUsageEventFromCostEvent))
    .filter((event) => !ledgerEvents.some((existing) => existing.sourceTrace.type === event.sourceTrace.type && existing.sourceTrace.id === event.sourceTrace.id))
  const allocations = allocationResult.error ? [] : ((allocationResult.data ?? []) as SubscriptionAllocationRow[]).map(subscriptionAllocationFromRow)

  return buildModelUsageSnapshotFromEvents({
    events: [...ledgerEvents, ...fallbackEvents],
    allocations,
    from,
    to,
  })
}

export function modelUsageEventFromCostEvent(row: CostEventRow): ModelUsageLedgerEvent {
  const metadata = row.metadata ?? {}
  const model = typeof metadata.model === 'string' ? metadata.model : 'unknown-model'
  const provider = inferModelUsageProvider(`${row.source ?? ''} ${model}`)
  const inputTokens = safeNumber(metadata.prompt_tokens) || safeNumber(metadata.input_tokens)
  const outputTokens = safeNumber(metadata.completion_tokens) || safeNumber(metadata.output_tokens)
  const totalTokens = safeNumber(metadata.total_tokens) || inputTokens + outputTokens
  return {
    id: `cost-${row.id}`,
    occurredAt: row.occurred_at,
    provider,
    runtime: runtimeFromMetadata(metadata),
    model,
    taskCategory: inferTaskCategory({ ...metadata, reference_type: row.reference_type }),
    agentKey: typeof metadata.agent_key === 'string' ? metadata.agent_key : null,
    clientProjectId: typeof metadata.client_project_id === 'string' ? metadata.client_project_id : null,
    clientLabel: typeof metadata.client_label === 'string' ? metadata.client_label : 'Portfolio',
    actionLabel: typeof metadata.operation === 'string' ? metadata.operation.replace(/_/g, ' ') : row.reference_type ?? 'Model usage transaction',
    inputTokens,
    outputTokens,
    cachedTokens: safeNumber(metadata.cached_tokens),
    reasoningTokens: safeNumber(metadata.reasoning_tokens),
    totalTokens,
    acceptedOutputCount: safeNumber(metadata.accepted_output_count) || 1,
    resolvedWorkItemCount: safeNumber(metadata.resolved_work_item_count),
    retryCount: safeNumber(metadata.retry_count),
    costUsd: roundUsd(safeNumber(row.amount)),
    costBasis: 'metered',
    confidence: totalTokens > 0 ? 'high' : 'medium',
    sourceTrace: {
      type: row.reference_type ?? 'cost_event',
      id: row.reference_id ?? row.id,
      href: row.agent_run_id ? `/admin/agents/runs/${row.agent_run_id}` : null,
    },
    pricingSnapshot: typeof metadata.pricing_snapshot === 'object' && metadata.pricing_snapshot ? metadata.pricing_snapshot as Record<string, unknown> : pricingFor(provider, model) ?? undefined,
    scrubbed: false,
  }
}

function modelUsageEventFromRow(row: ModelUsageEventRow): ModelUsageLedgerEvent {
  const inputTokens = safeNumber(row.input_tokens)
  const outputTokens = safeNumber(row.output_tokens)
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    provider: normalizeProvider(row.provider),
    runtime: normalizeRuntime(row.runtime),
    model: row.model ?? 'unknown-model',
    taskCategory: normalizeTaskCategory(row.task_category),
    agentKey: row.agent_key,
    clientProjectId: row.client_project_id,
    clientLabel: row.client_label ?? 'Portfolio',
    actionLabel: row.action_label ?? 'Model usage transaction',
    inputTokens,
    outputTokens,
    cachedTokens: safeNumber(row.cached_tokens),
    reasoningTokens: safeNumber(row.reasoning_tokens),
    totalTokens: safeNumber(row.total_tokens) || inputTokens + outputTokens,
    acceptedOutputCount: safeNumber(row.accepted_output_count),
    resolvedWorkItemCount: safeNumber(row.resolved_work_item_count),
    retryCount: safeNumber(row.retry_count),
    costUsd: roundUsd(safeNumber(row.cost_usd)),
    costBasis: normalizeCostBasis(row.cost_basis),
    confidence: normalizeConfidence(row.confidence),
    sourceTrace: { type: row.source_type ?? 'model_usage_event', id: row.source_id, href: row.source_href },
    pricingSnapshot: row.pricing_snapshot ?? undefined,
    scrubbed: Boolean(row.scrubbed),
  }
}

function subscriptionAllocationFromRow(row: SubscriptionAllocationRow): ModelUsageSubscriptionAllocation {
  return {
    id: row.id,
    provider: normalizeProvider(row.provider),
    runtime: row.runtime === 'any' ? 'any' : normalizeRuntime(row.runtime),
    accountLabel: row.account_label ?? 'Unlabeled account',
    monthlyCostUsd: safeNumber(row.monthly_cost_usd),
    periodStart: row.period_start,
    periodEnd: row.period_end,
    allocationBasis: row.allocation_basis === 'event_share' || row.allocation_basis === 'manual_weight' ? row.allocation_basis : 'token_share',
    confidence: normalizeConfidence(row.confidence),
    notes: row.notes,
  }
}

function runtimeFromMetadata(metadata: Record<string, unknown>): ModelUsageRuntime {
  return normalizeRuntime(typeof metadata.runtime === 'string' ? metadata.runtime : null)
}

function normalizeProvider(value: string | null | undefined): ModelUsageProvider {
  const provider = inferModelUsageProvider(value)
  return provider
}

function normalizeRuntime(value: string | null | undefined): ModelUsageRuntime {
  if (value === 'codex' || value === 'n8n' || value === 'hermes' || value === 'opencode' || value === 'manual' || value === 'api' || value === 'local') return value
  return 'other'
}

function normalizeTaskCategory(value: string | null | undefined): ModelUsageTaskCategory {
  if (value === 'research' || value === 'coding' || value === 'qa' || value === 'planning' || value === 'social' || value === 'video' || value === 'outreach' || value === 'automation' || value === 'rag' || value === 'client_ops') return value
  return 'other'
}

function normalizeCostBasis(value: string | null | undefined): ModelUsageCostBasis {
  if (value === 'metered' || value === 'catalog_priced' || value === 'subscription_prorated' || value === 'local_estimated' || value === 'inferred') return value
  return 'inferred'
}

function normalizeConfidence(value: string | null | undefined): ModelUsageConfidence {
  if (value === 'high' || value === 'medium' || value === 'low') return value
  return 'medium'
}

function startOfDayIso(value: string) {
  return `${value.slice(0, 10)}T00:00:00.000Z`
}

function endOfDayIso(value: string) {
  return `${value.slice(0, 10)}T23:59:59.999Z`
}
