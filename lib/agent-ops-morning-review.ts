import {
  attachAgentArtifact,
  endAgentRun,
  markAgentRunFailed,
  recordAgentEvent,
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'
import { sweepStaleAgentRuns, type StaleSweepResult } from '@/lib/agent-stale-runs'
import { buildHermesSystemHealthSummary, type HermesSystemHealthSummary } from '@/lib/hermes-system-health'

export type AgentOpsMorningReviewResult = {
  runId: string
  generatedAt: string
  overall: HermesSystemHealthSummary['overall']
  staleSweep: StaleSweepResult
  health: HermesSystemHealthSummary
  slackNotified: boolean
  summaryMarkdown: string
}

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.PORTFOLIO_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://amadutown.com'
  ).replace(/\/$/, '')
}

export function buildAgentOpsMorningReviewMarkdown(input: {
  generatedAt: string
  overall: HermesSystemHealthSummary['overall']
  staleSweep: StaleSweepResult
  health: HermesSystemHealthSummary
  runId?: string
}) {
  const agentOpsUrl = `${baseUrl()}/admin/agents/runs${input.runId ? `/${input.runId}` : ''}`
  const recent = input.health.signals.agentRuns24h

  return [
    '# Agent Ops Morning Review',
    '',
    `Generated: ${input.generatedAt}`,
    `Overall: ${input.overall}`,
    `Review: ${agentOpsUrl}`,
    '',
    '## Run Hygiene',
    '',
    `- Active runs checked: ${input.staleSweep.checked}`,
    `- Runs marked stale: ${input.staleSweep.marked}`,
    '',
    '## Last 24 Hours',
    '',
    `- Agent runs: ${recent.total}`,
    `- Running/queued: ${recent.running}`,
    `- Failed: ${recent.failed}`,
    `- Stale: ${recent.stale}`,
    `- Cost events: ${input.health.signals.costs24h.events}`,
    `- Cost total: $${input.health.signals.costs24h.totalUsd.toFixed(4)}`,
    '',
    '## Warnings',
    '',
    ...(input.health.warnings.length > 0 ? input.health.warnings.map((warning) => `- ${warning}`) : ['- None']),
  ].join('\n')
}

async function notifySlack(summaryMarkdown: string) {
  const webhookUrl = process.env.SLACK_AGENT_OPS_WEBHOOK_URL
  if (!webhookUrl || !webhookUrl.startsWith('https://')) return false

  const text = summaryMarkdown
    .replace(/^# Agent Ops Morning Review/m, '*Agent Ops Morning Review*')
    .replace(/^## /gm, '*')
    .replace(/\n\n/g, '\n')

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!response.ok) {
      console.warn('[agent-ops-morning-review] Slack webhook failed:', response.status)
      return false
    }
    return true
  } catch (error) {
    console.warn(
      '[agent-ops-morning-review] Slack webhook error:',
      error instanceof Error ? error.message : error,
    )
    return false
  }
}

export async function runAgentOpsMorningReview(triggerSource = 'cron_agent_ops_morning_review') {
  const generatedAt = new Date().toISOString()
  let runId: string | null = null

  try {
    const run = await startAgentRun({
      agentKey: 'n8n-automation',
      runtime: 'n8n',
      kind: 'agent_ops_morning_review',
      title: 'Run Agent Ops morning review',
      subject: { type: 'system', id: 'agent-operations', label: 'Agent Operations' },
      triggerSource,
      currentStep: 'Sweeping stale agent runs',
      metadata: {
        execution_mode: 'scheduled_review',
        production_mutation_allowed: true,
        mutation_scope: ['agent_runs', 'agent_run_events', 'agent_run_artifacts'],
        slack_notification_configured: Boolean(process.env.SLACK_AGENT_OPS_WEBHOOK_URL),
      },
      idempotencyKey: `agent-ops-morning-review:${generatedAt.slice(0, 10)}`,
    })
    runId = run.id

    const staleSweep = await sweepStaleAgentRuns()
    await recordAgentStep({
      runId,
      stepKey: 'stale_sweep',
      name: 'Swept stale agent runs',
      status: 'completed',
      outputSummary: `Checked ${staleSweep.checked}; marked ${staleSweep.marked} stale.`,
      metadata: staleSweep,
      idempotencyKey: `${runId}:stale-sweep`,
    })

    const health = await buildHermesSystemHealthSummary()
    await recordAgentStep({
      runId,
      stepKey: 'health_summary',
      name: 'Built Agent Operations health summary',
      status: health.overall === 'error' ? 'failed' : 'completed',
      outputSummary: `Overall: ${health.overall}; warnings: ${health.warnings.length}`,
      metadata: {
        overall: health.overall,
        warnings: health.warnings,
        signals: health.signals,
      },
      idempotencyKey: `${runId}:health-summary`,
    })

    const summaryMarkdown = buildAgentOpsMorningReviewMarkdown({
      generatedAt,
      overall: health.overall,
      staleSweep,
      health,
      runId,
    })

    const slackNotified = await notifySlack(summaryMarkdown)
    await recordAgentEvent({
      runId,
      eventType: slackNotified ? 'slack_notification_sent' : 'slack_notification_skipped',
      severity: 'info',
      message: slackNotified
        ? 'Agent Ops morning review posted to Slack'
        : 'Slack notification skipped or unavailable',
      metadata: { configured: Boolean(process.env.SLACK_AGENT_OPS_WEBHOOK_URL) },
      idempotencyKey: `${runId}:slack-notification`,
    })

    await attachAgentArtifact({
      runId,
      artifactType: 'agent_ops_morning_review',
      title: `Agent Ops Morning Review - ${health.overall}`,
      refType: 'agent_run',
      refId: runId,
      metadata: {
        summary_markdown: summaryMarkdown,
        stale_sweep: staleSweep,
        health_signals: health.signals,
        warnings: health.warnings,
        slack_notified: slackNotified,
      },
      idempotencyKey: `${runId}:artifact:morning-review`,
    })

    await endAgentRun({
      runId,
      status: health.overall === 'error' ? 'failed' : 'completed',
      currentStep: 'Agent Ops morning review ready',
      errorMessage: health.overall === 'error' ? health.warnings[0] ?? 'Agent Ops morning review failed' : null,
      outcome: {
        overall: health.overall,
        warning_count: health.warnings.length,
        stale_marked: staleSweep.marked,
        slack_notified: slackNotified,
        generated_at: generatedAt,
      },
    })

    return {
      runId,
      generatedAt,
      overall: health.overall,
      staleSweep,
      health,
      slackNotified,
      summaryMarkdown,
    } satisfies AgentOpsMorningReviewResult
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent Ops morning review failed'
    if (runId) {
      await markAgentRunFailed(runId, message, { trigger_source: triggerSource }).catch(() => {})
    }
    throw error
  }
}
