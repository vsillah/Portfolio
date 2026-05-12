import { existsSync } from 'fs'
import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { createHash } from 'crypto'

export type RouterExecutionLane = 'local' | 'frontier' | 'hybrid' | 'tool' | 'approval_required'
export type RouterApprovalState = 'approved_policy' | 'shadow_only' | 'approval_required' | 'blocked'

export interface ModelOpsRouterDecision {
  id: string
  recordType: 'router_decision'
  taskClass: string
  selectedRuntime: string
  fallbackRuntime: string | null
  executionLane: RouterExecutionLane
  confidence: number
  evidenceSource: string
  approvalState: RouterApprovalState
  reason: string
  linkedRecordIds: string[]
  sourcePath: string | null
  sourceGeneratedAt: string | null
  fingerprint: string
}

export interface ModelOpsCandidateRecord {
  id: string
  recordType: 'model_ops.candidate'
  model: string
  runtime: 'lm_studio' | 'hermes' | 'frontier_cloud' | 'retrieval' | 'unknown'
  installStatus: 'installed' | 'candidate' | 'partial' | 'unknown'
  benchmarkEligible: boolean
  sourcePath: string | null
  sourceGeneratedAt: string | null
  fingerprint: string
}

export interface ModelOpsBenchmarkResult {
  id: string
  recordType: 'model_ops.benchmark_result'
  task: string
  model: string
  score: number | null
  latencyMs: number | null
  sampleCount: number
  confidenceStatus: string
  sourcePath: string | null
  sourceGeneratedAt: string | null
  routerDecisionIds: string[]
  fingerprint: string
}

export interface ModelOpsRagQualityRun {
  id: string
  recordType: 'model_ops.rag_quality_run'
  name: string
  totalQueries: number
  localSufficient: number
  localPartial: number
  localWeak: number
  localBetter: number
  localSame: number
  localWorse: number
  sourcePath: string | null
  sourceGeneratedAt: string | null
  routerDecisionIds: string[]
  fingerprint: string
}

export interface ModelOpsSwapRequest {
  id: string
  recordType: 'model_ops.swap_request'
  title: string
  approvalState: RouterApprovalState
  sourcePath: string | null
  sourceGeneratedAt: string | null
  routerDecisionIds: string[]
  fingerprint: string
}

export interface CulturalResourceReview {
  id: string
  recordType: 'model_ops.cultural_resource_review'
  recommendation: 'partner' | 'use_dataset' | 'use_model_or_tool' | 'contribute_upstream' | 'watchlist' | 'avoid'
  useMode: string
  rightsPosture: string
  summary: string
  sourcePath: string | null
  sourceGeneratedAt: string | null
  fingerprint: string
}

export interface ModelOpsProjection {
  available: boolean
  generatedAt: string
  projectName: string
  sourceRoot: string
  reason: string | null
  currentLocalDefault: string
  currentFrontierFallback: string
  currentEmbeddingModel: string
  monitor: {
    name: string
    cadence: string
    latestReportPath: string | null
    productionGate: string
  }
  routerDecisions: ModelOpsRouterDecision[]
  candidates: ModelOpsCandidateRecord[]
  benchmarkResults: ModelOpsBenchmarkResult[]
  ragQualityRuns: ModelOpsRagQualityRun[]
  swapRequests: ModelOpsSwapRequest[]
  culturalResourceReviews: CulturalResourceReview[]
}

interface DashboardData {
  projectName?: string
  generatedAt?: string
  replyRuns?: ReplyRun[]
  ragRuns?: RagRun[]
  recommendations?: {
    replyIntentDefault?: string
    ragDefault?: string
    productionGate?: string
  }
  swapRequests?: Array<Record<string, unknown>>
}

interface ReplyRun {
  file?: string
  model?: string
  observedModel?: string
  scored?: number
  correct?: number
  accuracy?: number
  avgLatencyMs?: number
  status?: string
  caveat?: string
}

interface RagRun {
  file?: string
  name?: string
  generatedAt?: string
  totalQueries?: number
  overall?: {
    local?: {
      sufficient?: number
      partial?: number
      weak?: number
    }
    local_better?: number
    local_same?: number
    local_worse?: number
  }
}

const DEFAULT_MODEL_OPS_HOME = '/Users/vambahsillah/Documents/Codex/2026-04-29/hey-can-you-confirm-that-i/model-ops'
const REPO_MODEL_OPS_HOME = path.join(process.cwd(), 'data/model-ops')
const DASHBOARD_DATA_PATH = 'reports/latest-dashboard-data.json'
const CULTURAL_FRAMEWORK_PATH = 'cultural-preservation-resource-evaluation-framework.md'
const SECRETISH_PATTERN =
  /(sk-[A-Za-z0-9_-]{12,}|github_pat_[A-Za-z0-9_]{12,}|[A-Za-z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD)[A-Za-z0-9_]*\s*[:=]\s*["']?[^"'\s,}]+)/gi

export function getModelOpsHome() {
  return process.env.MODEL_OPS_HOME || DEFAULT_MODEL_OPS_HOME
}

export async function getModelOpsProjection(modelOpsHome?: string): Promise<ModelOpsProjection> {
  const generatedAt = new Date().toISOString()
  const requestedHome = modelOpsHome || getModelOpsHome()
  const dashboardPath = path.join(requestedHome, DASHBOARD_DATA_PATH)
  if (process.env.MODEL_OPS_FORCE_REPO_SNAPSHOT === '1' && shouldUseRepoSnapshotFallback(modelOpsHome)) {
    return buildRepoSnapshotProjection(requestedHome, dashboardPath, generatedAt)
  }
  if (!existsSync(dashboardPath)) {
    if (!shouldUseRepoSnapshotFallback(modelOpsHome)) {
      return emptyProjection(requestedHome, generatedAt, `Model Ops dashboard data was not found at ${dashboardPath}.`)
    }
    return buildRepoSnapshotProjection(requestedHome, dashboardPath, generatedAt)
  }

  return buildProjectionFromDashboard(requestedHome, dashboardPath, false, generatedAt)
}

function buildRepoSnapshotProjection(requestedHome: string, requestedDashboardPath: string, generatedAt: string) {
  const fallbackHome = REPO_MODEL_OPS_HOME
  const fallbackDashboardPath = path.join(fallbackHome, DASHBOARD_DATA_PATH)
  if (!existsSync(fallbackDashboardPath)) {
    return emptyProjection(requestedHome, generatedAt, `Model Ops dashboard data was not found at ${requestedDashboardPath}.`)
  }
  return buildProjectionFromDashboard(fallbackHome, fallbackDashboardPath, true, generatedAt)
}

async function buildProjectionFromDashboard(
  modelOpsHome: string,
  dashboardPath: string,
  usingRepoSnapshot: boolean,
  generatedAt: string,
): Promise<ModelOpsProjection> {
  const dashboard = await readDashboardData(dashboardPath)
  const sourceGeneratedAt = dashboard.generatedAt || generatedAt
  const latestReportPath = await findLatestReport(modelOpsHome, 'open-source-model-evaluation-swap-monitor-')
  const bestReplyRun = selectBestReplyRun(dashboard.replyRuns || [])
  const bestRagRun = selectBestRagRun(dashboard.ragRuns || [])
  const currentLocalDefault = bestReplyRun?.model || 'qwen3-4b-instruct-2507'
  const currentFrontierFallback = 'frontier_cloud'
  const currentEmbeddingModel = 'text-embedding-nomic-embed-text-v1.5'

  const benchmarkResults = buildBenchmarkResults(dashboard.replyRuns || [], modelOpsHome, sourceGeneratedAt)
  const ragQualityRuns = buildRagQualityRuns(dashboard.ragRuns || [], modelOpsHome, sourceGeneratedAt)
  const candidates = buildCandidates(dashboard.replyRuns || [], modelOpsHome, sourceGeneratedAt)
  const routerDecisions = buildRouterDecisions({
    modelOpsHome,
    sourceGeneratedAt,
    currentLocalDefault,
    currentFrontierFallback,
    bestReplyRun,
    bestRagRun,
    benchmarkResults,
    ragQualityRuns,
  })
  const swapRequests = buildSwapRequests(dashboard.swapRequests || [], modelOpsHome, sourceGeneratedAt, routerDecisions)

  return {
    available: true,
    generatedAt: sourceGeneratedAt,
    projectName: dashboard.projectName || 'Local LLM Model Ops & Hermes Automation',
    sourceRoot: modelOpsHome,
    reason: null,
    currentLocalDefault,
    currentFrontierFallback,
    currentEmbeddingModel,
    monitor: {
      name: 'Open Source Model Evaluation and Swap Monitor',
      cadence: usingRepoSnapshot ? 'weekly Monday 8 AM; displayed from repo snapshot fallback' : 'weekly Monday 8 AM',
      latestReportPath,
      productionGate: dashboard.recommendations?.productionGate
        || 'No public production swap should occur without a dated approval packet and explicit approval.',
    },
    routerDecisions,
    candidates,
    benchmarkResults,
    ragQualityRuns,
    swapRequests,
    culturalResourceReviews: buildCulturalResourceReviews(modelOpsHome, sourceGeneratedAt),
  }
}

function shouldUseRepoSnapshotFallback(modelOpsHome?: string) {
  return !modelOpsHome && !process.env.MODEL_OPS_HOME
}

function emptyProjection(modelOpsHome: string, generatedAt: string, reason: string): ModelOpsProjection {
  return {
    available: false,
    generatedAt,
    projectName: 'Local LLM Model Ops & Hermes Automation',
    sourceRoot: modelOpsHome,
    reason,
    currentLocalDefault: 'unknown',
    currentFrontierFallback: 'frontier_cloud',
    currentEmbeddingModel: 'unknown',
    monitor: {
      name: 'Open Source Model Evaluation and Swap Monitor',
      cadence: 'weekly Monday 8 AM',
      latestReportPath: null,
      productionGate: 'Unavailable until Model Ops reports are indexed.',
    },
    routerDecisions: [],
    candidates: [],
    benchmarkResults: [],
    ragQualityRuns: [],
    swapRequests: [],
    culturalResourceReviews: [],
  }
}

async function readDashboardData(filePath: string): Promise<DashboardData> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as DashboardData
  } catch {
    return {}
  }
}

async function findLatestReport(modelOpsHome: string, prefix: string) {
  const reportsDir = path.join(modelOpsHome, 'reports')
  if (!existsSync(reportsDir)) return null
  const files = await readdir(reportsDir)
  const latest = files.filter((file) => file.startsWith(prefix) && file.endsWith('.md')).sort().at(-1)
  return latest ? path.join(reportsDir, latest) : null
}

function buildBenchmarkResults(runs: ReplyRun[], modelOpsHome: string, sourceGeneratedAt: string): ModelOpsBenchmarkResult[] {
  return runs.filter((run) => run.model).map((run) => {
    const sourcePath = run.file ? path.join(modelOpsHome, '..', run.file) : path.join(modelOpsHome, DASHBOARD_DATA_PATH)
    const id = `model_ops.benchmark_result:reply_intent:${slug(run.model || 'unknown')}`
    return {
      id,
      recordType: 'model_ops.benchmark_result',
      task: 'reply_intent',
      model: run.model || 'unknown',
      score: typeof run.accuracy === 'number' ? run.accuracy : null,
      latencyMs: typeof run.avgLatencyMs === 'number' ? run.avgLatencyMs : null,
      sampleCount: run.scored || 0,
      confidenceStatus: run.status || 'unknown',
      sourcePath,
      sourceGeneratedAt,
      routerDecisionIds: ['router_decision:reply_intent_classification'],
      fingerprint: fingerprintOpenBrainRecord(['benchmark_result', run.model, run.accuracy, run.avgLatencyMs, run.scored, sourceGeneratedAt]),
    }
  })
}

function buildRagQualityRuns(runs: RagRun[], modelOpsHome: string, sourceGeneratedAt: string): ModelOpsRagQualityRun[] {
  return runs.filter((run) => run.name).map((run) => {
    const sourcePath = run.file ? path.join(modelOpsHome, '..', run.file) : path.join(modelOpsHome, DASHBOARD_DATA_PATH)
    const id = `model_ops.rag_quality_run:${slug(run.name || 'unknown')}`
    const local = run.overall?.local || {}
    return {
      id,
      recordType: 'model_ops.rag_quality_run',
      name: run.name || 'unknown',
      totalQueries: run.totalQueries || 0,
      localSufficient: local.sufficient || 0,
      localPartial: local.partial || 0,
      localWeak: local.weak || 0,
      localBetter: run.overall?.local_better || 0,
      localSame: run.overall?.local_same || 0,
      localWorse: run.overall?.local_worse || 0,
      sourcePath,
      sourceGeneratedAt: run.generatedAt || sourceGeneratedAt,
      routerDecisionIds: ['router_decision:portfolio_rag_retrieval'],
      fingerprint: fingerprintOpenBrainRecord(['rag_quality', run.name, run.totalQueries, JSON.stringify(run.overall), sourceGeneratedAt]),
    }
  })
}

function buildCandidates(runs: ReplyRun[], modelOpsHome: string, sourceGeneratedAt: string): ModelOpsCandidateRecord[] {
  const candidates = new Map<string, ModelOpsCandidateRecord>()
  for (const run of runs) {
    if (!run.model) continue
    candidates.set(run.model, {
      id: `model_ops.candidate:${slug(run.model)}`,
      recordType: 'model_ops.candidate',
      model: run.model,
      runtime: 'lm_studio',
      installStatus: 'installed',
      benchmarkEligible: true,
      sourcePath: run.file ? path.join(modelOpsHome, '..', run.file) : path.join(modelOpsHome, DASHBOARD_DATA_PATH),
      sourceGeneratedAt,
      fingerprint: fingerprintOpenBrainRecord(['candidate', run.model, run.status, sourceGeneratedAt]),
    })
  }
  for (const model of ['frontier_cloud', 'Pinecone/OpenAI fallback']) {
    candidates.set(model, {
      id: `model_ops.candidate:${slug(model)}`,
      recordType: 'model_ops.candidate',
      model,
      runtime: model === 'frontier_cloud' ? 'frontier_cloud' : 'retrieval',
      installStatus: 'unknown',
      benchmarkEligible: false,
      sourcePath: path.join(modelOpsHome, DASHBOARD_DATA_PATH),
      sourceGeneratedAt,
      fingerprint: fingerprintOpenBrainRecord(['candidate', model, sourceGeneratedAt]),
    })
  }
  return [...candidates.values()]
}

function buildRouterDecisions(input: {
  modelOpsHome: string
  sourceGeneratedAt: string
  currentLocalDefault: string
  currentFrontierFallback: string
  bestReplyRun: ReplyRun | null
  bestRagRun: RagRun | null
  benchmarkResults: ModelOpsBenchmarkResult[]
  ragQualityRuns: ModelOpsRagQualityRun[]
}): ModelOpsRouterDecision[] {
  const benchmarkId = input.benchmarkResults.find((result) => result.model === input.currentLocalDefault)?.id
  const ragId = input.ragQualityRuns.find((run) => run.name === input.bestRagRun?.name)?.id
  const dashboardPath = path.join(input.modelOpsHome, DASHBOARD_DATA_PATH)

  return [
    routerDecision({
      id: 'router_decision:reply_intent_classification',
      taskClass: 'reply_intent_classification',
      selectedRuntime: `local:${input.currentLocalDefault}`,
      fallbackRuntime: input.currentFrontierFallback,
      executionLane: 'local',
      confidence: confidenceFromReplyRun(input.bestReplyRun),
      evidenceSource: `${input.bestReplyRun?.scored || 0} scored reply-intent examples; fixture timing only until reviewed real examples reach the 200-example gate.`,
      approvalState: 'approved_policy',
      reason: 'Low-risk classification can run locally while production-facing behavior remains governed by eval gates.',
      linkedRecordIds: compact([benchmarkId]),
      sourcePath: dashboardPath,
      sourceGeneratedAt: input.sourceGeneratedAt,
    }),
    routerDecision({
      id: 'router_decision:portfolio_rag_retrieval',
      taskClass: 'portfolio_rag_retrieval',
      selectedRuntime: `local:${input.bestRagRun?.name || 'routed local RAG'}`,
      fallbackRuntime: 'Pinecone/OpenAI fallback',
      executionLane: 'hybrid',
      confidence: confidenceFromRagRun(input.bestRagRun),
      evidenceSource: `${input.bestRagRun?.totalQueries || 0} retrieval judgments; answer-level eval is still required before public cutover.`,
      approvalState: 'shadow_only',
      reason: 'Routed local retrieval is promising, but fallback remains required until larger retrieval and answer-level evals pass.',
      linkedRecordIds: compact([ragId]),
      sourcePath: dashboardPath,
      sourceGeneratedAt: input.sourceGeneratedAt,
    }),
    routerDecision({
      id: 'router_decision:local_low_risk_transforms',
      taskClass: 'extraction_scoring_prompt_formatting_retrieval_compression',
      selectedRuntime: `local:${input.currentLocalDefault}`,
      fallbackRuntime: input.currentFrontierFallback,
      executionLane: 'local',
      confidence: 0.74,
      evidenceSource: 'Policy-backed local lane for bounded deterministic transforms; production swap evidence still tracked separately.',
      approvalState: 'approved_policy',
      reason: 'Bounded low-risk transforms are the best first local-model substitution surface.',
      linkedRecordIds: compact([benchmarkId]),
      sourcePath: dashboardPath,
      sourceGeneratedAt: input.sourceGeneratedAt,
    }),
    routerDecision({
      id: 'router_decision:client_facing_drafts',
      taskClass: 'client_facing_drafts_strategy_copy',
      selectedRuntime: input.currentFrontierFallback,
      fallbackRuntime: `local:${input.currentLocalDefault} for private drafts only`,
      executionLane: 'frontier',
      confidence: 0.82,
      evidenceSource: 'Governance policy keeps high-judgment and public/client-facing work on frontier models until local answer-level eval passes.',
      approvalState: 'approved_policy',
      reason: 'Client-facing drafts and strategic copy have higher reputational and reasoning risk than current local eval coverage supports.',
      linkedRecordIds: [],
      sourcePath: dashboardPath,
      sourceGeneratedAt: input.sourceGeneratedAt,
    }),
    routerDecision({
      id: 'router_decision:agent_loops',
      taskClass: 'agent_loops_ambiguous_reasoning',
      selectedRuntime: input.currentFrontierFallback,
      fallbackRuntime: `local:${input.currentLocalDefault} for scoped substeps`,
      executionLane: 'frontier',
      confidence: 0.78,
      evidenceSource: 'No 200-example local harness for ambiguous multi-step agent loops yet.',
      approvalState: 'approved_policy',
      reason: 'Agent loops should keep frontier supervision until local models have task-specific reliability evidence.',
      linkedRecordIds: [],
      sourcePath: dashboardPath,
      sourceGeneratedAt: input.sourceGeneratedAt,
    }),
    routerDecision({
      id: 'router_decision:production_model_swap',
      taskClass: 'production_model_swap',
      selectedRuntime: 'none',
      fallbackRuntime: input.currentFrontierFallback,
      executionLane: 'approval_required',
      confidence: 1,
      evidenceSource: 'Production gate requires dated approval packet under model-ops/swap-requests and explicit approval.',
      approvalState: 'approval_required',
      reason: 'Production-facing defaults cannot change silently from benchmark automation.',
      linkedRecordIds: [],
      sourcePath: dashboardPath,
      sourceGeneratedAt: input.sourceGeneratedAt,
    }),
    routerDecision({
      id: 'router_decision:sensitive_corpus_decisions',
      taskClass: 'sensitive_corpus_cultural_preservation',
      selectedRuntime: 'approval gate',
      fallbackRuntime: 'RAG-only or partner-led review',
      executionLane: 'approval_required',
      confidence: 1,
      evidenceSource: 'Cultural-preservation framework requires rights, consent, and sovereignty review.',
      approvalState: 'approval_required',
      reason: 'Sensitive cultural corpus decisions require stewardship review before ingestion, fine-tuning, or public use.',
      linkedRecordIds: ['model_ops.cultural_resource_review:default-framework'],
      sourcePath: path.join(input.modelOpsHome, CULTURAL_FRAMEWORK_PATH),
      sourceGeneratedAt: input.sourceGeneratedAt,
    }),
  ]
}

function buildSwapRequests(
  requests: Array<Record<string, unknown>>,
  modelOpsHome: string,
  sourceGeneratedAt: string,
  routerDecisions: ModelOpsRouterDecision[],
): ModelOpsSwapRequest[] {
  if (requests.length === 0) return []
  return requests.map((request, index) => {
    const title = String(request.title || request.name || `Swap request ${index + 1}`)
    return {
      id: `model_ops.swap_request:${slug(title)}`,
      recordType: 'model_ops.swap_request',
      title: sanitizeOpenBrainText(title),
      approvalState: 'approval_required',
      sourcePath: path.join(modelOpsHome, 'swap-requests'),
      sourceGeneratedAt,
      routerDecisionIds: routerDecisions.filter((decision) => decision.executionLane === 'approval_required').map((decision) => decision.id),
      fingerprint: fingerprintOpenBrainRecord(['swap_request', title, sourceGeneratedAt]),
    }
  })
}

function buildCulturalResourceReviews(modelOpsHome: string, sourceGeneratedAt: string): CulturalResourceReview[] {
  const sourcePath = path.join(modelOpsHome, CULTURAL_FRAMEWORK_PATH)
  return [
    {
      id: 'model_ops.cultural_resource_review:default-framework',
      recordType: 'model_ops.cultural_resource_review',
      recommendation: 'watchlist',
      useMode: 'Evaluate each resource for partner, dataset, model/tool, upstream contribution, watchlist, or avoid.',
      rightsPosture: 'Approval required before sensitive corpus ingestion, fine-tuning, or production use.',
      summary: 'Default cultural-preservation review framework for books, minority knowledge, underrepresented history, language, and related resources.',
      sourcePath,
      sourceGeneratedAt,
      fingerprint: fingerprintOpenBrainRecord(['cultural_resource_review', sourcePath, sourceGeneratedAt]),
    },
  ]
}

function routerDecision(input: Omit<ModelOpsRouterDecision, 'recordType' | 'fingerprint'>): ModelOpsRouterDecision {
  return {
    ...input,
    recordType: 'router_decision',
    reason: sanitizeOpenBrainText(input.reason),
    evidenceSource: sanitizeOpenBrainText(input.evidenceSource),
    fingerprint: fingerprintOpenBrainRecord([
      input.id,
      input.taskClass,
      input.selectedRuntime,
      input.fallbackRuntime || '',
      input.executionLane,
      input.approvalState,
      input.sourceGeneratedAt || '',
    ]),
  }
}

function selectBestReplyRun(runs: ReplyRun[]) {
  return [...runs].filter((run) => run.model).sort((a, b) => {
    const accuracyDelta = (b.accuracy || 0) - (a.accuracy || 0)
    if (Math.abs(accuracyDelta) > 0.000001) return accuracyDelta
    return (a.avgLatencyMs || Number.MAX_SAFE_INTEGER) - (b.avgLatencyMs || Number.MAX_SAFE_INTEGER)
  })[0] || null
}

function selectBestRagRun(runs: RagRun[]) {
  return [...runs].filter((run) => run.name).sort((a, b) => {
    const aScore = (a.overall?.local_better || 0) - (a.overall?.local_worse || 0)
    const bScore = (b.overall?.local_better || 0) - (b.overall?.local_worse || 0)
    if (bScore !== aScore) return bScore - aScore
    return (b.overall?.local?.sufficient || 0) - (a.overall?.local?.sufficient || 0)
  })[0] || null
}

function confidenceFromReplyRun(run: ReplyRun | null) {
  if (!run) return 0.35
  const accuracy = typeof run.accuracy === 'number' ? run.accuracy : 0.5
  const sampleFactor = Math.min(1, (run.scored || 0) / 200)
  const fixturePenalty = run.status === 'fixture_pipeline_timing_only' ? 0.22 : 0
  return clamp(Number((accuracy * sampleFactor - fixturePenalty).toFixed(2)))
}

function confidenceFromRagRun(run: RagRun | null) {
  if (!run) return 0.35
  const total = Math.max(1, run.totalQueries || 0)
  const sufficient = run.overall?.local?.sufficient || 0
  const partial = run.overall?.local?.partial || 0
  const better = run.overall?.local_better || 0
  const worse = run.overall?.local_worse || 0
  const quality = (sufficient + partial * 0.45) / total
  const comparison = (better - worse) / total
  return clamp(Number((quality * 0.7 + Math.max(0, comparison) * 0.3).toFixed(2)))
}

function compact(values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value))
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value))
}

function fingerprintOpenBrainRecord(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part)).join('\u001f')).digest('hex')
}

function sanitizeOpenBrainText(value: string, maxLength = 700) {
  return value.replace(SECRETISH_PATTERN, '[redacted]').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown'
}
