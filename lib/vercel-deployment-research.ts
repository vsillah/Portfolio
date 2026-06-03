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
export type VercelResearchGoalStatus = 'on_track' | 'watch' | 'blocked' | 'unknown'
export type VercelResearchDecisionAction = 'approve' | 'reject' | 'run_another_test' | 'close'

export type VercelResearchDecisionOption = {
  action: VercelResearchDecisionAction
  label: string
  when: string
}

export type VercelResearchDecisionFrame = {
  experiment: string
  objective: string
  successMetric: string
  target: string
  currentRun: string
  distanceFromGoal: string
  goalStatus: VercelResearchGoalStatus
  recommendedAction: VercelResearchDecisionAction
  recommendation: string
  decisionOptions: VercelResearchDecisionOption[]
}

export type VercelResearchExperimentTrace = {
  mode: 'proposal_only' | 'read_only_local' | 'hosted_settings_packet'
  experimentConfig: {
    scope: string
    commands: string[]
    changedFiles: string[]
    changedSettings: string[]
    sideEffectsAllowed: false
  }
  metricGate: {
    metric: string
    target: string
    current: string
    passCondition: string
  }
  resultSummary: {
    status: 'not_run'
    notes: string
    metrics: string[]
  }
  rollbackPath: string
  promotionRecommendation: {
    recommendation: 'hold_for_approval' | 'collect_more_evidence' | 'close'
    reason: string
    nextApprovalRequired: boolean
  }
  forbiddenActions: string[]
}

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
  decisionFrame?: VercelResearchDecisionFrame
  experimentTrace?: VercelResearchExperimentTrace
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

function queueGoalFrame(metric: DeploymentMetric | null, thresholds: DeploymentMetricThresholds): VercelResearchDecisionFrame {
  const queue = metric?.queueSeconds ?? null
  const watchGap = queue === null ? null : queue - thresholds.queueWatchSeconds
  const blockedGap = queue === null ? null : thresholds.queueBlockedSeconds - queue
  const overWatch = watchGap !== null && watchGap > 0
  const overBlocked = blockedGap !== null && blockedGap < 0

  return {
    experiment: 'Queue-pressure review for staging production deployments',
    objective: 'Decide whether repeated staging queue time is an operating issue worth a deeper Vercel settings proposal.',
    successMetric: 'Deployment queue time',
    target: `Stay under the ${formatSeconds(thresholds.queueWatchSeconds)} queue watch threshold and avoid the ${formatSeconds(thresholds.queueBlockedSeconds)} blocked threshold.`,
    currentRun: queue === null
      ? 'No queue timing was available for the current run.'
      : `${metric?.project ?? 'portfolio-staging'}/${metric?.target ?? 'production'} queued for ${formatSeconds(queue)}.`,
    distanceFromGoal: queue === null
      ? 'Unknown until another deployment records queue timing.'
      : overBlocked
        ? `${formatSeconds(Math.abs(blockedGap ?? 0))} beyond the blocked threshold.`
        : overWatch
          ? `${formatSeconds(watchGap)} over the watch goal and ${formatSeconds(Math.max(blockedGap ?? 0, 0))} under the blocked threshold.`
          : `${formatSeconds(Math.abs(watchGap ?? 0))} inside the watch goal.`,
    goalStatus: queue === null ? 'unknown' : overBlocked ? 'blocked' : overWatch ? 'watch' : 'on_track',
    recommendedAction: overWatch ? 'approve' : 'close',
    recommendation: overWatch
      ? 'Approve preparing a settings proposal packet only. Do not change Vercel settings until that separate packet is reviewed.'
      : 'Close this proposal unless the queue finding repeats in a later deployment cycle.',
    decisionOptions: [
      {
        action: 'approve',
        label: 'Approve proposal packet',
        when: 'Use when the queue gap is real enough to justify a scoped settings proposal, without changing settings yet.',
      },
      {
        action: 'run_another_test',
        label: 'Run another deployment watch',
        when: 'Use when the signal may be one noisy deployment and you want another timing sample before approval.',
      },
      {
        action: 'reject',
        label: 'Reject as not worth pursuing',
        when: 'Use when queue time is acceptable or the proposed settings lane is too risky for the current operating need.',
      },
      {
        action: 'close',
        label: 'Close as informational',
        when: 'Use when the run is useful evidence but should not create follow-up work.',
      },
    ],
  }
}

function buildProfileGoalFrame(metric: DeploymentMetric | null, thresholds: DeploymentMetricThresholds): VercelResearchDecisionFrame {
  const build = metric?.buildSeconds ?? null
  const gap = build === null ? null : build - thresholds.buildWatchSeconds
  const overWatch = gap !== null && gap > 0

  return {
    experiment: 'Local build-profile experiment before hosted deployment changes',
    objective: 'Identify whether slow deployments are caused by app compilation, knowledge generation, tests, or asset work before proposing Vercel setting changes.',
    successMetric: 'Build duration and identified bottleneck',
    target: `Keep build time under the ${formatSeconds(thresholds.buildWatchSeconds)} build watch threshold or produce a named bottleneck to investigate.`,
    currentRun: build === null
      ? 'No build timing was available for the current run.'
      : `${metric?.project ?? 'portfolio'}/${metric?.target ?? 'preview'} built in ${formatSeconds(build)}.`,
    distanceFromGoal: build === null
      ? 'Unknown until another deployment records build timing.'
      : overWatch
        ? `${formatSeconds(gap)} over the build watch goal.`
        : `${formatSeconds(Math.abs(gap ?? 0))} inside the build watch goal.`,
    goalStatus: build === null ? 'unknown' : overWatch ? 'watch' : 'on_track',
    recommendedAction: overWatch ? 'approve' : 'run_another_test',
    recommendation: overWatch
      ? 'Approve a read-only build profile to isolate the bottleneck before changing hosted settings.'
      : 'Run another timing sample or close unless build time crosses the watch threshold again.',
    decisionOptions: [
      {
        action: 'approve',
        label: 'Approve read-only profile',
        when: 'Use when build time is above target or repeated enough to justify a scoped local profiling branch.',
      },
      {
        action: 'run_another_test',
        label: 'Collect another timing sample',
        when: 'Use when the latest run is inside target but you want more evidence before closing.',
      },
      {
        action: 'close',
        label: 'Close as healthy',
        when: 'Use when build timing is inside target and no bottleneck needs investigation.',
      },
      {
        action: 'reject',
        label: 'Reject this approach',
        when: 'Use when profiling would add noise or the proposed files are not the right investigation surface.',
      },
    ],
  }
}

function proposal(
  input: Omit<VercelResearchProposal, 'approvalState' | 'experimentTrace'>,
): VercelResearchProposal {
  const draft = { ...input, approvalState: 'not_required' as const }
  const approvalState: VercelResearchApprovalState = requiresVercelProductionConfigApproval(draft)
    ? 'approval_required'
    : 'not_required'
  const proposalWithApproval: Omit<VercelResearchProposal, 'experimentTrace'> = { ...draft, approvalState }
  return {
    ...proposalWithApproval,
    experimentTrace: buildExperimentTrace(proposalWithApproval),
  }
}

function buildExperimentTrace(
  proposal: Omit<VercelResearchProposal, 'experimentTrace'>,
): VercelResearchExperimentTrace {
  const mode = proposal.approvalState === 'approval_required'
    ? 'hosted_settings_packet'
    : proposal.touchedFiles.length > 0
      ? 'read_only_local'
      : 'proposal_only'
  const frame = proposal.decisionFrame
  const nextApprovalRequired = proposal.approvalState === 'approval_required' || proposal.riskLevel !== 'low'
  return {
    mode,
    experimentConfig: {
      scope: mode === 'hosted_settings_packet'
        ? 'Prepare a settings proposal packet only; do not mutate hosted Vercel configuration.'
        : 'Run local/read-only analysis only; do not merge, deploy, or change production configuration.',
      commands: mode === 'hosted_settings_packet'
        ? ['npm run deploy:metrics', 'npm run deploy:research:plan -- --json']
        : ['npm run build:knowledge', 'npm run deploy:metrics', 'npm run deploy:research:plan -- --json'],
      changedFiles: proposal.touchedFiles,
      changedSettings: proposal.touchedSettings,
      sideEffectsAllowed: false,
    },
    metricGate: {
      metric: frame?.successMetric ?? 'Deployment timing and evidence completeness',
      target: frame?.target ?? 'Produce a named metric target before any experiment is approved.',
      current: frame?.currentRun ?? 'No experiment has run yet.',
      passCondition: frame?.goalStatus === 'on_track'
        ? 'Close or collect another sample unless the metric regresses.'
        : 'Human review confirms the proposed next action and required evidence before execution.',
    },
    resultSummary: {
      status: 'not_run',
      notes: 'No experiment was executed by this AutoResearch planner. Results must be recorded after a separate approved run.',
      metrics: proposal.evidence,
    },
    rollbackPath: proposal.rollbackPath,
    promotionRecommendation: {
      recommendation: frame?.recommendedAction === 'close'
        ? 'close'
        : frame?.recommendedAction === 'run_another_test'
          ? 'collect_more_evidence'
          : 'hold_for_approval',
      reason: frame?.recommendation ?? 'No promotion is allowed until a human approves the next scoped research action.',
      nextApprovalRequired,
    },
    forbiddenActions: [
      'execute_experiment_without_approval',
      'merge_branch',
      'deploy_to_production',
      'mutate_hosted_config',
      'write_durable_open_brain_memory',
    ],
  }
}

export function getVercelResearchExperimentTrace(proposal: VercelResearchProposal): VercelResearchExperimentTrace {
  return proposal.experimentTrace ?? buildExperimentTrace(proposal)
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
      decisionFrame: buildProfileGoalFrame(slowestBuild, thresholds),
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
      decisionFrame: queueGoalFrame(slowestTotal, thresholds),
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
    ...plan.proposals.flatMap((item) => {
      const experimentTrace = getVercelResearchExperimentTrace(item)
      return [
        `### ${item.title}`,
        '',
        `- ID: ${item.id}`,
        `- Risk: ${item.riskLevel}`,
        `- Approval: ${item.approvalState}`,
        `- Hypothesis: ${item.hypothesis}`,
        `- Expected impact: ${item.expectedImpact}`,
        ...(item.decisionFrame ? [
          `- Experiment: ${item.decisionFrame.experiment}`,
          `- Objective: ${item.decisionFrame.objective}`,
          `- Goal: ${item.decisionFrame.target}`,
          `- Current run: ${item.decisionFrame.currentRun}`,
          `- Distance from goal: ${item.decisionFrame.distanceFromGoal}`,
          `- Recommendation: ${item.decisionFrame.recommendation}`,
        ] : []),
        `- Experiment mode: ${experimentTrace.mode}`,
        `- Metric gate: ${experimentTrace.metricGate.metric} — ${experimentTrace.metricGate.passCondition}`,
        `- Result summary: ${experimentTrace.resultSummary.status}; ${experimentTrace.resultSummary.notes}`,
        `- Promotion recommendation: ${experimentTrace.promotionRecommendation.recommendation}; ${experimentTrace.promotionRecommendation.reason}`,
        `- Approval question: ${item.approvalQuestion}`,
        `- Rollback: ${item.rollbackPath}`,
        `- Evidence: ${item.evidence.join('; ')}`,
        '',
      ]
    }),
    '## Operating Rules',
    '',
    ...plan.operatingRules.map((rule) => `- ${rule}`),
  ]
  return lines.join('\n')
}
