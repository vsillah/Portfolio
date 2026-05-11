import {
  DEFAULT_DEPLOYMENT_METRIC_THRESHOLDS,
  collectDeploymentFindings,
  formatSeconds,
  summarizeDeploymentMetrics,
  type DeploymentMetric,
  type DeploymentMetricThresholds,
  type MetricFinding,
  type MetricSummary,
} from './vercel-deployment-metrics'

export const VERCEL_RESEARCH_APPROVAL_TYPE = 'vercel_deployment_research_proposal'

export type VercelResearchRiskLevel = 'low' | 'medium' | 'high'
export type VercelResearchApprovalState = 'not_required' | 'approval_required'

export type VercelResearchProposal = {
  id: string
  title: string
  hypothesis: string
  expectedImpact: string
  scorecardBaseline: {
    project: string
    target: string
    queueSeconds: number | null
    buildSeconds: number | null
    totalSeconds: number | null
  }
  touchedFiles: string[]
  touchedSettings: string[]
  riskLevel: VercelResearchRiskLevel
  approvalState: VercelResearchApprovalState
  approvalQuestion: string
  rollbackPath: string
  evidence: string[]
}

export type VercelResearchPlan = {
  generatedAt: string
  approvalType: typeof VERCEL_RESEARCH_APPROVAL_TYPE
  thresholds: DeploymentMetricThresholds
  summaries: MetricSummary[]
  findings: MetricFinding[]
  proposals: VercelResearchProposal[]
  operatingRules: string[]
}

export type VercelResearchPlanInput = {
  metrics: DeploymentMetric[]
  thresholds?: DeploymentMetricThresholds
  generatedAt?: string
}

export function requiresVercelProductionConfigApproval(proposal: Pick<VercelResearchProposal, 'touchedSettings'>) {
  return proposal.touchedSettings.some((setting) =>
    /vercel project|environment variable|env var|build command|ignored build step|preview deployment|branch protection|domain|log drain|provider integration/i.test(setting)
  )
}

function highestTotalMetric(metrics: DeploymentMetric[]) {
  return [...metrics]
    .filter((metric) => metric.totalSeconds !== null)
    .sort((a, b) => (b.totalSeconds ?? 0) - (a.totalSeconds ?? 0))[0] ?? null
}

function highestBuildMetric(metrics: DeploymentMetric[]) {
  return [...metrics]
    .filter((metric) => metric.buildSeconds !== null)
    .sort((a, b) => (b.buildSeconds ?? 0) - (a.buildSeconds ?? 0))[0] ?? null
}

function metricBaseline(metric: DeploymentMetric | null): VercelResearchProposal['scorecardBaseline'] {
  return {
    project: metric?.project ?? 'portfolio',
    target: metric?.target ?? 'preview',
    queueSeconds: metric?.queueSeconds ?? null,
    buildSeconds: metric?.buildSeconds ?? null,
    totalSeconds: metric?.totalSeconds ?? null,
  }
}

function timingEvidence(metric: DeploymentMetric | null) {
  if (!metric) return ['No deployment metrics were available; establish a baseline before running experiments.']
  return [
    `${metric.project}/${metric.target} ${metric.state}`,
    `queue ${formatSeconds(metric.queueSeconds)}`,
    `build ${formatSeconds(metric.buildSeconds)}`,
    `total ${formatSeconds(metric.totalSeconds)}`,
    `deployment ${metric.url}`,
  ]
}

function proposal(
  input: Omit<VercelResearchProposal, 'approvalState'>,
): VercelResearchProposal {
  const draft = { ...input, approvalState: 'not_required' as const }
  return {
    ...draft,
    approvalState: requiresVercelProductionConfigApproval(draft) ? 'approval_required' : 'not_required',
  }
}

export function buildVercelResearchPlan(input: VercelResearchPlanInput): VercelResearchPlan {
  const thresholds = input.thresholds ?? DEFAULT_DEPLOYMENT_METRIC_THRESHOLDS
  const summaries = summarizeDeploymentMetrics(input.metrics)
  const findings = collectDeploymentFindings(input.metrics, thresholds)
  const slowestTotal = highestTotalMetric(input.metrics)
  const slowestBuild = highestBuildMetric(input.metrics)

  const proposals: VercelResearchProposal[] = [
    proposal({
      id: 'next-build-profile',
      title: 'Profile the Next.js build path before changing deployment settings',
      hypothesis: 'A focused build-profile pass can identify whether build time is coming from app compilation, generated knowledge, tests, or static asset work before any hosted settings are changed.',
      expectedImpact: 'Create a lower-risk experiment queue and avoid guessing at Vercel project settings.',
      scorecardBaseline: metricBaseline(slowestBuild),
      touchedFiles: ['package.json', 'scripts/build-chatbot-knowledge.ts', 'next.config.js'],
      touchedSettings: [],
      riskLevel: 'low',
      approvalQuestion: 'Approve a read-only/local build-profile experiment that does not change production Vercel configuration?',
      rollbackPath: 'Discard the experiment branch if build timing does not improve or the profile adds noisy instrumentation.',
      evidence: timingEvidence(slowestBuild),
    }),
  ]

  if (findings.some((finding) => finding.reason.includes('queue='))) {
    proposals.push(proposal({
      id: 'vercel-queue-config-review',
      title: 'Review Vercel queue pressure before changing project settings',
      hypothesis: 'Queue pressure may be reduced by adjusting preview deployment policy or build concurrency, but those hosted settings are production-adjacent and need explicit approval.',
      expectedImpact: 'Reduce integration-captain waiting time when queue findings repeat across sweeps.',
      scorecardBaseline: metricBaseline(slowestTotal),
      touchedFiles: ['docs/vercel-deployment-runbook.md'],
      touchedSettings: ['Vercel project preview deployment setting', 'Vercel build concurrency or plan setting'],
      riskLevel: 'high',
      approvalQuestion: 'Approve preparing a Vercel project-setting proposal packet without applying any hosted setting yet?',
      rollbackPath: 'Leave current Vercel project settings unchanged and continue using deploy:watch plus deploy:metrics.',
      evidence: findings.filter((finding) => finding.reason.includes('queue=')).map((finding) => `${finding.project}/${finding.target}: ${finding.reason}`),
    }))
  }

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    approvalType: VERCEL_RESEARCH_APPROVAL_TYPE,
    thresholds,
    summaries,
    findings,
    proposals,
    operatingRules: [
      'AutoResearch V1 is planning/proposal oriented; it does not execute experiments automatically.',
      'Approval authorizes only the next scoped research action, not merge or production deployment.',
      'Vercel project settings, env vars, build commands, branch protection, log drains, and provider integrations remain explicit approval gates.',
      'Open Brain may receive approved summaries only; Agent Ops remains the approval and trace surface.',
    ],
  }
}

export function formatVercelResearchPlanMarkdown(plan: VercelResearchPlan) {
  const lines = [
    '# Vercel Deployment AutoResearch Plan',
    '',
    `Generated: ${plan.generatedAt}`,
    `Approval type: ${plan.approvalType}`,
    '',
    '## Timing Summary',
    '',
    ...(
      plan.summaries.length
        ? plan.summaries.map((summary) => `- ${summary.project}/${summary.target}: avg build ${formatSeconds(Math.round(summary.averageBuildSeconds))}, avg total ${formatSeconds(Math.round(summary.averageTotalSeconds))}, max total ${formatSeconds(summary.maxTotalSeconds)}`)
        : ['- No ready deployment timing summaries were available.']
    ),
    '',
    '## Findings',
    '',
    ...(
      plan.findings.length
        ? plan.findings.map((finding) => `- ${finding.severity}: ${finding.project}/${finding.target} ${finding.reason}`)
        : ['- No queue/build timing findings crossed the configured thresholds.']
    ),
    '',
    '## Proposals',
    '',
    ...plan.proposals.flatMap((item) => [
      `### ${item.title}`,
      '',
      `- ID: ${item.id}`,
      `- Risk: ${item.riskLevel}`,
      `- Approval: ${item.approvalState}`,
      `- Hypothesis: ${item.hypothesis}`,
      `- Expected impact: ${item.expectedImpact}`,
      `- Approval question: ${item.approvalQuestion}`,
      `- Rollback: ${item.rollbackPath}`,
      `- Evidence: ${item.evidence.join('; ')}`,
      '',
    ]),
    '## Operating Rules',
    '',
    ...plan.operatingRules.map((rule) => `- ${rule}`),
  ]
  return lines.join('\n')
}
