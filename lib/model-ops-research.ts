import type {
  ModelOpsBenchmarkResult,
  ModelOpsProjection,
  ModelOpsRagQualityRun,
  ModelOpsRouterDecision,
} from './model-ops-open-brain'

export const MODEL_OPS_RESEARCH_APPROVAL_TYPE = 'model_ops_research_proposal'
export const MODEL_OPS_REVIEWED_EXAMPLE_GATE = 200

export type ModelOpsResearchRiskLevel = 'low' | 'medium' | 'high'
export type ModelOpsResearchApprovalState = 'not_required' | 'approval_required'

export type ModelOpsResearchProposal = {
  id: string
  title: string
  hypothesis: string
  expectedImpact: string
  scorecardBaseline: {
    taskClass: string
    selectedRuntime: string
    executionLane: string
    confidence: number | null
    sampleCount: number | null
    qualitySummary: string
  }
  touchedFiles: string[]
  touchedSettings: string[]
  riskLevel: ModelOpsResearchRiskLevel
  approvalState: ModelOpsResearchApprovalState
  approvalQuestion: string
  rollbackPath: string
  evidence: string[]
  nextMetricGate: string
}

export type ModelOpsResearchPlan = {
  generatedAt: string
  approvalType: typeof MODEL_OPS_RESEARCH_APPROVAL_TYPE
  projectName: string
  currentLocalDefault: string
  currentFrontierFallback: string
  proposals: ModelOpsResearchProposal[]
  operatingRules: string[]
}

export type ModelOpsResearchPlanInput = {
  projection: ModelOpsProjection
  generatedAt?: string
}

export function requiresModelOpsApproval(proposal: Pick<ModelOpsResearchProposal, 'touchedSettings'>) {
  return proposal.touchedSettings.some((setting) =>
    /production|hosted|vercel|n8n production|supabase|pinecone|model default|swap|secret|environment variable|provider routing/i.test(setting)
  )
}

export function buildModelOpsResearchPlan(input: ModelOpsResearchPlanInput): ModelOpsResearchPlan {
  const projection = input.projection
  const replyDecision = findDecision(projection, 'reply_intent_classification')
  const ragDecision = findDecision(projection, 'portfolio_rag_retrieval')
  const productionSwapDecision = findDecision(projection, 'production_model_swap')
  const replyBenchmark = bestBenchmark(projection.benchmarkResults, 'reply_intent')
  const bestRag = bestRagRun(projection.ragQualityRuns)
  const proposals = [
    buildReplyIntentProposal(replyDecision, replyBenchmark),
    buildRagExpansionProposal(ragDecision, bestRag),
    buildAnswerLevelEvalProposal(ragDecision, bestRag),
    buildProductionSwapReadinessProposal(productionSwapDecision, projection),
  ].filter((proposal): proposal is ModelOpsResearchProposal => Boolean(proposal))

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    approvalType: MODEL_OPS_RESEARCH_APPROVAL_TYPE,
    projectName: projection.projectName,
    currentLocalDefault: projection.currentLocalDefault,
    currentFrontierFallback: projection.currentFrontierFallback,
    proposals,
    operatingRules: [
      'Model Ops AutoResearch is planning/proposal oriented; it does not install models, change routing, merge, deploy, or mutate production automatically.',
      'Use the benchmark monitor scorecard as the iteration loop: propose the next dataset, harness, or shadow run only when current metrics expose a gap.',
      'Low-risk local eval expansion can proceed on branches or local artifacts; production swaps, hosted routing, n8n production changes, Supabase/Pinecone changes, and secrets remain approval-gated.',
      'Approval authorizes only the next scoped research action; merge and deployment remain Integration Captain gates.',
      'Open Brain records proposal traces and router evidence; durable memory writes still require Open Brain approval.',
    ],
  }
}

export function formatModelOpsResearchPlanMarkdown(plan: ModelOpsResearchPlan) {
  const lines = [
    '# Model Ops AutoResearch Plan',
    '',
    `Generated: ${plan.generatedAt}`,
    `Approval type: ${plan.approvalType}`,
    `Project: ${plan.projectName}`,
    `Local default: ${plan.currentLocalDefault}`,
    `Frontier fallback: ${plan.currentFrontierFallback}`,
    '',
    '## Proposals',
    '',
    ...(
      plan.proposals.length
        ? plan.proposals.flatMap((proposal) => [
          `### ${proposal.title}`,
          '',
          `- ID: ${proposal.id}`,
          `- Risk: ${proposal.riskLevel}`,
          `- Approval: ${proposal.approvalState}`,
          `- Hypothesis: ${proposal.hypothesis}`,
          `- Expected impact: ${proposal.expectedImpact}`,
          `- Metric gate: ${proposal.nextMetricGate}`,
          `- Approval question: ${proposal.approvalQuestion}`,
          `- Rollback: ${proposal.rollbackPath}`,
          `- Evidence: ${proposal.evidence.join('; ')}`,
          '',
        ])
        : ['- No Model Ops AutoResearch proposals are needed from the current scorecard.']
    ),
    '## Operating Rules',
    '',
    ...plan.operatingRules.map((rule) => `- ${rule}`),
  ]
  return lines.join('\n')
}

function buildReplyIntentProposal(
  decision: ModelOpsRouterDecision | null,
  benchmark: ModelOpsBenchmarkResult | null,
) {
  const sampleCount = benchmark?.sampleCount ?? 0
  const status = benchmark?.confidenceStatus ?? 'unknown'
  if (sampleCount >= MODEL_OPS_REVIEWED_EXAMPLE_GATE && status !== 'fixture_pipeline_timing_only') return null

  return proposal({
    id: 'reply-intent-reviewed-example-expansion',
    title: 'Expand reply-intent evals with reviewed real examples',
    hypothesis: 'The local reply-intent lane needs reviewed real examples before fixture-perfect scores can justify broader local routing.',
    expectedImpact: 'Turns the current fast fixture score into production-relevant evidence for the local reply-intent router lane.',
    scorecardBaseline: baseline(decision, {
      sampleCount,
      qualitySummary: `${benchmark?.model ?? 'unknown model'} ${formatPercent(benchmark?.score)} accuracy, ${formatMs(benchmark?.latencyMs)} average latency, status ${status}.`,
    }),
    touchedFiles: [
      'eval-data/reply-intent-review/**',
      'model-ops/reports/latest-dashboard-data.json',
      'data/model-ops/reports/latest-dashboard-data.json',
    ],
    touchedSettings: [],
    riskLevel: 'low',
    approvalQuestion: 'Approve using the next benchmark cycle to prioritize reviewed real reply-intent examples before model promotion?',
    rollbackPath: 'Discard the new eval dataset branch or mark questionable examples as pending review.',
    evidence: [
      `${sampleCount}/${MODEL_OPS_REVIEWED_EXAMPLE_GATE} scored examples are visible in the current benchmark result.`,
      `Current confidence status: ${status}.`,
      decision ? `Router lane: ${decision.executionLane}, approval ${decision.approvalState}, confidence ${formatPercent(decision.confidence)}.` : 'Router decision not found.',
    ],
    nextMetricGate: `${MODEL_OPS_REVIEWED_EXAMPLE_GATE}+ comparable reviewed real examples with no critical regression.`,
  })
}

function buildRagExpansionProposal(
  decision: ModelOpsRouterDecision | null,
  run: ModelOpsRagQualityRun | null,
) {
  const totalQueries = run?.totalQueries ?? 0
  if (totalQueries >= MODEL_OPS_REVIEWED_EXAMPLE_GATE) return null

  return proposal({
    id: 'rag-retrieval-judgment-expansion',
    title: 'Expand RAG retrieval judgments to the 200-query gate',
    hypothesis: 'The routed local RAG lane needs more comparable retrieval judgments before the hybrid lane can lose fallback dependence.',
    expectedImpact: 'Clarifies whether local retrieval is genuinely better than Pinecone/OpenAI fallback across the Portfolio knowledge surface.',
    scorecardBaseline: baseline(decision, {
      sampleCount: totalQueries,
      qualitySummary: run
        ? `${run.name}: sufficient ${run.localSufficient}, partial ${run.localPartial}, weak ${run.localWeak}, better/same/worse ${run.localBetter}/${run.localSame}/${run.localWorse}.`
        : 'No RAG quality run available.',
    }),
    touchedFiles: [
      'rag/**',
      'model-ops/reports/latest-dashboard-data.json',
      'data/model-ops/reports/latest-dashboard-data.json',
    ],
    touchedSettings: [],
    riskLevel: 'low',
    approvalQuestion: 'Approve using the next benchmark cycle to expand RAG retrieval judgments toward 200 comparable queries?',
    rollbackPath: 'Keep the existing hybrid lane with Pinecone/OpenAI fallback and mark disputed judgments as pending.',
    evidence: [
      `${totalQueries}/${MODEL_OPS_REVIEWED_EXAMPLE_GATE} comparable retrieval judgments are visible in the current RAG scorecard.`,
      decision ? `Router lane: ${decision.executionLane}, approval ${decision.approvalState}, confidence ${formatPercent(decision.confidence)}.` : 'Router decision not found.',
    ],
    nextMetricGate: `${MODEL_OPS_REVIEWED_EXAMPLE_GATE}+ retrieval judgments with local_worse rate low enough to preserve fallback safety.`,
  })
}

function buildAnswerLevelEvalProposal(
  decision: ModelOpsRouterDecision | null,
  run: ModelOpsRagQualityRun | null,
) {
  if (decision?.approvalState !== 'shadow_only') return null

  return proposal({
    id: 'answer-level-chatbot-eval-harness',
    title: 'Add answer-level chatbot evals before public local-RAG cutover',
    hypothesis: 'Retrieval quality alone is not enough; answer-level paired outputs should prove whether routed local context improves user-visible chatbot answers.',
    expectedImpact: 'Prevents a retrieval-only scorecard from driving a public chatbot routing decision.',
    scorecardBaseline: baseline(decision, {
      sampleCount: run?.totalQueries ?? null,
      qualitySummary: run
        ? `${run.name} retrieval-only scorecard has ${run.totalQueries} queries; answer-level paired outputs are not yet represented.`
        : 'No retrieval baseline is available.',
    }),
    touchedFiles: [
      'scripts/**chatbot**eval**',
      'model-ops/reports/latest-dashboard-data.json',
      'data/model-ops/reports/latest-dashboard-data.json',
    ],
    touchedSettings: [],
    riskLevel: 'medium',
    approvalQuestion: 'Approve planning the answer-level chatbot eval harness before any public local-RAG cutover?',
    rollbackPath: 'Keep routed local retrieval in shadow/hybrid mode and retain Pinecone/OpenAI fallback.',
    evidence: [
      decision.evidenceSource,
      `Router lane remains ${decision.executionLane} with ${decision.approvalState} approval state.`,
    ],
    nextMetricGate: `${MODEL_OPS_REVIEWED_EXAMPLE_GATE}+ paired answer-level outputs with no critical citation, factuality, or offer-copy regression.`,
  })
}

function buildProductionSwapReadinessProposal(
  decision: ModelOpsRouterDecision | null,
  projection: ModelOpsProjection,
) {
  if (!decision || decision.approvalState !== 'approval_required') return null

  return proposal({
    id: 'production-swap-readiness-packet',
    title: 'Keep production model swaps behind approval packets',
    hypothesis: 'The benchmark monitor should only create production swap packets after metric gates pass, not apply production changes directly.',
    expectedImpact: 'Keeps local model iteration fast while preserving explicit approval for hosted routing and public behavior.',
    scorecardBaseline: baseline(decision, {
      sampleCount: projection.benchmarkResults.reduce((sum, result) => sum + result.sampleCount, 0),
      qualitySummary: `${projection.benchmarkResults.length} benchmark result(s), ${projection.ragQualityRuns.length} RAG run(s), ${projection.swapRequests.length} pending swap request(s).`,
    }),
    touchedFiles: [
      'model-ops/swap-requests/**',
      'data/model-ops/reports/latest-dashboard-data.json',
    ],
    touchedSettings: ['production model default', 'hosted provider routing', 'n8n production workflow routing'],
    riskLevel: 'high',
    approvalQuestion: 'Approve only the preparation of a production swap packet after metric gates pass, without applying the swap?',
    rollbackPath: 'Do not create a swap packet; keep current local/frontier/hybrid routing policy.',
    evidence: [
      decision.evidenceSource,
      decision.reason,
      `Current swap requests indexed: ${projection.swapRequests.length}.`,
    ],
    nextMetricGate: 'Dated swap packet with candidate, incumbent, benchmark table, statistical evidence, known regressions, exact production change, and rollback.',
  })
}

function proposal(input: Omit<ModelOpsResearchProposal, 'approvalState'>): ModelOpsResearchProposal {
  const draft = { ...input, approvalState: 'not_required' as const }
  return {
    ...draft,
    approvalState: requiresModelOpsApproval(draft) ? 'approval_required' : 'not_required',
  }
}

function baseline(
  decision: ModelOpsRouterDecision | null,
  input: Pick<ModelOpsResearchProposal['scorecardBaseline'], 'sampleCount' | 'qualitySummary'>,
): ModelOpsResearchProposal['scorecardBaseline'] {
  return {
    taskClass: decision?.taskClass ?? 'unknown',
    selectedRuntime: decision?.selectedRuntime ?? 'unknown',
    executionLane: decision?.executionLane ?? 'unknown',
    confidence: decision?.confidence ?? null,
    sampleCount: input.sampleCount,
    qualitySummary: input.qualitySummary,
  }
}

function findDecision(projection: ModelOpsProjection, taskClass: string) {
  return projection.routerDecisions.find((decision) => decision.taskClass === taskClass) ?? null
}

function bestBenchmark(results: ModelOpsBenchmarkResult[], task: string) {
  return [...results]
    .filter((result) => result.task === task)
    .sort((a, b) => {
      const scoreDelta = (b.score ?? 0) - (a.score ?? 0)
      if (Math.abs(scoreDelta) > 0.000001) return scoreDelta
      return (a.latencyMs ?? Number.MAX_SAFE_INTEGER) - (b.latencyMs ?? Number.MAX_SAFE_INTEGER)
    })[0] ?? null
}

function bestRagRun(runs: ModelOpsRagQualityRun[]) {
  return [...runs].sort((a, b) => {
    const aScore = a.localBetter - a.localWorse
    const bScore = b.localBetter - b.localWorse
    if (bScore !== aScore) return bScore - aScore
    return b.localSufficient - a.localSufficient
  })[0] ?? null
}

function formatPercent(value: number | null | undefined) {
  return typeof value === 'number' ? `${Math.round(value * 1000) / 10}%` : 'n/a'
}

function formatMs(value: number | null | undefined) {
  return typeof value === 'number' ? `${Math.round(value)}ms` : 'n/a'
}
