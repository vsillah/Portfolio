import { createHash } from 'node:crypto'

export const SOCIAL_AVATAR_MOTION_PIPELINE_VERSION = 'social_avatar_motion_composite_v1' as const
export const SOCIAL_AVATAR_MOTION_PROVIDER = 'heygen' as const
export const SOCIAL_AVATAR_MOTION_MAX_USD = 10
export const SOCIAL_AVATAR_LOOK_SELECTOR_VERSION = 'social_avatar_look_lru_v1' as const
export const HEYGEN_V3_VIDEO_ENDPOINT = '/v3/videos' as const

export type HeyGenAvatarEngine = 'avatar_v' | 'avatar_iv' | 'avatar_iii'
export type HeyGenVoiceEngine = 'elevenlabs' | 'fish' | 'starfish'

export type HeyGenV3ProviderContract = {
  apiVersion: 'v3'
  endpoint: typeof HEYGEN_V3_VIDEO_ENDPOINT
  avatarEngine: HeyGenAvatarEngine
  voiceEngine: HeyGenVoiceEngine
  catalogReceiptId: string
}

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
    identityId?: string
    lookId?: string
    lookVersion?: string
    providerCharacterType?: 'avatar' | 'talking_photo'
    selection?: AvatarLookSelectionReceipt
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
  providerContract?: HeyGenV3ProviderContract
  customerFacingText: string[]
}

export type ApprovedAvatarLook = {
  identityId: string
  identityName: string
  lookId: string
  lookName: string
  lookVersion: string
  providerCharacterType: 'avatar' | 'talking_photo'
  ownership: 'owned' | 'public' | 'third_party'
  approvalStatus: 'approved' | 'pending' | 'blocked'
  availability: 'available' | 'unavailable'
  compatibleTargets: AvatarMotionPacket['target'][]
  consentRightsReceiptId: string
  sourceReceiptId: string
}

export type AvatarLookHistoryEntry = {
  identityId: string
  lookId: string
  providerJobId: string
  status: 'completed' | 'failed' | 'reserved' | 'submitted'
  attemptedAt: string
  completedAt?: string
}

export type AvatarLookSelectionReceipt = {
  selectorVersion: typeof SOCIAL_AVATAR_LOOK_SELECTOR_VERSION
  identityId: string
  lookId: string
  lookVersion: string
  providerCharacterType: ApprovedAvatarLook['providerCharacterType']
  reason: 'campaign_pin' | 'least_recently_used' | 'only_eligible_look'
  selectionKey: string
  sourceReceiptId: string
  consentRightsReceiptId: string
  recentCompletedHistory: Array<Pick<AvatarLookHistoryEntry, 'identityId' | 'lookId' | 'providerJobId' | 'completedAt'>>
}

export function selectedAvatarLookId(packet: AvatarMotionPacket): string {
  return packet.avatar.lookId ?? packet.avatar.id
}

export function selectApprovedAvatarLook(input: {
  looks: ApprovedAvatarLook[]
  history: AvatarLookHistoryEntry[]
  target: AvatarMotionPacket['target']
  selectionKey: string
  pin?: { identityId: string; lookId: string } | null
}): AvatarLookSelectionReceipt {
  if (!input.selectionKey.trim()) throw new Error('A stable avatar-look selection key is required.')
  const completedHistory = input.history
    .filter((entry) => entry.status === 'completed' && Number.isFinite(Date.parse(entry.completedAt ?? '')))
    .sort((left, right) => Date.parse(right.completedAt ?? '') - Date.parse(left.completedAt ?? ''))
  const eligible = input.looks.filter((look) =>
    look.ownership === 'owned'
    && look.approvalStatus === 'approved'
    && look.availability === 'available'
    && look.compatibleTargets.includes(input.target)
    && Boolean(look.identityId.trim())
    && Boolean(look.lookId.trim())
    && Boolean(look.lookVersion.trim())
    && Boolean(look.consentRightsReceiptId.trim())
    && Boolean(look.sourceReceiptId.trim()),
  )
  if (!eligible.length) throw new Error('No owned, approved, available, rights-bound avatar look is compatible with this target.')

  let selected: ApprovedAvatarLook
  let reason: AvatarLookSelectionReceipt['reason']
  if (input.pin) {
    const pinned = eligible.find((look) => look.identityId === input.pin?.identityId && look.lookId === input.pin.lookId)
    if (!pinned) throw new Error('The campaign-pinned avatar look is not eligible; selection failed closed.')
    selected = pinned
    reason = 'campaign_pin'
  } else if (eligible.length === 1) {
    selected = eligible[0]
    reason = 'only_eligible_look'
  } else {
    const immediatelyPreviousLookId = completedHistory[0]?.lookId
    const candidates = eligible.filter((look) => look.lookId !== immediatelyPreviousLookId)
    const mostRecentUse = new Map<string, number>()
    for (const entry of completedHistory) {
      if (!mostRecentUse.has(entry.lookId)) mostRecentUse.set(entry.lookId, Date.parse(entry.completedAt ?? ''))
    }
    selected = [...candidates].sort((left, right) => {
      const leftUsedAt = mostRecentUse.get(left.lookId) ?? Number.NEGATIVE_INFINITY
      const rightUsedAt = mostRecentUse.get(right.lookId) ?? Number.NEGATIVE_INFINITY
      if (leftUsedAt !== rightUsedAt) return leftUsedAt - rightUsedAt
      return sha256(`${input.selectionKey}:${left.lookId}`).localeCompare(sha256(`${input.selectionKey}:${right.lookId}`))
    })[0]
    reason = 'least_recently_used'
  }

  return {
    selectorVersion: SOCIAL_AVATAR_LOOK_SELECTOR_VERSION,
    identityId: selected.identityId,
    lookId: selected.lookId,
    lookVersion: selected.lookVersion,
    providerCharacterType: selected.providerCharacterType,
    reason,
    selectionKey: input.selectionKey,
    sourceReceiptId: selected.sourceReceiptId,
    consentRightsReceiptId: selected.consentRightsReceiptId,
    recentCompletedHistory: completedHistory.map(({ identityId, lookId, providerJobId, completedAt }) => ({
      identityId,
      lookId,
      providerJobId,
      completedAt,
    })),
  }
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

export type HeyGenV3AvatarLook = {
  id: string
  groupId?: string | null
  status?: string | null
  supportedApiEngines?: string[] | null
}

export type HeyGenV3Voice = {
  id: string
  status?: string | null
  defaultEngine?: string | null
  availableEngines?: string[] | null
}

export type HeyGenV3VideoRequest = {
  type: 'avatar'
  avatar_id: string
  title: string
  aspect_ratio: AvatarMotionPacket['aspectRatio']
  output_format: 'mp4'
  script: string
  voice_id: string
  voice_settings: {
    speed: 1
    engine_settings: { engine_type: HeyGenVoiceEngine }
  }
  engine: { type: HeyGenAvatarEngine }
}

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
  const avatarLookId = selectedAvatarLookId(packet)
  if (!avatarLookId.trim() || packet.avatar.status !== 'approved') blockers.push('Approved avatar is required.')
  if (!packet.voice.id.trim() || packet.voice.status !== 'approved') blockers.push('Approved voice is required.')
  if (!packet.avatar.version.trim()) blockers.push('Avatar version is required.')
  if (!packet.voice.version.trim()) blockers.push('Voice version is required.')
  if (packet.receipts.consentRights.avatarId !== avatarLookId) blockers.push('Consent and rights receipt does not bind the selected avatar.')
  if (packet.receipts.consentRights.voiceId !== packet.voice.id) blockers.push('Consent and rights receipt does not bind the selected voice.')
  if (!packet.receipts.consentRights.authorizationScope.trim()) blockers.push('Consent and rights authorization scope is required.')
  validateReceipt('Consent and rights', packet.receipts.consentRights, packet.contentVersion, now, blockers)
  validateReceipt('Privacy', packet.receipts.privacy, packet.contentVersion, now, blockers)
  validateReceipt('Source', packet.receipts.source, packet.contentVersion, now, blockers)
  const hasEnrichedAvatarBinding = Boolean(packet.avatar.identityId || packet.avatar.lookId || packet.avatar.lookVersion || packet.avatar.providerCharacterType || packet.avatar.selection)
  if (hasEnrichedAvatarBinding && (!packet.avatar.identityId || !packet.avatar.lookId || !packet.avatar.lookVersion || !packet.avatar.providerCharacterType || !packet.avatar.selection)) {
    blockers.push('Enriched avatar packets require a complete identity, look, character type, and selection receipt binding.')
  }
  if (packet.avatar.selection) {
    const selection = packet.avatar.selection
    if (selection.lookId !== avatarLookId || selection.identityId !== packet.avatar.identityId) blockers.push('Avatar selection receipt does not bind the selected identity and look.')
    if (selection.lookVersion !== (packet.avatar.lookVersion ?? packet.avatar.version)) blockers.push('Avatar selection receipt does not bind the selected look version.')
    if (selection.consentRightsReceiptId !== packet.receipts.consentRights.receiptId) blockers.push('Avatar selection receipt does not bind the consent and rights receipt.')
    if (selection.sourceReceiptId !== packet.receipts.source.receiptId) blockers.push('Avatar selection receipt does not bind the source receipt.')
  }
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
  if (packet.providerContract) {
    if (packet.providerContract.apiVersion !== 'v3' || packet.providerContract.endpoint !== HEYGEN_V3_VIDEO_ENDPOINT) blockers.push('Unsupported HeyGen provider contract.')
    if (!packet.providerContract.catalogReceiptId.trim()) blockers.push('HeyGen v3 catalog receipt binding is required.')
    if (!packet.avatar.selection) blockers.push('HeyGen v3 generation requires the complete approved avatar-look selection receipt.')
  }
  const forbidden = /\b(?:internal qa|implementation note|system prompt|sha256|job id|provider (?:job|request|receipt|execution|contract|authorization))\b/i
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
  voices: Array<{ id: string; status?: string | null; allowedEngines?: string[] | null }>
}): string[] {
  const blockers: string[] = []
  const avatar = input.avatars.find((value) => value.id === selectedAvatarLookId(input.packet))
  const voice = input.voices.find((value) => value.id === input.packet.voice.id)
  if (!avatar) blockers.push('Selected avatar is not available in the current HeyGen catalog.')
  if (avatar?.status && !['ready', 'completed', 'active'].includes(avatar.status)) blockers.push('Selected avatar is not ready for generation.')
  if (!voice) blockers.push('Selected voice is not available in the current HeyGen catalog.')
  if (voice?.status && !['ready', 'completed', 'active'].includes(voice.status)) blockers.push('Selected voice is not ready for generation.')
  if (voice && Array.isArray(voice.allowedEngines) && voice.allowedEngines.length === 0) blockers.push('Selected voice has no allowed v2 API generation engines.')
  return blockers
}

export function buildHeyGenV3VideoRequest(input: {
  packet: AvatarMotionPacket
  look: HeyGenV3AvatarLook
  voice: HeyGenV3Voice
  title?: string
}): { blockers: string[]; request?: HeyGenV3VideoRequest } {
  const { packet, look, voice } = input
  const blockers: string[] = []
  const contract = packet.providerContract
  const lookId = selectedAvatarLookId(packet)
  if (!contract) blockers.push('A version-bound HeyGen v3 provider contract is required before generation.')
  if (look.id !== lookId) blockers.push('HeyGen v3 look evidence does not bind the selected look.')
  if (packet.avatar.identityId && look.groupId !== packet.avatar.identityId) blockers.push('HeyGen v3 look evidence does not bind the selected avatar identity.')
  if (look.status !== 'completed') blockers.push('Selected HeyGen v3 look is not completed.')
  if (!Array.isArray(look.supportedApiEngines) || look.supportedApiEngines.length === 0) blockers.push('Selected HeyGen v3 look has no supported API engines.')
  if (contract && !look.supportedApiEngines?.includes(contract.avatarEngine)) blockers.push('Selected HeyGen v3 look does not support the bound avatar engine.')
  if (voice.id !== packet.voice.id) blockers.push('HeyGen v3 voice evidence does not bind the selected voice.')
  if (voice.status && !['ready', 'completed', 'active'].includes(voice.status)) blockers.push('Selected HeyGen v3 voice is not ready for generation.')
  if (!Array.isArray(voice.availableEngines) || voice.availableEngines.length === 0) blockers.push('Selected HeyGen v3 voice has no available API engines.')
  if (contract && !voice.availableEngines?.includes(contract.voiceEngine)) blockers.push('Selected HeyGen v3 voice does not support the bound voice engine.')
  if (blockers.length || !contract) return { blockers: [...new Set(blockers)] }
  return {
    blockers: [],
    request: {
      type: 'avatar',
      avatar_id: lookId,
      title: input.title ?? 'Jev presenter clip - review only',
      aspect_ratio: packet.aspectRatio,
      output_format: 'mp4',
      script: packet.script.text,
      voice_id: packet.voice.id,
      voice_settings: { speed: 1, engine_settings: { engine_type: contract.voiceEngine } },
      engine: { type: contract.avatarEngine },
    },
  }
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
  const binding: Record<string, unknown> = {
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
  if (packet.avatar.lookId || packet.avatar.identityId || packet.avatar.selection) {
    binding.avatarIdentityId = packet.avatar.identityId
    binding.avatarLookId = selectedAvatarLookId(packet)
    binding.avatarLookVersion = packet.avatar.lookVersion ?? packet.avatar.version
    binding.avatarSelection = packet.avatar.selection
  }
  if (packet.providerContract) binding.providerContract = packet.providerContract
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
    avatar: {
      id: selectedAvatarLookId(input.packet),
      identity_id: input.packet.avatar.identityId,
      look_id: input.packet.avatar.lookId,
      version: input.packet.avatar.lookVersion ?? input.packet.avatar.version,
      selection: input.packet.avatar.selection,
    },
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
