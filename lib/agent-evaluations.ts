import { recordAgentEvent } from '@/lib/agent-run'
import { supabaseAdmin } from '@/lib/supabase'

export type AgentEvalDimension = {
  key: string
  label: string
  weight?: number
}

export type AgentEvalRubricRow = {
  id: string
  key: string
  agent_key: string
  workflow_key: string | null
  name: string
  description: string | null
  dimensions: unknown
  threshold: number | string
  active: boolean
  metadata: Record<string, unknown> | null
}

export type AgentEvalRunRow = {
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
  outcome: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

export type AgentRunEvaluationRow = {
  id: string
  run_id: string
  rubric_id: string
  rubric_key: string
  agent_key: string
  workflow_key: string | null
  score: number | string
  passed: boolean
  dimension_scores: Record<string, number> | null
  judge_model: string
  summary: string | null
  failure_reasons: string[] | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type RecordAgentRunEvaluationInput = {
  runId: string
  rubricId: string
  rubricKey: string
  agentKey: string
  workflowKey?: string | null
  score: number
  threshold?: number
  dimensionScores?: Record<string, number>
  judgeModel?: string
  summary?: string | null
  failureReasons?: string[]
  metadata?: Record<string, unknown>
}

export type ScoredAgentRunEvaluation = {
  run_id: string
  rubric_id: string
  rubric_key: string
  agent_key: string
  workflow_key: string | null
  score: number
  passed: boolean
  dimension_scores: Record<string, number>
  judge_model: string
  summary: string
  failure_reasons: string[]
  metadata: Record<string, unknown>
}

export type AgentQualityTrend = {
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
}

export type AgentQualitySummary = {
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
  rubric_trends: AgentQualityTrend[]
}

function db() {
  if (!supabaseAdmin) {
    throw new Error('Database not available')
  }
  return supabaseAdmin
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Number(score.toFixed(2))))
}

function scoreValue(value: number | string | null | undefined) {
  const numberValue = Number(value ?? 0)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function normalizeDimensions(dimensions: unknown): AgentEvalDimension[] {
  if (!Array.isArray(dimensions)) return []
  return dimensions
    .map((dimension): AgentEvalDimension | null => {
      if (!dimension || typeof dimension !== 'object') return null
      const record = dimension as Record<string, unknown>
      const key = typeof record.key === 'string' ? record.key.trim() : ''
      const label = typeof record.label === 'string' ? record.label.trim() : key
      const weight = typeof record.weight === 'number' && Number.isFinite(record.weight) ? record.weight : undefined
      return key && label ? { key, label, ...(weight === undefined ? {} : { weight }) } : null
    })
    .filter((dimension): dimension is AgentEvalDimension => Boolean(dimension))
}

export function validateAgentEvalRubric(rubric: Pick<AgentEvalRubricRow, 'key' | 'agent_key' | 'name' | 'dimensions' | 'threshold'>): AgentEvalDimension[] {
  if (!rubric.key?.trim()) throw new Error('Rubric key is required')
  if (!rubric.agent_key?.trim()) throw new Error('Rubric agent key is required')
  if (!rubric.name?.trim()) throw new Error('Rubric name is required')

  const threshold = scoreValue(rubric.threshold)
  if (threshold < 0 || threshold > 100) {
    throw new Error('Rubric threshold must be between 0 and 100')
  }

  const dimensions = normalizeDimensions(rubric.dimensions)
  if (!dimensions.length) {
    throw new Error('Rubric requires at least one dimension')
  }
  return dimensions
}

function runHasOutcome(run: AgentEvalRunRow) {
  return Boolean(run.outcome && Object.keys(run.outcome).length > 0)
}

function runHasTraceMetadata(run: AgentEvalRunRow) {
  return Boolean(run.current_step || run.subject_label || (run.metadata && Object.keys(run.metadata).length > 0))
}

function scoreDimension(baseScore: number, dimension: AgentEvalDimension, run: AgentEvalRunRow) {
  const key = `${dimension.key} ${dimension.label}`.toLowerCase()
  let score = baseScore

  if (key.includes('trace') || key.includes('ground') || key.includes('provenance') || key.includes('attribution')) {
    if (!runHasTraceMetadata(run)) score -= 15
  }
  if (key.includes('approval') || key.includes('send') || key.includes('outbound')) {
    const approvalRequired = run.metadata?.requires_approval ?? run.outcome?.requires_approval
    const statusShowsApproval = run.status === 'waiting_for_approval'
    if (approvalRequired === false && !statusShowsApproval) score -= 10
  }
  if (key.includes('safety') || key.includes('privacy') || key.includes('isolation') || key.includes('boundary')) {
    if (run.error_message || run.status === 'failed') score -= 20
  }
  if (key.includes('synthesis') || key.includes('action') || key.includes('handoff')) {
    if (!runHasOutcome(run) && run.status === 'completed') score -= 10
    if (!run.current_step) score -= 5
  }

  return clampScore(score)
}

export function scoreAgentRunAgainstRubric(run: AgentEvalRunRow, rubric: AgentEvalRubricRow): ScoredAgentRunEvaluation {
  const dimensions = validateAgentEvalRubric(rubric)
  const threshold = scoreValue(rubric.threshold)
  const statusScore =
    run.status === 'completed'
      ? 90
      : run.status === 'running' || run.status === 'queued' || run.status === 'waiting_for_approval'
        ? 68
        : run.status === 'stale' || run.status === 'cancelled'
          ? 45
          : 25

  let baseScore = statusScore
  if (run.error_message) baseScore -= 25
  if (!run.current_step) baseScore -= 5
  if (run.status === 'completed' && !runHasOutcome(run)) baseScore -= 5

  const dimensionScores = dimensions.reduce<Record<string, number>>((acc, dimension) => {
    acc[dimension.key] = scoreDimension(baseScore, dimension, run)
    return acc
  }, {})

  const weightedTotal = dimensions.reduce((sum, dimension) => {
    const weight = dimension.weight ?? 1 / dimensions.length
    return sum + (dimensionScores[dimension.key] ?? 0) * weight
  }, 0)
  const totalWeight = dimensions.reduce((sum, dimension) => sum + (dimension.weight ?? 1 / dimensions.length), 0) || 1
  const score = clampScore(weightedTotal / totalWeight)
  const failureReasons = [
    run.status === 'failed' ? 'Run failed before producing a reviewable output.' : null,
    run.status === 'stale' ? 'Run is stale and needs owner follow-up.' : null,
    run.error_message ? `Run error: ${run.error_message}` : null,
    run.status === 'completed' && !runHasOutcome(run) ? 'Completed run does not expose a structured outcome.' : null,
    score < threshold ? `Score ${score.toFixed(2)} is below threshold ${threshold.toFixed(2)}.` : null,
  ].filter((reason): reason is string => Boolean(reason))

  return {
    run_id: run.id,
    rubric_id: rubric.id,
    rubric_key: rubric.key,
    agent_key: rubric.agent_key || run.agent_key || 'chief-of-staff',
    workflow_key: rubric.workflow_key ?? run.kind ?? null,
    score,
    passed: score >= threshold,
    dimension_scores: dimensionScores,
    judge_model: 'deterministic-agent-eval-v1',
    summary: score >= threshold
      ? `${rubric.name} passed at ${score.toFixed(2)}.`
      : `${rubric.name} needs coaching at ${score.toFixed(2)}.`,
    failure_reasons: failureReasons,
    metadata: {
      run_status: run.status,
      runtime: run.runtime,
      threshold,
      mutation_policy: 'approval_gated',
      autonomous_mutation: false,
    },
  }
}

export async function recordAgentRunEvaluation(input: RecordAgentRunEvaluationInput): Promise<AgentRunEvaluationRow> {
  if (!input.runId.trim()) throw new Error('runId is required')
  if (!input.rubricKey.trim()) throw new Error('rubricKey is required')
  if (!input.agentKey.trim()) throw new Error('agentKey is required')
  if (!Number.isFinite(input.score) || input.score < 0 || input.score > 100) {
    throw new Error('Evaluation score must be between 0 and 100')
  }

  const score = clampScore(input.score)
  const threshold = input.threshold ?? 80
  const { data, error } = await db()
    .from('agent_run_evaluations')
    .upsert({
      run_id: input.runId,
      rubric_id: input.rubricId,
      rubric_key: input.rubricKey,
      agent_key: input.agentKey,
      workflow_key: input.workflowKey ?? null,
      score,
      passed: score >= threshold,
      dimension_scores: input.dimensionScores ?? {},
      judge_model: input.judgeModel ?? 'deterministic-agent-eval-v1',
      summary: input.summary ?? null,
      failure_reasons: input.failureReasons ?? [],
      metadata: {
        ...(input.metadata ?? {}),
        threshold,
        mutation_policy: 'approval_gated',
        autonomous_mutation: false,
      },
    }, { onConflict: 'run_id,rubric_key' })
    .select('id, run_id, rubric_id, rubric_key, agent_key, workflow_key, score, passed, dimension_scores, judge_model, summary, failure_reasons, metadata, created_at')
    .single()

  if (error) throw new Error(`Failed to record agent evaluation: ${error.message}`)
  return data as AgentRunEvaluationRow
}

export async function evaluateAgentRun(runId: string, rubricKey: string): Promise<AgentRunEvaluationRow> {
  const runIdValue = runId.trim()
  const rubricKeyValue = rubricKey.trim()
  if (!runIdValue) throw new Error('runId is required')
  if (!rubricKeyValue) throw new Error('rubricKey is required')

  const [runRes, rubricRes] = await Promise.all([
    db()
      .from('agent_runs')
      .select('id, agent_key, runtime, kind, title, status, subject_label, current_step, error_message, started_at, completed_at, outcome, metadata')
      .eq('id', runIdValue)
      .maybeSingle(),
    db()
      .from('agent_eval_rubrics')
      .select('id, key, agent_key, workflow_key, name, description, dimensions, threshold, active, metadata')
      .eq('key', rubricKeyValue)
      .eq('active', true)
      .maybeSingle(),
  ])

  if (runRes.error) throw new Error(`Failed to fetch agent run: ${runRes.error.message}`)
  if (rubricRes.error) throw new Error(`Failed to fetch evaluation rubric: ${rubricRes.error.message}`)
  if (!runRes.data) throw new Error('Agent run not found')
  if (!rubricRes.data) throw new Error('Evaluation rubric not found')

  const scored = scoreAgentRunAgainstRubric(runRes.data as AgentEvalRunRow, rubricRes.data as AgentEvalRubricRow)
  const threshold = scoreValue((rubricRes.data as AgentEvalRubricRow).threshold)
  const evaluation = await recordAgentRunEvaluation({
    runId: scored.run_id,
    rubricId: scored.rubric_id,
    rubricKey: scored.rubric_key,
    agentKey: scored.agent_key,
    workflowKey: scored.workflow_key,
    score: scored.score,
    threshold,
    dimensionScores: scored.dimension_scores,
    judgeModel: scored.judge_model,
    summary: scored.summary,
    failureReasons: scored.failure_reasons,
    metadata: scored.metadata,
  })

  await recordAgentEvent({
    runId: runIdValue,
    eventType: 'agent_run_evaluated',
    severity: evaluation.passed ? 'info' : 'warning',
    message: evaluation.summary ?? `Evaluated ${rubricKeyValue}`,
    metadata: {
      evaluation_id: evaluation.id,
      rubric_key: evaluation.rubric_key,
      score: scoreValue(evaluation.score),
      passed: evaluation.passed,
      judge_model: evaluation.judge_model,
      failure_reasons: evaluation.failure_reasons ?? [],
    },
    idempotencyKey: `${runIdValue}:${rubricKeyValue}:evaluation`,
  })

  return evaluation
}

export function getEmptyAgentQualitySummary(windowHours = 24): AgentQualitySummary {
  return {
    window_hours: windowHours,
    generated_at: new Date().toISOString(),
    rubric_count: 0,
    evaluation_count: 0,
    average_score: null,
    pass_rate: null,
    by_agent: [],
    needs_coaching: [],
    rubric_trends: [],
  }
}

export function summarizeAgentQuality(input: {
  rubrics: AgentEvalRubricRow[]
  evaluations: AgentRunEvaluationRow[]
  windowHours?: number
}): AgentQualitySummary {
  const windowHours = input.windowHours ?? 24
  const activeRubrics = input.rubrics.filter((rubric) => rubric.active)
  const rubricsByKey = new Map(activeRubrics.map((rubric) => [rubric.key, rubric]))
  const evaluations = [...input.evaluations].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const totalScore = evaluations.reduce((sum, evaluation) => sum + scoreValue(evaluation.score), 0)
  const passCount = evaluations.filter((evaluation) => evaluation.passed).length
  const byAgent = new Map<string, AgentRunEvaluationRow[]>()
  const byRubric = new Map<string, AgentRunEvaluationRow[]>()

  for (const evaluation of evaluations) {
    byAgent.set(evaluation.agent_key, [...(byAgent.get(evaluation.agent_key) ?? []), evaluation])
    byRubric.set(evaluation.rubric_key, [...(byRubric.get(evaluation.rubric_key) ?? []), evaluation])
  }

  const agentSummaries = Array.from(byAgent.entries())
    .map(([agentKey, rows]) => {
      const latest = rows[0]
      const rowScore = rows.reduce((sum, evaluation) => sum + scoreValue(evaluation.score), 0)
      const rowPassCount = rows.filter((evaluation) => evaluation.passed).length
      return {
        agent_key: agentKey,
        evaluation_count: rows.length,
        average_score: Number((rowScore / rows.length).toFixed(2)),
        pass_rate: Number((rowPassCount / rows.length).toFixed(2)),
        latest_score: latest ? scoreValue(latest.score) : null,
        latest_evaluated_at: latest?.created_at ?? null,
      }
    })
    .sort((a, b) => (a.average_score ?? 0) - (b.average_score ?? 0))

  const rubricTrends = activeRubrics.map<AgentQualityTrend>((rubric) => {
    const rows = byRubric.get(rubric.key) ?? []
    const latest = rows[0]
    const previous = rows[1]
    const average = rows.length
      ? Number((rows.reduce((sum, evaluation) => sum + scoreValue(evaluation.score), 0) / rows.length).toFixed(2))
      : null
    const passRate = rows.length
      ? Number((rows.filter((evaluation) => evaluation.passed).length / rows.length).toFixed(2))
      : null
    const latestScore = latest ? scoreValue(latest.score) : null
    const previousScore = previous ? scoreValue(previous.score) : null
    const direction =
      latestScore === null || previousScore === null
        ? 'unknown'
        : latestScore > previousScore
          ? 'up'
          : latestScore < previousScore
            ? 'down'
            : 'flat'

    return {
      rubric_key: rubric.key,
      rubric_name: rubric.name,
      agent_key: rubric.agent_key,
      workflow_key: rubric.workflow_key,
      latest_score: latestScore,
      average_score: average,
      pass_rate: passRate,
      evaluation_count: rows.length,
      threshold: scoreValue(rubric.threshold),
      latest_evaluated_at: latest?.created_at ?? null,
      direction,
    }
  })

  const needsCoaching = rubricTrends
    .map((trend): AgentQualitySummary['needs_coaching'][number] | null => {
      const latest = (byRubric.get(trend.rubric_key) ?? [])[0]
      const latestScore = trend.latest_score
      const lowLatest = latestScore !== null && latestScore < trend.threshold
      const weakPassRate = trend.pass_rate !== null && trend.pass_rate < 0.8 && trend.evaluation_count >= 2
      if (!lowLatest && !weakPassRate) return null

      return {
        agent_key: trend.agent_key,
        rubric_key: trend.rubric_key,
        rubric_name: trend.rubric_name,
        latest_score: latestScore,
        threshold: trend.threshold,
        reason: lowLatest
          ? `Latest score is below ${trend.threshold.toFixed(2)}.`
          : `Pass rate is ${Math.round((trend.pass_rate ?? 0) * 100)}%.`,
        run_id: latest?.run_id ?? null,
        evaluated_at: latest?.created_at ?? null,
      }
    })
    .filter((item): item is AgentQualitySummary['needs_coaching'][number] => Boolean(item))
    .slice(0, 8)

  return {
    window_hours: windowHours,
    generated_at: new Date().toISOString(),
    rubric_count: activeRubrics.length,
    evaluation_count: evaluations.length,
    average_score: evaluations.length ? Number((totalScore / evaluations.length).toFixed(2)) : null,
    pass_rate: evaluations.length ? Number((passCount / evaluations.length).toFixed(2)) : null,
    by_agent: agentSummaries,
    needs_coaching: needsCoaching,
    rubric_trends: rubricTrends,
  }
}

export async function getAgentQualitySummary(input: {
  agentKey?: string
  windowHours?: number
} = {}): Promise<AgentQualitySummary> {
  const windowHours = input.windowHours ?? 24
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()

  let rubricQuery = db()
    .from('agent_eval_rubrics')
    .select('id, key, agent_key, workflow_key, name, description, dimensions, threshold, active, metadata')
    .eq('active', true)
    .order('agent_key', { ascending: true })

  let evaluationQuery = db()
    .from('agent_run_evaluations')
    .select('id, run_id, rubric_id, rubric_key, agent_key, workflow_key, score, passed, dimension_scores, judge_model, summary, failure_reasons, metadata, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(250)

  if (input.agentKey) {
    rubricQuery = rubricQuery.eq('agent_key', input.agentKey)
    evaluationQuery = evaluationQuery.eq('agent_key', input.agentKey)
  }

  const [rubricRes, evaluationRes] = await Promise.all([rubricQuery, evaluationQuery])
  if (rubricRes.error) throw new Error(`Failed to fetch evaluation rubrics: ${rubricRes.error.message}`)
  if (evaluationRes.error) throw new Error(`Failed to fetch agent evaluations: ${evaluationRes.error.message}`)

  return summarizeAgentQuality({
    rubrics: (rubricRes.data ?? []) as AgentEvalRubricRow[],
    evaluations: (evaluationRes.data ?? []) as AgentRunEvaluationRow[],
    windowHours,
  })
}
