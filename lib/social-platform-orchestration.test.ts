import { describe, expect, it } from 'vitest'

import { buildPlatformOrchestrationPlan } from './social-platform-orchestration'

describe('buildPlatformOrchestrationPlan', () => {
  it('exposes connected platform automatic submission only after the final submission gate is ready', () => {
    const plan = buildPlatformOrchestrationPlan({
      targetPlatforms: ['linkedin', 'youtube', 'instagram', 'facebook', 'tiktok'],
      copyApproved: true,
      productionReady: true,
      redactionReady: true,
      draftHandoffReady: true,
      publishRecords: [{
        platform: 'linkedin',
        status: 'pending',
        platform_post_url: null,
      }],
    })

    expect(plan.anyAutomaticSubmissionAvailable).toBe(true)
    expect(plan.platforms.map((platform) => platform.platform)).toEqual(['linkedin', 'youtube', 'instagram', 'facebook', 'tiktok'])
    expect(plan.platforms.every((platform) => platform.automaticSubmissionSupported === true)).toBe(true)
    expect(plan.platforms[0]).toMatchObject({
      platform: 'linkedin',
      automaticSubmissionSupported: true,
      publishStatus: 'pending',
      nextAction: 'Submit to LinkedIn through the configured platform integration.',
    })
    expect(plan.platforms[0].stages.map((stage) => [stage.key, stage.state])).toEqual([
      ['human_approval', 'complete'],
      ['asset_readiness', 'complete'],
      ['platform_draft_handoff', 'complete'],
      ['platform_configuration', 'complete'],
      ['final_submission_gate', 'complete'],
      ['automatic_submission', 'available'],
    ])
    expect(plan.sideEffectsUntilFinalGate).toEqual({
      providerGeneration: false,
      upload: false,
      externalSchedule: false,
      publish: false,
      externalPost: false,
    })
  })

  it('connects Facebook to the same automatic submission gate path', () => {
    const plan = buildPlatformOrchestrationPlan({
      targetPlatforms: ['facebook'],
      copyApproved: true,
      productionReady: true,
      redactionReady: true,
      draftHandoffReady: true,
      finalSubmissionGateReady: true,
    })

    expect(plan.anyAutomaticSubmissionAvailable).toBe(true)
    expect(plan.platforms.map((platform) => platform.platform)).toEqual(['facebook'])
    expect(plan.platforms.every((platform) => platform.automaticSubmissionSupported === true)).toBe(true)
    expect(plan.platforms.map((platform) => (
      platform.stages.find((stage) => stage.key === 'automatic_submission')?.state
    ))).toEqual(['available'])
  })

  it('keeps platform submission blocked until privacy and asset readiness clear', () => {
    const plan = buildPlatformOrchestrationPlan({
      targetPlatforms: ['linkedin'],
      copyApproved: true,
      productionReady: false,
      redactionReady: false,
      draftHandoffReady: false,
    })

    expect(plan.anyAutomaticSubmissionAvailable).toBe(false)
    expect(plan.platforms[0].stages.map((stage) => [stage.key, stage.state])).toEqual([
      ['human_approval', 'complete'],
      ['asset_readiness', 'blocked'],
      ['platform_draft_handoff', 'blocked'],
      ['platform_configuration', 'blocked'],
      ['final_submission_gate', 'blocked'],
      ['automatic_submission', 'blocked'],
    ])
  })

  it('blocks final submission when requested platform configuration is missing', () => {
    const plan = buildPlatformOrchestrationPlan({
      targetPlatforms: ['tiktok'],
      copyApproved: true,
      productionReady: true,
      redactionReady: true,
      draftHandoffReady: true,
      finalSubmissionGateReady: true,
      platformConfigs: [{
        platform: 'tiktok',
        is_active: true,
        credentials: { access_token: 'token' },
        settings: { creator_info_confirmed: false, source_url_approved: false } as never,
      }],
    })

    expect(plan.anyAutomaticSubmissionAvailable).toBe(false)
    expect(plan.platforms[0].nextAction).toBe('TikTok needs creator-info confirmation, approved URL ingestion.')
    expect(plan.platforms[0].stages.map((stage) => [stage.key, stage.state])).toEqual([
      ['human_approval', 'complete'],
      ['asset_readiness', 'complete'],
      ['platform_draft_handoff', 'complete'],
      ['platform_configuration', 'blocked'],
      ['final_submission_gate', 'blocked'],
      ['automatic_submission', 'blocked'],
    ])
  })
})
