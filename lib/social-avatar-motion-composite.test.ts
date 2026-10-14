import { describe, expect, it } from 'vitest'
import {
  SOCIAL_AVATAR_MOTION_PIPELINE_VERSION,
  avatarMotionWorstCaseCostUsd,
  buildAvatarMotionCompositeManifest,
  buildAvatarMotionIdempotencyKey,
  decideAvatarMotionReplay,
  sha256,
  validateCompositeProbe,
  validateHeyGenProviderAssets,
  validateAvatarMotionPacket,
  type AvatarMotionPacket,
  type AvatarMotionProviderReceipt,
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

  it('fails before generation when the avatar or voice is unavailable or incompatible', () => {
    const value = packet()
    expect(validateHeyGenProviderAssets({ packet: value, avatars: [], voices: [] })).toEqual([
      'Selected avatar is not available in the current HeyGen catalog.',
      'Selected voice is not available in the current HeyGen catalog.',
    ])
    expect(validateHeyGenProviderAssets({
      packet: value,
      avatars: [{ id: value.avatar.id, status: 'ready' }],
      voices: [{ id: value.voice.id, status: 'ready', allowedEngines: [] }],
    })).toContain('Selected voice has no currently allowed HeyGen generation engine.')
  })

  it('rejects internal production language in customer-facing frames', () => {
    const value = packet()
    value.customerFacingText.push('Internal QA receipt')
    expect(validateAvatarMotionPacket(value, NOW)).toContain('Customer-facing text contains internal production language.')
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
