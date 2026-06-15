import fs from 'fs'
import path from 'path'
import readline from 'readline'
import type {
  BuildEvidenceCostSummary,
  BuildEvidenceHourlyTranslation,
  BuildEvidenceRepoMetrics,
  BuildEvidenceSourceConfidence,
  BuildEvidenceTokenUsage,
} from './client-build-evidence'

export interface TokenTotals {
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningTokens: number
  totalTokens: number
}

export interface CodexSessionEvidence extends TokenTotals {
  filePath: string
  sessionId: string | null
  cwd: string | null
  firstTimestamp: string | null
  lastTimestamp: string | null
  modelProvider: string | null
  model: string | null
  planType: string | null
  directReversrMention: boolean
  strictWorkspaceMatch: boolean
}

export interface TokenAttributionSummary extends TokenTotals {
  sessionCount: number
  allSessionCount: number
  allTotalTokens: number
  shareOfComparisonWindowPct: number
  sessions: CodexSessionEvidence[]
  supportingMentionCount: number
  modelProvider: string | null
  model: string | null
  planType: string | null
}

export interface MarkBuildEvidenceSnapshot {
  projectLabel: string
  repoMetrics: BuildEvidenceRepoMetrics
  tokenUsage: BuildEvidenceTokenUsage
  costSummary: BuildEvidenceCostSummary
  hourlyTranslation: BuildEvidenceHourlyTranslation
  sourceConfidence: BuildEvidenceSourceConfidence
  clientSafeNotes: string[]
  privateSourceRefs: string[]
}

export interface ExtractReversrTokenUsageOptions {
  sessionsRoot: string
  strictCwdPrefix?: string
  directMentionPattern?: RegExp
}

const DEFAULT_STRICT_CWD_PREFIX = '/Users/vambahsillah/Documents/ReversR'
const DEFAULT_DIRECT_MENTION_PATTERN = /ReversR|ReversR-Rebuild|original-ReversR|Vanguard|Mark Meadows/i

function emptyTotals(): TokenTotals {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
  }
}

function addTotals(target: TokenTotals, source: TokenTotals) {
  target.inputTokens += source.inputTokens
  target.cachedInputTokens += source.cachedInputTokens
  target.outputTokens += source.outputTokens
  target.reasoningTokens += source.reasoningTokens
  target.totalTokens += source.totalTokens
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

async function* walkJsonlFiles(root: string): AsyncGenerator<string> {
  const entries = await fs.promises.readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const filePath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      yield* walkJsonlFiles(filePath)
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      yield filePath
    }
  }
}

export async function parseCodexSessionFile(
  filePath: string,
  options: Omit<ExtractReversrTokenUsageOptions, 'sessionsRoot'> = {}
): Promise<CodexSessionEvidence> {
  const strictCwdPrefix = options.strictCwdPrefix ?? DEFAULT_STRICT_CWD_PREFIX
  const directMentionPattern = options.directMentionPattern ?? DEFAULT_DIRECT_MENTION_PATTERN
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' })
  const reader = readline.createInterface({ input: stream, crlfDelay: Infinity })

  let sessionId: string | null = null
  let cwd: string | null = null
  let modelProvider: string | null = null
  let model: string | null = null
  let planType: string | null = null
  let firstTimestamp: string | null = null
  let lastTimestamp: string | null = null
  let directReversrMention = false
  let totals = emptyTotals()

  for await (const line of reader) {
    if (!directReversrMention && directMentionPattern.test(line)) {
      directReversrMention = true
    }
    if (!line.trim()) continue

    let row: Record<string, unknown>
    try {
      row = JSON.parse(line) as Record<string, unknown>
    } catch {
      continue
    }

    const timestamp = stringValue(row.timestamp)
    if (!firstTimestamp) firstTimestamp = timestamp
    lastTimestamp = timestamp ?? lastTimestamp

    if (row.type === 'session_meta') {
      const payload = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as Record<string, unknown>
      sessionId = stringValue(payload.id) ?? sessionId
      cwd = stringValue(payload.cwd) ?? cwd
      modelProvider = stringValue(payload.model_provider) ?? modelProvider
    }

    if (row.type === 'turn_context') {
      const payload = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as Record<string, unknown>
      model = stringValue(payload.model) ?? model
      cwd = stringValue(payload.cwd) ?? cwd
    }

    if (row.type === 'event_msg') {
      const payload = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as Record<string, unknown>
      if (payload.type === 'token_count') {
        const info = (payload.info && typeof payload.info === 'object' ? payload.info : {}) as Record<string, unknown>
        const usage = (info.total_token_usage && typeof info.total_token_usage === 'object'
          ? info.total_token_usage
          : {}) as Record<string, unknown>
        totals = {
          inputTokens: numberValue(usage.input_tokens),
          cachedInputTokens: numberValue(usage.cached_input_tokens),
          outputTokens: numberValue(usage.output_tokens),
          reasoningTokens: numberValue(usage.reasoning_output_tokens),
          totalTokens: numberValue(usage.total_tokens),
        }
        planType = stringValue(payload.plan_type) ?? planType
        const rateLimits = (payload.rate_limits && typeof payload.rate_limits === 'object'
          ? payload.rate_limits
          : {}) as Record<string, unknown>
        planType = stringValue(rateLimits.plan_type) ?? planType
      }
    }
  }

  return {
    filePath,
    sessionId,
    cwd,
    firstTimestamp,
    lastTimestamp,
    modelProvider,
    model,
    planType,
    directReversrMention,
    strictWorkspaceMatch: cwd?.startsWith(strictCwdPrefix) ?? false,
    ...totals,
  }
}

export async function extractReversrTokenUsage(
  options: ExtractReversrTokenUsageOptions
): Promise<TokenAttributionSummary> {
  const totals = emptyTotals()
  const allTotals = emptyTotals()
  const sessions: CodexSessionEvidence[] = []
  let allSessionCount = 0
  let supportingMentionCount = 0

  for await (const filePath of walkJsonlFiles(options.sessionsRoot)) {
    const session = await parseCodexSessionFile(filePath, options)
    if (session.totalTokens <= 0) continue

    allSessionCount += 1
    addTotals(allTotals, session)

    if (session.strictWorkspaceMatch) {
      sessions.push(session)
      addTotals(totals, session)
    } else if (session.directReversrMention) {
      supportingMentionCount += 1
    }
  }

  const share = allTotals.totalTokens > 0 ? (totals.totalTokens / allTotals.totalTokens) * 100 : 0
  const firstSession = sessions.find((session) => session.modelProvider || session.model || session.planType)

  return {
    ...totals,
    sessionCount: sessions.length,
    allSessionCount,
    allTotalTokens: allTotals.totalTokens,
    shareOfComparisonWindowPct: Math.round(share * 100) / 100,
    sessions,
    supportingMentionCount,
    modelProvider: firstSession?.modelProvider ?? null,
    model: firstSession?.model ?? null,
    planType: firstSession?.planType ?? null,
  }
}

function repoMetricsFromSnapshot(snapshot: Record<string, any>): BuildEvidenceRepoMetrics {
  const gitMetrics = snapshot.gitMetrics ?? {}
  const diff = gitMetrics.rootToHeadDiff ?? {}
  const release = snapshot.releaseStatus ?? {}
  const productEvidence = snapshot.productEvidence ?? {}
  const github = snapshot.github ?? {}

  return {
    repoLabel: github.nameWithOwner ?? 'vsillah/ReversR-Rebuild',
    publicRepoUrl: github.url ?? null,
    capturedAt: snapshot.capturedAt ?? null,
    allBranchCommitCount: gitMetrics.allBranchCommitCount ?? 0,
    headCommitCount: gitMetrics.headCommitCount ?? 0,
    trackedFiles: gitMetrics.trackedFilesExcludingBuildAndExpo ?? 0,
    trackedCodeDocConfigFiles: gitMetrics.trackedCodeDocConfigFilesExcludingLockfile ?? 0,
    trackedTextLines: gitMetrics.trackedTextCodeDocLinesExcludingBuildExpoAssetsAndLockfile ?? 0,
    filesChanged: diff.filesChanged ?? 0,
    insertions: diff.insertions ?? 0,
    deletions: diff.deletions ?? 0,
    releasePassCount: release.pass ?? 0,
    releasePendingCount: release.pending ?? 0,
    releasePendingGate: release.remainingPendingGate ?? null,
    workflow: Array.isArray(productEvidence.workflow) ? productEvidence.workflow : [],
  }
}

export async function buildMarkReversrEvidenceSnapshot(input: {
  repoEvidencePath: string
  sessionsRoot: string
  capturedAt?: string
  subscriptionMonthlyCostUsd?: number | null
  apiEquivalentCostUsd?: number | null
}): Promise<MarkBuildEvidenceSnapshot> {
  const snapshot = JSON.parse(await fs.promises.readFile(input.repoEvidencePath, 'utf8')) as Record<string, any>
  const tokenSummary = await extractReversrTokenUsage({ sessionsRoot: input.sessionsRoot })
  const capturedAt = input.capturedAt ?? new Date().toISOString()
  const subscriptionMonthlyCostUsd = input.subscriptionMonthlyCostUsd ?? null
  const subscriptionAllocatedCostUsd =
    subscriptionMonthlyCostUsd == null
      ? null
      : Math.round(subscriptionMonthlyCostUsd * (tokenSummary.shareOfComparisonWindowPct / 100) * 100) / 100

  return {
    projectLabel: 'ReversR Rebuild Product Asset',
    repoMetrics: repoMetricsFromSnapshot(snapshot),
    tokenUsage: {
      attributionMethod: 'strict_reversr_workspace_cwd',
      confidenceLabel: 'Direct ReversR workspace evidence',
      comparisonWindowLabel: 'June 2026 local Codex sessions',
      sessionCount: tokenSummary.sessionCount,
      totalTokens: tokenSummary.totalTokens,
      inputTokens: tokenSummary.inputTokens,
      cachedInputTokens: tokenSummary.cachedInputTokens,
      outputTokens: tokenSummary.outputTokens,
      reasoningTokens: tokenSummary.reasoningTokens,
      shareOfComparisonWindowPct: tokenSummary.shareOfComparisonWindowPct,
      modelProvider: tokenSummary.modelProvider,
      model: tokenSummary.model,
      planType: tokenSummary.planType,
    },
    costSummary: {
      pricingCapturedAt: null,
      pricingSourceLabel: 'Provider/API pricing snapshot not recorded',
      pricingAssumption: 'Observed Codex Pro token usage is shown. Dollar cost requires an admin-entered pricing or subscription spend snapshot.',
      apiEquivalentCostUsd: input.apiEquivalentCostUsd ?? null,
      subscriptionMonthlyCostUsd,
      subscriptionAllocatedCostUsd,
      subscriptionSharePct: tokenSummary.shareOfComparisonWindowPct,
    },
    hourlyTranslation: {
      defaultBenchmarkHourlyRate: 175,
      defaultProposalAmount: 30000,
      focusedHoursLow: 300,
      focusedHoursHigh: 475,
      notes: 'Scenario estimate, not a time sheet.',
    },
    sourceConfidence: {
      label: 'Direct ReversR workspace evidence',
      confidence: 'high',
      sourceSummary: 'Strict attribution includes only Codex sessions whose working directory was the ReversR workspace.',
      excludedSources: [
        `${tokenSummary.supportingMentionCount} broader sessions mention ReversR or Mark but were excluded from client-facing token totals.`,
        'Raw prompts, private strategy notes, local paths, and full session logs stay admin-only.',
      ],
    },
    clientSafeNotes: [
      'Repository and token metrics are supporting evidence, not billing units.',
      'Hourly translation is a comparison lens for evaluating replacement cost and fixed-fee economics.',
      'The final store-console/review gate remains separate from the completed build evidence.',
    ],
    privateSourceRefs: [
      input.repoEvidencePath,
      input.sessionsRoot,
      ...tokenSummary.sessions.map((session) => session.filePath),
    ],
  }
}
