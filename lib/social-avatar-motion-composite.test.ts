import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  SOCIAL_AVATAR_MOTION_PIPELINE_VERSION,
  avatarMotionWorstCaseCostUsd,
  buildHeyGenV3VideoRequest,
  buildAvatarMotionCompositeManifest,
  buildAvatarMotionIdempotencyKey,
  decideAvatarMotionReplay,
  selectApprovedAvatarLook,
  sha256,
  validateCompositeProbe,
  validateHeyGenProviderAssets,
  validateAvatarMotionPacket,
  type AvatarMotionPacket,
  type AvatarMotionProviderReceipt,
  type ApprovedAvatarLook,
} from './social-avatar-motion-composite'

const NOW = new Date('2026-10-14T21:00:00.000Z')
const script = 'A score is not a decision. Read the signal, apply the policy, and keep a human owner visible. Route the exception. Make uncertainty visible enough to act.'
const contentVersion = `sha256:${'e'.repeat(64)}`

function receipt(receiptId: string) {
  return {
    receiptId,
    status: 'approved' as const,
    inputVersion: contentVersion,
    reviewedAt: '2026-10-14T20:30:00.000Z',
    validUntil: '2026-10-15T20:30:00.000Z',
  }
}

function packet(): AvatarMotionPacket {
  return {
    version: SOCIAL_AVATAR_MOTION_PIPELINE_VERSION,
    socialContentId: 'f966123f-05eb-48ec-a7c2-970afce642ef',
    contentVersion,
    target: 'youtube_shorts',
    aspectRatio: '9:16',
    script: { text: script, sha256: `sha256:${sha256(script)}`, status: 'approved' },
    avatar: { id: 'avatar-approved', version: '2026-04-15', name: 'Approved avatar', status: 'approved' },
    voice: { id: 'voice-approved', version: '2026-04-15', name: 'Approved voice', status: 'approved' },
    receipts: {
      consentRights: {
        ...receipt('rights:avatar-motion:approved'),
        avatarId: 'avatar-approved',
        voiceId: 'voice-approved',
        authorizationScope: 'One review-only Jev presenter clip.',
      },
      privacy: receipt('privacy:jev:passed'),
      source: receipt('source:jev:passed'),
    },
    motionMaster: {
      path: '/review/jev-motion.mp4',
      sha256: 'a'.repeat(64),
      status: 'approved',
      durationSeconds: 22,
      width: 1080,
      height: 1920,
      fps: 30,
    },
    providerAuthorization: {
      provider: 'heygen',
      authorizationId: 'jev-heygen-one-job-20261014',
      status: 'approved',
      approvedAt: '2026-10-14T20:30:00.000Z',
      expiresAt: '2026-10-15T20:30:00.000Z',
      maxCostUsd: 9,
      worstCaseRateUsdPerMinute: 4,
      maxBillableSeconds: 120,
      maxProviderJobs: 1,
      maxScriptCharacters: 220,
    },
    customerFacingText: ['A score is not a decision.', 'Make uncertainty visible enough to act.'],
  }
}

function providerReceipt(p: AvatarMotionPacket): AvatarMotionProviderReceipt {
  return {
    idempotencyKey: buildAvatarMotionIdempotencyKey(p),
    provider: 'heygen',
    providerJobId: 'heygen-job-1',
    outputSha256: 'b'.repeat(64),
    durationSeconds: 12,
    costUsd: 0.8,
    status: 'completed',
  }
}

function avatarLook(id: string, overrides: Partial<ApprovedAvatarLook> = {}): ApprovedAvatarLook {
  return {
    identityId: `identity-${id}`,
    identityName: `Identity ${id}`,
    lookId: id,
    lookName: `Look ${id}`,
    lookVersion: '2026-10-14',
    providerCharacterType: 'avatar',
    ownership: 'owned',
    approvalStatus: 'approved',
    availability: 'available',
    compatibleTargets: ['youtube_long_form', 'youtube_shorts'],
    consentRightsReceiptId: `rights-${id}`,
    sourceReceiptId: `source-${id}`,
    ...overrides,
  }
}

describe('social avatar-motion composite gate', () => {
  it('accepts one receipt-complete, bounded composition packet', () => {
    const value = packet()
    expect(validateAvatarMotionPacket(value, NOW)).toEqual([])
    expect(avatarMotionWorstCaseCostUsd(value)).toBe(8)
  })

  it('fails closed when a required receipt is missing or stale', () => {
    const value = packet()
    value.receipts.privacy.receiptId = ''
    value.receipts.source.validUntil = '2026-10-14T20:00:00.000Z'
    expect(validateAvatarMotionPacket(value, NOW)).toEqual(expect.arrayContaining([
      'Privacy receipt is missing its ID.',
      'Source receipt is expired.',
    ]))
  })

  it('rejects content-version and script-hash mismatches', () => {
    const value = packet()
    value.script.text += ' Changed.'
    value.receipts.privacy.inputVersion = `sha256:${'c'.repeat(64)}`
    expect(validateAvatarMotionPacket(value, NOW)).toEqual(expect.arrayContaining([
      'Script hash does not match the approved text.',
      'Privacy receipt is stale or version-mismatched.',
    ]))
  })

  it('enforces a provider cap strictly below US$10', () => {
    const value = packet()
    value.providerAuthorization.maxCostUsd = 10
    expect(validateAvatarMotionPacket(value, NOW)).toContain('Provider cost cap must be strictly below US$10.')
    value.providerAuthorization.maxCostUsd = 7
    expect(validateAvatarMotionPacket(value, NOW)).toContain('Worst-case provider cost exceeds the authorized cap.')
  })

  it('returns the same provider job on an idempotent replay', () => {
    const value = packet()
    const receiptValue = providerReceipt(value)
    expect(decideAvatarMotionReplay({
      packet: value,
      existing: { idempotencyKey: receiptValue.idempotencyKey, status: 'completed', receipt: receiptValue },
    })).toEqual({ action: 'reuse', idempotencyKey: receiptValue.idempotencyKey, receipt: receiptValue })
  })

  it('requires reconciliation after a provider failure or uncertain submission', () => {
    const value = packet()
    const key = buildAvatarMotionIdempotencyKey(value)
    expect(decideAvatarMotionReplay({ packet: value, existing: { idempotencyKey: key, status: 'failed' } })).toMatchObject({ action: 'reconcile' })
    expect(decideAvatarMotionReplay({ packet: value, existing: { idempotencyKey: key, status: 'submitted' } })).toMatchObject({ action: 'reconcile' })
  })

  it('preserves the consumed legacy packet idempotency key exactly', () => {
    const legacyPacket = JSON.parse(readFileSync('artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev-avatar-motion-v1.json', 'utf8')) as AvatarMotionPacket
    expect(buildAvatarMotionIdempotencyKey(legacyPacket)).toBe('social-avatar-motion:0121e25ff316b87d90f85007ba8e7ad38bc2048cf465ad3467a4ba653ffb0457')
  })

  it('fails before generation when the avatar or voice is unavailable or explicitly blocked', () => {
    const value = packet()
    expect(validateHeyGenProviderAssets({ packet: value, avatars: [], voices: [] })).toEqual([
      'Selected avatar is not available in the current HeyGen catalog.',
      'Selected voice is not available in the current HeyGen catalog.',
    ])
    expect(validateHeyGenProviderAssets({
      packet: value,
      avatars: [{ id: value.avatar.id, status: 'ready' }],
      voices: [{ id: value.voice.id, status: 'blocked' }],
    })).toContain('Selected voice is not ready for generation.')
    expect(validateHeyGenProviderAssets({
      packet: value,
      avatars: [{ id: value.avatar.id, status: 'ready' }],
      voices: [{ id: value.voice.id, status: 'ready', allowedEngines: [] }],
    })).toContain('Selected voice has no allowed v2 API generation engines.')
  })

  it('rejects internal production language in customer-facing frames', () => {
    const value = packet()
    value.customerFacingText.push('Internal QA receipt')
    expect(validateAvatarMotionPacket(value, NOW)).toContain('Customer-facing text contains internal production language.')
  })

  it('allows approved public governance language about receipts and provider-use boundaries', () => {
    const value = packet()
    value.script.text = 'Keep the versioned receipt visible. Live provider use remains on hold.'
    value.script.sha256 = `sha256:${sha256(value.script.text)}`
    value.customerFacingText = ['Keep the versioned receipt visible.', 'Live provider use remains on hold.']
    expect(validateAvatarMotionPacket(value, NOW)).not.toContain('Customer-facing text contains internal production language.')
  })

  it('binds audio-bearing provider output and preserves external gates', () => {
    const value = packet()
    const manifest = buildAvatarMotionCompositeManifest({
      packet: value,
      providerReceipt: providerReceipt(value),
      presenterSourcePath: '/review/presenter.mp4',
      outputPath: '/review/composite.mp4',
      outputSha256: 'c'.repeat(64),
      ffmpegCommand: 'ffmpeg -i motion.mp4 -i presenter.mp4 composite.mp4',
      presenterWindows: [
        { sourceStart: 0, sourceEnd: 3, outputStart: 0, x: 620, y: 1080, width: 390, height: 693 },
        { sourceStart: 3, sourceEnd: 9, outputStart: 8, x: 620, y: 1080, width: 390, height: 693 },
      ],
    })
    expect(manifest.provider.duration_seconds).toBeGreaterThan(0)
    expect(manifest.gates).toEqual({
      youtube_upload: false,
      platform_draft: false,
      schedule: false,
      publish: false,
      external_send: false,
    })
  })

  it('rejects a final encode without playable audio or matching motion timing', () => {
    expect(validateCompositeProbe({
      streams: [{ codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920 }],
      format: { duration: '21.4' },
    }, { durationSeconds: 22, width: 1080, height: 1920 })).toEqual([
      'Final composite has no playable audio stream.',
      'Final composite duration does not match the approved motion master.',
    ])
  })
})

describe('HeyGen v3 contract adapter', () => {
  function v3Packet(): AvatarMotionPacket {
    const value = packet()
    const look = avatarLook(value.avatar.id, {
      identityId: 'owned-group',
      lookVersion: value.avatar.version,
      consentRightsReceiptId: value.receipts.consentRights.receiptId,
      sourceReceiptId: value.receipts.source.receiptId,
    })
    const selection = selectApprovedAvatarLook({ looks: [look], history: [], target: value.target, selectionKey: 'campaign:jev:v3-contract' })
    value.avatar = {
      ...value.avatar,
      identityId: selection.identityId,
      lookId: selection.lookId,
      lookVersion: selection.lookVersion,
      providerCharacterType: selection.providerCharacterType,
      selection,
    }
    value.providerContract = {
      apiVersion: 'v3',
      endpoint: '/v3/videos',
      avatarEngine: 'avatar_iv',
      voiceEngine: 'elevenlabs',
      catalogReceiptId: 'provider-catalog:heygen:v3:20261014',
    }
    return value
  }

  it('builds the current direct-avatar request only from exact engine-bound catalog evidence', () => {
    const value = v3Packet()
    const result = buildHeyGenV3VideoRequest({
      packet: value,
      look: { id: value.avatar.id, groupId: value.avatar.identityId, status: 'completed', supportedApiEngines: ['avatar_v', 'avatar_iv', 'avatar_iii'] },
      voice: { id: value.voice.id, defaultEngine: 'elevenlabs', availableEngines: ['elevenlabs', 'elevenlabs_v3'] },
    })
    expect(result.blockers).toEqual([])
    expect(result.request).toEqual(expect.objectContaining({
      type: 'avatar',
      avatar_id: value.avatar.id,
      aspect_ratio: '9:16',
      script: value.script.text,
      voice_id: value.voice.id,
      engine: { type: 'avatar_iv' },
      voice_settings: { speed: 1, engine_settings: { engine_type: 'elevenlabs' } },
    }))
  })

  it('accepts the Red V-Neck default Mad Hadda voice through the same exact-ID contract', () => {
    const value = v3Packet()
    value.voice = { id: '3bed25c167534fd6ac5becdec4516ec7', version: 'provider-catalog-2026-10-14', name: 'Vambah Sillah (Mad Hadda)', status: 'approved' }
    value.receipts.consentRights.voiceId = value.voice.id
    const result = buildHeyGenV3VideoRequest({
      packet: value,
      look: { id: value.avatar.id, groupId: value.avatar.identityId, status: 'completed', supportedApiEngines: ['avatar_iv'] },
      voice: { id: value.voice.id, defaultEngine: 'elevenlabs', availableEngines: ['starfish', 'orca', 'elevenlabs', 'elevenlabs_v3'] },
    })
    expect(result.blockers).toEqual([])
    expect(result.request?.voice_id).toBe(value.voice.id)
  })

  it('fails closed for absent evidence, identity drift, or unsupported bound engines', () => {
    const value = v3Packet()
    const result = buildHeyGenV3VideoRequest({
      packet: value,
      look: { id: value.avatar.id, groupId: 'other-group', status: 'pending', supportedApiEngines: ['avatar_iii'] },
      voice: { id: value.voice.id, availableEngines: [] },
    })
    expect(result.request).toBeUndefined()
    expect(result.blockers).toEqual(expect.arrayContaining([
      'HeyGen v3 look evidence does not bind the selected avatar identity.',
      'Selected HeyGen v3 look is not completed.',
      'Selected HeyGen v3 look does not support the bound avatar engine.',
      'Selected HeyGen v3 voice has no available API engines.',
      'Selected HeyGen v3 voice does not support the bound voice engine.',
    ]))
  })

  it('requires a new idempotency binding when the provider contract is added or changed', () => {
    const legacy = packet()
    const v3 = v3Packet()
    expect(buildAvatarMotionIdempotencyKey(v3)).not.toBe(buildAvatarMotionIdempotencyKey(legacy))
    const first = buildAvatarMotionIdempotencyKey(v3)
    v3.providerContract = { ...v3.providerContract!, avatarEngine: 'avatar_v' }
    expect(buildAvatarMotionIdempotencyKey(v3)).not.toBe(first)
  })
})

describe('owned avatar-look rotation', () => {
  const looks = [avatarLook('gray'), avatarLook('red'), avatarLook('green')]

  it('is deterministic for an identical replay input', () => {
    const input = { looks, history: [], target: 'youtube_shorts' as const, selectionKey: 'campaign:jev:v1' }
    expect(selectApprovedAvatarLook(input)).toEqual(selectApprovedAvatarLook(input))
  })

  it('does not immediately repeat the most recently completed look', () => {
    const selected = selectApprovedAvatarLook({
      looks,
      target: 'youtube_shorts',
      selectionKey: 'campaign:jev:v2',
      history: [{ identityId: 'identity-gray', lookId: 'gray', providerJobId: 'job-1', status: 'completed', attemptedAt: '2026-10-14T18:00:00Z', completedAt: '2026-10-14T18:01:00Z' }],
    })
    expect(selected.lookId).not.toBe('gray')
  })

  it('chooses the least recently used eligible look', () => {
    const selected = selectApprovedAvatarLook({
      looks,
      target: 'youtube_shorts',
      selectionKey: 'campaign:jev:v3',
      history: [
        { identityId: 'identity-gray', lookId: 'gray', providerJobId: 'job-3', status: 'completed', attemptedAt: '2026-10-14T20:00:00Z', completedAt: '2026-10-14T20:01:00Z' },
        { identityId: 'identity-red', lookId: 'red', providerJobId: 'job-2', status: 'completed', attemptedAt: '2026-10-14T19:00:00Z', completedAt: '2026-10-14T19:01:00Z' },
        { identityId: 'identity-green', lookId: 'green', providerJobId: 'job-1', status: 'completed', attemptedAt: '2026-10-14T18:00:00Z', completedAt: '2026-10-14T18:01:00Z' },
      ],
    })
    expect(selected.lookId).toBe('green')
    expect(selected.reason).toBe('least_recently_used')
  })

  it('honors an eligible campaign pin', () => {
    const selected = selectApprovedAvatarLook({
      looks,
      history: [],
      target: 'youtube_long_form',
      selectionKey: 'campaign:founder-story',
      pin: { identityId: 'identity-red', lookId: 'red' },
    })
    expect(selected).toMatchObject({ lookId: 'red', reason: 'campaign_pin' })
  })

  it('fails closed for an unavailable campaign pin', () => {
    expect(() => selectApprovedAvatarLook({
      looks: [avatarLook('red', { availability: 'unavailable' })],
      history: [],
      target: 'youtube_shorts',
      selectionKey: 'campaign:blocked',
      pin: { identityId: 'identity-red', lookId: 'red' },
    })).toThrow('No owned, approved, available, rights-bound avatar look')
  })

  it('fails closed instead of substituting another look for an ineligible pin', () => {
    expect(() => selectApprovedAvatarLook({
      looks,
      history: [],
      target: 'youtube_shorts',
      selectionKey: 'campaign:bad-pin',
      pin: { identityId: 'identity-missing', lookId: 'missing' },
    })).toThrow('campaign-pinned avatar look is not eligible')
  })

  it('excludes public, unapproved, rights-incomplete, and incompatible looks', () => {
    const selected = selectApprovedAvatarLook({
      looks: [
        avatarLook('owned'),
        avatarLook('public', { ownership: 'public' }),
        avatarLook('pending', { approvalStatus: 'pending' }),
        avatarLook('no-rights', { consentRightsReceiptId: '' }),
        avatarLook('wrong-target', { compatibleTargets: ['youtube_long_form'] }),
      ],
      history: [],
      target: 'youtube_shorts',
      selectionKey: 'campaign:eligible-only',
    })
    expect(selected).toMatchObject({ lookId: 'owned', reason: 'only_eligible_look' })
  })

  it('does not advance rotation history for a failed provider job', () => {
    const failed = { identityId: 'identity-gray', lookId: 'gray', providerJobId: 'job-failed', status: 'failed' as const, attemptedAt: '2026-10-14T21:00:00Z' }
    const withoutFailure = selectApprovedAvatarLook({ looks, history: [], target: 'youtube_shorts', selectionKey: 'campaign:failure-safe' })
    const withFailure = selectApprovedAvatarLook({ looks, history: [failed], target: 'youtube_shorts', selectionKey: 'campaign:failure-safe' })
    expect(withFailure).toEqual(withoutFailure)
    expect(withFailure.recentCompletedHistory).toEqual([])
  })

  it('keeps the selected identity and look inside enriched idempotency bindings', () => {
    const value = packet()
    const selection = selectApprovedAvatarLook({ looks, history: [], target: value.target, selectionKey: 'campaign:packet-v1' })
    value.avatar = {
      ...value.avatar,
      id: selection.lookId,
      identityId: selection.identityId,
      lookId: selection.lookId,
      lookVersion: selection.lookVersion,
      providerCharacterType: selection.providerCharacterType,
      selection: { ...selection, sourceReceiptId: value.receipts.source.receiptId, consentRightsReceiptId: value.receipts.consentRights.receiptId },
    }
    value.receipts.consentRights.avatarId = selection.lookId
    const originalKey = buildAvatarMotionIdempotencyKey(value)
    value.avatar.lookId = 'different-look'
    expect(buildAvatarMotionIdempotencyKey(value)).not.toBe(originalKey)
  })

  it('rejects partially enriched packet bindings', () => {
    const value = packet()
    value.avatar.identityId = 'identity-gray'
    expect(validateAvatarMotionPacket(value, NOW)).toContain('Enriched avatar packets require a complete identity, look, character type, and selection receipt binding.')
  })

  it('keeps the authenticated owned-look catalog unique and receipt-bound', () => {
    const catalog = JSON.parse(readFileSync('artifacts/human-qa/artifact-video-review-2026-10-14/inputs/vambah-owned-avatar-look-catalog-v1.json', 'utf8')) as { looks: ApprovedAvatarLook[] }
    expect(catalog.looks).toHaveLength(7)
    expect(new Set(catalog.looks.map((look) => look.lookId)).size).toBe(catalog.looks.length)
    expect(new Set(catalog.looks.map((look) => look.identityId)).size).toBe(4)
    expect(catalog.looks.every((look) => look.ownership === 'owned' && look.approvalStatus === 'approved')).toBe(true)
    expect(catalog.looks.every((look) => Boolean(look.sourceReceiptId) && Boolean(look.consentRightsReceiptId))).toBe(true)
  })

  it('binds all seven approved looks and both candidate voices to positive v3 engine evidence', () => {
    const catalog = JSON.parse(readFileSync('artifacts/human-qa/artifact-video-review-2026-10-14/inputs/vambah-owned-avatar-look-catalog-v1.json', 'utf8')) as { looks: ApprovedAvatarLook[] }
    const evidence = JSON.parse(readFileSync('artifacts/human-qa/artifact-video-review-2026-10-14/inputs/heygen-v3-avatar-voice-compatibility-v1.json', 'utf8')) as {
      looks: Array<{ look_id: string; group_id: string; status: string; supported_api_engines: string[] }>
      voices: Array<{ voice_id: string; available_engines: string[] }>
      side_effects: { provider_jobs_created: number; uploads: number; credential_changes: number; cost_usd: number }
    }
    expect(evidence.looks).toHaveLength(7)
    for (const look of catalog.looks) {
      expect(evidence.looks).toContainEqual(expect.objectContaining({
        look_id: look.lookId,
        group_id: look.identityId,
        status: 'completed',
        supported_api_engines: expect.arrayContaining(['avatar_iv']),
      }))
    }
    expect(evidence.voices.map((voice) => voice.voice_id)).toEqual(expect.arrayContaining([
      '17c1834716ca4e27b32de949a72f2b5d',
      '3bed25c167534fd6ac5becdec4516ec7',
    ]))
    expect(evidence.voices.every((voice) => voice.available_engines.includes('elevenlabs'))).toBe(true)
    expect(evidence.side_effects).toMatchObject({ provider_jobs_created: 0, uploads: 0, credential_changes: 0, cost_usd: 0 })
  })
})
