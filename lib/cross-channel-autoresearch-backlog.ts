import {
  CAMPAIGN_PHASE_LABELS,
  type SocialContentCalendarChannel,
  type SocialContentCampaignPhase,
} from './social-content-calendar'

export const AUTORESEARCH_BACKLOG_CHANNELS = [
  'linkedin',
  'x',
  'youtube',
  'youtube_shorts',
  'instagram',
  'instagram_reels',
  'facebook',
  'tiktok',
  'thumbnail',
  'manual',
] as const

export const AUTORESEARCH_BACKLOG_GATE_ORDER = [
  'source_basis',
  'copy',
  'visual_media',
  'privacy_rights',
  'draft_handoff',
  'final_submission',
  'provider_execution',
  'status_reconciliation',
] as const

export const AUTORESEARCH_BACKLOG_EXTERNAL_ACTIONS = [
  'provider_call',
  'slack_send',
  'cron_activation',
  'migration',
  'publish',
  'schedule',
  'upload',
  'production_mutation',
] as const

export const AUTORESEARCH_BACKLOG_SIDE_EFFECTS = {
  provider_call: false,
  slack_send: false,
  cron_activation: false,
  migration: false,
  publish: false,
  schedule: false,
  upload: false,
  production_mutation: false,
} as const

export type AutoResearchBacklogChannel = (typeof AUTORESEARCH_BACKLOG_CHANNELS)[number]
export type AutoResearchBacklogExternalAction = (typeof AUTORESEARCH_BACKLOG_EXTERNAL_ACTIONS)[number]
export type AutoResearchBacklogGateKey = (typeof AUTORESEARCH_BACKLOG_GATE_ORDER)[number]

export type AutoResearchBacklogStatus =
  | 'research_candidate'
  | 'source_basis_recorded'
  | 'channel_fit_recommended'
  | 'draft_packet_ready'
  | 'human_review_ready'
  | 'approved_for_internal_handoff'
  | 'blocked'
  | 'manual_hold'
  | 'superseded'

export type AutoResearchSourceType =
  | 'public_post'
  | 'public_video'
  | 'public_profile'
  | 'portfolio_proof'
  | 'campaign_packet'
  | 'review_packet'
  | 'manual_note'

export type AutoResearchProvenance = {
  sourceId: string
  sourceType: AutoResearchSourceType
  urlOrPath: string
  capturedAt: string
  visibleSignalBasis?: string
  transferablePattern: string
  internalProofSurface?: string
  confidence: 'low' | 'medium' | 'high'
}

export type AutoResearchSourceDistanceReview = {
  status: 'pending' | 'approved' | 'blocked' | 'manual_review'
  allowedPatternUse: string
  disallowedReuse: string[]
  privacyNotes: string
  rightsNotes: string
  reviewerLane?: 'Amina' | 'Moremi' | 'Nefertiti' | 'Shaka' | 'human'
}

export type AutoResearchRecommendedFormat =
  | 'text_post'
  | 'thread'
  | 'carousel'
  | 'single_image'
  | 'short_form_video'
  | 'long_form_video'
  | 'thumbnail'
  | 'manual_review_packet'

export type AutoResearchVisualNeed = {
  kind: 'thumbnail' | 'b_roll' | 'carousel' | 'screenshot' | 'cover_frame' | 'caption_card' | 'alt_text' | 'none'
  description: string
  sourceAssetPath?: string
  rightsState: 'approved_source' | 'needs_audit' | 'needs_generation_qa' | 'blocked'
}

export type AutoResearchHashtagNeed = {
  strategy: 'linkedin_3_to_5' | 'instagram_3_to_5' | 'x_minimal' | 'youtube_metadata' | 'none'
  candidateTags: string[]
  reviewState: 'draft' | 'approved' | 'blocked'
}

export type AutoResearchChannelVariantRecommendation = {
  channel: AutoResearchBacklogChannel
  recommendedFormat: AutoResearchRecommendedFormat
  channelFit: 'strong' | 'medium' | 'weak' | 'blocked'
  fitReason: string
  hookHypothesis: string
  proofPlacement: string
  ctaRole: 'conversation' | 'save_share' | 'follow' | 'release_url' | 'playlist' | 'consultation' | 'manual_review' | 'none'
  visualNeeds: AutoResearchVisualNeed[]
  hashtagNeeds?: AutoResearchHashtagNeed
  publishWindowHypothesis?: string
  providerBoundary: 'internal_only' | 'provider_setup_required' | 'render_gate_required' | 'upload_gate_required' | 'publish_gate_required'
  manualState?: 'needs_source_review' | 'needs_copy_review' | 'needs_visual_review' | 'needs_final_submit_approval' | 'manual_hold'
}

export type AutoResearchCtaHypothesis = {
  role: AutoResearchChannelVariantRecommendation['ctaRole']
  hypothesis: string
  approvedUrl?: string
  reviewState: 'draft' | 'approved' | 'blocked'
}

export type AutoResearchReleaseLinkage = {
  campaignSlug?: string
  calendarAssetId?: string
  socialContentId?: string
  workItemId?: string
  manualPacketPath?: string
}

export type AutoResearchPostReleaseSignalPlan = {
  directionalWindow: '24_48h'
  decisionWindow: 'seven_day'
  baselineComparison: string
  benchmarkComparison?: string
  visibleSampleBasis: string
  trackedSignals: Array<
    | 'hook_resonance'
    | 'comment_quality'
    | 'saves'
    | 'shares'
    | 'reposts'
    | 'profile_visits'
    | 'watch_time'
    | 'retention'
    | 'thumbnail_ctr'
    | 'hashtag_discovery'
    | 'cta_clicks'
    | 'manual_replies'
  >
}

export type AutoResearchImprovementRecommendation = {
  recommendationState: 'draft' | 'directional_signal' | 'directional_insufficient_sample' | 'decision_grade' | 'blocked'
  reviewWindowUsed: '24_48h' | 'seven_day'
  changeType:
    | 'cta'
    | 'thumbnail'
    | 'hashtags'
    | 'b_roll'
    | 'hook'
    | 'format'
    | 'proof_placement'
    | 'source_placement'
    | 'publish_window'
    | 'target_avatar'
    | 'pause_or_supersede'
  recommendation: string
  evidenceBasis: string
  visibleSampleBasis?: string
  confidence?: 'low' | 'medium' | 'high'
  nextTest?: string
}

export type AutoResearchGateState = {
  key: AutoResearchBacklogGateKey
  state: 'approved' | 'pending' | 'blocked' | 'manual_review'
  note?: string
}

export type CrossChannelAutoResearchBacklogItem = {
  id: string
  title: string
  status: AutoResearchBacklogStatus
  targetAvatar: string
  campaignSlug?: string
  campaignPhase?: SocialContentCampaignPhase
  sourcePacketPaths: string[]
  provenance: AutoResearchProvenance[]
  sourceDistance: AutoResearchSourceDistanceReview
  channelVariants: AutoResearchChannelVariantRecommendation[]
  ctaHypothesis: AutoResearchCtaHypothesis
  releaseLinkage?: AutoResearchReleaseLinkage
  postReleaseSignals?: AutoResearchPostReleaseSignalPlan
  improvementRecommendation?: AutoResearchImprovementRecommendation
  gates: AutoResearchGateState[]
  blockedReason?: string
  nextHumanDecision?: string
}

export type AutoResearchGateProjection = AutoResearchGateState & {
  rawState: AutoResearchGateState['state']
  missingPrerequisite: AutoResearchBacklogGateKey | null
  blockers: string[]
}

export type AutoResearchBacklogProjection = {
  id: string
  title: string
  status: AutoResearchBacklogStatus
  failClosed: boolean
  gates: Record<AutoResearchBacklogGateKey, AutoResearchGateProjection>
  firstBlockedOrPendingGate: AutoResearchBacklogGateKey | null
  canDraftHandoff: boolean
  externalActions: typeof AUTORESEARCH_BACKLOG_SIDE_EFFECTS
  callableExternalActions: []
  blockers: string[]
}

export type AutoResearchImprovementEvaluation = {
  allowed: boolean
  state: AutoResearchImprovementRecommendation['recommendationState'] | 'none'
  canBeDecisionGrade: boolean
  blockers: string[]
}

export type AutoResearchAdminProjection = {
  id: string
  title: string
  status: AutoResearchBacklogStatus
  targetAvatar: string
  campaign: {
    slug?: string
    phase?: SocialContentCampaignPhase
  }
  sourcePacketPaths: string[]
  variants: Array<Pick<AutoResearchChannelVariantRecommendation,
    'channel'
    | 'recommendedFormat'
    | 'channelFit'
    | 'ctaRole'
    | 'providerBoundary'
    | 'manualState'
  > & {
    visualNeeds: string[]
  }>
  gates: AutoResearchBacklogProjection['gates']
  firstBlockedOrPendingGate: AutoResearchBacklogGateKey | null
  learningWindows: {
    directional: '24_48h'
    decision: 'seven_day'
    visibleSampleBasis: string
    trackedSignals: AutoResearchPostReleaseSignalPlan['trackedSignals']
  } | null
  improvement: AutoResearchImprovementEvaluation
  externalActions: typeof AUTORESEARCH_BACKLOG_SIDE_EFFECTS
  callableExternalActions: []
  nextHumanDecision?: string
  blockers: string[]
}

export type AutoResearchOpportunityPriority = 'high' | 'medium' | 'low'

export type AutoResearchContentOpportunity = {
  id: string
  itemId: string
  title: string
  priority: AutoResearchOpportunityPriority
  channel: AutoResearchBacklogChannel
  recommendedFormat: AutoResearchRecommendedFormat
  campaign: {
    slug?: string
    phase?: SocialContentCampaignPhase
  }
  targetAvatarFit: string
  whyNow: string
  nextContentMove: string
  measurementHypothesis: string
  recommendedImprovement: AutoResearchImprovementRecommendation['changeType'] | 'none'
  requiredGate: AutoResearchBacklogGateKey | null
  evidenceBasis: string
  sourceDistanceBoundary: string
  calendarLinkage: AutoResearchReleaseLinkage
  blockedReason?: string
}

export type AutoResearchBacklogReadOnlyResponse = {
  items: AutoResearchAdminProjection[]
  summary: {
    total: number
    readyForInternalHandoff: number
    blockedOrManual: number
    callableExternalActions: 0
  }
  opportunity_summary: {
    total: number
    highPriority: number
    channels: AutoResearchBacklogChannel[]
    requiresHumanGate: number
  }
  opportunities: AutoResearchContentOpportunity[]
  side_effects: typeof AUTORESEARCH_BACKLOG_SIDE_EFFECTS
  callable_external_actions: []
}

function gateState(item: CrossChannelAutoResearchBacklogItem, key: AutoResearchBacklogGateKey) {
  return item.gates.find((gate) => gate.key === key)?.state ?? 'pending'
}

function gateNote(item: CrossChannelAutoResearchBacklogItem, key: AutoResearchBacklogGateKey) {
  return item.gates.find((gate) => gate.key === key)?.note
}

function hasSourceBasis(item: CrossChannelAutoResearchBacklogItem) {
  return item.sourcePacketPaths.length > 0 && item.provenance.length > 0
}

function hasApprovedSourceDistance(item: CrossChannelAutoResearchBacklogItem) {
  return item.sourceDistance.status === 'approved'
    && item.sourceDistance.allowedPatternUse.trim().length > 0
    && item.sourceDistance.disallowedReuse.length > 0
    && item.sourceDistance.privacyNotes.trim().length > 0
    && item.sourceDistance.rightsNotes.trim().length > 0
}

function isFailClosedStatus(status: AutoResearchBacklogStatus) {
  return status === 'blocked' || status === 'manual_hold' || status === 'superseded'
}

function rawGateProjection(
  item: CrossChannelAutoResearchBacklogItem,
  key: AutoResearchBacklogGateKey,
): Omit<AutoResearchGateProjection, 'missingPrerequisite'> {
  const explicitGateState = gateState(item, key)
  const rawState = key === 'source_basis'
    ? explicitGateState === 'blocked' || explicitGateState === 'manual_review'
      ? explicitGateState
      : hasSourceBasis(item) ? 'approved' : explicitGateState === 'approved' ? 'blocked' : explicitGateState
    : explicitGateState
  const blockers: string[] = []
  let state = rawState

  if (key === 'source_basis' && rawState === 'blocked') {
    blockers.push('Source basis is blocked and must be resolved before draft handoff.')
  }

  if (key === 'privacy_rights' && rawState === 'approved' && !hasApprovedSourceDistance(item)) {
    state = 'blocked'
    blockers.push('Source-distance, privacy, and rights review must be approved before draft handoff.')
  }

  if (key === 'draft_handoff' && rawState === 'approved' && !hasApprovedSourceDistance(item)) {
    state = 'blocked'
    blockers.push('Draft handoff requires approved source-distance, privacy, and rights review.')
  }

  if (key === 'provider_execution' && rawState === 'approved') {
    state = 'blocked'
    blockers.push('Provider execution cannot be authorized by the AutoResearch backlog contract.')
  }

  return {
    key,
    state,
    rawState,
    note: gateNote(item, key),
    blockers,
  }
}

export function evaluateAutoResearchImprovementRecommendation(
  recommendation?: AutoResearchImprovementRecommendation | null,
): AutoResearchImprovementEvaluation {
  if (!recommendation) {
    return {
      allowed: true,
      state: 'none',
      canBeDecisionGrade: false,
      blockers: [],
    }
  }

  const blockers: string[] = []
  if (recommendation.reviewWindowUsed === '24_48h' && recommendation.recommendationState === 'decision_grade') {
    blockers.push('24-48 hour directional review cannot produce a decision-grade recommendation.')
  }

  if (recommendation.reviewWindowUsed === 'seven_day' && recommendation.recommendationState === 'decision_grade') {
    if (!recommendation.evidenceBasis.trim()) {
      blockers.push('Seven-day decision-grade recommendation requires an evidence basis.')
    }
    if (!recommendation.visibleSampleBasis?.trim()) {
      blockers.push('Seven-day decision-grade recommendation requires a visible sample basis.')
    }
    if (!recommendation.confidence) {
      blockers.push('Seven-day decision-grade recommendation requires a confidence level.')
    }
  }

  return {
    allowed: blockers.length === 0,
    state: recommendation.recommendationState,
    canBeDecisionGrade: recommendation.reviewWindowUsed === 'seven_day'
      && recommendation.recommendationState === 'decision_grade'
      && blockers.length === 0,
    blockers,
  }
}

export function projectAutoResearchBacklogItem(
  item: CrossChannelAutoResearchBacklogItem,
): AutoResearchBacklogProjection {
  const gates = {} as AutoResearchBacklogProjection['gates']
  const blockers: string[] = []

  for (const key of AUTORESEARCH_BACKLOG_GATE_ORDER) {
    const raw = rawGateProjection(item, key)
    const missingPrerequisite = AUTORESEARCH_BACKLOG_GATE_ORDER
      .slice(0, AUTORESEARCH_BACKLOG_GATE_ORDER.indexOf(key))
      .find((priorKey) => gates[priorKey].state !== 'approved') ?? null
    const gateBlockers = [...raw.blockers]
    let state = raw.state

    if (state === 'approved' && missingPrerequisite) {
      state = 'blocked'
      gateBlockers.push(`Gate ${key} requires ${missingPrerequisite} to be approved first.`)
    }

    gates[key] = {
      ...raw,
      state,
      missingPrerequisite,
      blockers: gateBlockers,
    }

    blockers.push(...gateBlockers)
  }

  const improvement = evaluateAutoResearchImprovementRecommendation(item.improvementRecommendation)
  blockers.push(...improvement.blockers)

  if (isFailClosedStatus(item.status)) {
    blockers.push(`Backlog item status ${item.status} is fail-closed.`)
  }

  const firstBlockedOrPendingGate = AUTORESEARCH_BACKLOG_GATE_ORDER
    .find((key) => gates[key].state !== 'approved') ?? null
  const failClosed = isFailClosedStatus(item.status) || blockers.length > 0

  return {
    id: item.id,
    title: item.title,
    status: item.status,
    failClosed,
    gates,
    firstBlockedOrPendingGate,
    canDraftHandoff: !failClosed && gates.draft_handoff.state === 'approved',
    externalActions: AUTORESEARCH_BACKLOG_SIDE_EFFECTS,
    callableExternalActions: [],
    blockers,
  }
}

export function externalAutoResearchActionPermission(
  _item: CrossChannelAutoResearchBacklogItem,
  action: AutoResearchBacklogExternalAction,
) {
  return {
    action,
    allowed: false as const,
    reason: 'The cross-channel AutoResearch backlog contract is internal-only and exposes no external action executor.',
  }
}

export function callableAutoResearchExternalActions() {
  return [] as []
}

export function buildAutoResearchBacklogAdminProjection(
  items: CrossChannelAutoResearchBacklogItem[],
): AutoResearchAdminProjection[] {
  return items.map((item) => {
    const projection = projectAutoResearchBacklogItem(item)
    return {
      id: item.id,
      title: item.title,
      status: item.status,
      targetAvatar: item.targetAvatar,
      campaign: {
        slug: item.campaignSlug,
        phase: item.campaignPhase,
      },
      sourcePacketPaths: item.sourcePacketPaths,
      variants: item.channelVariants.map((variant) => ({
        channel: variant.channel,
        recommendedFormat: variant.recommendedFormat,
        channelFit: variant.channelFit,
        ctaRole: variant.ctaRole,
        providerBoundary: variant.providerBoundary,
        manualState: variant.manualState,
        visualNeeds: variant.visualNeeds.map((need) => need.kind),
      })),
      gates: projection.gates,
      firstBlockedOrPendingGate: projection.firstBlockedOrPendingGate,
      learningWindows: item.postReleaseSignals
        ? {
          directional: item.postReleaseSignals.directionalWindow,
          decision: item.postReleaseSignals.decisionWindow,
          visibleSampleBasis: item.postReleaseSignals.visibleSampleBasis,
          trackedSignals: item.postReleaseSignals.trackedSignals,
        }
        : null,
      improvement: evaluateAutoResearchImprovementRecommendation(item.improvementRecommendation),
      externalActions: projection.externalActions,
      callableExternalActions: projection.callableExternalActions,
      nextHumanDecision: item.nextHumanDecision,
      blockers: projection.blockers,
    }
  })
}

function channelFitScore(fit: AutoResearchChannelVariantRecommendation['channelFit']) {
  if (fit === 'strong') return 3
  if (fit === 'medium') return 2
  if (fit === 'weak') return 1
  return 0
}

function bestChannelVariant(item: CrossChannelAutoResearchBacklogItem) {
  return [...item.channelVariants]
    .sort((left, right) => channelFitScore(right.channelFit) - channelFitScore(left.channelFit))[0] ?? null
}

function opportunityPriority(
  item: CrossChannelAutoResearchBacklogItem,
  projection: AutoResearchBacklogProjection,
  variant: AutoResearchChannelVariantRecommendation,
): AutoResearchOpportunityPriority {
  if (
    variant.channelFit === 'strong'
    && (projection.firstBlockedOrPendingGate === null || projection.firstBlockedOrPendingGate === 'final_submission')
  ) {
    return 'high'
  }

  if (variant.channelFit === 'blocked' || item.status === 'blocked' || item.status === 'manual_hold') {
    return 'low'
  }

  return 'medium'
}

function opportunityRank(priority: AutoResearchOpportunityPriority) {
  if (priority === 'high') return 3
  if (priority === 'medium') return 2
  return 1
}

function summarizeTrackedSignals(signals: AutoResearchPostReleaseSignalPlan['trackedSignals'] = []) {
  return signals
    .map((signal) => signal.replace(/_/g, ' '))
    .slice(0, 3)
    .join(', ')
}

export function buildAutoResearchContentOpportunities(
  items: CrossChannelAutoResearchBacklogItem[],
): AutoResearchContentOpportunity[] {
  return items
    .flatMap((item) => {
      const projection = projectAutoResearchBacklogItem(item)
      const variant = bestChannelVariant(item)
      if (!variant) return []

      const priority = opportunityPriority(item, projection, variant)
      const evidenceBasis = item.improvementRecommendation?.evidenceBasis
        ?? item.provenance[0]?.visibleSignalBasis
        ?? 'Source packet and campaign calendar linkage.'
      const trackedSignals = summarizeTrackedSignals(item.postReleaseSignals?.trackedSignals)
      const requiredGate = projection.firstBlockedOrPendingGate
      const blockedReason = projection.blockers[0] ?? item.blockedReason

      return [{
        id: `opportunity-${item.id}-${variant.channel}`,
        itemId: item.id,
        title: item.title,
        priority,
        channel: variant.channel,
        recommendedFormat: variant.recommendedFormat,
        campaign: {
          slug: item.campaignSlug,
          phase: item.campaignPhase,
        },
        targetAvatarFit: variant.fitReason || item.targetAvatar,
        whyNow: variant.hookHypothesis,
        nextContentMove: variant.proofPlacement,
        measurementHypothesis: item.improvementRecommendation?.nextTest
          ?? (trackedSignals
            ? `Review ${trackedSignals} across the 24-48 hour and seven-day windows before revising the next release.`
            : 'Collect directional and seven-day signal before changing the next release.'),
        recommendedImprovement: item.improvementRecommendation?.changeType ?? 'none',
        requiredGate,
        evidenceBasis,
        sourceDistanceBoundary: item.sourceDistance.allowedPatternUse,
        calendarLinkage: item.releaseLinkage ?? {},
        blockedReason,
      } satisfies AutoResearchContentOpportunity]
    })
    .sort((left, right) => (
      opportunityRank(right.priority) - opportunityRank(left.priority)
      || left.title.localeCompare(right.title)
    ))
}

export function buildAutoResearchBacklogReadOnlyResponse(
  items: CrossChannelAutoResearchBacklogItem[] = AGENTIFIED_AUTORESEARCH_BACKLOG_FIXTURES,
): AutoResearchBacklogReadOnlyResponse {
  const projectedItems = buildAutoResearchBacklogAdminProjection(items)
  const opportunities = buildAutoResearchContentOpportunities(items)
  return {
    items: projectedItems,
    summary: {
      total: projectedItems.length,
      readyForInternalHandoff: projectedItems.filter((item) => item.status === 'approved_for_internal_handoff').length,
      blockedOrManual: projectedItems.filter((item) => item.firstBlockedOrPendingGate !== null || item.blockers.length > 0).length,
      callableExternalActions: 0,
    },
    opportunity_summary: {
      total: opportunities.length,
      highPriority: opportunities.filter((opportunity) => opportunity.priority === 'high').length,
      channels: [...new Set(opportunities.map((opportunity) => opportunity.channel))],
      requiresHumanGate: opportunities.filter((opportunity) => opportunity.requiredGate !== null).length,
    },
    opportunities,
    side_effects: AUTORESEARCH_BACKLOG_SIDE_EFFECTS,
    callable_external_actions: [],
  }
}

const AGENTIFIED_X_SOURCE_PACKET_PATHS = [
  'docs/content-strategy/agentified-youtube-x-calendar-brief.md',
  'docs/content-strategy/agentified-x-research-evidence-2026-08-05.md',
  'docs/content-strategy/agentified-x-review-packets-2026-08-05.md',
  'agentified/campaign/portfolio-campaign-packet.json',
]

const AGENTIFIED_VIDEO_SOURCE_PACKET_PATHS = [
  'docs/agentic-content-video-scripts/agentified-youtube-amina-research-to-video-packet.md',
  'docs/agentic-content-video-scripts/agentified-youtube-review-package.md',
  'agentified/campaign/portfolio-campaign-packet.json',
]

function approvedTextOnlyGates(): AutoResearchGateState[] {
  return [
    { key: 'source_basis', state: 'approved' },
    { key: 'copy', state: 'approved' },
    { key: 'visual_media', state: 'approved', note: 'Text-only X packet; visual not required.' },
    { key: 'privacy_rights', state: 'approved' },
    { key: 'draft_handoff', state: 'approved' },
    { key: 'final_submission', state: 'pending' },
    { key: 'provider_execution', state: 'pending' },
    { key: 'status_reconciliation', state: 'pending' },
  ]
}

function videoPlanningGates(): AutoResearchGateState[] {
  return [
    { key: 'source_basis', state: 'approved' },
    { key: 'copy', state: 'pending' },
    { key: 'visual_media', state: 'pending' },
    { key: 'privacy_rights', state: 'pending' },
    { key: 'draft_handoff', state: 'pending' },
    { key: 'final_submission', state: 'pending' },
    { key: 'provider_execution', state: 'pending' },
    { key: 'status_reconciliation', state: 'pending' },
  ]
}

function agentifiedXBacklogItem(input: {
  id: string
  assetId: string
  title: string
  phase: SocialContentCampaignPhase
  status?: AutoResearchBacklogStatus
  sourceIds: string[]
  hookHypothesis: string
  proofPlacement: string
  ctaRole: AutoResearchChannelVariantRecommendation['ctaRole']
  fitReason: string
  recommendation: string
  trackedSignals?: AutoResearchPostReleaseSignalPlan['trackedSignals']
}): CrossChannelAutoResearchBacklogItem {
  return {
    id: input.id,
    title: input.title,
    status: input.status ?? 'approved_for_internal_handoff',
    targetAvatar: 'AI product operators, founders, and agent-builder educators who need public language for trust, proof, and governance without turning the campaign into generic AI hype.',
    campaignSlug: 'agentified-trust-scale-2026-07',
    campaignPhase: input.phase,
    sourcePacketPaths: AGENTIFIED_X_SOURCE_PACKET_PATHS,
    provenance: [
      {
        sourceId: input.sourceIds.join(', '),
        sourceType: 'public_post',
        urlOrPath: 'docs/content-strategy/agentified-x-research-evidence-2026-08-05.md#evidence-table',
        capturedAt: '2026-08-05T12:00:00.000Z',
        visibleSignalBasis: 'Public X pattern scan; metrics were directional only.',
        transferablePattern: 'Use public creator examples for hook structure, proof placement, and CTA role only.',
        internalProofSurface: `agentified/campaign/portfolio-campaign-packet.json#${input.assetId.toLowerCase()}`,
        confidence: 'medium',
      },
      {
        sourceId: input.assetId,
        sourceType: 'campaign_packet',
        urlOrPath: 'agentified/campaign/portfolio-campaign-packet.json',
        capturedAt: '2026-08-05T12:00:00.000Z',
        transferablePattern: `${CAMPAIGN_PHASE_LABELS[input.phase]} phase row for the Agentified trust-scale launch.`,
        internalProofSurface: `agentified/campaign/draft-assets.md#${input.assetId.toLowerCase()}`,
        confidence: 'high',
      },
    ],
    sourceDistance: {
      status: 'approved',
      allowedPatternUse: 'Use public creator patterns only for tension, structure, proof placement, and CTA shape.',
      disallowedReuse: ['creator copy', 'catchphrases', 'thread wording', 'private analytics', 'distinctive visual identity'],
      privacyNotes: 'Use Portfolio and Agentified proof only at public-safe abstraction.',
      rightsNotes: 'No external media or proprietary creator assets reused.',
      reviewerLane: 'Moremi',
    },
    channelVariants: [
      {
        channel: 'x',
        recommendedFormat: 'thread',
        channelFit: 'strong',
        fitReason: input.fitReason,
        hookHypothesis: input.hookHypothesis,
        proofPlacement: input.proofPlacement,
        ctaRole: input.ctaRole,
        visualNeeds: [{ kind: 'none', description: 'Text-only X packet approved for source-distance/privacy review.', rightsState: 'approved_source' }],
        hashtagNeeds: { strategy: 'x_minimal', candidateTags: [], reviewState: 'approved' },
        providerBoundary: 'publish_gate_required',
        manualState: 'needs_final_submit_approval',
      },
      {
        channel: 'linkedin',
        recommendedFormat: input.phase === 'proof' ? 'carousel' : 'text_post',
        channelFit: 'medium',
        fitReason: 'Can be expanded into a LinkedIn story, carousel, or proof post after X learning is reviewed.',
        hookHypothesis: input.hookHypothesis,
        proofPlacement: input.proofPlacement,
        ctaRole: input.ctaRole === 'release_url' ? 'release_url' : 'conversation',
        visualNeeds: [{ kind: input.phase === 'proof' ? 'carousel' : 'alt_text', description: 'Use approved AmaduTown/Agentified visual system only if expanded beyond text.', rightsState: 'needs_generation_qa' }],
        hashtagNeeds: {
          strategy: 'linkedin_3_to_5',
          candidateTags: ['#AIProduct', '#ProductManagement', '#AmaduTownAdvisory'],
          reviewState: 'draft',
        },
        providerBoundary: 'internal_only',
      },
    ],
    ctaHypothesis: {
      role: input.ctaRole,
      hypothesis: input.ctaRole === 'release_url'
        ? 'Release CTA can point to /agentified only after final submission approval confirms the page and provider handoff.'
        : 'Conversation CTA should invite operators to name the part of the workflow where trust or proof breaks.',
      approvedUrl: input.ctaRole === 'release_url' ? 'https://amadutown.com/agentified' : undefined,
      reviewState: input.ctaRole === 'release_url' ? 'draft' : 'approved',
    },
    releaseLinkage: {
      campaignSlug: 'agentified-trust-scale-2026-07',
      calendarAssetId: input.assetId,
      manualPacketPath: `docs/content-strategy/agentified-x-review-packets-2026-08-05.md#${input.assetId.toLowerCase()}`,
    },
    postReleaseSignals: {
      directionalWindow: '24_48h',
      decisionWindow: 'seven_day',
      baselineComparison: 'Compare against recent Vambah X/LinkedIn campaign baseline when first-party signal is approved.',
      benchmarkComparison: 'Compare against XEV pattern cohort as directional structure only.',
      visibleSampleBasis: 'Public visible replies, reposts, saves where available, and manual qualitative reply review.',
      trackedSignals: input.trackedSignals ?? ['hook_resonance', 'comment_quality', 'reposts', 'manual_replies'],
    },
    improvementRecommendation: {
      recommendationState: 'directional_signal',
      reviewWindowUsed: '24_48h',
      changeType: input.ctaRole === 'release_url' ? 'cta' : 'hook',
      recommendation: input.recommendation,
      evidenceBasis: 'Early public conversation quality only.',
      visibleSampleBasis: 'Manual public review after 24-48 hours.',
      confidence: 'medium',
      nextTest: 'Seven-day review decides whether to repeat, expand to LinkedIn, revise CTA, or pause the pattern.',
    },
    gates: approvedTextOnlyGates(),
    nextHumanDecision: `Approve or revise ${input.assetId} for final X provider preparation; this does not authorize posting.`,
  }
}

function agentifiedVideoBacklogItem(input: {
  id: string
  assetId: string
  title: string
  phase: SocialContentCampaignPhase
  channel: 'youtube' | 'youtube_shorts' | 'instagram_reels'
  recommendedFormat: AutoResearchRecommendedFormat
  hookHypothesis: string
  proofPlacement: string
  visualNeeds: AutoResearchVisualNeed[]
  improvementChangeType: AutoResearchImprovementRecommendation['changeType']
  recommendation: string
}): CrossChannelAutoResearchBacklogItem {
  return {
    id: input.id,
    title: input.title,
    status: 'channel_fit_recommended',
    targetAvatar: 'Product leaders, overloaded operators, nonprofits, small businesses, and founders who need agentic proof before scale.',
    campaignSlug: 'agentified-trust-scale-2026-07',
    campaignPhase: input.phase,
    sourcePacketPaths: AGENTIFIED_VIDEO_SOURCE_PACKET_PATHS,
    provenance: [
      {
        sourceId: input.assetId,
        sourceType: 'campaign_packet',
        urlOrPath: 'agentified/campaign/portfolio-campaign-packet.json',
        capturedAt: '2026-08-04T12:00:00.000Z',
        transferablePattern: `${CAMPAIGN_PHASE_LABELS[input.phase]} video row from the Agentified YouTube/Amina packet.`,
        internalProofSurface: 'docs/agentic-content-video-scripts/agentified-youtube-amina-research-to-video-packet.md#draft-package-map',
        confidence: 'high',
      },
    ],
    sourceDistance: {
      status: 'manual_review',
      allowedPatternUse: 'Use public video patterns for structure only after Moremi review completes.',
      disallowedReuse: ['creator scripts', 'titles', 'thumbnails', 'visual identity', 'private dashboards without redaction'],
      privacyNotes: 'B-roll must use redacted Portfolio proof surfaces.',
      rightsNotes: 'Thumbnail, avatar, captions, and B-roll assets need visual/privacy approval before render.',
      reviewerLane: 'Amina',
    },
    channelVariants: [
      {
        channel: input.channel,
        recommendedFormat: input.recommendedFormat,
        channelFit: 'strong',
        fitReason: 'The idea benefits from spoken proof, visual reinforcement, and a clear review boundary before provider handoff.',
        hookHypothesis: input.hookHypothesis,
        proofPlacement: input.proofPlacement,
        ctaRole: input.channel === 'youtube' ? 'release_url' : 'follow',
        visualNeeds: input.visualNeeds,
        hashtagNeeds: input.channel === 'youtube' || input.channel === 'youtube_shorts'
          ? { strategy: 'youtube_metadata', candidateTags: ['Agentified', 'AI agents', 'AI governance'], reviewState: 'draft' }
          : { strategy: 'instagram_3_to_5', candidateTags: ['#Agentified', '#AIAgents', '#WorkflowDesign'], reviewState: 'draft' },
        providerBoundary: 'render_gate_required',
        manualState: 'needs_visual_review',
      },
    ],
    ctaHypothesis: {
      role: input.channel === 'youtube' ? 'release_url' : 'follow',
      hypothesis: input.channel === 'youtube'
        ? 'Release URL CTA should appear only after `/agentified` is final and public-safe.'
        : 'Short-form CTA should invite follow/save until the release path is approved.',
      approvedUrl: input.channel === 'youtube' ? 'https://amadutown.com/agentified' : undefined,
      reviewState: 'draft',
    },
    releaseLinkage: {
      campaignSlug: 'agentified-trust-scale-2026-07',
      calendarAssetId: input.assetId,
      manualPacketPath: 'docs/agentic-content-video-scripts/agentified-youtube-amina-research-to-video-packet.md#draft-package-map',
    },
    postReleaseSignals: {
      directionalWindow: '24_48h',
      decisionWindow: 'seven_day',
      baselineComparison: 'Compare against future AmaduTown video baseline after enough first-party signal exists.',
      benchmarkComparison: 'Use public creator pattern scan only as source-distance context.',
      visibleSampleBasis: 'Watch starts, retention, comment quality, thumbnail or cover performance if available, and manual viewer feedback.',
      trackedSignals: ['hook_resonance', 'watch_time', 'retention', 'thumbnail_ctr', 'comment_quality', 'cta_clicks'],
    },
    improvementRecommendation: {
      recommendationState: 'draft',
      reviewWindowUsed: '24_48h',
      changeType: input.improvementChangeType,
      recommendation: input.recommendation,
      evidenceBasis: 'No provider signal yet; recommendation is a pre-release hypothesis from approved research packets.',
      visibleSampleBasis: 'Wait for 24-48 hour visible signal after release.',
      confidence: 'low',
      nextTest: 'After release, compare hook retention and comment quality before revising the next cutdown.',
    },
    gates: videoPlanningGates(),
    nextHumanDecision: `Complete source-distance, visual/privacy, avatar, caption, and render-readiness review for ${input.assetId}.`,
  }
}

export const AGENTIFIED_AUTORESEARCH_BACKLOG_FIXTURES = [
  {
    id: 'autoresearch-agentified-agt-x-01',
    title: 'What breaks first when AI gets faster?',
    status: 'approved_for_internal_handoff',
    targetAvatar: 'AI product operators and agent-builder educators carrying workflow risk after a prototype impresses leadership.',
    campaignSlug: 'agentified-trust-scale-2026-07',
    campaignPhase: 'tease',
    sourcePacketPaths: AGENTIFIED_X_SOURCE_PACKET_PATHS,
    provenance: [
      {
        sourceId: 'XEV-01',
        sourceType: 'public_post',
        urlOrPath: 'docs/content-strategy/agentified-x-research-evidence-2026-08-05.md#evidence-table',
        capturedAt: '2026-08-05T12:00:00.000Z',
        visibleSignalBasis: 'Public X pattern scan; metrics were directional only.',
        transferablePattern: 'Use the demo-to-workflow tension as a structural input.',
        internalProofSurface: 'agentified/campaign/portfolio-campaign-packet.json#AGT-X-01',
        confidence: 'medium',
      },
      {
        sourceId: 'AGT-X-01',
        sourceType: 'campaign_packet',
        urlOrPath: 'agentified/campaign/portfolio-campaign-packet.json',
        capturedAt: '2026-08-05T12:00:00.000Z',
        transferablePattern: 'Tease phase row for speed-versus-trust campaign opening.',
        internalProofSurface: 'agentified/campaign/draft-assets.md#agt-x-01',
        confidence: 'high',
      },
    ],
    sourceDistance: {
      status: 'approved',
      allowedPatternUse: 'Use public creator patterns only for tension, structure, and proof placement.',
      disallowedReuse: ['creator copy', 'catchphrases', 'thread wording', 'private analytics', 'distinctive visual identity'],
      privacyNotes: 'Use Portfolio and Agentified proof only at public-safe abstraction.',
      rightsNotes: 'No external media or proprietary creator assets reused.',
      reviewerLane: 'Moremi',
    },
    channelVariants: [
      {
        channel: 'x',
        recommendedFormat: 'thread',
        channelFit: 'strong',
        fitReason: 'The idea works as a compact tension-first thread tied to Agentified campaign phase `tease`.',
        hookHypothesis: 'AI got faster; the first failure is usually the handoff.',
        proofPlacement: 'Name the receipt path before asking operators where trust breaks.',
        ctaRole: 'conversation',
        visualNeeds: [{ kind: 'none', description: 'Text-only X packet approved for source-distance/privacy review.', rightsState: 'approved_source' }],
        hashtagNeeds: { strategy: 'x_minimal', candidateTags: [], reviewState: 'approved' },
        providerBoundary: 'publish_gate_required',
        manualState: 'needs_final_submit_approval',
      },
      {
        channel: 'linkedin',
        recommendedFormat: 'text_post',
        channelFit: 'medium',
        fitReason: 'Can become a longer story/proof post after X thread learning is reviewed.',
        hookHypothesis: 'The trust problem shows up right after the demo works.',
        proofPlacement: 'Move from concrete operating tension to Agentified receipt principle.',
        ctaRole: 'conversation',
        visualNeeds: [{ kind: 'alt_text', description: 'No visual required unless converted into a carousel.', rightsState: 'approved_source' }],
        hashtagNeeds: {
          strategy: 'linkedin_3_to_5',
          candidateTags: ['#AIProduct', '#ProductManagement', '#AmaduTownAdvisory'],
          reviewState: 'draft',
        },
        providerBoundary: 'internal_only',
      },
    ],
    ctaHypothesis: {
      role: 'conversation',
      hypothesis: 'Conversation CTA should reveal where operators lose trust in agent handoffs.',
      reviewState: 'approved',
    },
    releaseLinkage: {
      campaignSlug: 'agentified-trust-scale-2026-07',
      calendarAssetId: 'AGT-X-01',
      manualPacketPath: 'docs/content-strategy/agentified-x-review-packets-2026-08-05.md#agt-x-01-what-breaks-first-when-ai-gets-faster',
    },
    postReleaseSignals: {
      directionalWindow: '24_48h',
      decisionWindow: 'seven_day',
      baselineComparison: 'Compare against recent Vambah X/LinkedIn campaign baseline when first-party signal is approved.',
      benchmarkComparison: 'Compare against XEV pattern cohort as directional structure only.',
      visibleSampleBasis: 'Public visible replies, reposts, saves where available, and manual qualitative reply review.',
      trackedSignals: ['hook_resonance', 'comment_quality', 'reposts', 'manual_replies'],
    },
    improvementRecommendation: {
      recommendationState: 'directional_signal',
      reviewWindowUsed: '24_48h',
      changeType: 'hook',
      recommendation: 'Keep the speed-versus-trust hook if replies name concrete handoff failures.',
      evidenceBasis: 'Early public conversation quality only.',
      visibleSampleBasis: 'Manual public review after 24-48 hours.',
      confidence: 'medium',
      nextTest: 'Seven-day review decides whether to repeat as LinkedIn proof post.',
    },
    gates: [
      { key: 'source_basis', state: 'approved' },
      { key: 'copy', state: 'approved' },
      { key: 'visual_media', state: 'approved', note: 'Text-only X packet; visual not required.' },
      { key: 'privacy_rights', state: 'approved' },
      { key: 'draft_handoff', state: 'approved' },
      { key: 'final_submission', state: 'pending' },
      { key: 'provider_execution', state: 'pending' },
      { key: 'status_reconciliation', state: 'pending' },
    ],
    nextHumanDecision: 'Approve or revise AGT-X-01 for final X provider preparation; this does not authorize posting.',
  },
  agentifiedXBacklogItem({
    id: 'autoresearch-agentified-agt-x-02',
    assetId: 'AGT-X-02',
    title: 'The operating layer behind AMINA',
    phase: 'teach',
    sourceIds: ['XEV-02', 'XEV-05', 'XEV-06', 'XEV-07'],
    hookHypothesis: 'AMINA is the operating loop around agentic work.',
    proofPlacement: 'Make each AMINA move an operating question: job, source, receipt, boundary, result.',
    ctaRole: 'conversation',
    fitReason: 'Framework threads fit the teach phase because the audience needs a reusable vocabulary before the proof posts.',
    recommendation: 'Keep the five-move AMINA structure if replies show operators can name which layer they are missing.',
    trackedSignals: ['hook_resonance', 'comment_quality', 'saves', 'reposts', 'manual_replies'],
  }),
  agentifiedXBacklogItem({
    id: 'autoresearch-agentified-agt-x-03',
    assetId: 'AGT-X-03',
    title: 'The workbook is the receipt path',
    phase: 'proof',
    sourceIds: ['XEV-03', 'XEV-05'],
    hookHypothesis: 'The workbook is where the argument becomes inspectable.',
    proofPlacement: 'Move from the book/workbook distinction into source, role, boundary, gate, and receipt questions.',
    ctaRole: 'conversation',
    fitReason: 'Proof phase works when the thread names a tangible artifact and asks whether the workflow can show its evidence.',
    recommendation: 'Repeat this proof posture if replies ask for workbook examples, screenshots, or implementation checklists.',
    trackedSignals: ['hook_resonance', 'comment_quality', 'saves', 'shares', 'manual_replies'],
  }),
  agentifiedXBacklogItem({
    id: 'autoresearch-agentified-agt-x-04',
    assetId: 'AGT-X-04',
    title: 'Agentified release thread: build trust before scale',
    phase: 'offer',
    sourceIds: ['XEV-06', 'XEV-08', 'XEV-09', 'XEV-10'],
    hookHypothesis: 'Build trust before scale.',
    proofPlacement: 'Connect the problem, AMINA, workbook proof, and release path without turning the post into an unearned sales page.',
    ctaRole: 'release_url',
    fitReason: 'The offer phase should make the release path clear after the audience has seen tension, framework, and proof.',
    recommendation: 'Use the release CTA only when the page is ready; revise if the thread gets clicks without meaningful replies.',
    trackedSignals: ['hook_resonance', 'comment_quality', 'cta_clicks', 'profile_visits', 'manual_replies'],
  }),
  agentifiedVideoBacklogItem({
    id: 'autoresearch-agentified-agt-short-01',
    assetId: 'AGT-SHORT-01',
    title: 'Agentic work needs an operating system',
    phase: 'teach',
    channel: 'youtube_shorts',
    recommendedFormat: 'short_form_video',
    hookHypothesis: 'Agentic work needs an operating system.',
    proofPlacement: 'Use a short proof cue from Mission Control, approval gate, trace, or receipt labels.',
    visualNeeds: [
      { kind: 'b_roll', description: 'Mission Control, approval gate, trace/receipt labels with private data redacted.', rightsState: 'needs_audit' },
      { kind: 'caption_card', description: 'Safe-area caption card for permissions, receipts, review, gates, and drift.', rightsState: 'needs_generation_qa' },
    ],
    improvementChangeType: 'b_roll',
    recommendation: 'Use real Portfolio proof cuts, not abstract stock motion, because this short is testing whether the operating-system claim feels concrete.',
  }),
  {
    id: 'autoresearch-agentified-agt-yt-ep01',
    title: 'The Receipt Every Agent Needs',
    status: 'channel_fit_recommended',
    targetAvatar: 'Product leaders, overloaded operators, nonprofits, small businesses, and founders who need agentic proof before scale.',
    campaignSlug: 'agentified-trust-scale-2026-07',
    campaignPhase: 'teach',
    sourcePacketPaths: [
      'docs/agentic-content-video-scripts/agentified-youtube-amina-research-to-video-packet.md',
      'docs/agentified-visual-autoresearch.md',
      'agentified/campaign/portfolio-campaign-packet.json',
    ],
    provenance: [
      {
        sourceId: 'AGT-YT-EP01',
        sourceType: 'campaign_packet',
        urlOrPath: 'agentified/campaign/portfolio-campaign-packet.json',
        capturedAt: '2026-08-04T12:00:00.000Z',
        transferablePattern: 'Long-form YouTube proof layer for the Agentified teach phase.',
        internalProofSurface: 'docs/agentic-content-video-scripts/agentified-youtube-amina-research-to-video-packet.md#episode-1-pilot-packet',
        confidence: 'high',
      },
    ],
    sourceDistance: {
      status: 'manual_review',
      allowedPatternUse: 'Use public YouTube patterns for structure only after Moremi review completes.',
      disallowedReuse: ['creator scripts', 'titles', 'thumbnails', 'visual identity', 'private dashboards without redaction'],
      privacyNotes: 'B-roll must use redacted Portfolio proof surfaces.',
      rightsNotes: 'Thumbnail, avatar, and B-roll assets need visual/privacy approval before render.',
      reviewerLane: 'Amina',
    },
    channelVariants: [
      {
        channel: 'youtube',
        recommendedFormat: 'long_form_video',
        channelFit: 'strong',
        fitReason: 'The idea needs a proof walkthrough and can carry B-roll, workbook, and receipt examples.',
        hookHypothesis: 'The first thing I built around agents was the receipt.',
        proofPlacement: 'Show source, tool, handoff, approval, cost, and audit labels before the CTA.',
        ctaRole: 'release_url',
        visualNeeds: [
          { kind: 'b_roll', description: 'Redacted Agent Ops run detail, Mission Control, approval gate, and receipt checklist.', rightsState: 'needs_audit' },
          { kind: 'thumbnail', description: 'Promise-led thumbnail tied to the receipt operating proof.', rightsState: 'needs_generation_qa' },
        ],
        hashtagNeeds: { strategy: 'youtube_metadata', candidateTags: ['Agentified', 'AI agents', 'AI governance'], reviewState: 'draft' },
        providerBoundary: 'render_gate_required',
        manualState: 'needs_visual_review',
      },
    ],
    ctaHypothesis: {
      role: 'release_url',
      hypothesis: 'A release URL CTA should only appear after `/agentified` is final and public-safe.',
      approvedUrl: 'https://amadutown.com/agentified',
      reviewState: 'draft',
    },
    releaseLinkage: {
      campaignSlug: 'agentified-trust-scale-2026-07',
      calendarAssetId: 'AGT-YT-EP01',
      workItemId: '9f9dd8f1-9d19-48ff-bedf-2a5779a44be8',
      manualPacketPath: 'docs/agentic-content-video-scripts/agentified-youtube-amina-research-to-video-packet.md#episode-1-pilot-packet',
    },
    postReleaseSignals: {
      directionalWindow: '24_48h',
      decisionWindow: 'seven_day',
      baselineComparison: 'Compare against future AmaduTown YouTube baseline after a published pilot exists.',
      benchmarkComparison: 'Use YouTube public pattern scan only as source-distance context.',
      visibleSampleBasis: 'Watch starts, retention, comment quality, thumbnail CTR if available, and manual viewer feedback.',
      trackedSignals: ['hook_resonance', 'watch_time', 'retention', 'thumbnail_ctr', 'comment_quality', 'cta_clicks'],
    },
    gates: [
      { key: 'source_basis', state: 'approved' },
      { key: 'copy', state: 'pending' },
      { key: 'visual_media', state: 'pending' },
      { key: 'privacy_rights', state: 'pending' },
      { key: 'draft_handoff', state: 'pending' },
      { key: 'final_submission', state: 'pending' },
      { key: 'provider_execution', state: 'pending' },
      { key: 'status_reconciliation', state: 'pending' },
    ],
    nextHumanDecision: 'Complete source-distance, B-roll/privacy, avatar, thumbnail, and render-readiness review before any YouTube provider packet.',
  },
  agentifiedVideoBacklogItem({
    id: 'autoresearch-agentified-agt-short-02',
    assetId: 'AGT-SHORT-02',
    title: 'What the cover is really showing',
    phase: 'proof',
    channel: 'youtube_shorts',
    recommendedFormat: 'short_form_video',
    hookHypothesis: 'The cover is not decoration. It is the machine.',
    proofPlacement: 'Use the approved cover/workbook visual system as the proof cue, then connect it to SAM, AMINA, and receipts.',
    visualNeeds: [
      { kind: 'cover_frame', description: 'Approved Agentified cover or workbook visual, framed for short-form safe areas.', rightsState: 'needs_audit' },
      { kind: 'caption_card', description: 'Short caption card explaining cover-as-operating-system without internal campaign labels.', rightsState: 'needs_generation_qa' },
    ],
    improvementChangeType: 'thumbnail',
    recommendation: 'Use cover-led motion only if the small-screen frame clearly communicates the receipt/operating-system promise.',
  }),
] satisfies CrossChannelAutoResearchBacklogItem[]

export function channelToCalendarChannel(
  channel: AutoResearchBacklogChannel,
): SocialContentCalendarChannel | null {
  return channel === 'manual' ? null : channel
}
