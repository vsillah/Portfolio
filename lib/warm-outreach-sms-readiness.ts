import type {
  WarmOutreachReadiness,
  WarmOutreachRelationshipPacket,
} from './warm-outreach-relationship-intelligence'

export const warmSmsTemplateFamilies = [
  'prior_collaborator',
  'referral_common_connection',
  'community_relationship',
  'dormant_lead',
  'advisor_investor',
  'prior_email_follow_up',
] as const

export type WarmSmsTemplateFamily = (typeof warmSmsTemplateFamilies)[number]

export type WarmSmsReadinessState = 'blocked' | 'manual_review_required' | 'manual_ready'

export type WarmSmsApprovalState =
  | 'not_reviewed'
  | 'approved_manual_ready'
  | 'revision_requested'
  | 'rejected'

export type WarmSmsReadiness = {
  version: 'warm-outreach-sms-readiness/v1'
  contactId: string
  contactName: string | null
  channel: 'phone_contact'
  state: WarmSmsReadinessState
  label: string
  phoneReadiness: {
    present: boolean
    source: 'contact_submissions.phone_number' | 'missing'
    provenance: string
    rawPhoneReturned: false
  }
  relationshipRationale: {
    status: 'present' | 'missing'
    basis: string
    sourceCount: number
    signalCount: number
    detail: string
  }
  consentAndSuppression: {
    status: 'clear_for_manual_review' | 'blocked' | 'relationship_rationale_required'
    rationale: string
    blockers: string[]
    checks: Array<{
      key:
        | 'phone_present'
        | 'phone_provenance'
        | 'relationship_basis'
        | 'suppression'
        | 'opt_out'
        | 'manual_only'
      label: string
      status: 'passed' | 'blocked' | 'review_required'
      detail: string
    }>
  }
  draft: {
    templateFamily: WarmSmsTemplateFamily
    templateLabel: string
    selectionReason: string
    preview: string
    guidance: string[]
    maxRecommendedCharacters: 240
  }
  approval: {
    state: WarmSmsApprovalState
    recordsManualReadinessOnly: true
    smsDeliveryEnabled: false
    providerCallsEnabled: false
    externalSendEnabled: false
    genericProceedAccepted: false
    allowedDecisions: ['approve_manual_ready', 'request_revision', 'reject']
  }
  operatorNextAction: string
  recoveryStep: string | null
  executionBoundary: {
    manualOnly: true
    smsProviderConfigured: false
    smsProviderCalls: false
    smsDelivery: false
    phoneImport: false
    slackDispatch: false
    gmailAction: false
    n8nDispatch: false
    productionDataMutation: false
  }
}

function hasSuppression(readiness: WarmOutreachReadiness, packet: WarmOutreachRelationshipPacket) {
  return (
    readiness.blockers.length > 0 ||
    packet.suppression.doNotContact ||
    packet.suppression.unsubscribed ||
    Boolean(packet.suppression.removedAt)
  )
}

function hasRelationshipRationale(packet: WarmOutreachRelationshipPacket) {
  const sourceCount = packet.sourceRefs.filter((source) => (
    source.sourceStatus !== 'missing' &&
    source.sourceType !== 'portfolio_contact'
  )).length
  const signalCount = packet.relationshipSignals.length
  const basisIsLimited = /limited local relationship evidence/i.test(packet.relationshipBasis)

  return {
    sourceCount,
    signalCount,
    present: !basisIsLimited && (sourceCount > 0 || signalCount > 0),
  }
}

export function selectWarmSmsTemplateFamily(
  packet: WarmOutreachRelationshipPacket,
): { family: WarmSmsTemplateFamily; reason: string } {
  const searchable = [
    packet.objective,
    packet.relationshipBasis,
    ...packet.relationshipSignals,
    ...packet.commonalities,
    ...packet.sourceRefs.map((source) => source.summary),
  ].join(' ')

  if (/\b(advisor|investor|fund|capital|board)\b/i.test(searchable)) {
    return {
      family: 'advisor_investor',
      reason: 'Advisor, investor, or mentor language is present in the relationship context.',
    }
  }

  if (/\b(referral|referred|introduced|intro|common connection|recommended)\b/i.test(searchable)) {
    return {
      family: 'referral_common_connection',
      reason: 'Referral or common-connection evidence is present.',
    }
  }

  if (/\b(community|alumni|school|church|club|event|nonprofit|village)\b/i.test(searchable)) {
    return {
      family: 'community_relationship',
      reason: 'Community relationship context is present.',
    }
  }

  if (/\b(dormant|stale|long time|reconnect|re-introduce|reintroduce)\b/i.test(searchable)) {
    return {
      family: 'dormant_lead',
      reason: 'The contact appears to need a light reintroduction.',
    }
  }

  if (/\b(reply|responded|response|email|gmail|follow.?up|followed up)\b/i.test(searchable)) {
    return {
      family: 'prior_email_follow_up',
      reason: 'Prior email or follow-up evidence is the strongest local signal.',
    }
  }

  return {
    family: 'prior_collaborator',
    reason: 'The packet has enough warm relationship context for a concise collaborator-style note.',
  }
}

function templateLabel(family: WarmSmsTemplateFamily) {
  const labels: Record<WarmSmsTemplateFamily, string> = {
    prior_collaborator: 'Prior collaborator',
    referral_common_connection: 'Referral / common connection',
    community_relationship: 'Community relationship',
    dormant_lead: 'Dormant lead',
    advisor_investor: 'Advisor / investor',
    prior_email_follow_up: 'Follow-up after prior email',
  }
  return labels[family]
}

function firstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] || 'there'
}

function smsPreview(
  packet: WarmOutreachRelationshipPacket,
  family: WarmSmsTemplateFamily,
) {
  const name = firstName(packet.contactName)
  const anchor =
    packet.commonalities[0] ??
    packet.relationshipSignals[0] ??
    'our last conversation'

  const drafts: Record<WarmSmsTemplateFamily, string> = {
    prior_collaborator:
      `Hi ${name}, thinking about ${anchor}. Worth a quick check-in this week?`,
    referral_common_connection:
      `Hi ${name}, our shared intro around ${anchor} came back to mind. Open to a quick follow-up?`,
    community_relationship:
      `Hi ${name}, your work around ${anchor} has been on my mind. Would a brief check-in be useful?`,
    dormant_lead:
      `Hi ${name}, it has been a while. Still worth reconnecting on ${anchor}, or should I close the loop for now?`,
    advisor_investor:
      `Hi ${name}, I would value your read on ${anchor}. Do you have room for a short check-in?`,
    prior_email_follow_up:
      `Hi ${name}, following up on my email about ${anchor}. No pressure, but is this still worth a quick look?`,
  }

  return drafts[family].slice(0, 240)
}

export function buildWarmSmsReadiness(args: {
  packet: WarmOutreachRelationshipPacket
  readiness: WarmOutreachReadiness
}): WarmSmsReadiness {
  const packet = args.packet
  const phoneCapability = packet.channelCapabilities.phone_contact
  const phonePresent = phoneCapability?.available === true
  const relationship = hasRelationshipRationale(packet)
  const suppressed = hasSuppression(args.readiness, packet)
  const suppressionBlockers = [
    ...args.readiness.blockers,
    ...(packet.suppression.doNotContact ? ['Contact is marked do not contact.'] : []),
    ...(packet.suppression.unsubscribed ? ['Contact is unsubscribed or opted out.'] : []),
    ...(packet.suppression.removedAt ? ['Contact was removed from outreach.'] : []),
  ]
  const blockers = [
    ...(!phonePresent ? ['No phone number is present in the Portfolio contact record.'] : []),
    ...(!relationship.present ? ['Relationship rationale is not strong enough for SMS review.'] : []),
    ...(suppressed ? suppressionBlockers : []),
  ]
  const template = selectWarmSmsTemplateFamily(packet)
  const state: WarmSmsReadinessState =
    blockers.length > 0
      ? 'blocked'
      : args.readiness.status === 'draft_ready'
        ? 'manual_ready'
        : 'manual_review_required'

  const consentStatus: WarmSmsReadiness['consentAndSuppression']['status'] =
    suppressed
      ? 'blocked'
      : !relationship.present
        ? 'relationship_rationale_required'
        : 'clear_for_manual_review'

  return {
    version: 'warm-outreach-sms-readiness/v1',
    contactId: String(packet.contactId),
    contactName: packet.contactName ?? null,
    channel: 'phone_contact',
    state,
    label:
      state === 'blocked'
        ? 'SMS manual outreach blocked'
        : state === 'manual_ready'
          ? 'SMS draft ready for manual approval'
          : 'SMS draft needs manual review',
    phoneReadiness: {
      present: phonePresent,
      source: phonePresent ? 'contact_submissions.phone_number' : 'missing',
      provenance: phonePresent
        ? phoneCapability?.reason ?? 'Phone number is present on the Portfolio contact record.'
        : 'Add a phone number to the Portfolio contact record before SMS review.',
      rawPhoneReturned: false,
    },
    relationshipRationale: {
      status: relationship.present ? 'present' : 'missing',
      basis: packet.relationshipBasis,
      sourceCount: relationship.sourceCount,
      signalCount: relationship.signalCount,
      detail: relationship.present
        ? 'Local relationship evidence supports manual SMS review.'
        : 'SMS requires stronger local relationship evidence than email draft review.',
    },
    consentAndSuppression: {
      status: consentStatus,
      rationale:
        consentStatus === 'blocked'
          ? blockers[0] ?? 'SMS outreach is blocked by suppression state.'
          : consentStatus === 'relationship_rationale_required'
            ? 'Add a relationship or consent rationale before drafting SMS.'
            : 'No DNC, removal, unsubscribe, or opt-out blocker is recorded; operator must still confirm manual one-to-one appropriateness.',
      blockers,
      checks: [
        {
          key: 'phone_present',
          label: 'Phone number present',
          status: phonePresent ? 'passed' : 'blocked',
          detail: phonePresent
            ? 'Portfolio has a phone number on the contact record.'
            : 'Add a phone number to the contact record.',
        },
        {
          key: 'phone_provenance',
          label: 'Phone source provenance',
          status: phonePresent ? 'review_required' : 'blocked',
          detail: phonePresent
            ? 'Confirm the contact record source is appropriate for manual SMS.'
            : 'No phone source can be reviewed until a phone number exists.',
        },
        {
          key: 'relationship_basis',
          label: 'Relationship rationale',
          status: relationship.present ? 'passed' : 'blocked',
          detail: relationship.present
            ? 'Portfolio has relationship evidence beyond the contact row.'
            : 'Add a meeting, reply, referral, prior collaboration, or approved manual note.',
        },
        {
          key: 'suppression',
          label: 'Suppression',
          status: suppressed ? 'blocked' : 'passed',
          detail: suppressed
            ? blockers[0] ?? 'Suppression state blocks SMS review.'
            : 'No DNC, unsubscribe, or removed-state blocker is recorded.',
        },
        {
          key: 'opt_out',
          label: 'Opt-out sensitivity',
          status: suppressed ? 'blocked' : 'review_required',
          detail: suppressed
            ? 'Existing opt-out or suppression evidence blocks SMS.'
            : 'Operator must stop immediately if the contact declines or opts out.',
        },
        {
          key: 'manual_only',
          label: 'Manual only',
          status: 'review_required',
          detail: 'Portfolio records readiness only. No SMS provider, delivery, import, Slack, Gmail, or n8n action is enabled.',
        },
      ],
    },
    draft: {
      templateFamily: template.family,
      templateLabel: templateLabel(template.family),
      selectionReason: template.reason,
      preview: smsPreview(packet, template.family),
      guidance: [
        'Keep it one-to-one, under two short sentences, and grounded in the relationship evidence shown here.',
        'Do not paste private notes, raw email text, internal task language, or unsupported claims.',
        'If the contact declines, asks not to be texted, or the phone source feels uncertain, stop and record suppression/review evidence before any future touch.',
      ],
      maxRecommendedCharacters: 240,
    },
    approval: {
      state: 'not_reviewed',
      recordsManualReadinessOnly: true,
      smsDeliveryEnabled: false,
      providerCallsEnabled: false,
      externalSendEnabled: false,
      genericProceedAccepted: false,
      allowedDecisions: ['approve_manual_ready', 'request_revision', 'reject'],
    },
    operatorNextAction:
      state === 'blocked'
        ? 'Resolve the blocked SMS readiness check before reviewing draft text.'
        : 'Review the draft, revise or reject it, or approve the text for manual use from this contact workroom.',
    recoveryStep:
      state === 'blocked'
        ? blockers[0] ?? 'Add phone, source, relationship, and consent evidence before SMS review.'
        : null,
    executionBoundary: {
      manualOnly: true,
      smsProviderConfigured: false,
      smsProviderCalls: false,
      smsDelivery: false,
      phoneImport: false,
      slackDispatch: false,
      gmailAction: false,
      n8nDispatch: false,
      productionDataMutation: false,
    },
  }
}
