import {
  attachAgentArtifact,
  endAgentRun,
  markAgentRunFailed,
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'
import {
  AI_RISK_SIGNAL_CATEGORIES,
  AI_RISK_SOURCE_PRIORITIES,
  getAiRiskSignalMonitorSummary,
  getAiRiskSourceFeeds,
  type AiRiskSignalCategory,
  type AiRiskSourcePriority,
} from '@/lib/ai-risk-signal-monitor'

export type MoremiRiskSignalMonitorResult = {
  runId: string
  generatedAt: string
  overall: 'ok' | 'warning'
  enabledSourceFeedCount: number
  disabledSourceFeedCount: number
  coverageByCategory: Record<AiRiskSignalCategory, number>
  coverageByPriority: Record<AiRiskSourcePriority, number>
  warnings: string[]
  summaryMarkdown: string
}

function emptyCategoryCoverage() {
  return Object.fromEntries(AI_RISK_SIGNAL_CATEGORIES.map((category) => [category, 0])) as Record<AiRiskSignalCategory, number>
}

function emptyPriorityCoverage() {
  return Object.fromEntries(AI_RISK_SOURCE_PRIORITIES.map((priority) => [priority, 0])) as Record<AiRiskSourcePriority, number>
}

function buildCoverage() {
  const enabledFeeds = getAiRiskSourceFeeds({ enabledOnly: true })
  const allFeeds = getAiRiskSourceFeeds({ enabledOnly: false })
  const coverageByCategory = emptyCategoryCoverage()
  const coverageByPriority = emptyPriorityCoverage()

  for (const feed of enabledFeeds) {
    coverageByPriority[feed.priority] += 1
    for (const category of feed.categories) {
      coverageByCategory[category] += 1
    }
  }

  const disabledFeeds = allFeeds.filter((feed) => !feed.enabled)
  const uncoveredCategories = AI_RISK_SIGNAL_CATEGORIES.filter((category) => coverageByCategory[category] === 0)
  const warnings = [
    ...(enabledFeeds.length === 0 ? ['No approved AI risk source feeds are enabled.'] : []),
    ...uncoveredCategories.map((category) => `No enabled source feed currently covers ${category}.`),
    ...disabledFeeds.map((feed) => `${feed.name} is disabled pending policy approval.`),
  ]

  return {
    allFeeds,
    enabledFeeds,
    disabledFeeds,
    coverageByCategory,
    coverageByPriority,
    warnings,
  }
}

export function buildMoremiRiskSignalMonitorMarkdown(input: {
  generatedAt: string
  overall: 'ok' | 'warning'
  enabledSourceFeedCount: number
  disabledSourceFeedCount: number
  coverageByCategory: Record<AiRiskSignalCategory, number>
  coverageByPriority: Record<AiRiskSourcePriority, number>
  warnings: string[]
  runId?: string
}) {
  const runUrl = input.runId ? `/admin/agents/runs/${input.runId}` : '/admin/agents/runs'
  const categoryLines = AI_RISK_SIGNAL_CATEGORIES.map((category) => `- ${category}: ${input.coverageByCategory[category]} enabled feed(s)`)
  const priorityLines = AI_RISK_SOURCE_PRIORITIES.map((priority) => `- ${priority}: ${input.coverageByPriority[priority]} enabled feed(s)`)

  return [
    '# Moremi AI Risk Signal Monitor',
    '',
    `Generated: ${input.generatedAt}`,
    `Overall: ${input.overall}`,
    `Review: ${runUrl}`,
    '',
    '## Safety Boundary',
    '',
    '- Read-only source-feed coverage review.',
    '- No live external fetch, work-item creation, remediation, production config change, public claim, or client-data access.',
    '- Actionable findings must be converted through the existing explicit confirmation path.',
    '',
    '## Source Feed Coverage',
    '',
    `- Enabled feeds: ${input.enabledSourceFeedCount}`,
    `- Disabled feeds: ${input.disabledSourceFeedCount}`,
    '',
    '### Categories',
    '',
    ...categoryLines,
    '',
    '### Priorities',
    '',
    ...priorityLines,
    '',
    '## Warnings',
    '',
    ...(input.warnings.length ? input.warnings.map((warning) => `- ${warning}`) : ['- None']),
  ].join('\n')
}

export async function runMoremiRiskSignalMonitor(triggerSource = 'cron_moremi_risk_signal_monitor') {
  const generatedAt = new Date().toISOString()
  let runId: string | null = null

  try {
    const monitor = getAiRiskSignalMonitorSummary()
    const coverage = buildCoverage()
    const overall = coverage.warnings.length ? 'warning' : 'ok'

    const run = await startAgentRun({
      agentKey: 'risk-compliance-intelligence',
      runtime: 'manual',
      kind: 'ai_risk_signal_monitor',
      title: 'Run Moremi AI risk signal monitor',
      subject: { type: 'system', id: 'ai-risk-compliance', label: 'AI risk and compliance' },
      triggerSource,
      currentStep: 'Reviewing approved AI risk source feeds',
      metadata: {
        execution_mode: 'scheduled_read_only',
        production_mutation_allowed: false,
        creates_work_items: false,
        live_external_fetch: false,
        client_data_access: false,
        approval_required_for_remediation: true,
        source_feed_count: coverage.allFeeds.length,
      },
      idempotencyKey: `moremi-risk-signal-monitor:${generatedAt.slice(0, 10)}`,
    })
    runId = run.id

    await recordAgentStep({
      runId,
      stepKey: 'source_feed_coverage',
      name: 'Reviewed approved AI risk source feed coverage',
      status: 'completed',
      outputSummary: `Enabled feeds: ${coverage.enabledFeeds.length}; warnings: ${coverage.warnings.length}`,
      metadata: {
        monitor,
        enabled_source_feeds: coverage.enabledFeeds,
        disabled_source_feeds: coverage.disabledFeeds,
        coverage_by_category: coverage.coverageByCategory,
        coverage_by_priority: coverage.coverageByPriority,
        warnings: coverage.warnings,
      },
      idempotencyKey: `${runId}:source-feed-coverage`,
    })

    const summaryMarkdown = buildMoremiRiskSignalMonitorMarkdown({
      generatedAt,
      overall,
      enabledSourceFeedCount: coverage.enabledFeeds.length,
      disabledSourceFeedCount: coverage.disabledFeeds.length,
      coverageByCategory: coverage.coverageByCategory,
      coverageByPriority: coverage.coverageByPriority,
      warnings: coverage.warnings,
      runId,
    })

    await attachAgentArtifact({
      runId,
      artifactType: 'ai_risk_signal_monitor',
      title: `Moremi AI Risk Signal Monitor - ${overall}`,
      refType: 'agent_run',
      refId: runId,
      metadata: {
        summary_markdown: summaryMarkdown,
        source_feeds: coverage.allFeeds,
        coverage_by_category: coverage.coverageByCategory,
        coverage_by_priority: coverage.coverageByPriority,
        warnings: coverage.warnings,
        safety_boundary: monitor.safetyBoundary,
      },
      idempotencyKey: `${runId}:artifact:ai-risk-signal-monitor`,
    })

    await endAgentRun({
      runId,
      status: 'completed',
      currentStep: 'Moremi AI risk signal monitor ready',
      outcome: {
        overall,
        warning_count: coverage.warnings.length,
        enabled_source_feed_count: coverage.enabledFeeds.length,
        disabled_source_feed_count: coverage.disabledFeeds.length,
        generated_at: generatedAt,
        production_mutation_allowed: false,
      },
    })

    return {
      runId,
      generatedAt,
      overall,
      enabledSourceFeedCount: coverage.enabledFeeds.length,
      disabledSourceFeedCount: coverage.disabledFeeds.length,
      coverageByCategory: coverage.coverageByCategory,
      coverageByPriority: coverage.coverageByPriority,
      warnings: coverage.warnings,
      summaryMarkdown,
    } satisfies MoremiRiskSignalMonitorResult
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Moremi AI risk signal monitor failed'
    if (runId) {
      await markAgentRunFailed(runId, message, { trigger_source: triggerSource }).catch(() => {})
    }
    throw error
  }
}
