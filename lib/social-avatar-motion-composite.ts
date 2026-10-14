import { createHash } from 'node:crypto'

export const SOCIAL_AVATAR_MOTION_PIPELINE_VERSION = 'social_avatar_motion_composite_v1' as const
export const SOCIAL_AVATAR_MOTION_PROVIDER = 'heygen' as const
export const SOCIAL_AVATAR_MOTION_MAX_USD = 10

type ApprovalStatus = 'approved' | 'passed' | 'complete'

export type VersionBoundReceipt = {
  receiptId: string
  status: ApprovalStatus
  inputVersion: string
  reviewedAt: string
  validUntil: string
}

export type AvatarMotionPacket = {
  version: typeof SOCIAL_AVATAR_MOTION_PIPELINE_VERSION
  socialContentId: string
  contentVersion: string
  target: 'youtube_long_form' | 'youtube_shorts'
  aspectRatio: '16:9' | '9:16'
  script: {
    text: string
    sha256: string
    status: 'approved'
  }
  avatar: {
    id: string
    version: string
    name: string
    status: 'approved'
  }
  voice: {
    id: string
    version: string
    name: string
    status: 'approved'
  }
  receipts: {
    consentRights: VersionBoundReceipt & {
      avatarId: string
      voiceId: string
      authorizationScope: string
    }
    privacy: VersionBoundReceipt
    source: VersionBoundReceipt
  }
  motionMaster: {
    path: string
    sha256: string
    status: 'approved'
    durationSeconds: number
    width: number
    height: number
    fps: number
  }
  providerAuthorization: {
    provider: typeof SOCIAL_AVATAR_MOTION_PROVIDER
    authorizationId: string
    status: 'approved'
    approvedAt: string
    expiresAt: string
    maxCostUsd: number
    worstCaseRateUsdPerMinute: number
    maxBillableSeconds: number
    maxProviderJobs: 1
    maxScriptCharacters: number
  }
  customerFacingText: string[]
}

export type AvatarMotionProviderReceipt = {
  idempotencyKey: string
  provider: typeof SOCIAL_AVATAR_MOTION_PROVIDER
  providerJobId: string
  outputSha256: string
  durationSeconds: number
  costUsd: number
  status: 'completed'
}

export type AvatarMotionReplayDecision =
  | { action: 'create'; idempotencyKey: string }
  | { action: 'reuse'; idempotencyKey: string; receipt: AvatarMotionProviderReceipt }
  | { action: 'reconcile'; idempotencyKey: string; reason: string }

export type MediaProbe = {
  streams?: Array<{
    codec_type?: string
    codec_name?: string
    width?: number
    height?: number
    channels?: number
  }>
  format?: { duration?: string | number }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  )
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

export function canonicalSha256(value: unknown): string {
  return sha256(JSON.stringify(canonicalize(value)))
}

export function avatarMotionWorstCaseCostUsd(packet: AvatarMotionPacket): number {
  const { worstCaseRateUsdPerMinute, maxBillableSeconds } = packet.providerAuthorization
  return Number(((worstCaseRateUsdPerMinute * maxBillableSeconds) / 60).toFixed(4))
}

function validateReceipt(
  label: string,
  receipt: VersionBoundReceipt,
  contentVersion: string,
  now: Date,
  blockers: string[],
) {
  if (!receipt.receiptId.trim()) blockers.push(`${label} receipt is missing its ID.`)
  if (!['approved', 'passed', 'complete'].includes(receipt.status)) blockers.push(`${label} receipt is not approved.`)
  if (receipt.inputVersion !== contentVersion) blockers.push(`${label} receipt is stale or version-mismatched.`)
  if (!Number.isFinite(Date.parse(receipt.reviewedAt))) blockers.push(`${label} receipt has an invalid review timestamp.`)
  if (!Number.isFinite(Date.parse(receipt.validUntil)) || Date.parse(receipt.validUntil) <= now.getTime()) {
    blockers.push(`${label} receipt is expired.`)
  }
}

export function validateAvatarMotionPacket(packet: AvatarMotionPacket, now = new Date()): string[] {
  const blockers: string[] = []
  if (packet.version !== SOCIAL_AVATAR_MOTION_PIPELINE_VERSION) blockers.push('Unsupported avatar-motion packet version.')
  if (!packet.socialContentId.trim()) blockers.push('Social Content ID is required.')
  if (!/^sha256:[a-f0-9]{64}$/.test(packet.contentVersion)) blockers.push('Content version must be a SHA-256 binding.')
  if (packet.script.status !== 'approved') blockers.push('Script is not approved.')
  if (`sha256:${sha256(packet.script.text)}` !== packet.script.sha256) blockers.push('Script hash does not match the approved text.')
  if (!packet.avatar.id.trim() || packet.avatar.status !== 'approved') blockers.push('Approved avatar is required.')
  if (!packet.voice.id.trim() || packet.voice.status !== 'approved') blockers.push('Approved voice is required.')
  if (!packet.avatar.version.trim()) blockers.push('Avatar version is required.')
  if (!packet.voice.version.trim()) blockers.push('Voice version is required.')
  if (packet.receipts.consentRights.avatarId !== packet.avatar.id) blockers.push('Consent and rights receipt does not bind the selected avatar.')
  if (packet.receipts.consentRights.voiceId !== packet.voice.id) blockers.push('Consent and rights receipt does not bind the selected voice.')
  if (!packet.receipts.consentRights.authorizationScope.trim()) blockers.push('Consent and rights authorization scope is required.')
  validateReceipt('Consent and rights', packet.receipts.consentRights, packet.contentVersion, now, blockers)
  validateReceipt('Privacy', packet.receipts.privacy, packet.contentVersion, now, blockers)
  validateReceipt('Source', packet.receipts.source, packet.contentVersion, now, blockers)
  if (packet.motionMaster.status !== 'approved') blockers.push('Motion master is not approved.')
  if (!/^[a-f0-9]{64}$/.test(packet.motionMaster.sha256)) blockers.push('Motion-master hash is invalid.')
  if (packet.motionMaster.durationSeconds <= 0 || packet.motionMaster.width <= 0 || packet.motionMaster.height <= 0 || packet.motionMaster.fps <= 0) {
    blockers.push('Motion-master probe is incomplete.')
  }
  const expectedRatio = packet.motionMaster.height > packet.motionMaster.width ? '9:16' : '16:9'
  if (packet.aspectRatio !== expectedRatio) blockers.push('Aspect ratio does not match the motion master.')
  const authorization = packet.providerAuthorization
  if (authorization.provider !== SOCIAL_AVATAR_MOTION_PROVIDER || authorization.status !== 'approved') blockers.push('Bounded HeyGen authorization is required.')
  if (!authorization.authorizationId.trim()) blockers.push('Provider authorization ID is required.')
  if (authorization.maxProviderJobs !== 1) blockers.push('Provider authorization must permit exactly one job.')
  if (!(authorization.maxCostUsd > 0 && authorization.maxCostUsd < SOCIAL_AVATAR_MOTION_MAX_USD)) blockers.push('Provider cost cap must be strictly below US$10.')
  if (!(authorization.worstCaseRateUsdPerMinute > 0 && authorization.maxBillableSeconds > 0)) blockers.push('Provider pricing bound is incomplete.')
  if (avatarMotionWorstCaseCostUsd(packet) > authorization.maxCostUsd) blockers.push('Worst-case provider cost exceeds the authorized cap.')
  if (packet.script.text.length > authorization.maxScriptCharacters) blockers.push('Script exceeds the bounded provider authorization.')
  if (!Number.isFinite(Date.parse(authorization.expiresAt)) || Date.parse(authorization.expiresAt) <= now.getTime()) blockers.push('Provider authorization is expired.')
  const forbidden = /\b(?:qa|receipt|provider|implementation|prompt|sha256|job id|internal)\b/i
  for (const text of [packet.script.text, ...packet.customerFacingText]) {
    if (forbidden.test(text)) blockers.push('Customer-facing text contains internal production language.')
  }
  return [...new Set(blockers)]
}

export function assertAvatarMotionPacket(packet: AvatarMotionPacket, now = new Date()): void {
  const blockers = validateAvatarMotionPacket(packet, now)
  if (blockers.length) throw new Error(blockers.join(' '))
}

export function validateHeyGenProviderAssets(input: {
  packet: AvatarMotionPacket
  avatars: Array<{ id: string; status?: string | null }>
  voices: Array<{ id: string; status?: string | null }>
}): string[] {
  const blockers: string[] = []
  const avatar = input.avatars.find((value) => value.id === input.packet.avatar.id)
  const voice = input.voices.find((value) => value.id === input.packet.voice.id)
  if (!avatar) blockers.push('Selected avatar is not available in the current HeyGen catalog.')
  if (avatar?.status && !['ready', 'completed', 'active'].includes(avatar.status)) blockers.push('Selected avatar is not ready for generation.')
  if (!voice) blockers.push('Selected voice is not available in the current HeyGen catalog.')
  if (voice?.status && !['ready', 'completed', 'active'].includes(voice.status)) blockers.push('Selected voice is not ready for generation.')
  return blockers
}

export function validateCompositeProbe(probe: MediaProbe, expected: { durationSeconds: number; width: number; height: number }): string[] {
  const blockers: string[] = []
  const video = probe.streams?.find((stream) => stream.codec_type === 'video')
  const audio = probe.streams?.find((stream) => stream.codec_type === 'audio')
  if (!video) blockers.push('Final composite has no video stream.')
  if (!audio || !(Number(audio.channels ?? 0) > 0)) blockers.push('Final composite has no playable audio stream.')
  if (video && (Number(video.width) !== expected.width || Number(video.height) !== expected.height)) blockers.push('Final composite dimensions do not match the approved motion master.')
  const duration = Number(probe.format?.duration)
  if (!Number.isFinite(duration) || Math.abs(duration - expected.durationSeconds) > 0.1) blockers.push('Final composite duration does not match the approved motion master.')
  return blockers
}

export function buildAvatarMotionIdempotencyKey(packet: AvatarMotionPacket): string {
  const binding = {
    version: packet.version,
    socialContentId: packet.socialContentId,
    contentVersion: packet.contentVersion,
    scriptSha256: packet.script.sha256,
    avatarId: packet.avatar.id,
    avatarVersion: packet.avatar.version,
    voiceId: packet.voice.id,
    voiceVersion: packet.voice.version,
    motionMasterSha256: packet.motionMaster.sha256,
    aspectRatio: packet.aspectRatio,
    authorizationId: packet.providerAuthorization.authorizationId,
  }
  return `social-avatar-motion:${canonicalSha256(binding)}`
}

export function decideAvatarMotionReplay(input: {
  packet: AvatarMotionPacket
  existing?: {
    idempotencyKey: string
    status: 'reserved' | 'submitted' | 'completed' | 'failed'
    receipt?: AvatarMotionProviderReceipt | null
  } | null
}): AvatarMotionReplayDecision {
  const idempotencyKey = buildAvatarMotionIdempotencyKey(input.packet)
  if (!input.existing) return { action: 'create', idempotencyKey }
  if (input.existing.idempotencyKey !== idempotencyKey) {
    return { action: 'reconcile', idempotencyKey, reason: 'Existing provider state belongs to a different version binding.' }
  }
  if (input.existing.status === 'completed' && input.existing.receipt) {
    return { action: 'reuse', idempotencyKey, receipt: input.existing.receipt }
  }
  return {
    action: 'reconcile',
    idempotencyKey,
    reason: 'A provider attempt already exists without a reusable completed receipt; reconcile it before another job.',
  }
}

export function buildAvatarMotionCompositeManifest(input: {
  packet: AvatarMotionPacket
  providerReceipt: AvatarMotionProviderReceipt
  presenterSourcePath: string
  outputPath: string
  outputSha256: string
  ffmpegCommand: string
  presenterWindows: Array<{ sourceStart: number; sourceEnd: number; outputStart: number; x: number; y: number; width: number; height: number }>
}) {
  assertAvatarMotionPacket(input.packet)
  const idempotencyKey = buildAvatarMotionIdempotencyKey(input.packet)
  if (input.providerReceipt.idempotencyKey !== idempotencyKey) throw new Error('Provider receipt does not match this packet idempotency key.')
  if (!input.providerReceipt.outputSha256) throw new Error('Provider output hash is required.')
  if (!(input.providerReceipt.costUsd >= 0 && input.providerReceipt.costUsd <= input.packet.providerAuthorization.maxCostUsd)) {
    throw new Error('Provider cost receipt exceeds the authorized cap.')
  }
  if (input.presenterWindows.length < 2) throw new Error('Presenter must be used intentionally in at least two bounded windows.')
  return {
    version: SOCIAL_AVATAR_MOTION_PIPELINE_VERSION,
    idempotency_key: idempotencyKey,
    social_content_id: input.packet.socialContentId,
    content_version: input.packet.contentVersion,
    script_sha256: input.packet.script.sha256,
    avatar: { id: input.packet.avatar.id, version: input.packet.avatar.version },
    voice: { id: input.packet.voice.id, version: input.packet.voice.version },
    provider: {
      name: input.providerReceipt.provider,
      job_id: input.providerReceipt.providerJobId,
      output_sha256: input.providerReceipt.outputSha256,
      duration_seconds: input.providerReceipt.durationSeconds,
      cost_usd: input.providerReceipt.costUsd,
      authorization_id: input.packet.providerAuthorization.authorizationId,
      max_cost_usd: input.packet.providerAuthorization.maxCostUsd,
    },
    motion_master_sha256: input.packet.motionMaster.sha256,
    consent_rights_receipt_id: input.packet.receipts.consentRights.receiptId,
    privacy_receipt_id: input.packet.receipts.privacy.receiptId,
    source_receipt_id: input.packet.receipts.source.receiptId,
    presenter_source_path: input.presenterSourcePath,
    presenter_windows: input.presenterWindows,
    output_path: input.outputPath,
    output_sha256: input.outputSha256,
    ffmpeg_command: input.ffmpegCommand,
    gates: {
      youtube_upload: false,
      platform_draft: false,
      schedule: false,
      publish: false,
      external_send: false,
    },
  }
}
