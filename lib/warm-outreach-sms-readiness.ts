import type {
  WarmOutreachReadiness,
  WarmOutreachRelationshipPacket,
} from './warm-outreach-relationship-intelligence'
import {
  buildWarmSmsProviderReadiness,
  type WarmSmsProviderReadiness,
  type WarmSmsProviderReadinessInput,
} from './warm-outreach-sms-provider-readiness'
import {
  buildWarmSmsCandidateReview,
  type WarmSmsCandidateQueueRow,
  type WarmSmsCandidateReview,
} from './warm-outreach-sms-candidate'

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

export type WarmSmsManualLoopState =
  | 'readiness_reviewed'
  | 'draft_revised'
  | 'manual_send_prepared'
  | 'manual_send_evidence_recorded'
  | 'response_expected'
  | 'response_received'
  | 'follow_up_draft_needed'
  | 'suppressed_stop'

export const warmSmsManualResponseOutcomes = [
  'no_response_yet',
  'interested',
  'not_now',
  'stop_opt_out',
  'wrong_number',
  'needs_follow_up',
] as const

export type WarmSmsManualResponseOutcome = (typeof warmSmsManualResponseOutcomes)[number]

export type WarmSmsManualEvidenceInput = {
  sentAt: string | null
  channel: 'manual_sms'
  operatorNote: string
  outcome: WarmSmsManualResponseOutcome
}

export type WarmSmsManualLoopEvaluation = {
  state: WarmSmsManualLoopState
  label: string
  operatorNextAction: string
  recoveryStep: string | null
  evidenceComplete: boolean
  missingEvidence: string[]
  response: {
    outcome: WarmSmsManualResponseOutcome
    label: string
    detail: string
    responseReceived: boolean
    followUpDraftNeeded: boolean
    suppressesFutureSms: boolean
  }
  gates: {
    canCopyApprovedDraft: boolean
    canPrepareManualSend: boolean
    canRecordEvidence: boolean
    smsPromptsSuppressed: boolean
    externalProviderCallsEnabled: false
    smsDeliveryEnabled: false
    genericProceedAccepted: false
  }
}

export const warmSmsManualLoopStages: Array<{
  state: WarmSmsManualLoopState
  label: string
  detail: string
}> = [
  {
    state: 'readiness_reviewed',
    label: 'Readiness reviewed',
    detail: 'Phone, source, relationship basis, suppression, and opt-out sensitivity were reviewed.',
  },
  {
    state: 'draft_revised',
    label: 'Draft revised',
    detail: 'The operator adjusted the short SMS text before manual use.',
  },
  {
    state: 'manual_send_prepared',
    label: 'Manual-send prepared',
    detail: 'The approved draft is ready to copy for a one-to-one send outside Portfolio.',
  },
  {
    state: 'manual_send_evidence_recorded',
    label: 'Manual-send evidence recorded',
    detail: 'Minimal local evidence records when the outside SMS step happened.',
  },
  {
    state: 'response_expected',
    label: 'Response expected',
    detail: 'The contact has not responded yet; no follow-up should be drafted until a result is known.',
  },
  {
    state: 'response_received',
    label: 'Response received',
    detail: 'The operator recorded a non-sensitive outcome from the manual SMS thread.',
  },
  {
    state: 'follow_up_draft_needed',
    label: 'Follow-up draft needed',
    detail: 'The response creates a new draft-review need, not an automatic send.',
  },
  {
    state: 'suppressed_stop',
    label: 'Suppressed / stop',
    detail: 'Stop, opt-out, or wrong-number evidence suppresses further SMS prompts.',
  },
]

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
  operatingLoop: {
    version: 'warm-outreach-sms-manual-loop/v1'
    states: typeof warmSmsManualLoopStages
    manualEvidence: {
      requiredFields: ['timestamp', 'channel', 'operator_note']
      privacyBoundary: string
      channel: 'manual_sms'
      storesRawSmsBody: false
      storesPhoneNumber: false
      requiresScreenshot: false
    }
    responseOutcomes: Array<{
      outcome: WarmSmsManualResponseOutcome
      label: string
      suppressesFutureSms: boolean
      followUpDraftNeeded: boolean
    }>
    externalProviderCallsEnabled: false
    smsDeliveryEnabled: false
    genericProceedAccepted: false
  }
  providerReadiness: WarmSmsProviderReadiness
  candidateReview: WarmSmsCandidateReview
  operatorNextAction: string
  recoveryStep: string | null
  executionBoundary: {
    manualOnly: true
    smsProviderConfigured: boolean
    smsProviderCalls: false
    smsDelivery: false
    phoneImport: false
    slackDispatch: false
    gmailAction: false
    n8nDispatch: false
    productionDataMutation: false
  }
}

export function classifyWarmSmsManualResponseOutcome(outcome: WarmSmsManualResponseOutcome) {
  const labels: Record<WarmSmsManualResponseOutcome, string> = {
    no_response_yet: 'No response yet',
    interested: 'Interested',
    not_now: 'Not now',
    stop_opt_out: 'Stop / opt out',
    wrong_number: 'Wrong number',
    needs_follow_up: 'Needs follow-up',
  }
  const details: Record<WarmSmsManualResponseOutcome, string> = {
    no_response_yet: 'Wait for a response before drafting another SMS touch.',
    interested: 'A response is present; draft the next follow-up for review before any action.',
    not_now: 'Record the outcome and pause further SMS unless a later relationship basis is created.',
    stop_opt_out: 'Fail closed. Suppress future SMS prompts and do not prepare another draft.',
    wrong_number: 'Fail closed. Suppress future SMS prompts until the contact record is corrected and reviewed.',
    needs_follow_up: 'Create a follow-up draft request; this is not send authority.',
  }
  const suppressesFutureSms = outcome === 'stop_opt_out' || outcome === 'wrong_number'
  const followUpDraftNeeded = outcome === 'interested' || outcome === 'needs_follow_up'
  return {
    outcome,
    label: labels[outcome],
    detail: details[outcome],
    responseReceived: outcome !== 'no_response_yet',
    followUpDraftNeeded,
    suppressesFutureSms,
  }
}

export function evaluateWarmSmsManualLoop(args: {
  readinessState: WarmSmsReadinessState
  approvalState: WarmSmsApprovalState
  draftText: string
  draftRevised: boolean
  manualSendPrepared: boolean
  evidenceRecorded: boolean
  evidence: WarmSmsManualEvidenceInput
}): WarmSmsManualLoopEvaluation {
  const response = classifyWarmSmsManualResponseOutcome(args.evidence.outcome)
  const missingEvidence = [
    ...(!args.evidence.sentAt ? ['timestamp'] : []),
    ...(args.evidence.channel !== 'manual_sms' ? ['channel'] : []),
    ...(args.evidence.operatorNote.trim().length === 0 ? ['operator note'] : []),
  ]
  const evidenceComplete = args.evidenceRecorded && missingEvidence.length === 0
  const draftIsApproved = args.approvalState === 'approved_manual_ready'
  const draftUsable = args.draftText.trim().length > 0
  const readinessBlocked = args.readinessState === 'blocked'
  const smsPromptsSuppressed = response.suppressesFutureSms
  const canCopyApprovedDraft = draftIsApproved && draftUsable && !readinessBlocked && !smsPromptsSuppressed
  const canPrepareManualSend = canCopyApprovedDraft
  const canRecordEvidence = args.manualSendPrepared && !readinessBlocked && !smsPromptsSuppressed

  let state: WarmSmsManualLoopState = 'readiness_reviewed'
  if (smsPromptsSuppressed) {
    state = 'suppressed_stop'
  } else if (evidenceComplete && response.followUpDraftNeeded) {
    state = 'follow_up_draft_needed'
  } else if (evidenceComplete && response.responseReceived) {
    state = 'response_received'
  } else if (evidenceComplete && response.outcome === 'no_response_yet') {
    state = 'response_expected'
  } else if (args.evidenceRecorded) {
    state = 'manual_send_evidence_recorded'
  } else if (args.manualSendPrepared) {
    state = 'manual_send_prepared'
  } else if (args.draftRevised || args.approvalState === 'revision_requested') {
    state = 'draft_revised'
  }

  const labels = new Map(warmSmsManualLoopStages.map((stage) => [stage.state, stage.label]))
  const operatorNextAction =
    readinessBlocked
      ? 'Resolve readiness blockers before copying or preparing a manual SMS.'
      : smsPromptsSuppressed
        ? 'Stop SMS follow-up for this contact and preserve suppression evidence.'
        : state === 'follow_up_draft_needed'
          ? 'Draft a follow-up for review. Do not send from Portfolio.'
          : state === 'response_received'
            ? 'Record the outcome and wait for a new reviewed basis before future SMS.'
            : state === 'response_expected'
              ? 'Wait for a response or classify the manual outcome when one arrives.'
              : state === 'manual_send_evidence_recorded'
                ? 'Complete timestamp, channel, and operator-note evidence before expecting a response.'
                : state === 'manual_send_prepared'
                  ? 'Send manually outside Portfolio, then record minimal evidence here.'
                  : state === 'draft_revised'
                    ? 'Approve the revised draft before preparing manual use.'
                    : 'Review readiness and approve, revise, or reject the draft.'

  return {
    state,
    label: labels.get(state) ?? 'Readiness reviewed',
    operatorNextAction,
    recoveryStep:
      readinessBlocked
        ? 'Resolve phone basis, relationship rationale, or suppression blockers first.'
        : args.evidenceRecorded && !evidenceComplete
          ? `Complete manual evidence: ${missingEvidence.join(', ')}.`
          : smsPromptsSuppressed
            ? response.detail
            : null,
    evidenceComplete,
    missingEvidence,
    response,
    gates: {
      canCopyApprovedDraft,
      canPrepareManualSend,
      canRecordEvidence,
      smsPromptsSuppressed,
      externalProviderCallsEnabled: false,
      smsDeliveryEnabled: false,
      genericProceedAccepted: false,
    },
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
  providerReadiness?: WarmSmsProviderReadinessInput
  queueRows?: WarmSmsCandidateQueueRow[]
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
  const providerReadiness = buildWarmSmsProviderReadiness(args.providerReadiness ?? {
    provider: {
      name: null,
      configured: phoneCapability?.providerConfigured === true,
      enabled:
        phoneCapability?.providerConfigured === true &&
        phoneCapability.supportsExternalSend === true &&
        phoneCapability.manualOnly !== true,
    },
    consent: {
      knownRelationshipBasis: relationship.present,
      relationshipBasisNote: relationship.present ? packet.relationshipBasis : null,
      phoneProvenance: phonePresent ? 'unverified' : 'missing',
      phoneProvenanceNote: phonePresent ? phoneCapability?.reason ?? null : null,
      permissionStatus: relationship.present ? 'relationship_basis_only' : 'missing',
      permissionNote: null,
      optOutStop: packet.suppression.unsubscribed,
      wrongNumber: false,
      doNotContact: packet.suppression.doNotContact || Boolean(packet.suppression.removedAt),
      lastContactAt: null,
      cooldownDays: 7,
      auditedAt: null,
    },
    draftApproval: {
      approvedForProviderDraftCreation: false,
    },
    now: new Date().toISOString(),
  })

  const readinessPayload: Omit<WarmSmsReadiness, 'candidateReview'> = {
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
    operatingLoop: {
      version: 'warm-outreach-sms-manual-loop/v1',
      states: warmSmsManualLoopStages,
      manualEvidence: {
        requiredFields: ['timestamp', 'channel', 'operator_note'],
        privacyBoundary:
          'Record only when the manual outside-SMS step happened, the manual channel, and a short operator note. Do not store the raw SMS body, phone number, screenshots, or private reply content.',
        channel: 'manual_sms',
        storesRawSmsBody: false,
        storesPhoneNumber: false,
        requiresScreenshot: false,
      },
      responseOutcomes: warmSmsManualResponseOutcomes.map((outcome) => {
        const response = classifyWarmSmsManualResponseOutcome(outcome)
        return {
          outcome,
          label: response.label,
          suppressesFutureSms: response.suppressesFutureSms,
          followUpDraftNeeded: response.followUpDraftNeeded,
        }
      }),
      externalProviderCallsEnabled: false,
      smsDeliveryEnabled: false,
      genericProceedAccepted: false,
    },
    providerReadiness,
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
      smsProviderConfigured: providerReadiness.provider.configured,
      smsProviderCalls: false,
      smsDelivery: false,
      phoneImport: false,
      slackDispatch: false,
      gmailAction: false,
      n8nDispatch: false,
      productionDataMutation: false,
    },
  }

  return {
    ...readinessPayload,
    candidateReview: buildWarmSmsCandidateReview({
      readiness: readinessPayload,
      queueRows: args.queueRows,
    }),
  }
}
