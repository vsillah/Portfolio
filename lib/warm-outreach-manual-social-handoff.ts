import { createHash } from 'crypto'

import type {
  WarmOutreachChannel,
  WarmOutreachReadiness,
  WarmOutreachRelationshipPacket,
} from './warm-outreach-relationship-intelligence'

export const warmManualSocialHandoffChannels = [
  'linkedin',
  'facebook',
  'phone_contact',
] as const

export type WarmManualSocialHandoffChannel =
  (typeof warmManualSocialHandoffChannels)[number]

export type WarmManualSocialHandoffChannelState =
  | 'ready_for_manual_copy'
  | 'blocked'
  | 'unavailable'

export type WarmManualSocialHandoffChannelPacket = {
  channel: WarmManualSocialHandoffChannel
  label: string
  state: WarmManualSocialHandoffChannelState
  blocker: string | null
  preview: string
  maxRecommendedCharacters: number
  checklist: Array<{
    key:
      | 'relationship_basis'
      | 'suppression'
      | 'copy_manually'
      | 'record_minimal_evidence'
      | 'no_provider_automation'
    label: string
    status: 'ready' | 'blocked' | 'manual_required'
  }>
  idempotency: {
    messageVersionKey: string
    manualHandoffKey: string
    manualEvidenceKey: string
    duplicateScope: 'contact_channel_message_version'
  }
  executionBoundary: {
    manualOnly: true
    providerCallsEnabled: false
    externalSendEnabled: false
    linkedinApiEnabled: false
    facebookApiEnabled: false
    phoneAccessEnabled: false
    smsDeliveryEnabled: false
    gmailDraftCreationEnabled: false
    slackDispatchEnabled: false
    n8nDispatchEnabled: false
    productionDataMutation: false
    externalRequests: []
  }
  evidencePolicy: {
    requiredFields: ['timestamp', 'channel', 'operator_note']
    storesRawMessageBody: false
    storesRawContactDetails: false
    requiresScreenshot: false
    detail: string
  }
}

export type WarmManualSocialHandoff = {
  version: 'warm-outreach-manual-social-handoff/v1'
  contactId: string
  contactName: string | null
  state: 'ready' | 'blocked'
  label: string
  currentCta: {
    key: 'copy_manual_text' | 'review_blocker'
    label: string
    enabled: boolean
    channel: WarmManualSocialHandoffChannel | null
  }
  channels: WarmManualSocialHandoffChannelPacket[]
  auditState: {
    recordsManualEvidenceOnly: true
    durableDocsExcludeRawSecretsAndContactDetails: true
    providerAutomationBlocked: true
    detail: string
  }
  executionBoundary: {
    manualCopyOnly: true
    providerCallsEnabled: false
    externalSendEnabled: false
    gmailDraftCreationEnabled: false
    slackDispatchEnabled: false
    smsDeliveryEnabled: false
    n8nDispatchEnabled: false
    productionDataMutation: false
    externalRequests: []
  }
}

const CHANNEL_LABELS: Record<WarmManualSocialHandoffChannel, string> = {
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  phone_contact: 'Phone contact',
}

const MAX_CHARS: Record<WarmManualSocialHandoffChannel, number> = {
  linkedin: 300,
  facebook: 360,
  phone_contact: 240,
}

function stableHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 20)
}

function compact(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.replace(/\s+/g, ' ').trim()
  return trimmed ? trimmed : fallback
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 3).trim()}...`
}

function firstName(contactName: string | null | undefined): string {
  const name = compact(contactName, 'there')
  return name.split(/\s+/)[0] || 'there'
}

function safeReference(packet: WarmOutreachRelationshipPacket): string {
  const explicitSafe = packet.sourceInventory?.safeToMention?.[0]
  const signal = packet.relationshipSignals[0]
  const commonality = packet.commonalities[0]
  return compact(explicitSafe ?? signal ?? commonality, packet.relationshipBasis)
}

function previewFor(
  channel: WarmManualSocialHandoffChannel,
  packet: WarmOutreachRelationshipPacket,
): string {
  const name = firstName(packet.contactName)
  const reference = safeReference(packet)
  const nextStep = compact(
    packet.suggestedNextStep,
    'compare notes on whether an AmaduTown operating-system review would be useful',
  )

  if (channel === 'linkedin') {
    return truncate(
      `Hi ${name}, I was thinking about ${reference}. I am building AmaduTown around practical AI and operations support for teams that need more capacity without more burden. Would it be useful to compare notes for 15 minutes?`,
      MAX_CHARS[channel],
    )
  }

  if (channel === 'facebook') {
    return truncate(
      `Hi ${name}, hope you are well. ${reference} came back to mind while I was reviewing warm follow-ups in Portfolio. I would value a quick conversation about ${nextStep}.`,
      MAX_CHARS[channel],
    )
  }

  return truncate(
    `Hi ${name}, this is Vambah. Reaching out because ${packet.relationshipBasis}. If useful, I would like to ${nextStep}.`,
    MAX_CHARS[channel],
  )
}

function channelBlocker(
  channel: WarmManualSocialHandoffChannel,
  packet: WarmOutreachRelationshipPacket,
  readiness: WarmOutreachReadiness,
): string | null {
  const capability = packet.channelCapabilities[channel]
  if (readiness.status === 'blocked') {
    return readiness.blockers[0] ?? 'Resolve relationship readiness before manual handoff.'
  }
  if (!capability?.available) {
    return `${CHANNEL_LABELS[channel]} is not recorded for this contact.`
  }
  return null
}

function checklistFor(blocked: boolean): WarmManualSocialHandoffChannelPacket['checklist'] {
  return [
    {
      key: 'relationship_basis',
      label: 'Warm basis reviewed',
      status: blocked ? 'blocked' : 'ready',
    },
    {
      key: 'suppression',
      label: 'Suppression checked',
      status: blocked ? 'blocked' : 'ready',
    },
    {
      key: 'copy_manually',
      label: 'Copy into the channel manually',
      status: blocked ? 'blocked' : 'manual_required',
    },
    {
      key: 'record_minimal_evidence',
      label: 'Record timestamp, channel, and note only',
      status: blocked ? 'blocked' : 'manual_required',
    },
    {
      key: 'no_provider_automation',
      label: 'Provider automation stays off',
      status: 'manual_required',
    },
  ]
}

function buildChannelPacket(args: {
  channel: WarmManualSocialHandoffChannel
  packet: WarmOutreachRelationshipPacket
  readiness: WarmOutreachReadiness
}): WarmManualSocialHandoffChannelPacket {
  const blocker = channelBlocker(args.channel, args.packet, args.readiness)
  const unavailable = !args.packet.channelCapabilities[args.channel]?.available
  const state: WarmManualSocialHandoffChannelState = blocker
    ? unavailable ? 'unavailable' : 'blocked'
    : 'ready_for_manual_copy'
  const hash = stableHash({
    contactId: String(args.packet.contactId),
    channel: args.channel,
    template: args.readiness.recommendedTemplate,
    relationshipEventId: args.packet.relationshipEventId ?? null,
    basis: args.packet.relationshipBasis,
  })
  const messageVersionKey = `warm-outreach:manual-message-version:v1:${hash}`

  return {
    channel: args.channel,
    label: CHANNEL_LABELS[args.channel],
    state,
    blocker,
    preview: state === 'ready_for_manual_copy'
      ? previewFor(args.channel, args.packet)
      : '',
    maxRecommendedCharacters: MAX_CHARS[args.channel],
    checklist: checklistFor(Boolean(blocker)),
    idempotency: {
      messageVersionKey,
      manualHandoffKey: `warm-outreach:manual-handoff:v1:${hash}`,
      manualEvidenceKey: `warm-outreach:manual-evidence:v1:${hash}`,
      duplicateScope: 'contact_channel_message_version',
    },
    executionBoundary: {
      manualOnly: true,
      providerCallsEnabled: false,
      externalSendEnabled: false,
      linkedinApiEnabled: false,
      facebookApiEnabled: false,
      phoneAccessEnabled: false,
      smsDeliveryEnabled: false,
      gmailDraftCreationEnabled: false,
      slackDispatchEnabled: false,
      n8nDispatchEnabled: false,
      productionDataMutation: false,
      externalRequests: [],
    },
    evidencePolicy: {
      requiredFields: ['timestamp', 'channel', 'operator_note'],
      storesRawMessageBody: false,
      storesRawContactDetails: false,
      requiresScreenshot: false,
      detail:
        'Record only that the manual handoff happened, the channel, timestamp, and a non-sensitive operator note. Do not store raw private messages, phone numbers, screenshots, secrets, or provider identifiers here.',
    },
  }
}

export function buildWarmManualSocialHandoff(args: {
  packet: WarmOutreachRelationshipPacket
  readiness: WarmOutreachReadiness
}): WarmManualSocialHandoff {
  const channels = warmManualSocialHandoffChannels.map((channel) =>
    buildChannelPacket({
      channel,
      packet: args.packet,
      readiness: args.readiness,
    }),
  )
  const firstReady = channels.find((channel) => channel.state === 'ready_for_manual_copy')

  return {
    version: 'warm-outreach-manual-social-handoff/v1',
    contactId: String(args.packet.contactId),
    contactName: args.packet.contactName ?? null,
    state: firstReady ? 'ready' : 'blocked',
    label: firstReady
      ? 'Manual social handoff ready'
      : 'Manual social handoff blocked',
    currentCta: firstReady
      ? {
          key: 'copy_manual_text',
          label: `Copy ${firstReady.label} text`,
          enabled: true,
          channel: firstReady.channel,
        }
      : {
          key: 'review_blocker',
          label: 'Review blocker',
          enabled: false,
          channel: null,
        },
    channels,
    auditState: {
      recordsManualEvidenceOnly: true,
      durableDocsExcludeRawSecretsAndContactDetails: true,
      providerAutomationBlocked: true,
      detail:
        'This handoff is copy-and-record only. It preserves stable contact/channel/message-version keys without enabling provider automation.',
    },
    executionBoundary: {
      manualCopyOnly: true,
      providerCallsEnabled: false,
      externalSendEnabled: false,
      gmailDraftCreationEnabled: false,
      slackDispatchEnabled: false,
      smsDeliveryEnabled: false,
      n8nDispatchEnabled: false,
      productionDataMutation: false,
      externalRequests: [],
    },
  }
}
