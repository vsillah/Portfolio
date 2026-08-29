import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RelationshipPacketPanel, {
  describeChannelCapability,
  relationshipReadinessLabel,
  type RelationshipPacketApiResponse,
} from './RelationshipPacketPanel'
import type { WarmOutreachChannel } from '@/lib/warm-outreach-relationship-intelligence'
import { buildWarmGmailOperatingLoop } from '@/lib/warm-outreach-gmail-operating-loop'
import type {
  WarmOutreachChannelSendReadiness,
  WarmOutreachEmailSendLifecycle,
  WarmOutreachSendAuthority,
  WarmOutreachSendMode,
} from '@/lib/warm-outreach-response-monitoring'
import {
  buildWarmOutreachGmailResponseImportActivationReadiness,
  buildWarmOutreachGmailResponseImportCanaryReadiness,
} from '@/lib/warm-outreach-gmail-response-import'
import { buildWarmSmsReadiness } from '@/lib/warm-outreach-sms-readiness'
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
            approvalRequestRecovery: {
              status: 'portfolio_request_available_slack_dispatch_disabled',
              label: 'Portfolio recovery path',
              detail:
                'Slack dispatch is disabled. The relationship packet can still record a local one-recipient approval request without posting to Slack or calling Gmail.',
              nextAction:
                'Use Request send approval in this contact workroom, then record approve, reject, or revise before any separate Gmail send execution gate.',
            },
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
        gmailProviderExecutionReadiness: {
          version: 'warm-outreach-gmail-provider-execution-readiness/v1',
          state: 'blocked',
          label: 'Execution blocked',
          liveExecutionEnabled: false,
          providerCallsEnabled: false,
          externalSendEnabled: false,
          adminActivationGate: {
            key: 'ENABLE_WARM_GMAIL_SEND_EXECUTION',
            state: 'disabled',
            detail:
              'The relationship packet and workroom never enable Gmail execution.',
          },
          operatorDecision: {
            status: 'not_sent',
            nextAction: 'Review the recipient, context, and draft before any approval.',
            approvalRoute: '/api/admin/outreach/[id]/slack-send-approval',
            recordsAuthorizationIntentOnly: true,
          },
          exactExecutionGate: {
            route: '/api/admin/outreach/[id]/gmail-user-send',
            method: 'POST',
            enabledOnThisSurface: false,
            sendAuthorization: 'execute_warm_gmail_send_for_authorized_recipient',
            messageVersionKey: `warm-outreach:email-message-version:v1:${mode}`,
            sendQueueIdempotencyKey: `warm-outreach:email-send-queue:v1:${mode}`,
            submittedEvidenceKey: `warm-outreach:email-submitted-evidence:v1:${mode}`,
            detail: 'Exact execution remains separately gated.',
          },
          canaryTrace: {
            queueId: null,
            status: 'blocked',
            sentEvidenceRecorded: false,
            gmailMessageId: null,
            gmailThreadId: null,
            detail: 'No Gmail execution evidence is recorded.',
          },
        },
        gmailOperatingLoop: buildWarmGmailOperatingLoop({
          contactId: 42,
          queueId: null,
          messageVersionKey: `warm-outreach:email-message-version:v1:${mode}`,
          sendQueueIdempotencyKey: `warm-outreach:email-send-queue:v1:${mode}`,
          submittedEvidenceKey: `warm-outreach:email-submitted-evidence:v1:${mode}`,
          internalDraftReady: true,
          draftTracked: false,
          providerConfigured: false,
          senderMatched: false,
          approvalRequestStatus: 'not_sent',
          authorizationStatus: 'missing',
          executionState: 'blocked',
          submittedEvidenceRecorded: false,
          secondaryLogRepairRequired: false,
          responseMonitoringAttached: false,
          hardBlockers: mode === 'warm_1_to_many'
            ? ['Batch Gmail actions remain per-recipient only. Open one warm contact before continuing.']
            : [],
        }),
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
    providerCaptureReadiness: {
      version: 'warm-outreach-provider-response-capture-readiness/v1',
      state: 'provider_assisted_readiness',
      label: 'Provider-assisted metadata ready; polling disabled',
      responseCaptureKey: 'warm-outreach:response-capture:v1:response42',
      supportedClassifications: [
        { key: 'interested', label: 'Interested', humanReviewRequired: true },
        { key: 'question', label: 'Question', humanReviewRequired: true },
        { key: 'referral', label: 'Referral', humanReviewRequired: true },
        { key: 'objection', label: 'Objection', humanReviewRequired: true },
        { key: 'not_now', label: 'Not now', humanReviewRequired: true },
        { key: 'unsubscribe_do_not_contact', label: 'Unsubscribe / do not contact', humanReviewRequired: true },
        { key: 'negative_sensitive', label: 'Negative / sensitive', humanReviewRequired: true },
        { key: 'ambiguous', label: 'Ambiguous', humanReviewRequired: true },
      ],
      providers: [
        {
          provider: 'gmail',
          channel: 'email',
          state: 'readiness_metadata_only',
          label: 'Gmail / email metadata ready',
          detail: 'Provider identifiers may be stored on a manually reviewed capture, but provider polling and import jobs remain disabled.',
          manualCaptureEnabled: true,
          providerIngestionEnabled: false,
          providerPollingEnabled: false,
          externalMonitoringEnabled: false,
          externalActionEnabled: false,
        },
        {
          provider: 'linkedin',
          channel: 'linkedin',
          state: 'blocked_provider_gate',
          label: 'LinkedIn provider gate blocked',
          detail: 'A provider capability gate must clear before provider-assisted response capture can be represented.',
          manualCaptureEnabled: true,
          providerIngestionEnabled: false,
          providerPollingEnabled: false,
          externalMonitoringEnabled: false,
          externalActionEnabled: false,
        },
        {
          provider: 'facebook',
          channel: 'facebook',
          state: 'manual_capture_only',
          label: 'Facebook manual capture only',
          detail: 'Capture the response manually in Portfolio and link it to the contact or outreach queue row.',
          manualCaptureEnabled: true,
          providerIngestionEnabled: false,
          providerPollingEnabled: false,
          externalMonitoringEnabled: false,
          externalActionEnabled: false,
        },
        {
          provider: 'phone_contact',
          channel: 'phone_contact',
          state: 'manual_capture_only',
          label: 'Phone manual capture only',
          detail: 'Capture the response manually in Portfolio and link it to the contact or outreach queue row.',
          manualCaptureEnabled: true,
          providerIngestionEnabled: false,
          providerPollingEnabled: false,
          externalMonitoringEnabled: false,
          externalActionEnabled: false,
        },
      ],
      slackAlertReadiness: {
        state: 'metadata_deeplink_only',
        label: 'Slack alert metadata only',
        deepLinkReady: true,
        dispatchEnabled: false,
        slackActionEnabled: false,
        route: '/admin/contacts/[id]',
        detail: 'Response alerts may store a Portfolio contact deep link for later review, but this surface does not post Slack messages.',
      },
    },
    gmailResponseImportReadiness: {
      version: 'warm-outreach-gmail-response-import-readiness/v1',
      state: 'dry_run_ready',
      label: 'Mock Gmail response import ready',
      provider: 'gmail',
      dryRunImportEnabled: true,
      liveProviderImportEnabled: false,
      providerPollingEnabled: false,
      gmailApiCalled: false,
      externalActionsEnabled: false,
      gmailDraftCreationEnabled: false,
      slackDispatchEnabled: false,
      n8nDispatchEnabled: false,
      activationReadiness: buildWarmOutreachGmailResponseImportActivationReadiness(),
      matchBasis: [
        {
          key: 'gmail_thread_id',
          label: 'Gmail thread',
          available: true,
          detail: 'gmail-thread-42',
        },
        {
          key: 'gmail_message_id',
          label: 'Gmail message',
          available: false,
          detail: 'No Gmail message id is recorded on local response or queue evidence.',
        },
        {
          key: 'queue_id',
          label: 'Queue row',
          available: true,
          detail: 'queue-1',
        },
        {
          key: 'contact_id',
          label: 'Contact',
          available: true,
          detail: 'contact_submission:42',
        },
        {
          key: 'normalized_recipient',
          label: 'Recipient identity',
          available: true,
          detail: 'The dry-run importer also compares mocked reply sender against the Portfolio contact email.',
        },
        {
          key: 'subject_fingerprint',
          label: 'Subject fingerprint',
          available: true,
          detail: 'subject-key',
        },
      ],
      latestCandidate: {
        status: 'ready_for_mock_import',
        confidence: 'high',
        providerThreadId: 'gmail-thread-42',
        providerMessageId: null,
        matchedOutreachQueueId: 'queue-1',
        matchedContactId: 42,
        provenanceSourceId: null,
        nextAction:
          'Run the dry-run admin test path with mocked Gmail payloads, then import through the existing response lifecycle after human review.',
        recoveryPath:
          'POST mocked payloads to the dry-run route; ready candidates still create only local response evidence through the existing lifecycle.',
      },
      dedupe: {
        provider: 'gmail',
        keys: ['gmail_thread:gmail-thread-42', 'queue:queue-1', 'contact:42', 'subject:subject-key'],
        duplicateReplayBlocked: true,
        detail:
          'Replay checks use provider, Gmail thread/message id, queue id, contact id, normalized recipient, subject fingerprint, and existing warm response source ids.',
      },
      canaryReadiness: buildWarmOutreachGmailResponseImportCanaryReadiness({
        contactId: 42,
        queueId: 'queue-1',
        gmailThreadId: 'gmail-thread-42',
        dedupeKey: 'gmail_thread:gmail-thread-42',
        observedAt: '2026-08-28T10:00:00.000Z',
      }),
      auditNotes: [
        'This readiness packet is local Portfolio metadata only.',
        'Live Gmail polling/import remains disabled; mocked dry-run planning is the only import path represented here.',
        'No Gmail draft, Gmail send, Slack dispatch, n8n dispatch, or provider action is enabled.',
      ],
    },
    operatorDecisionPaths: [
      {
        key: 'capture_response',
        label: 'Capture response',
        state: 'available',
        description: 'Record a manual or provider-assisted response as Portfolio contact communication evidence.',
        requiresHumanApproval: true,
        externalActionEnabled: false,
        idempotencyKey: 'warm-outreach:operator-decision:v1:capture-response',
      },
      {
        key: 'review_reply_draft',
        label: 'Review reply draft',
        state: 'readiness_only',
        description: 'A local draft decision becomes available after response evidence is captured.',
        requiresHumanApproval: true,
        externalActionEnabled: false,
        idempotencyKey: 'warm-outreach:operator-decision:v1:review-reply',
      },
      {
        key: 'suppression_proposal',
        label: 'Suppression proposal',
        state: 'readiness_only',
        description: 'Unsubscribe or do-not-contact replies create a human-gated suppression proposal; this path does not mutate suppression directly.',
        requiresHumanApproval: true,
        externalActionEnabled: false,
        idempotencyKey: 'warm-outreach:operator-decision:v1:suppression',
      },
      {
        key: 'interested_task',
        label: 'Interested task path',
        state: 'readiness_only',
        description: 'Interested or sales-intent replies can create a local outreach task for the next decision; no provider execution is enabled.',
        requiresHumanApproval: true,
        externalActionEnabled: false,
        idempotencyKey: 'warm-outreach:operator-decision:v1:interested-task',
      },
      {
        key: 'next_touch_timing',
        label: 'Next-touch timing',
        state: 'pending_human_qa',
        description: 'Review relationship evidence before proposing another touch.',
        requiresHumanApproval: true,
        externalActionEnabled: false,
        idempotencyKey: 'warm-outreach:operator-decision:v1:timing',
      },
      {
        key: 'slack_alert_metadata',
        label: 'Slack alert metadata',
        state: 'readiness_only',
        description: 'A future alert may deep-link to this contact workroom, but Slack dispatch and Slack actions stay disabled.',
        requiresHumanApproval: true,
        externalActionEnabled: false,
        idempotencyKey: 'warm-outreach:operator-decision:v1:slack-alert',
      },
    ],
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
    expect(screen.getAllByText('Response monitoring')).not.toHaveLength(0)
    expect(screen.getByText('Review stale no-response follow-up')).toBeInTheDocument()
    expect(screen.getByText('stale no response')).toBeInTheDocument()
    expect(screen.getByText('Response capture readiness')).toBeInTheDocument()
    expect(screen.getByText('Provider-assisted metadata ready; polling disabled')).toBeInTheDocument()
    expect(screen.getByText('Gmail / email metadata ready')).toBeInTheDocument()
    expect(screen.getByText('Facebook manual capture only')).toBeInTheDocument()
    expect(screen.getByText('Gmail response import')).toBeInTheDocument()
    expect(screen.getByText('Mock Gmail response import ready')).toBeInTheDocument()
    expect(screen.getByText('Live import off')).toBeInTheDocument()
    expect(screen.getByText('Candidate: ready for mock import / confidence high')).toBeInTheDocument()
    expect(screen.getByText('Activation readiness: Ready for mock import')).toBeInTheDocument()
    expect(screen.getByText('Mock: ready / live: disabled')).toBeInTheDocument()
    expect(screen.getByText('Mock import: ready')).toBeInTheDocument()
    expect(screen.getByText('Live import: disabled')).toBeInTheDocument()
    expect(screen.getByText('Provider: not checked')).toBeInTheDocument()
    expect(screen.getByText('Gmail token: not checked')).toBeInTheDocument()
    expect(screen.getByText('Gmail scope: not checked')).toBeInTheDocument()
    expect(screen.getByText('Manual recovery: ready')).toBeInTheDocument()
    expect(screen.getByText('Queue: queue-1')).toBeInTheDocument()
    expect(screen.getByText('Thread: gmail-thread-42')).toBeInTheDocument()
    expect(screen.getByText('Message: missing')).toBeInTheDocument()
    expect(screen.getByText('Response import canary readiness')).toBeInTheDocument()
    expect(screen.getByText('Ready for dry-run response import')).toBeInTheDocument()
    expect(screen.getByText('Live read approval required')).toBeInTheDocument()
    expect(screen.getByText('Decision: dry run only')).toBeInTheDocument()
    expect(screen.getByText('Outcome: not checked')).toBeInTheDocument()
    expect(screen.getByText('Dry-run fixture: ready')).toBeInTheDocument()
    expect(screen.getByText('One-recipient scope: ready')).toBeInTheDocument()
    expect(screen.getByText('Live Gmail read approval: required')).toBeInTheDocument()
    expect(screen.getByText('Reply/send boundary: disabled')).toBeInTheDocument()
    expect(screen.getByText('Gmail API: not called / DB writes: off / reply draft: not created.')).toBeInTheDocument()
    expect(screen.getByText('Gmail thread: ready')).toBeInTheDocument()
    expect(screen.getByText('Gmail message: missing')).toBeInTheDocument()
    expect(screen.getByText('Recipient identity: ready')).toBeInTheDocument()
    expect(screen.getByText(/Run the dry-run admin test path/)).toBeInTheDocument()
    expect(screen.getByText(/ready candidates still create only local response evidence/)).toBeInTheDocument()
    expect(screen.getByText('Import dedupe keys')).toBeInTheDocument()
    expect(screen.getByText('gmail_thread:gmail-thread-42')).toBeInTheDocument()
    expect(screen.getByText('Dry-run import: on / Gmail API: not called / Slack and n8n: off.')).toBeInTheDocument()
    expect(screen.getAllByText(/Provider import: off/).length).toBeGreaterThan(0)
    expect(screen.getByText('Supported classifications')).toBeInTheDocument()
    expect(screen.getByText('Interested')).toBeInTheDocument()
    expect(screen.getByText('Unsubscribe / do not contact')).toBeInTheDocument()
    expect(screen.getByText('Negative / sensitive')).toBeInTheDocument()
    expect(screen.getByText('Slack alert metadata only')).toBeInTheDocument()
    expect(screen.getByText(/this surface does not post Slack messages/i)).toBeInTheDocument()
    expect(screen.getByText('Capture response')).toBeInTheDocument()
    expect(screen.getByText('Review reply draft')).toBeInTheDocument()
    expect(screen.getByText('Suppression proposal')).toBeInTheDocument()
    expect(screen.getByText('Interested task path')).toBeInTheDocument()
    expect(screen.getByText(/does not mutate suppression directly/i)).toBeInTheDocument()
    expect(screen.getByText(/Capture key: warm-outreach:response-capture:v1:/)).toBeInTheDocument()
    expect(screen.getByText('Send authority review')).toBeInTheDocument()
    expect(screen.getByText('Email first candidate')).toBeInTheDocument()
    expect(screen.getByText(/Provider\/send activation blocked/)).toBeInTheDocument()
    expect(screen.getByText('Provider/send off')).toBeInTheDocument()
    expect(screen.getByText('Real-recipient Gmail rollout')).toBeInTheDocument()
    expect(screen.getByText('Real Gmail send request blocked')).toBeInTheDocument()
    expect(screen.getByText('Resolve blocker')).toBeInTheDocument()
    expect(screen.getAllByText('Draft: missing').length).toBeGreaterThan(0)
    expect(screen.getByText('Sender: missing')).toBeInTheDocument()
    expect(screen.getAllByText('Provider: missing').length).toBeGreaterThan(0)
    expect(screen.getByText('Authorization: missing')).toBeInTheDocument()
    expect(screen.getByText('Submitted evidence: missing')).toBeInTheDocument()
    expect(screen.getByLabelText('Warm Gmail execution readiness')).toBeInTheDocument()
    expect(screen.getByText('Execution readiness')).toBeInTheDocument()
    expect(screen.getAllByText('Execution blocked').length).toBeGreaterThan(0)
    expect(screen.getByText('Exact gate locked')).toBeInTheDocument()
    expect(screen.getByText('Safe next step: Open the warm queue row, repair the named readiness gate, then return to this same item.')).toBeInTheDocument()
    expect(screen.getByText('Exact execution evidence')).toBeInTheDocument()
    expect(screen.getByText(/Authorization: execute_warm_gmail_send_for_authorized_recipient/)).toBeInTheDocument()
    expect(screen.getByText('Approval request: not sent. Slack dispatch: not sent.')).toBeInTheDocument()
    expect(screen.getByText('Approval records intent only. Gmail send: off.')).toBeInTheDocument()
    expect(screen.getByText('Portfolio recovery path')).toBeInTheDocument()
    expect(screen.getByText(/Slack dispatch is disabled/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Request send approval' })).not.toBeInTheDocument()
    expect(screen.getByText('Resolve draft blocker')).toBeInTheDocument()
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
    expect(screen.getAllByText(/Send key: warm-outreach:email-send-queue:v1:/).length).toBeGreaterThan(0)
    expect(screen.getByText('Provider execution readiness')).toBeInTheDocument()
    expect(screen.getByText('Activation gate: ENABLE_WARM_GMAIL_SEND_EXECUTION is disabled.')).toBeInTheDocument()
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

  it('surfaces provider-missing Gmail import recovery in the existing readiness card', () => {
    const responseMonitoring = packetResponse.responseMonitoring!
    const providerMissing: RelationshipPacketApiResponse = {
      ...packetResponse,
      responseMonitoring: {
        ...responseMonitoring,
        gmailResponseImportReadiness: {
          ...responseMonitoring.gmailResponseImportReadiness,
          activationReadiness: buildWarmOutreachGmailResponseImportActivationReadiness({
            providerConfigured: false,
          }),
          canaryReadiness: buildWarmOutreachGmailResponseImportCanaryReadiness({
            activationReadiness: buildWarmOutreachGmailResponseImportActivationReadiness({
              providerConfigured: false,
            }),
            contactId: 42,
            queueId: 'queue-1',
            gmailThreadId: 'gmail-thread-42',
            dedupeKey: 'gmail_thread:gmail-thread-42',
          }),
        },
      },
    }

    render(<RelationshipPacketPanel loading={false} error={null} data={providerMissing} />)

    expect(screen.getByText('Activation readiness: Gmail provider missing')).toBeInTheDocument()
    expect(screen.getByText('Mock: ready / live: disabled')).toBeInTheDocument()
    expect(screen.getAllByText('Provider: missing').length).toBeGreaterThan(0)
    expect(screen.getByText('Gate state: Gmail response import provider configuration is missing.')).toBeInTheDocument()
    expect(screen.getByText('Gmail response import not connected')).toBeInTheDocument()
  })

  it('renders response-import canary found, no-response, duplicate, and retry states', () => {
    const responseMonitoring = packetResponse.responseMonitoring!
    const baseCanary = responseMonitoring.gmailResponseImportReadiness.canaryReadiness
    const variants = [
      {
        state: 'imported_response_found',
        label: 'Imported response found in dry-run',
        outcome: 'mock_response_found',
        retryAvailable: false,
        decisionState: 'candidate_ready_for_import',
      },
      {
        state: 'no_response_found',
        label: 'No Gmail response found',
        outcome: 'no_response_found',
        retryAvailable: true,
        decisionState: 'no_response_found',
      },
      {
        state: 'duplicate_deduped',
        label: 'Duplicate Gmail response deduped',
        outcome: 'duplicate_deduped',
        retryAvailable: false,
        decisionState: 'duplicate_blocked',
      },
      {
        state: 'error_retry',
        label: 'Gmail response import retry required',
        outcome: 'error',
        retryAvailable: true,
        decisionState: 'error_retry',
      },
    ] as const

    for (const variant of variants) {
      const { unmount } = render(
        <RelationshipPacketPanel
          loading={false}
          error={null}
          data={{
            ...packetResponse,
            responseMonitoring: {
              ...responseMonitoring,
              gmailResponseImportReadiness: {
                ...responseMonitoring.gmailResponseImportReadiness,
                canaryReadiness: {
                  ...baseCanary,
                  state: variant.state,
                  label: variant.label,
                  retryAvailable: variant.retryAvailable,
                  latestOutcome: {
                    ...baseCanary.latestOutcome,
                    status: variant.outcome,
                    detail: variant.label,
                  },
                  provenance: {
                    ...baseCanary.provenance,
                    decisionState: variant.decisionState,
                  },
                },
              },
            },
          }}
        />,
      )

      expect(screen.getByText(variant.label)).toBeInTheDocument()
      expect(screen.getByText(`Decision: ${variant.decisionState.replace(/_/g, ' ')}`)).toBeInTheDocument()
      expect(screen.getByText(`Outcome: ${variant.outcome.replace(/_/g, ' ')}`)).toBeInTheDocument()
      expect(screen.getByText(`Retry: ${variant.retryAvailable ? 'available' : 'not needed'}`)).toBeInTheDocument()
      unmount()
    }
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
                      gmailOperatingLoop: {
                        ...emailItem.emailSendLifecycle!.gmailOperatingLoop,
                        operatorContext: {
                          ...emailItem.emailSendLifecycle!.gmailOperatingLoop.operatorContext,
                          gmailDraftId: 'r3600377219184694601',
                          gmailThreadId: '1a043d900ee02b0f',
                        },
                        executionGate: {
                          ...emailItem.emailSendLifecycle!.gmailOperatingLoop.executionGate,
                          requiredEvidence: {
                            ...emailItem.emailSendLifecycle!.gmailOperatingLoop.executionGate.requiredEvidence,
                            gmailDraftId: 'r3600377219184694601',
                          },
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
    expect(screen.getByText('Draft: r3600377219184694601')).toBeInTheDocument()
    expect(screen.getByText(/tracking evidence only; external send still needs separate approval/i)).toBeInTheDocument()
    expect(screen.getByText('External send blocked')).toBeInTheDocument()
    expect(screen.getByText('separate external send authority')).toBeInTheDocument()
    expect(screen.getByText('Draft evidence: tracked Gmail draft')).toBeInTheDocument()
    expect(screen.getByText('Recipient approval: required')).toBeInTheDocument()
    expect(screen.getByText('External Gmail send authority blocked')).toBeInTheDocument()
    expect(screen.getByText('Draft creation: off')).toBeInTheDocument()
    expect(screen.getByText('External send: off')).toBeInTheDocument()
  })

  it('renders SMS readiness and records only local manual operating-loop state', async () => {
    const previousFetch = globalThis.fetch
    const previousNavigator = globalThis.navigator
    const fetchMock = vi.fn()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('navigator', {
      ...previousNavigator,
      clipboard: { writeText },
    })
    const smsReady: RelationshipPacketApiResponse = {
      ...packetResponse,
      smsReadiness: buildWarmSmsReadiness({
        packet: packetResponse.packet,
        readiness: packetResponse.readiness,
      }),
    }

    render(<RelationshipPacketPanel loading={false} error={null} data={smsReady} />)

    expect(screen.getByText('Warm SMS manual readiness')).toBeInTheDocument()
    expect(screen.getByText('SMS draft needs manual review')).toBeInTheDocument()
    expect(screen.getByText('No SMS provider')).toBeInTheDocument()
    expect(screen.getByText('Warm SMS provider readiness · activation architecture')).toBeInTheDocument()
    expect(screen.getByText('SMS consent or suppression checks not satisfied')).toBeInTheDocument()
    const criticalBoundaries = [...document.querySelectorAll('[data-sms-provider-critical-boundary]')]
      .map((element) => element.textContent)
    expect(criticalBoundaries).toEqual(expect.arrayContaining([
      'Provider calls: off',
      'Live send: off',
      'Generic proceed: rejected',
      'Approval: per-recipient required',
    ]))
    const providerDetails = screen.getByTestId('warm-sms-provider-details')
    expect(providerDetails).not.toHaveAttribute('open')
    expect(screen.getByTestId('warm-sms-activation-next-step')).toHaveTextContent(
      /verified phone provenance and a source note are required/i,
    )
    expect(document.querySelector('[data-sms-activation-summary]')).toHaveTextContent(
      /Provider not selected · selection not selected · configuration not reviewed · capabilities 0\/6 verified · idempotency contract only/i,
    )
    expect(document.querySelector('[data-sms-provider-setup-summary]')).toHaveTextContent(
      /No provider path selected \/ not selected/i,
    )
    expect(document.querySelector('[data-sms-provider-setup-summary]')).toHaveTextContent(
      /Credentials read: no · env changed: no/i,
    )
    fireEvent.click(screen.getByText('Activation requirements and audit evidence'))
    expect(providerDetails).toHaveAttribute('open')
    fireEvent.click(screen.getByText('Activation requirements and audit evidence'))
    expect(providerDetails).not.toHaveAttribute('open')
    expect(document.querySelector('[data-sms-provider-setup-path]')).toHaveTextContent(
      /Provider setup path/i,
    )
    expect(document.querySelector('[data-sms-provider-setup-path]')).toHaveTextContent(
      /Twilio Messaging/i,
    )
    expect(document.querySelector('[data-sms-provider-setup-path]')).toHaveTextContent(
      /Custom disabled adapter/i,
    )
    expect(document.querySelectorAll('[data-sms-provider-setup-candidate]')).toHaveLength(4)
    expect(document.querySelector('[data-sms-configuration-validation]')).toHaveTextContent(
      /Environment and config validation/i,
    )
    expect(document.querySelector('[data-sms-configuration-validation]')).toHaveTextContent(
      /ENABLE_WARM_SMS_PROVIDER_EXECUTION · disabled verified/i,
    )
    expect(document.querySelector('[data-sms-configuration-validation]')).toHaveTextContent(
      /Raw value returned: no/i,
    )
    expect(document.querySelectorAll('[data-sms-provider-config-item]')).toHaveLength(6)
    expect(document.querySelector('[data-sms-operator-setup-path]')).toHaveTextContent(
      /Blocked by setup/i,
    )
    expect(document.querySelector('[data-sms-operator-setup-path]')).toHaveTextContent(
      /Live SMS delivery/i,
    )
    expect(document.querySelector('[data-sms-operator-setup-path]')).toHaveTextContent(
      /Current per-recipient approval matched to contact, SMS channel, message version, and idempotency key/i,
    )
    expect(screen.getByText('Permission / consent note')).toBeInTheDocument()
    expect(screen.getByText('Consent audit timestamp')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-sms-provider-capability]')).toHaveLength(6)
    expect(document.querySelector('[data-sms-idempotency-model]')).toHaveTextContent(
      /return existing attempt evidence without resending/i,
    )
    expect(document.querySelector('[data-sms-recovery-path]')).toHaveTextContent(
      /current per-recipient approval matched to the message version and idempotency key/i,
    )
    expect(screen.getByText(/Phone: present from contact_submissions.phone_number/)).toBeInTheDocument()
    expect(screen.getByText('Phone number present')).toBeInTheDocument()
    expect(screen.getByText('Phone source provenance')).toBeInTheDocument()
    expect(screen.getByText('Relationship rationale')).toBeInTheDocument()
    expect(screen.getByText('Opt-out sensitivity')).toBeInTheDocument()
    expect(screen.getAllByText('Manual only').length).toBeGreaterThan(0)
    const smsDraftTextarea = screen.getByRole('textbox', { name: 'Warm SMS draft text' }) as HTMLTextAreaElement
    expect(smsDraftTextarea.value).toMatch(/Hi Ada/)
    expect(smsDraftTextarea).toHaveClass('bg-imperial-navy/90')
    expect(smsDraftTextarea).toHaveClass('text-platinum-white')
    expect(smsDraftTextarea).toHaveClass('placeholder:text-muted-foreground')
    expect(smsDraftTextarea).toHaveClass('[color-scheme:dark]')
    expect(screen.getByText('SMS drafting aids and boundary')).toBeInTheDocument()
    expect(screen.getAllByText('Community relationship').length).toBeGreaterThan(0)
    expect(screen.getByText('Not reviewed')).toBeInTheDocument()
    expect(screen.getByText('Manual SMS operating loop')).toBeInTheDocument()
    expect(screen.getAllByText('Readiness reviewed').length).toBeGreaterThan(0)
    expect(screen.getByText('Manual-send prepared')).toBeInTheDocument()
    expect(screen.getByText('Manual-send evidence recorded')).toBeInTheDocument()
    expect(screen.getByText('Response expected')).toBeInTheDocument()
    expect(screen.getByText('Response received')).toBeInTheDocument()
    expect(screen.getByText('Follow-up draft needed')).toBeInTheDocument()
    expect(screen.getByText('Suppressed / stop')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy approved draft' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Prepare manual use' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(screen.getByText('Approved for manual use')).toBeInTheDocument()
    expect(screen.getByText(/Manual readiness is recorded on this screen only/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copy approved draft' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^Hi Ada/)))
    expect(screen.getByText(/Approved SMS draft copied/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Prepare manual use' }))
    expect(screen.getAllByText('Manual-send prepared').length).toBeGreaterThan(0)
    const operatorNoteTextarea = screen.getByLabelText('Operator note') as HTMLTextAreaElement
    expect(operatorNoteTextarea).toHaveClass('bg-imperial-navy/90')
    expect(operatorNoteTextarea).toHaveClass('text-platinum-white')
    expect(operatorNoteTextarea).toHaveClass('caret-radiant-gold')
    expect(operatorNoteTextarea).toHaveClass('placeholder:text-muted-foreground')
    expect(operatorNoteTextarea).toHaveClass('[color-scheme:dark]')
    const outcomeSelect = screen.getByLabelText('Manual SMS response outcome') as HTMLSelectElement
    expect(outcomeSelect).toHaveClass('bg-imperial-navy/90')
    expect(outcomeSelect).toHaveClass('text-platinum-white')
    expect(outcomeSelect).toHaveClass('[color-scheme:dark]')
    fireEvent.change(screen.getByLabelText('Operator note'), {
      target: { value: 'Sent manually from phone after reviewing the consent basis.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Record manual evidence' }))
    expect(screen.getAllByText('Response expected').length).toBeGreaterThan(0)
    expect(screen.getByText(/Evidence: complete at/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Manual SMS response outcome'), {
      target: { value: 'interested' },
    })
    expect(screen.getAllByText('Follow-up draft needed').length).toBeGreaterThan(0)
    expect(screen.getByText('Follow-up draft: needed')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Manual SMS response outcome'), {
      target: { value: 'stop_opt_out' },
    })
    expect(screen.getAllByText('Suppressed / stop').length).toBeGreaterThan(0)
    expect(screen.getByText('SMS prompts: suppressed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy approved draft' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Revise' }))
    expect(screen.queryByText('Revision requested')).not.toBeInTheDocument()
    const textarea = screen.getByLabelText('Warm SMS draft text')
    expect(textarea).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(screen.getByText('Rejected')).toBeInTheDocument()
    expect(screen.getByText(/SMS delivery, provider calls, phone import, Slack, Gmail, n8n, and production mutation are off/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    vi.stubGlobal('fetch', previousFetch)
    vi.stubGlobal('navigator', previousNavigator)
  })

  it('shows clipboard fallback without making external or provider calls', async () => {
    const previousFetch = globalThis.fetch
    const previousNavigator = globalThis.navigator
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('navigator', {
      ...previousNavigator,
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('blocked clipboard')),
      },
    })
    const smsReady: RelationshipPacketApiResponse = {
      ...packetResponse,
      smsReadiness: buildWarmSmsReadiness({
        packet: packetResponse.packet,
        readiness: packetResponse.readiness,
      }),
    }

    render(<RelationshipPacketPanel loading={false} error={null} data={smsReady} />)

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy approved draft' }))
    expect(await screen.findByText(/Clipboard unavailable/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    vi.stubGlobal('fetch', previousFetch)
    vi.stubGlobal('navigator', previousNavigator)
  })

  it('keeps revised SMS drafts local and evidence incomplete until minimal fields exist', () => {
    const smsReady: RelationshipPacketApiResponse = {
      ...packetResponse,
      smsReadiness: buildWarmSmsReadiness({
        packet: packetResponse.packet,
        readiness: packetResponse.readiness,
      }),
    }

    render(<RelationshipPacketPanel loading={false} error={null} data={smsReady} />)

    fireEvent.click(screen.getByRole('button', { name: 'Revise' }))
    expect(screen.getByText('Revision requested')).toBeInTheDocument()
    const textarea = screen.getByLabelText('Warm SMS draft text')
    fireEvent.change(textarea, {
      target: {
        value: 'Hi Amina, quick check on the Portfolio QA follow-up. Is this worth a short look this week?',
      },
    })
    expect(screen.getByDisplayValue(/Portfolio QA follow-up/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    fireEvent.click(screen.getByRole('button', { name: 'Prepare manual use' }))
    expect(screen.getByRole('button', { name: 'Record manual evidence' })).toBeDisabled()
    expect(screen.getByText(/Evidence: missing timestamp, operator note/)).toBeInTheDocument()
  })

  it('shows blocked SMS recovery without enabling approval when phone readiness fails', () => {
    const baseSms = buildWarmSmsReadiness({
      packet: {
        ...packetResponse.packet,
        channelCapabilities: {
          ...packetResponse.packet.channelCapabilities,
          phone_contact: {
            available: false,
            providerConfigured: false,
            supportsExternalSend: false,
            manualOnly: true,
            reason: 'No phone number is present.',
          },
        },
      },
      readiness: packetResponse.readiness,
    })
    const blockedSms: RelationshipPacketApiResponse = {
      ...packetResponse,
      smsReadiness: baseSms,
    }

    render(<RelationshipPacketPanel loading={false} error={null} data={blockedSms} />)

    expect(screen.getByText('SMS manual outreach blocked')).toBeInTheDocument()
    expect(screen.getByText(/Phone: missing from missing/)).toBeInTheDocument()
    expect(screen.getByText('Recovery: No phone number is present in the Portfolio contact record.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Warm SMS draft text' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Revise' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(screen.getByText('Rejected')).toBeInTheDocument()
    expect(screen.getByText(/Boundary: manual only yes \/ SMS delivery off \/ provider calls off/)).toBeInTheDocument()
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
      const authorizationStatus = status === 'approved'
        ? 'approved' as const
        : status === 'rejected'
          ? 'rejected' as const
          : status === 'revision_requested'
            ? 'revision_requested' as const
            : 'missing' as const
      const executionState = status === 'approved'
        ? 'approved_for_send' as const
        : status === 'pending'
          ? 'approval_requested' as const
          : 'approval_needed' as const
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
                      gmailOperatingLoop: buildWarmGmailOperatingLoop({
                        contactId: 42,
                        queueId: 'queue-ready',
                        messageVersionKey: emailItem.emailSendLifecycle!.messageVersionKey,
                        sendQueueIdempotencyKey: emailItem.emailSendLifecycle!.sendQueueIdempotencyKey,
                        submittedEvidenceKey: emailItem.emailSendLifecycle!.submittedEvidenceKey,
                        internalDraftReady: true,
                        draftTracked: true,
                        providerConfigured: true,
                        senderMatched: true,
                        approvalRequestStatus: status,
                        authorizationStatus,
                        executionState,
                        submittedEvidenceRecorded: false,
                        secondaryLogRepairRequired: false,
                        responseMonitoringAttached: false,
                        hardBlockers: [],
                      }),
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

    expect(screen.getByText('Approval request: pending. Slack dispatch: not sent.')).toBeInTheDocument()
    expect(screen.getAllByText('Approval requested')).not.toHaveLength(0)
    expect(screen.getAllByText('Approval: requested').length).toBeGreaterThan(0)
    expect(screen.getByText('Record approval decision')).toBeInTheDocument()
    expect(screen.getByText(/Slack dispatch: off\. Gmail send: off\. Response polling: off/)).toBeInTheDocument()

    for (const status of ['approved', 'rejected', 'revision_requested'] as const) {
      rerender(
          <RelationshipPacketPanel
            loading={false}
            error={null}
            data={responseWithSlackStatus(status)}
          />,
      )
      expect(screen.getByText(
        `Approval request: ${status === 'revision_requested' ? 'revision requested' : status}. Slack dispatch: not sent.`,
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

    const button = screen.getByRole('button', { name: 'Request send approval' })
    expect(button).toBeEnabled()

    fireEvent.click(button)

    expect(await screen.findByText(
      `QA local Slack approval request recorded for ${WARM_SLACK_SEND_APPROVAL_QA_QUEUE_ID}. Slack dispatch off. Gmail send off. Provider calls off.`,
    )).toBeInTheDocument()
    expect(screen.getByText('Canary proof receipt')).toBeInTheDocument()
    expect(screen.getByLabelText('Live Gmail send disabled')).toBeInTheDocument()
    expect(screen.getByText(
      'Approval intent: not sent. Gmail auth: missing.',
    )).toBeInTheDocument()
    expect(screen.getByText('Draft evidence: tracked. Sender: matched.')).toBeInTheDocument()
    expect(screen.getByText('Send evidence: none. Gmail execution: disabled.')).toBeInTheDocument()
    expect(screen.getByText('Proof details')).toBeInTheDocument()
    expect(screen.getByText(`Queue row: ${WARM_SLACK_SEND_APPROVAL_QA_QUEUE_ID}`)).toBeInTheDocument()
    expect(screen.getByText('Gmail response import')).toBeInTheDocument()
    expect(screen.getByText('Mock Gmail response import ready')).toBeInTheDocument()
    expect(screen.getByText('Live import off')).toBeInTheDocument()
    expect(screen.getByText(`Queue: ${WARM_SLACK_SEND_APPROVAL_QA_QUEUE_ID}`)).toBeInTheDocument()
    expect(screen.getByText(/Use Request send approval in this contact workroom/)).toBeInTheDocument()
    expect(screen.getAllByText('Approval requested')).not.toHaveLength(0)
    expect(screen.getByText('Record approval decision')).toBeInTheDocument()
    expect(screen.getByText('SMS provider configured but disabled')).toBeInTheDocument()
    expect(screen.getByText('Provider configured · disabled')).toBeInTheDocument()
    expect(screen.getByText('Provider: configured / disabled')).toBeInTheDocument()
    expect(screen.getByText('Generic proceed: rejected')).toBeInTheDocument()
    expect(screen.getByText('Approval: per-recipient required')).toBeInTheDocument()
    expect(screen.getByTestId('warm-sms-activation-next-step')).toHaveTextContent(
      /Document a disabled configuration review with secrets excluded/i,
    )
    expect(document.querySelector('[data-sms-activation-summary]')).toHaveTextContent(
      /Synthetic future SMS adapter · selection selected · configuration planned disabled · capabilities 2\/6 verified · idempotency contract only/i,
    )
    expect(document.querySelectorAll('[data-sms-provider-capability]')).toHaveLength(6)
    expect(screen.getByTestId('warm-sms-provider-details')).not.toHaveAttribute('open')
    expect(screen.getByText('Manual SMS operating loop')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled()
    expect(fetchMock).not.toHaveBeenCalled()

    vi.stubGlobal('fetch', previousFetch)
  })
})
