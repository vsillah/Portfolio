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

const GATE_ORDER = new Map<GoalOrchestrationGate, number>(
  GOAL_ORCHESTRATION_PATTERN.map((gate, index) => [gate, index]),
)

function isDone(status: string) {
  return ['ready_for_review', 'ready_for_merge', 'merged', 'deployed'].includes(status)
}

function isTerminal(status: string) {
  return ['merged', 'deployed', 'cancelled'].includes(status)
}

function isGate(value: unknown): value is GoalOrchestrationGate {
  return typeof value === 'string' && GOAL_ORCHESTRATION_PATTERN.includes(value as GoalOrchestrationGate)
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
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

export function inferWorkItemOrchestrationGate(item: GoalOrchestrationWorkItem): GoalOrchestrationGate {
  const metadataGate = item.metadata?.orchestration_gate ?? item.metadata?.current_gate
  if (isGate(metadataGate)) return metadataGate

  const title = item.title
  if (/intake|readiness|scope|frame|acceptance/i.test(title)) return 'readiness_packet'
  if (/research|source|context|evidence|signal|open brain|chronicle|trace|workflow/i.test(title)) return 'research_context_evidence'
  if (/implement|build|draft|design|create|compose|code|handoff/i.test(title)) return 'draft_build'
  if (/qa|quality|risk|governance|review|challenger|compliance|validation/i.test(title)) return 'challenger_qa'
  if (/approval|human|operator/i.test(title)) return 'human_review'
  return 'delegated_work_graph'
}

function gateStatusForWorkItem(item: GoalOrchestrationWorkItem, gate: GoalOrchestrationGate): GoalOrchestrationGateStatus {
  if (item.status === 'blocked') return 'blocked'
  if (item.status === 'ready_for_review' && gate === 'challenger_qa') return 'challenger_pending'
  if (gate === 'research_context_evidence') return 'research_pending'
  if (gate === 'draft_build') return 'drafting'
  if (gate === 'challenger_qa') return 'challenger_pending'
  if (gate === 'human_review') return 'human_review_ready'
  if (gate === 'approved_execution') return 'approved'
  if (gate === 'delegated_work_graph') return 'delegated'
  return 'ready'
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

export function evaluateGoalOrchestration(input: {
  goalType: string
  items: GoalOrchestrationWorkItem[]
  approvalBoundary: string
}) {
  if (input.goalType === 'social_outreach_linkedin_post') {
    return evaluateContentGoalOrchestration(input.items)
  }

  const items = input.items.filter((item) => item.status !== 'cancelled')
  const blocked = items.find((item) => item.status === 'blocked' || Boolean(item.blocker_summary))
  if (blocked) {
    const gate = inferWorkItemOrchestrationGate(blocked)
    return buildGoalOrchestrationPacket({
      goalType: input.goalType,
      currentGate: gate === 'human_review' ? 'repair_loop' : gate,
      gateStatus: 'blocked',
      challengerStatus: gate === 'challenger_qa' ? 'blocked' : 'pending',
      approvalBoundary: 'Human review is blocked until the active blocker is resolved.',
      residualRisksForHuman: [
        firstString(blocked.blocker_summary, blocked.validation_summary, `${blocked.title} is blocked.`) ?? `${blocked.title} is blocked.`,
      ],
    })
  }

  if (!items.length) {
    return buildGoalOrchestrationPacket({
      goalType: input.goalType,
      currentGate: 'delegated_work_graph',
      gateStatus: 'delegated',
      approvalBoundary: input.approvalBoundary,
      residualRisksForHuman: ['No delegated work items are linked to this goal yet.'],
    })
  }

  const challengerItems = items.filter((item) => inferWorkItemOrchestrationGate(item) === 'challenger_qa')
  const challengerFindings = challengerItems.flatMap((item) => [
    ...stringArray(item.metadata?.challenge_findings),
    ...stringArray(item.metadata?.unsupported_claims).map((claim) => `Unsupported claim: ${claim}`),
    ...stringArray(item.metadata?.privacy_flags).map((flag) => `Privacy flag: ${flag}`),
  ])
  const challengerBlocked = challengerItems.some((item) => item.metadata?.challenger_status === 'blocked')
  const challengerNeedsRevision = challengerItems.some((item) => item.metadata?.challenger_status === 'needs_revision') || challengerFindings.length > 0

  if (challengerBlocked || challengerNeedsRevision) {
    return buildGoalOrchestrationPacket({
      goalType: input.goalType,
      currentGate: 'repair_loop',
      gateStatus: challengerBlocked ? 'blocked' : 'needs_revision',
      challengerStatus: challengerBlocked ? 'blocked' : 'needs_revision',
      approvalBoundary: 'Human review is blocked until challenger findings are repaired and re-checked.',
      residualRisksForHuman: challengerFindings.length ? challengerFindings : ['Challenger QA requires revision.'],
    })
  }

  const incomplete = [...items]
    .filter((item) => !isDone(item.status) && !isTerminal(item.status))
    .sort((a, b) => {
      const aGate = inferWorkItemOrchestrationGate(a)
      const bGate = inferWorkItemOrchestrationGate(b)
      return (GATE_ORDER.get(aGate) ?? 0) - (GATE_ORDER.get(bGate) ?? 0)
    })[0]

  if (incomplete) {
    const gate = inferWorkItemOrchestrationGate(incomplete)
    return buildGoalOrchestrationPacket({
      goalType: input.goalType,
      currentGate: gate,
      gateStatus: gateStatusForWorkItem(incomplete, gate),
      challengerStatus: gate === 'challenger_qa' ? 'pending' : 'pending',
      approvalBoundary: input.approvalBoundary,
      residualRisksForHuman: [`${incomplete.title} has not cleared ${gate.replace(/_/g, ' ')}.`],
    })
  }

  const challengerPassed = challengerItems.length === 0 || challengerItems.every((item) => (
    item.metadata?.challenger_status === 'passed' || isDone(item.status)
  ))

  if (challengerPassed) {
    return buildGoalOrchestrationPacket({
      goalType: input.goalType,
      currentGate: 'human_review',
      gateStatus: 'human_review_ready',
      passToHuman: true,
      challengerStatus: 'passed',
      approvalBoundary: input.approvalBoundary,
    })
  }

  return buildGoalOrchestrationPacket({
    goalType: input.goalType,
    currentGate: 'challenger_qa',
    gateStatus: 'challenger_pending',
    challengerStatus: 'pending',
    approvalBoundary: input.approvalBoundary,
    residualRisksForHuman: ['Challenger QA has not passed.'],
  })
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
