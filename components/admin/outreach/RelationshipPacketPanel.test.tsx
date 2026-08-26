import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import RelationshipPacketPanel, {
  describeChannelCapability,
  relationshipReadinessLabel,
  type RelationshipPacketApiResponse,
} from './RelationshipPacketPanel'
import type { WarmOutreachChannel } from '@/lib/warm-outreach-relationship-intelligence'
import type {
  WarmOutreachChannelSendReadiness,
  WarmOutreachSendAuthority,
  WarmOutreachSendMode,
} from '@/lib/warm-outreach-response-monitoring'

const gateKeys = [
  'target_source_provenance',
  'relationship_basis',
  'consent_suppression',
  'personalization',
  'human_approval',
  'provider_capability',
  'idempotency',
  'send_scheduling',
  'outcome_tracking',
  'response_follow_up',
] as const

function sendAuthority(
  mode: WarmOutreachSendMode,
  channel: WarmOutreachChannel,
  state: WarmOutreachSendAuthority['state'],
): WarmOutreachSendAuthority {
  return {
    version: 'warm-outreach-send-authority/v1',
    mode,
    channel,
    label: `${channel} ${state}`,
    state,
    futureActivationEligible: state === 'eligible_for_future_activation',
    externalSendApproved: false,
    externalSendEnabled: false,
    providerExecutionEnabled: false,
    gmailDraftCreationEnabled: false,
    schedulingEnabled: false,
    outcomeTrackingEnabled: false,
    humanApprovalRequired: true,
    idempotencyKey: `warm-outreach:send-readiness:v1:${mode}:${channel}`,
    gates: gateKeys.map((key) => ({
      key,
      label: key.replace(/_/g, ' '),
      status:
        key === 'provider_capability'
          ? state === 'manual_only'
            ? 'manual_required'
            : 'future_gate'
          : key === 'human_approval' || key === 'send_scheduling' || key === 'outcome_tracking' || key === 'response_follow_up'
            ? 'future_gate'
            : 'satisfied',
      requiredForActivation: true,
      detail: `${key} detail`,
      externalExecutionEnabled: false,
    })),
    blockers: [],
    manualSteps: state === 'manual_only' ? ['Review the relationship packet in Portfolio.'] : [],
    nextReviewAction:
      state === 'manual_only'
        ? 'Manual-only channel: prepare an operator review packet; no provider action is available.'
        : 'Prepare send packet for a future approval request; external sends remain disabled.',
  }
}

function sendReadiness(
  mode: WarmOutreachSendMode,
  channel: WarmOutreachChannel,
  state: WarmOutreachChannelSendReadiness['state'],
  authorityState: WarmOutreachSendAuthority['state'],
): WarmOutreachChannelSendReadiness {
  return {
    mode,
    channel,
    label:
      state === 'manual_review_only'
        ? `${channel} manual review only`
        : `${channel} provider gate required`,
    state,
    sendReady: false,
    externalSendEnabled: false,
    providerExecutionEnabled: false,
    humanApprovalRequired: true,
    idempotencyKey: `warm-outreach:send-readiness:v1:${mode}:${channel}`,
    blockers: [],
    gatesRemaining: ['human_reply_or_draft_approval', 'external_send_authority', 'provider_execution_gate'],
    auditNotes: ['Scaffold only.'],
    sendAuthority: sendAuthority(mode, channel, authorityState),
  }
}

function readinessForMode(mode: WarmOutreachSendMode): WarmOutreachChannelSendReadiness[] {
  return [
    sendReadiness(mode, 'email', 'provider_gate_required', 'eligible_for_future_activation'),
    sendReadiness(mode, 'linkedin', 'provider_gate_required', 'eligible_for_future_activation'),
    sendReadiness(mode, 'facebook', 'manual_review_only', 'manual_only'),
    sendReadiness(mode, 'phone_contact', 'manual_review_only', 'manual_only'),
  ]
}

const packetResponse: RelationshipPacketApiResponse = {
  packet: {
    version: 'warm-outreach-relationship/v1',
    contactId: 42,
    contactName: 'Ada Operator',
    objective: 'Prepare warm outreach context.',
    relationshipBasis: 'Met through a Portfolio meeting and has prior email replies.',
    sourceRefs: [
      {
        sourceType: 'meeting_record',
        sourceId: 'meeting-1',
        summary: 'Meeting summary says the team discussed operations follow-up.',
        privateSource: true,
        visibility: 'portfolio_internal',
        mentionSafety: 'summarize_only',
        sourceStatus: 'present',
      },
      {
        sourceType: 'portfolio_contact',
        summary: 'Contact record includes company and channel information.',
        privateSource: false,
        visibility: 'portfolio_internal',
        mentionSafety: 'safe_to_mention',
        sourceStatus: 'present',
      },
    ],
    relationshipSignals: ['Prior reply exists', 'Meeting follow-up is pending'],
    commonalities: ['Community operations', 'AI workflow interest'],
    riskFlags: ['Private source context must stay summarized'],
    sourceInventory: {
      sourceStatus: [
        { sourceType: 'contact_submissions', status: 'present' },
        { sourceType: 'meeting_records', status: 'present' },
      ],
      safeToMention: ['Company and public role'],
      summarizeOnly: ['Meeting notes'],
      doNotMention: ['Raw transcript'],
    },
    openingPitchGuidance: {
      safeCommonalities: ['Community operations'],
      openingAngle: 'Reconnect around the meeting follow-up.',
      channelNotes: {
        email: 'Use email for the internal draft.',
        linkedin: 'Keep LinkedIn short.',
      },
    },
    suggestedNextStep: 'Review an internal draft.',
    avoidContext: ['Do not quote private notes.'],
    responseMonitoringPlan: {
      enabled: false,
      plan: 'Reply monitoring requires a provider gate.',
      externalActivationRequired: true,
    },
    confidence: 'medium',
    suppression: {
      doNotContact: false,
      unsubscribed: false,
      removedAt: null,
    },
    channelCapabilities: {
      email: {
        available: true,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: false,
        reason: 'Email can prepare a draft only.',
      },
      linkedin: {
        available: true,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: false,
        reason: 'LinkedIn draft text only.',
      },
      facebook: {
        available: true,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: true,
        reason: 'Facebook remains manual.',
      },
      phone_contact: {
        available: true,
        providerConfigured: false,
        supportsExternalSend: false,
        manualOnly: true,
        reason: 'Phone remains manual.',
      },
    },
    preferredChannel: 'email',
  },
  readiness: {
    status: 'needs_review',
    humanReviewRequired: true,
    selectedChannel: 'email',
    recommendedTemplate: 'follow_up',
    blockers: [],
    warnings: ['Private source context must be summarized, not quoted.'],
    approvalBoundary: 'draft_only_no_external_send',
  },
  contextSummary: {
    version: 'warm-outreach-relationship/v1',
    contact_id: '42',
    contact_name: 'Ada Operator',
    objective: 'Prepare warm outreach context.',
    relationship_basis: 'Met through a Portfolio meeting and has prior email replies.',
    selected_channel: 'email',
    recommended_template: 'follow_up',
    confidence: 'medium',
    source_summaries: [],
    relationship_signals: [],
    commonalities: [],
    risk_flags: [],
    source_inventory: null,
    opening_pitch_guidance: null,
    suggested_next_step: null,
    avoid_context: [],
    response_monitoring_plan: null,
    readiness_status: 'needs_review',
    blockers: [],
    warnings: [],
    human_review_required: true,
    approval_boundary: 'draft_only_no_external_send',
  },
  executionBoundary: {
    source: 'local_portfolio_rows',
    readOnly: true,
    providerCalls: false,
    createsDraft: false,
    externalSend: false,
    n8nDispatch: false,
    slackAction: false,
    responseMonitoring: false,
  },
  responseMonitoring: {
    version: 'warm-outreach-response-monitoring/v1',
    contactId: 42,
    status: 'stale_no_response',
    mode: 'pending',
    label: 'stale no response',
    expectedReplyBy: '2026-08-24T00:00:00.000Z',
    latestOutboundAt: '2026-08-17T00:00:00.000Z',
    latestResponseAt: null,
    staleAfterDays: 7,
    perRecipientIdempotencyKey: 'warm-outreach:monitoring-recipient:v1:recipient42',
    evidence: [
      {
        sourceType: 'outreach_queue',
        sourceId: 'queue-1',
        status: 'sent',
        summary: 'Email queue row sent.',
        evidenceType: 'expected_reply',
      },
    ],
    proposedFollowUp: {
      state: 'stale_follow_up_review',
      label: 'Review stale no-response follow-up',
      description: 'Review relationship evidence before proposing another touch.',
      requiresHumanApproval: true,
      idempotencyKey: 'warm-outreach:monitoring-follow-up:v1:followup42',
    },
    blockedReasons: [],
    auditNotes: ['Monitoring is derived from local Portfolio rows only.'],
    sendReadiness: {
      version: 'warm-outreach-send-readiness/v1',
      contactId: 42,
      perRecipientIdempotencyKey: 'warm-outreach:recipient:v1:recipient42',
      modes: {
        warm_1_to_1: readinessForMode('warm_1_to_1'),
        warm_1_to_many: readinessForMode('warm_1_to_many'),
      },
      executionBoundary: {
        gmailEmailSend: false,
        linkedinAction: false,
        facebookAction: false,
        phoneAction: false,
        providerExecution: false,
        scheduling: false,
        externalMonitoring: false,
        gmailDraftCreation: false,
        outcomeTracking: false,
      },
    },
    executionBoundary: {
      localRowsOnly: true,
      manualImportEnabled: true,
      providerResponseImportEnabled: false,
      providerPollingEnabled: false,
      externalMonitoringEnabled: false,
      externalSendEnabled: false,
      gmailDraftCreationEnabled: false,
      linkedinActionEnabled: false,
      facebookActionEnabled: false,
      phoneActionEnabled: false,
      slackActionEnabled: false,
      n8nDispatchEnabled: false,
    },
  },
}

describe('RelationshipPacketPanel', () => {
  it('renders readiness, provenance, channel capabilities, and execution boundaries', () => {
    render(<RelationshipPacketPanel loading={false} error={null} data={packetResponse} />)

    expect(screen.getByText('Relationship packet')).toBeInTheDocument()
    expect(screen.getAllByText('Needs human review')).toHaveLength(2)
    expect(screen.getByText('Met through a Portfolio meeting and has prior email replies.')).toBeInTheDocument()
    expect(screen.getByText('Sources: 2')).toBeInTheDocument()
    expect(screen.getByText('Safe to mention: 1')).toBeInTheDocument()
    expect(screen.getByText('Summarize only: 1')).toBeInTheDocument()
    expect(screen.getByText('Excluded: 1')).toBeInTheDocument()
    const sourceInventory = screen.getByText('Full source inventory and review lists').closest('details')
    expect(sourceInventory).not.toBeNull()
    expect(sourceInventory).not.toHaveAttribute('open')
    expect(screen.getByText('Meeting notes')).toBeInTheDocument()
    expect(screen.getByText('Raw transcript')).toBeInTheDocument()
    expect(screen.getByText('private summary')).toBeInTheDocument()

    const channelRegion = screen.getByText('Channel capability state').closest('div')
    expect(channelRegion).not.toBeNull()
    expect(within(channelRegion!).getByText('Email')).toBeInTheDocument()
    expect(within(channelRegion!).getByText('Facebook / manual')).toBeInTheDocument()
    expect(within(channelRegion!).getAllByText('Manual review only')).toHaveLength(2)

    expect(screen.getByText('Provider calls: off')).toBeInTheDocument()
    expect(screen.getByText('Draft creation: off')).toBeInTheDocument()
    expect(screen.getByText('External send: off')).toBeInTheDocument()
    expect(screen.getByText('Provider monitoring: off')).toBeInTheDocument()
    expect(screen.getByText('Response monitoring')).toBeInTheDocument()
    expect(screen.getByText('Review stale no-response follow-up')).toBeInTheDocument()
    expect(screen.getByText('stale no response')).toBeInTheDocument()
    expect(screen.getByText('Send authority review')).toBeInTheDocument()
    expect(screen.getByText('Warm one-to-one')).toBeInTheDocument()
    expect(screen.getByText('Warm one-to-many')).toBeInTheDocument()
    expect(screen.getAllByText('Future eligible')).toHaveLength(4)
    expect(screen.getAllByText('Manual only')).toHaveLength(4)
    expect(screen.getAllByText(/Prepare send packet for a future approval request/)).toHaveLength(4)
    expect(screen.getAllByText(/Manual-only channel: prepare an operator review packet/)).toHaveLength(4)
    expect(screen.getByText('External monitoring: off')).toBeInTheDocument()
    expect(screen.getByText('Local response evidence: visible')).toBeInTheDocument()
  })

  it('shows suppressed contacts as blocked readiness', () => {
    const blocked: RelationshipPacketApiResponse = {
      ...packetResponse,
      packet: {
        ...packetResponse.packet,
        suppression: {
          doNotContact: true,
          unsubscribed: false,
          removedAt: null,
          suppressionReason: 'Contact is marked do not contact in Portfolio.',
        },
      },
      readiness: {
        ...packetResponse.readiness,
        status: 'blocked',
        blockers: ['Contact is marked do not contact in Portfolio.'],
      },
    }

    render(<RelationshipPacketPanel loading={false} error={null} data={blocked} />)

    expect(screen.getAllByText('Blocked')).toHaveLength(2)
    expect(screen.getAllByText('Contact is marked do not contact in Portfolio.').length).toBeGreaterThan(0)
    expect(screen.queryByText('Ready means the operator has enough local context to review an internal draft.')).not.toBeInTheDocument()
  })

  it('exports stable label helpers for adapter tests', () => {
    expect(relationshipReadinessLabel('draft_ready')).toBe('Ready for draft review')
    expect(relationshipReadinessLabel('needs_review')).toBe('Needs human review')
    expect(describeChannelCapability()).toBe('Not recorded')
    expect(describeChannelCapability(packetResponse.packet.channelCapabilities.facebook)).toBe('Manual review only')
  })
})
