import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RelationshipPacketPanel, {
  describeChannelCapability,
  relationshipReadinessLabel,
  type RelationshipPacketApiResponse,
} from './RelationshipPacketPanel'
import type { WarmOutreachChannel } from '@/lib/warm-outreach-relationship-intelligence'
import type {
  WarmOutreachChannelSendReadiness,
  WarmOutreachEmailSendLifecycle,
  WarmOutreachSendAuthority,
  WarmOutreachSendMode,
} from '@/lib/warm-outreach-response-monitoring'
import {
  WARM_SLACK_SEND_APPROVAL_QA_QUEUE_ID,
  warmSlackSendApprovalQaRelationshipPacket,
} from './warmSlackSendApprovalQaFixture'

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
  const emailSendLifecycle: WarmOutreachEmailSendLifecycle | null = channel === 'email'
    ? {
        version: 'warm-outreach-email-send-lifecycle/v1',
        contactId: 42,
        mode,
        channel: 'email',
        label: 'Email is first candidate, provider/send activation blocked',
        state: mode === 'warm_1_to_many' ? 'per_recipient_gate_required' : 'blocked_before_provider_activation',
        firstCandidateChannel: true,
        sendReady: false,
        providerExecutionEnabled: false,
        externalSendEnabled: false,
        gmailDraftCreationEnabled: false,
        schedulingEnabled: false,
        messageVersionKey: `warm-outreach:email-message-version:v1:${mode}`,
        sendQueueIdempotencyKey: `warm-outreach:email-send-queue:v1:${mode}`,
        providerCapabilitySmokeKey: `warm-outreach:gmail-capability-smoke:v1:${mode}`,
        gmailDraftCreationGateKey: `warm-outreach:gmail-draft-creation-gate:v1:${mode}`,
        submittedEvidenceKey: `warm-outreach:email-submitted-evidence:v1:${mode}`,
        gmailDraftHandoffPacket: {
          version: 'warm-outreach-gmail-draft-handoff/v1',
          state: mode === 'warm_1_to_many' ? 'per_recipient_gate_required' : 'ready_for_internal_handoff',
          label: mode === 'warm_1_to_many'
            ? 'Internal draft handoff is per-recipient only'
            : 'Internal Gmail draft handoff ready',
          internalHandoffReady: true,
          channel: 'email',
          contactReference: {
            contactId: 42,
            contactName: 'Ada Operator',
            reference: 'contact_submission:42:Ada Operator',
          },
          messageVersionKey: `warm-outreach:email-message-version:v1:${mode}`,
          templateDraftBasis: {
            recommendedTemplate: 'follow_up',
            selectedChannel: 'email',
            relationshipEventId: null,
            detail: 'Use follow up as the internal draft basis for the current message version.',
          },
          provenanceSummary: {
            relationshipSourceCount: 2,
            relationshipSignalCount: 2,
            safeToMentionCount: 1,
            summarizeOnlyCount: 1,
            commonalityCount: 2,
            detail: 'Portfolio-local relationship provenance is summarized for the handoff packet.',
          },
          suppressionStatus: 'clear',
          suppressionReasons: [],
          idempotencyKey: `warm-outreach:gmail-draft-handoff:v1:${mode}`,
          futureApprovalGates: [
            'human_reply_or_draft_approval',
            'provider_capability_smoke',
            'gmail_draft_creation_authority',
            'external_send_authority',
            'send_scheduling',
            'submitted_sent_evidence',
          ],
          gmailProviderActivated: false,
          gmailDraftCreationEnabled: false,
          providerCallsEnabled: false,
          externalSendBlocked: true,
          detail: mode === 'warm_1_to_many'
            ? 'Batch review can prepare handoff evidence only one recipient at a time; no batch Gmail drafts can be created.'
            : 'Operator can review the internal Gmail draft handoff packet; Gmail draft creation and send stay blocked.',
        },
        providerCapabilitySmoke: {
          version: 'warm-outreach-gmail-provider-smoke/v1',
          provider: 'gmail',
          status: 'not_configured',
          label: 'Gmail provider not activated',
          smokeKey: `warm-outreach:gmail-capability-smoke:v1:${mode}`,
          oauthConfigured: false,
          connectedProfileAvailable: false,
          providerConfigured: false,
          readOnlySmokeReady: false,
          readOnlySmokeEnabled: false,
          providerCallsEnabled: false,
          externalSendEnabled: false,
          gmailDraftCreationEnabled: false,
          requiredConfig: [
            'Gmail OAuth configuration',
            'Connected Gmail profile',
            'Future explicit read-only smoke authority',
          ],
          blockedReasons: [],
          lastSmokeAt: null,
          lastSmokeError: null,
          futureActivationGate: 'A later captain-lane approval must authorize any Gmail provider smoke; this scaffold records readiness only.',
          notes: [
            'This model does not call Gmail.',
            'Read-only smoke readiness is separate from Gmail draft creation and external send authority.',
            'Gmail draft creation, send, scheduling, Slack action, and provider calls remain disabled.',
          ],
        },
        gmailDraftCreationGate: {
          version: 'warm-outreach-gmail-draft-creation-gate/v1',
          status: 'provider_smoke_required',
          label: 'Gmail provider smoke required before draft creation',
          draftCreationKey: `warm-outreach:gmail-draft-creation-gate:v1:${mode}`,
          internalHandoffReady: true,
          providerSmokeStatus: 'not_configured',
          providerSmokePassed: false,
          draftCreationAuthority: false,
          gmailDraftCreationEnabled: false,
          providerCallsEnabled: false,
          externalSendEnabled: false,
          externalSendBlocked: true,
          blockedReasons: [],
          requiredGates: [
            'internal_gmail_draft_handoff',
            'read_only_gmail_provider_smoke',
            'gmail_draft_creation_authority',
            'duplicate_prevention',
            'external_send_authority_separate_future_gate',
          ],
          notes: [
            'This gate does not create Gmail drafts.',
            'Draft creation stays disabled even when readiness evidence is complete.',
            'External send authority remains a separate future gate.',
          ],
        },
        gmailProviderActivationReadiness: {
          version: 'warm-outreach-gmail-provider-activation-readiness/v1',
          localDraftReadiness: {
            state: 'ready',
            label: 'Local draft handoff ready',
            detail: 'Operator can review the internal Gmail draft handoff packet; Gmail draft creation and send stay blocked.',
            idempotencyKey: `warm-outreach:gmail-draft-handoff:v1:${mode}`,
          },
          connectedSenderReadiness: {
            state: 'requires_no_send_canary',
            label: 'Connected sender not checked in relationship packet',
            requiredSender: null,
            connectedAs: null,
            recoveryAction: 'Run the no-send canary or open Admin Credentials to verify the connected Gmail sender before any live draft canary request.',
          },
          liveDraftCanaryReadiness: {
            state: 'ready_for_no_send_canary',
            label: 'Ready for no-send canary',
            detail: 'The operator may run the no-send canary. It verifies local readiness and connected sender gates without calling Gmail.',
            providerCallsEnabled: false,
            gmailDraftCreated: false,
            trackingPersisted: false,
            externalSendEnabled: false,
          },
          duplicateDraftEvidence: {
            createdOnce: false,
            duplicatePrevented: false,
            draftId: null,
            threadId: null,
            messageId: null,
            sourceIds: [],
            noSendStatus: 'no_send',
            detail: 'No prior Gmail draft metadata was found in local Portfolio rows for this contact/channel/message path.',
          },
          externalSendBoundary: {
            blocked: true,
            label: 'External send blocked',
            detail: 'Gmail draft creation and Gmail send authority are separate gates. A draft, smoke, or canary never authorizes sending.',
          },
          remainingHumanGates: [
            'review_local_draft_handoff_packet',
            'verify_connected_sender_identity',
            'captain_authorize_specific_live_draft_canary',
            'explicit_per_recipient_gmail_draft_authorization',
            'separate_external_send_authority',
          ],
        },
        externalSendReadiness: {
          version: 'warm-outreach-external-send-readiness/v1',
          state: 'blocked_pending_authority',
          label: 'External Gmail send authority blocked',
          senderIdentity: {
            state: 'not_verified',
            requiredSender: null,
            connectedAs: null,
            detail: 'Sender identity must be verified before external send authority.',
          },
          recipientApproval: {
            state: 'required',
            contactId: 42,
            approved: false,
            detail: 'No per-recipient external-send approval is recorded.',
          },
          draftEvidence: {
            state: 'missing',
            gmailDraftExists: false,
            draftId: null,
            threadId: null,
            messageId: null,
            sourceIds: [],
            detail: 'No tracked Gmail draft evidence is recorded.',
          },
          suppressionConsent: {
            state: 'clear',
            reasons: [],
            detail: 'No suppression blocker is recorded.',
          },
          idempotency: {
            messageVersionKey: `warm-outreach:email-message-version:v1:${mode}`,
            sendQueueIdempotencyKey: `warm-outreach:email-send-queue:v1:${mode}`,
            submittedEvidenceKey: `warm-outreach:email-submitted-evidence:v1:${mode}`,
            duplicateDetected: false,
            detail: 'Future external-send review must reuse stable keys.',
          },
          externalSend: {
            enabled: false,
            approved: false,
            blocked: true,
            detail: 'Portfolio cannot send this Gmail message from this state.',
            nextStep: 'Ask the Integration Captain for explicit per-recipient external-send authority after readiness review.',
          },
        },
        realRecipientRolloutReadiness: {
          version: 'warm-outreach-real-gmail-rollout-readiness/v1',
          state: 'blocked',
          label: 'Real Gmail send request blocked',
          eligibleForSendApprovalRequest: false,
          canBuildSlackApprovalPayload: false,
          exactNextAction: 'resolve_blocker',
          actionLabel: 'Resolve blocker',
          requirements: {
            draftEvidence: {
              state: 'missing',
              draftId: null,
              threadId: null,
              messageId: null,
              sourceIds: [],
              detail: 'Create and track the per-recipient Gmail draft before requesting real-recipient send approval.',
            },
            senderMatch: {
              state: 'missing',
              requiredSender: null,
              connectedAs: null,
              detail: 'Sender identity must be recorded on the tracked Gmail draft evidence.',
            },
            suppression: {
              state: 'clear',
              reasons: [],
              detail: 'No suppression blocker is recorded.',
            },
            provider: {
              state: 'missing',
              detail: 'Reconnect or verify Gmail provider readiness before asking for real-recipient approval.',
            },
            authorization: {
              state: 'missing',
              decisionKey: null,
              detail: 'No Portfolio or Slack send authorization decision is recorded yet.',
            },
            submittedEvidence: {
              state: 'missing',
              sourceIds: [],
              detail: 'No submitted send evidence is recorded for this contact, channel, and message version.',
            },
            execution: {
              state: 'blocked',
              sourceIds: [],
              detail: 'Resolve blockers before execution eligibility.',
            },
          },
          blockers: [
            'Tracked Gmail draft evidence is required before a real-recipient send request.',
            'Gmail provider configuration or connected profile evidence is missing.',
            'Tracked Gmail draft sender evidence is missing.',
          ],
          slackApprovalContract: {
            route: '/api/admin/outreach/[id]/slack-send-approval',
            method: 'POST',
            dispatchEnabled: false,
            actionIds: ['warm_gmail_send.approve', 'warm_gmail_send.reject', 'warm_gmail_send.revise'],
            payloadDedupeKey: `warm-outreach:slack-gmail-send-card:v1:${mode}`,
            status: 'not_sent',
            requestKey: null,
            slackDispatchStatus: 'not_sent',
            recordsAuthorizationIntentOnly: true,
            gmailSendCalled: false,
            providerExecutionEnabled: false,
          },
          executionBoundary: {
            slackDispatch: false,
            gmailSend: false,
            providerCalls: false,
            productionEnvChange: false,
            perRecipientExecutionAuthorizationRequired: true,
            captainFlagRequiredForExecution: true,
          },
        },
        duplicatePrevention: {
          scope: 'contact_channel_message_version',
          duplicateDetected: false,
          existingEvidenceIds: [],
          requiredUniqueKeys: [
            `warm-outreach:email-message-version:v1:${mode}`,
            `warm-outreach:gmail-draft-creation-gate:v1:${mode}`,
            `warm-outreach:email-send-queue:v1:${mode}`,
            `warm-outreach:gmail-capability-smoke:v1:${mode}`,
            `warm-outreach:email-submitted-evidence:v1:${mode}`,
          ],
          detail: 'Future send activation must reuse these keys to prevent duplicate contact/channel/message-version execution.',
        },
        suppressionCheck: {
          status: 'clear',
          reasons: [],
        },
        relationshipProvenance: {
          status: 'present',
          sourceCount: 2,
          signalCount: 2,
          relationshipEventId: null,
          detail: 'Portfolio-local relationship provenance is attached.',
        },
        personalizationProvenance: {
          status: 'present',
          safeToMentionCount: 1,
          summarizeOnlyCount: 1,
          commonalityCount: 2,
          detail: 'Personalization context is available from local evidence.',
        },
        auditState: {
          status: 'scaffold_only',
          notes: [
            'Email is the first candidate channel for future activation review.',
            'No Gmail draft, Gmail send, provider smoke, schedule, or submitted evidence mutation is enabled.',
            'A later explicit provider/send approval gate is required before any external action.',
          ],
        },
        stages: [
          {
            key: 'draft_packet',
            label: 'Draft packet',
            status: 'ready_for_review',
            detail: 'Local relationship and personalization context can be reviewed as a draft packet.',
            externalExecutionEnabled: false,
          },
          {
            key: 'human_reply_or_draft_approval',
            label: 'Human draft approval',
            status: 'future_gate',
            detail: 'A human must approve the exact reply or draft packet before any send authority review.',
            externalExecutionEnabled: false,
          },
          {
            key: 'send_authority_review',
            label: 'Send authority review',
            status: 'future_gate',
            detail: 'Future explicit authority is required for this contact, channel, and message version.',
            externalExecutionEnabled: false,
          },
          {
            key: 'provider_capability_smoke',
            label: 'Provider capability smoke',
            status: 'blocked',
            detail: 'Gmail/provider capability smoke is intentionally blocked in this scaffold.',
            externalExecutionEnabled: false,
          },
          {
            key: 'scheduled_send_queue',
            label: 'Scheduled send queue',
            status: 'disabled',
            detail: 'Scheduling is modeled but disabled until provider/send activation.',
            externalExecutionEnabled: false,
          },
          {
            key: 'submitted_sent_evidence',
            label: 'Submitted/sent evidence',
            status: 'evidence_required',
            detail: 'Submitted or sent evidence must be recorded after a future approved provider action.',
            externalExecutionEnabled: false,
          },
        ],
      }
    : null

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
    emailSendLifecycle,
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
    expect(screen.getByText('Email first candidate')).toBeInTheDocument()
    expect(screen.getByText(/Provider\/send activation blocked/)).toBeInTheDocument()
    expect(screen.getByText('Provider/send off')).toBeInTheDocument()
    expect(screen.getByText('Real-recipient Gmail rollout')).toBeInTheDocument()
    expect(screen.getByText('Real Gmail send request blocked')).toBeInTheDocument()
    expect(screen.getByText('Resolve blocker')).toBeInTheDocument()
    expect(screen.getByText('Draft: missing')).toBeInTheDocument()
    expect(screen.getByText('Sender: missing')).toBeInTheDocument()
    expect(screen.getByText('Provider: missing')).toBeInTheDocument()
    expect(screen.getByText('Authorization: missing')).toBeInTheDocument()
    expect(screen.getByText('Submitted evidence: missing')).toBeInTheDocument()
    expect(screen.getByText('Slack approval: not sent. Slack dispatch: not sent.')).toBeInTheDocument()
    expect(screen.getByText('Approval records intent only. Gmail send: off.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Build Slack approval card' })).toBeDisabled()
    expect(screen.getByText('Draft packet: ready for review')).toBeInTheDocument()
    expect(screen.getByText('Provider capability smoke: blocked')).toBeInTheDocument()
    expect(screen.getByText(/Queue key: warm-outreach:email-send-queue:v1:/)).toBeInTheDocument()
    expect(screen.getByText('Internal draft handoff')).toBeInTheDocument()
    expect(screen.getByText('contact_submission:42:Ada Operator / follow up')).toBeInTheDocument()
    expect(screen.getByText('Suppression: clear. Gmail draft creation off. External send blocked.')).toBeInTheDocument()
    expect(screen.getByText('Gmail provider smoke')).toBeInTheDocument()
    expect(screen.getAllByText('not configured')).toHaveLength(1)
    expect(screen.getByText('Gmail provider not activated. Provider calls off.')).toBeInTheDocument()
    expect(screen.getByText('OAuth: missing / Profile: missing.')).toBeInTheDocument()
    expect(screen.getByText('Gmail provider activation readiness')).toBeInTheDocument()
    expect(screen.getByText('Local draft readiness')).toBeInTheDocument()
    expect(screen.getByText('Local draft handoff ready')).toBeInTheDocument()
    expect(screen.getByText('Connected sender readiness')).toBeInTheDocument()
    expect(screen.getByText('Connected sender not checked in relationship packet')).toBeInTheDocument()
    expect(screen.getByText('Live draft canary readiness')).toBeInTheDocument()
    expect(screen.getByText('Ready for no-send canary')).toBeInTheDocument()
    expect(screen.getByText('No-send canary: provider calls off / creates draft: no')).toBeInTheDocument()
    expect(screen.getByText('Gmail draft tracking')).toBeInTheDocument()
    expect(screen.getByText('No tracked Gmail draft')).toBeInTheDocument()
    expect(screen.getByText('captain authorize specific live draft canary')).toBeInTheDocument()
    expect(screen.getByText('explicit per recipient gmail draft authorization')).toBeInTheDocument()
    expect(screen.getByText('separate external send authority')).toBeInTheDocument()
    expect(screen.getByText('External send authority')).toBeInTheDocument()
    expect(screen.getByText('External Gmail send authority blocked')).toBeInTheDocument()
    expect(screen.getByText('Sender: not verified')).toBeInTheDocument()
    expect(screen.getByText('Recipient approval: required')).toBeInTheDocument()
    expect(screen.getByText('Draft evidence: missing')).toBeInTheDocument()
    expect(screen.getByText('External send: blocked')).toBeInTheDocument()
    expect(screen.getByText(/Send key: warm-outreach:email-send-queue:v1:/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Check send authority' }))
    expect(screen.getByText(/explicit per-recipient external-send authority after readiness review/i)).toBeInTheDocument()
    expect(screen.getByText('Gmail draft creation availability')).toBeInTheDocument()
    expect(screen.getByText('provider smoke required')).toBeInTheDocument()
    expect(screen.getByText('Gmail provider smoke required before draft creation. Draft creation off. External send blocked.')).toBeInTheDocument()
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

  it('surfaces the no-send Gmail draft canary without implying draft creation', () => {
    const onGmailDraftCanary = vi.fn()

    render(
      <RelationshipPacketPanel
        loading={false}
        error={null}
        data={packetResponse}
        onGmailDraftCanary={onGmailDraftCanary}
        gmailDraftCanaryResult={{
          status: 'passed_no_send',
          message:
            'No-send Gmail draft creation canary passed. No Gmail draft was created, no tracking was written, and no email was sent.',
          draftCreationEnabled: false,
          providerCallsEnabled: false,
          externalSendEnabled: false,
          gmailDraftCreated: false,
          trackingPersisted: false,
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Run no-send canary' }))

    expect(onGmailDraftCanary).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Run a no-send canary to confirm the contact/)).toBeInTheDocument()
    expect(screen.getByText(/No-send Gmail draft creation canary passed/)).toBeInTheDocument()
    expect(screen.getByText('Gmail draft: not created / Tracking: not written / External send: blocked.')).toBeInTheDocument()
    expect(screen.getByText('Draft creation: off')).toBeInTheDocument()
    expect(screen.getByText('External send: off')).toBeInTheDocument()
  })

  it('shows tracked Gmail draft evidence without enabling external send authority', () => {
    const emailItem = packetResponse.responseMonitoring!.sendReadiness.modes.warm_1_to_1
      .find((item) => item.channel === 'email')!
    const trackedDraftResponse: RelationshipPacketApiResponse = {
      ...packetResponse,
      responseMonitoring: {
        ...packetResponse.responseMonitoring!,
        sendReadiness: {
          ...packetResponse.responseMonitoring!.sendReadiness,
          modes: {
            ...packetResponse.responseMonitoring!.sendReadiness.modes,
            warm_1_to_1: packetResponse.responseMonitoring!.sendReadiness.modes.warm_1_to_1.map((item) => (
              item.channel === 'email'
                ? {
                    ...item,
                    emailSendLifecycle: {
                      ...emailItem.emailSendLifecycle!,
                      gmailProviderActivationReadiness: {
                        ...emailItem.emailSendLifecycle!.gmailProviderActivationReadiness,
                        liveDraftCanaryReadiness: {
                          ...emailItem.emailSendLifecycle!.gmailProviderActivationReadiness.liveDraftCanaryReadiness,
                          state: 'blocked_no_send',
                          label: 'No-send canary blocked',
                          detail: 'Existing Gmail draft metadata is already present; duplicate draft creation remains blocked.',
                        },
                        duplicateDraftEvidence: {
                          createdOnce: true,
                          duplicatePrevented: true,
                          draftId: 'r3600377219184694601',
                          threadId: '1a043d900ee02b0f',
                          messageId: '1a043d900ee02b0f',
                          sourceIds: ['outreach_queue:70e2adea-3bfa-4920-8cd9-5531234d8d02'],
                          noSendStatus: 'no_send',
                          detail: 'Existing Gmail draft metadata is present.',
                        },
                      },
                      externalSendReadiness: {
                        ...emailItem.emailSendLifecycle!.externalSendReadiness,
                        draftEvidence: {
                          state: 'tracked',
                          gmailDraftExists: true,
                          draftId: 'r3600377219184694601',
                          threadId: '1a043d900ee02b0f',
                          messageId: '1a043d900ee02b0f',
                          sourceIds: ['outreach_queue:70e2adea-3bfa-4920-8cd9-5531234d8d02'],
                          detail: 'A Gmail draft exists as tracking evidence only. It does not grant send authority.',
                        },
                        idempotency: {
                          ...emailItem.emailSendLifecycle!.externalSendReadiness.idempotency,
                          duplicateDetected: true,
                        },
                      },
                    },
                  }
                : item
            )),
          },
        },
      },
    }

    render(<RelationshipPacketPanel loading={false} error={null} data={trackedDraftResponse} />)

    expect(screen.getByText('Gmail draft exists and is tracked')).toBeInTheDocument()
    expect(screen.getByText(/Draft: r3600377219184694601 \/ Thread: 1a043d900ee02b0f \/ Message: 1a043d900ee02b0f/)).toBeInTheDocument()
    expect(screen.getByText(/tracking evidence only; external send still needs separate approval/i)).toBeInTheDocument()
    expect(screen.getByText('External send blocked')).toBeInTheDocument()
    expect(screen.getByText('separate external send authority')).toBeInTheDocument()
    expect(screen.getByText('Draft evidence: tracked Gmail draft')).toBeInTheDocument()
    expect(screen.getByText('Recipient approval: required')).toBeInTheDocument()
    expect(screen.getByText('External Gmail send authority blocked')).toBeInTheDocument()
    expect(screen.getByText('Draft creation: off')).toBeInTheDocument()
    expect(screen.getByText('External send: off')).toBeInTheDocument()
  })

  it('exports stable label helpers for adapter tests', () => {
    expect(relationshipReadinessLabel('draft_ready')).toBe('Ready for draft review')
    expect(relationshipReadinessLabel('needs_review')).toBe('Needs human review')
    expect(describeChannelCapability()).toBe('Not recorded')
    expect(describeChannelCapability(packetResponse.packet.channelCapabilities.facebook)).toBe('Manual review only')
  })

  it('surfaces Slack approval decision states without implying Gmail was sent', () => {
    const responseWithSlackStatus = (
      status: NonNullable<WarmOutreachEmailSendLifecycle['realRecipientRolloutReadiness']>['slackApprovalContract']['status'],
    ): RelationshipPacketApiResponse => {
      const emailItem = packetResponse.responseMonitoring!.sendReadiness.modes.warm_1_to_1
        .find((item) => item.channel === 'email')!
      return {
        ...packetResponse,
        responseMonitoring: {
          ...packetResponse.responseMonitoring!,
          sendReadiness: {
            ...packetResponse.responseMonitoring!.sendReadiness,
            modes: {
              ...packetResponse.responseMonitoring!.sendReadiness.modes,
              warm_1_to_1: packetResponse.responseMonitoring!.sendReadiness.modes.warm_1_to_1.map((item) => item.channel === 'email'
                ? {
                    ...item,
                    emailSendLifecycle: {
                      ...emailItem.emailSendLifecycle!,
                      realRecipientRolloutReadiness: {
                        ...emailItem.emailSendLifecycle!.realRecipientRolloutReadiness,
                        canBuildSlackApprovalPayload: true,
                        slackApprovalContract: {
                          ...emailItem.emailSendLifecycle!.realRecipientRolloutReadiness.slackApprovalContract,
                          status,
                        },
                        requirements: {
                          ...emailItem.emailSendLifecycle!.realRecipientRolloutReadiness.requirements,
                          draftEvidence: {
                            ...emailItem.emailSendLifecycle!.realRecipientRolloutReadiness.requirements.draftEvidence,
                            sourceIds: ['queue-ready'],
                          },
                        },
                      },
                    },
                  }
                : item),
            },
          },
        },
      }
    }

    const { rerender } = render(
      <RelationshipPacketPanel
        loading={false}
        error={null}
        data={responseWithSlackStatus('pending')}
      />,
    )

    expect(screen.getByText('Slack approval: pending. Slack dispatch: not sent.')).toBeInTheDocument()
    expect(screen.getByText('Local request only; no Slack or Gmail send runs here.')).toBeInTheDocument()

    for (const status of ['approved', 'rejected', 'revision_requested'] as const) {
      rerender(
          <RelationshipPacketPanel
            loading={false}
            error={null}
            data={responseWithSlackStatus(status)}
          />,
      )
      expect(screen.getByText(
        `Slack approval: ${status === 'revision_requested' ? 'revision requested' : status}. Slack dispatch: not sent.`,
      )).toBeInTheDocument()
      expect(screen.getByText('Approval records intent only. Gmail send: off.')).toBeInTheDocument()
      expect(screen.getByText(/Operator state:/)).toBeInTheDocument()
    }
  })

  it('records an inert QA Slack approval request without calling the API', async () => {
    const previousFetch = globalThis.fetch
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(
      <RelationshipPacketPanel
        loading={false}
        error={null}
        data={warmSlackSendApprovalQaRelationshipPacket}
        inertSlackApprovalRequest
      />,
    )

    const button = screen.getByRole('button', { name: 'Build Slack approval card' })
    expect(button).toBeEnabled()

    fireEvent.click(button)

    expect(await screen.findByText(
      `QA local Slack approval request recorded for ${WARM_SLACK_SEND_APPROVAL_QA_QUEUE_ID}. Slack dispatch off. Gmail send off. Provider calls off.`,
    )).toBeInTheDocument()
    expect(screen.getByText('Canary proof receipt')).toBeInTheDocument()
    expect(screen.getByLabelText('Live Gmail send disabled')).toBeInTheDocument()
    expect(screen.getByText(
      'Slack intent: not sent. Gmail auth: missing.',
    )).toBeInTheDocument()
    expect(screen.getByText('Draft evidence: tracked. Sender: matched.')).toBeInTheDocument()
    expect(screen.getByText('Send evidence: none. Gmail execution: disabled.')).toBeInTheDocument()
    expect(screen.getByText('Proof details')).toBeInTheDocument()
    expect(screen.getByText(`Queue row: ${WARM_SLACK_SEND_APPROVAL_QA_QUEUE_ID}`)).toBeInTheDocument()
    expect(screen.getByText(
      'Next step: Build the Slack approval card for this exact queue row; Slack records intent only and does not send Gmail.',
    )).toBeInTheDocument()
    expect(screen.getByText('Slack approval: pending. Slack dispatch: not sent.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    vi.stubGlobal('fetch', previousFetch)
  })
})
