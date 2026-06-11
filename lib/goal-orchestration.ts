export const GOAL_ORCHESTRATION_VERSION = 'v1_content_v2_ready'

export const GOAL_ORCHESTRATION_PATTERN = [
  'goal_intake',
  'readiness_packet',
  'delegated_work_graph',
  'research_context_evidence',
  'draft_build',
  'challenger_qa',
  'repair_loop',
  'human_review',
  'approved_execution',
] as const

export type GoalOrchestrationGate = (typeof GOAL_ORCHESTRATION_PATTERN)[number]

export type GoalOrchestrationGateStatus =
  | 'ready'
  | 'delegated'
  | 'research_pending'
  | 'drafting'
  | 'challenger_pending'
  | 'needs_revision'
  | 'human_review_ready'
  | 'approved'
  | 'blocked'

export type GoalOrchestrationChallengerStatus = 'pending' | 'needs_revision' | 'passed' | 'blocked'

export type GoalOrchestrationPacket = {
  orchestration_version: typeof GOAL_ORCHESTRATION_VERSION
  goal_type: string
  pattern: readonly GoalOrchestrationGate[]
  current_gate: GoalOrchestrationGate
  gate_status: GoalOrchestrationGateStatus
  pass_to_human: boolean
  challenger_status: GoalOrchestrationChallengerStatus
  residual_risks_for_human: string[]
  approval_boundary: string
}

export type GoalOrchestrationWorkItem = {
  title: string
  status: string
  blocker_summary?: string | null
  validation_summary?: string | null
  metadata?: Record<string, unknown> | null
}

function isDone(status: string) {
  return ['ready_for_review', 'ready_for_merge', 'merged', 'deployed'].includes(status)
}

function hasTask(items: GoalOrchestrationWorkItem[], pattern: RegExp) {
  return items.some((item) => pattern.test(item.title))
}

function taskGroupDone(items: GoalOrchestrationWorkItem[], patterns: RegExp[]) {
  return patterns.every((pattern) => {
    const matches = items.filter((item) => pattern.test(item.title))
    return matches.length > 0 && matches.every((item) => isDone(item.status))
  })
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

export function buildGoalOrchestrationPacket(input: {
  goalType: string
  currentGate?: GoalOrchestrationGate
  gateStatus?: GoalOrchestrationGateStatus
  passToHuman?: boolean
  challengerStatus?: GoalOrchestrationChallengerStatus
  residualRisksForHuman?: string[]
  approvalBoundary: string
}): GoalOrchestrationPacket {
  return {
    orchestration_version: GOAL_ORCHESTRATION_VERSION,
    goal_type: input.goalType,
    pattern: GOAL_ORCHESTRATION_PATTERN,
    current_gate: input.currentGate ?? 'readiness_packet',
    gate_status: input.gateStatus ?? 'ready',
    pass_to_human: input.passToHuman ?? false,
    challenger_status: input.challengerStatus ?? 'pending',
    residual_risks_for_human: input.residualRisksForHuman ?? [],
    approval_boundary: input.approvalBoundary,
  }
}

export function initialContentOrchestrationReview(input: {
  goalType: string
  sourceIds?: string[]
  approvalBoundary: string
}) {
  return {
    ...buildGoalOrchestrationPacket({
      goalType: input.goalType,
      currentGate: 'research_context_evidence',
      gateStatus: 'research_pending',
      challengerStatus: 'pending',
      approvalBoundary: input.approvalBoundary,
    }),
    orchestration_status: 'research_pending',
    approval_status: 'not_ready',
    source_ids: input.sourceIds ?? [],
    unsupported_claims: [],
    source_conflicts: [],
    privacy_flags: [],
    implementation_drift: [],
    required_fixes: [
      'Complete source-backed research/context work.',
      'Run challenger QA before human editorial review.',
      'Keep publishing, scheduling, DMs, sends, provider calls, and production mutation behind separate approval gates.',
    ],
    fixes_applied: [],
    human_review_blocker: 'Human review is blocked until research/context evidence and challenger QA pass.',
  }
}

export function evaluateContentGoalOrchestration(items: GoalOrchestrationWorkItem[]) {
  const researchPatterns = [/industry signal/i, /Open Brain context/i, /Chronicle evidence/i]
  const draftPatterns = [/proof points/i, /LinkedIn post/i, /visual brief/i]
  const challenger = items.find((item) => /QA|governance|challenger/i.test(item.title)) ?? null

  if (!taskGroupDone(items, researchPatterns)) {
    return buildGoalOrchestrationPacket({
      goalType: 'social_outreach_linkedin_post',
      currentGate: 'research_context_evidence',
      gateStatus: 'research_pending',
      approvalBoundary: 'Human review is blocked until research/context evidence is complete.',
      residualRisksForHuman: ['Research/context evidence is incomplete.'],
    })
  }

  if (!taskGroupDone(items, draftPatterns)) {
    return buildGoalOrchestrationPacket({
      goalType: 'social_outreach_linkedin_post',
      currentGate: 'draft_build',
      gateStatus: 'drafting',
      approvalBoundary: 'Human review is blocked until draft/build work is complete.',
      residualRisksForHuman: ['Draft/build work is incomplete.'],
    })
  }

  const challengerMetadata = challenger?.metadata ?? {}
  const challengeFindings = stringArray(challengerMetadata.challenge_findings)
  const unsupportedClaims = stringArray(challengerMetadata.unsupported_claims)
  const privacyFlags = stringArray(challengerMetadata.privacy_flags)
  const challengerStatus = typeof challengerMetadata.challenger_status === 'string'
    ? challengerMetadata.challenger_status
    : null

  if (
    challenger?.status === 'blocked' ||
    challengerStatus === 'needs_revision' ||
    challengerStatus === 'blocked' ||
    challengeFindings.length > 0 ||
    unsupportedClaims.length > 0 ||
    privacyFlags.length > 0
  ) {
    return buildGoalOrchestrationPacket({
      goalType: 'social_outreach_linkedin_post',
      currentGate: 'repair_loop',
      gateStatus: challengerStatus === 'blocked' || challenger?.status === 'blocked' ? 'blocked' : 'needs_revision',
      challengerStatus: challengerStatus === 'blocked' || challenger?.status === 'blocked' ? 'blocked' : 'needs_revision',
      approvalBoundary: 'Human review is blocked until challenger findings are repaired and re-checked.',
      residualRisksForHuman: [
        ...challengeFindings,
        ...unsupportedClaims.map((claim) => `Unsupported claim: ${claim}`),
        ...privacyFlags.map((flag) => `Privacy flag: ${flag}`),
      ],
    })
  }

  if (challenger && isDone(challenger.status) && (challengerStatus === 'passed' || challenger.validation_summary)) {
    return buildGoalOrchestrationPacket({
      goalType: 'social_outreach_linkedin_post',
      currentGate: 'human_review',
      gateStatus: 'human_review_ready',
      passToHuman: true,
      challengerStatus: 'passed',
      approvalBoundary: 'Human review may approve only the next governed content gate; publishing remains separately approved.',
    })
  }

  return buildGoalOrchestrationPacket({
    goalType: 'social_outreach_linkedin_post',
    currentGate: hasTask(items, /QA|governance|challenger/i) ? 'challenger_qa' : 'draft_build',
    gateStatus: 'challenger_pending',
    challengerStatus: 'pending',
    approvalBoundary: 'Human review is blocked until challenger QA is recorded.',
    residualRisksForHuman: ['Challenger QA has not passed.'],
  })
}
