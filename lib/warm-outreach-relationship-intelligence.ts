import { z } from 'zod'

export const warmOutreachChannels = [
  'email',
  'linkedin',
  'facebook',
  'phone_contact',
] as const

export type WarmOutreachChannel = (typeof warmOutreachChannels)[number]

export const warmOutreachTemplateFamilies = [
  'reconnect',
  'follow_up',
  'referral_path',
  'community_bridge',
  'value_first_note',
  'product_relevance',
  'response_follow_up',
] as const

export type WarmOutreachTemplateFamily = (typeof warmOutreachTemplateFamilies)[number]

const sourceRefSchema = z.object({
  sourceType: z.enum([
    'portfolio_contact',
    'contact_communication',
    'outreach_queue',
    'email_message',
    'meeting_record',
    'meeting_action_task',
    'prior_outreach',
    'imported_reply',
    'google_contacts',
    'linkedin',
    'facebook',
    'phone_contact',
    'manual_note',
    'public_profile',
  ]),
  sourceId: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1).max(500),
  privateSource: z.boolean().default(false),
  visibility: z.enum(['public_profile', 'private_summary', 'operator_only']).default('private_summary'),
  sourceStatus: z.enum(['verified', 'manual', 'unverified', 'blocked']).default('verified'),
  safeToMention: z.boolean().default(false),
  avoidInDraftReason: z.string().trim().max(240).optional(),
})

const channelCapabilitySchema = z.object({
  available: z.boolean(),
  providerConfigured: z.boolean().default(false),
  supportsExternalSend: z.boolean().default(false),
  supportsDraftCreation: z.boolean().default(false),
  supportsReplyMonitoring: z.boolean().default(false),
  manualOnly: z.boolean().default(false),
  provider: z.string().trim().max(80).optional(),
  providerAccountLabel: z.string().trim().max(160).optional(),
  reason: z.string().trim().max(240).optional(),
})

const responseMonitoringPlanSchema = z.object({
  enabled: z.boolean().default(false),
  status: z.enum(['not_enabled', 'manual_only', 'provider_gate_required']).default('not_enabled'),
  summary: z.string().trim().min(1).max(500),
  channels: z.array(z.enum(warmOutreachChannels)).default([]),
  humanApprovalRequired: z.literal(true).default(true),
})

export const warmOutreachRelationshipPacketSchema = z.object({
  version: z.literal('warm-outreach-relationship/v1').default('warm-outreach-relationship/v1'),
  contactId: z.union([z.string().trim().min(1), z.number().int().positive()]),
  contactName: z.string().trim().min(1).max(160).optional(),
  objective: z.string().trim().min(1).max(300),
  relationshipBasis: z.string().trim().min(1).max(1000),
  sourceRefs: z.array(sourceRefSchema).min(1),
  relationshipSignals: z.array(z.string().trim().min(1).max(240)).default([]),
  commonalities: z.array(z.string().trim().min(1).max(240)).default([]),
  riskFlags: z.array(z.string().trim().min(1).max(160)).default([]),
  confidence: z.enum(['low', 'medium', 'high']).default('medium'),
  suppression: z.object({
    doNotContact: z.boolean().default(false),
    unsubscribed: z.boolean().default(false),
    removedAt: z.string().trim().min(1).nullable().optional(),
    suppressionReason: z.string().trim().max(240).optional(),
  }).default({
    doNotContact: false,
    unsubscribed: false,
  }),
  channelCapabilities: z.object({
    email: channelCapabilitySchema.optional(),
    linkedin: channelCapabilitySchema.optional(),
    facebook: channelCapabilitySchema.optional(),
    phone_contact: channelCapabilitySchema.optional(),
  }).default({}),
  preferredChannel: z.enum(warmOutreachChannels).optional(),
  relationshipEventId: z.string().trim().min(1).optional(),
  openingPitchGuidance: z.string().trim().min(1).max(500).optional(),
  suggestedNextStep: z.string().trim().min(1).max(500).optional(),
  avoidContext: z.array(z.string().trim().min(1).max(240)).default([]),
  responseMonitoringPlan: responseMonitoringPlanSchema.optional(),
})

export type WarmOutreachRelationshipPacket = z.infer<
  typeof warmOutreachRelationshipPacketSchema
>

export type WarmOutreachReadiness = {
  status: 'blocked' | 'needs_review' | 'draft_ready'
  humanReviewRequired: true
  selectedChannel: WarmOutreachChannel | null
  recommendedTemplate: WarmOutreachTemplateFamily
  blockers: string[]
  warnings: string[]
  approvalBoundary: 'draft_only_no_external_send'
}

export type WarmOutreachContextSummary = ReturnType<typeof buildWarmOutreachContextSummary>

export type WarmOutreachDraftPreparation =
  | {
      status: 'ready'
      packet: WarmOutreachRelationshipPacket
      readiness: WarmOutreachReadiness
      contextSummary: WarmOutreachContextSummary
      channel: Extract<WarmOutreachChannel, 'email' | 'linkedin'>
    }
  | {
      status: 'blocked'
      statusCode: 400 | 409
      error: string
      packet?: WarmOutreachRelationshipPacket
      readiness?: WarmOutreachReadiness
      contextSummary?: WarmOutreachContextSummary
    }

const channelPriority: WarmOutreachChannel[] = [
  'email',
  'linkedin',
  'facebook',
  'phone_contact',
]

function hasSource(packet: WarmOutreachRelationshipPacket, sourceType: string): boolean {
  return packet.sourceRefs.some((source) => source.sourceType === sourceType)
}

function hasSignal(packet: WarmOutreachRelationshipPacket, pattern: RegExp): boolean {
  return [
    packet.objective,
    packet.relationshipBasis,
    ...packet.relationshipSignals,
    ...packet.commonalities,
  ].some((value) => pattern.test(value))
}

export function recommendWarmOutreachTemplate(
  packetInput: WarmOutreachRelationshipPacket,
): WarmOutreachTemplateFamily {
  const packet = warmOutreachRelationshipPacketSchema.parse(packetInput)

  if (hasSignal(packet, /\b(reply|responded|response|answered|inbound)\b/i)) {
    return 'response_follow_up'
  }

  if (hasSource(packet, 'meeting_record') || hasSource(packet, 'meeting_action_task')) {
    return 'follow_up'
  }

  if (hasSignal(packet, /\b(referral|introduced|intro|recommended)\b/i)) {
    return 'referral_path'
  }

  if (hasSignal(packet, /\b(community|alumni|school|church|event|group|creator)\b/i)) {
    return 'community_bridge'
  }

  if (hasSignal(packet, /\b(problem|pain|opportunity|workflow|automation|bottleneck)\b/i)) {
    return 'value_first_note'
  }

  if (hasSignal(packet, /\b(offer|product|service|proposal|pilot|agentified|amadutown)\b/i)) {
    return 'product_relevance'
  }

  return 'reconnect'
}

export function selectWarmOutreachChannel(
  packetInput: WarmOutreachRelationshipPacket,
): WarmOutreachChannel | null {
  const packet = warmOutreachRelationshipPacketSchema.parse(packetInput)
  const preferred = packet.preferredChannel

  if (preferred && packet.channelCapabilities[preferred]?.available) {
    return preferred
  }

  return (
    channelPriority.find((channel) => packet.channelCapabilities[channel]?.available) ?? null
  )
}

export function evaluateWarmOutreachReadiness(
  packetInput: WarmOutreachRelationshipPacket,
): WarmOutreachReadiness {
  const packet = warmOutreachRelationshipPacketSchema.parse(packetInput)
  const blockers: string[] = []
  const warnings: string[] = []

  if (packet.suppression.doNotContact) {
    blockers.push(packet.suppression.suppressionReason ?? 'Contact is marked do not contact.')
  }

  if (packet.suppression.unsubscribed) {
    blockers.push('Contact is unsubscribed.')
  }

  if (packet.suppression.removedAt) {
    blockers.push('Contact was removed from outreach.')
  }

  if (!packet.relationshipBasis.trim()) {
    blockers.push('Relationship basis is missing.')
  }

  if (packet.sourceRefs.length === 0) {
    blockers.push('At least one source reference is required.')
  }

  const selectedChannel = selectWarmOutreachChannel(packet)
  if (!selectedChannel) {
    blockers.push('No available outreach channel is recorded.')
  }

  const selectedCapability = selectedChannel
    ? packet.channelCapabilities[selectedChannel]
    : null

  if (selectedCapability?.manualOnly || selectedCapability?.supportsExternalSend === false) {
    warnings.push(
      selectedCapability.reason ??
        `${selectedChannel} is manual or not verified for external send.`,
    )
  }

  if (packet.confidence !== 'high') {
    warnings.push('Relationship context requires human review before any draft can be sent.')
  }

  if (packet.riskFlags.length > 0) {
    warnings.push('Risk flags are present and must remain visible during review.')
  }

  if (packet.sourceRefs.some((source) => source.privateSource)) {
    warnings.push('Private source context must be summarized, not quoted.')
  }

  const status =
    blockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'needs_review' : 'draft_ready'

  return {
    status,
    humanReviewRequired: true,
    selectedChannel,
    recommendedTemplate: recommendWarmOutreachTemplate(packet),
    blockers,
    warnings,
    approvalBoundary: 'draft_only_no_external_send',
  }
}

export function buildWarmOutreachContextSummary(
  packetInput: WarmOutreachRelationshipPacket,
) {
  const packet = warmOutreachRelationshipPacketSchema.parse(packetInput)
  const readiness = evaluateWarmOutreachReadiness(packet)

  return {
    version: packet.version,
    contact_id: String(packet.contactId),
    contact_name: packet.contactName ?? null,
    objective: packet.objective,
    relationship_basis: packet.relationshipBasis,
    selected_channel: readiness.selectedChannel,
    recommended_template: readiness.recommendedTemplate,
    confidence: packet.confidence,
    source_summaries: packet.sourceRefs.map((source) => ({
      source_type: source.sourceType,
      source_id: source.sourceId ?? null,
      summary: source.summary,
      private_source: source.privateSource,
      visibility: source.visibility,
      source_status: source.sourceStatus,
      safe_to_mention: source.safeToMention,
      avoid_in_draft_reason: source.avoidInDraftReason ?? null,
    })),
    relationship_signals: packet.relationshipSignals,
    commonalities: packet.commonalities,
    risk_flags: packet.riskFlags,
    opening_pitch_guidance: packet.openingPitchGuidance ?? null,
    suggested_next_step: packet.suggestedNextStep ?? null,
    avoid_context: packet.avoidContext,
    response_monitoring_plan: packet.responseMonitoringPlan ?? null,
    readiness_status: readiness.status,
    blockers: readiness.blockers,
    warnings: readiness.warnings,
    human_review_required: readiness.humanReviewRequired,
    approval_boundary: readiness.approvalBoundary,
  }
}

export function prepareWarmOutreachDraftRequest(args: {
  routeContactId: number
  packetInput: unknown
}): WarmOutreachDraftPreparation {
  const parsed = warmOutreachRelationshipPacketSchema.safeParse(args.packetInput)
  if (!parsed.success) {
    return {
      status: 'blocked',
      statusCode: 400,
      error: 'Warm relationship packet is invalid.',
    }
  }

  const packet = parsed.data
  if (String(packet.contactId) !== String(args.routeContactId)) {
    return {
      status: 'blocked',
      statusCode: 400,
      error: 'Warm relationship packet does not match this lead.',
      packet,
    }
  }

  const readiness = evaluateWarmOutreachReadiness(packet)
  const contextSummary = buildWarmOutreachContextSummary(packet)

  if (readiness.status === 'blocked') {
    return {
      status: 'blocked',
      statusCode: 400,
      error: readiness.blockers[0] ?? 'Warm relationship packet is blocked.',
      packet,
      readiness,
      contextSummary,
    }
  }

  if (readiness.selectedChannel !== 'email' && readiness.selectedChannel !== 'linkedin') {
    return {
      status: 'blocked',
      statusCode: 409,
      error:
        'Warm outreach draft generation currently supports email and LinkedIn only. Keep this contact in manual review for Facebook or phone-contact outreach.',
      packet,
      readiness,
      contextSummary,
    }
  }

  return {
    status: 'ready',
    packet,
    readiness,
    contextSummary,
    channel: readiness.selectedChannel,
  }
}
