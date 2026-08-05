import { describe, expect, it } from 'vitest'

import {
  buildPlatformOrchestrationPlan,
  getPlatformSubmissionGate,
  isPlatformSubmissionGateApproved,
} from './social-platform-orchestration'

describe('buildPlatformOrchestrationPlan', () => {
  it('exposes connected platform automatic submission only after the final submission gate is ready', () => {
    const plan = buildPlatformOrchestrationPlan({
      targetPlatforms: ['linkedin', 'youtube', 'instagram', 'facebook', 'tiktok'],
      copyApproved: true,
      productionReady: true,
      redactionReady: true,
      draftHandoffReady: true,
      finalSubmissionGateReady: true,
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

  it('does not treat pending publish rows as final human submission approval', () => {
    const plan = buildPlatformOrchestrationPlan({
      targetPlatforms: ['linkedin'],
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

    expect(plan.anyAutomaticSubmissionAvailable).toBe(false)
    expect(plan.platforms[0].stages.map((stage) => [stage.key, stage.state])).toEqual([
      ['human_approval', 'complete'],
      ['asset_readiness', 'complete'],
      ['platform_draft_handoff', 'complete'],
      ['platform_configuration', 'complete'],
      ['final_submission_gate', 'pending'],
      ['automatic_submission', 'blocked'],
    ])
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

  it('routes X through manual handoff instead of automatic submission', () => {
    const plan = buildPlatformOrchestrationPlan({
      targetPlatforms: ['x'],
      copyApproved: true,
      productionReady: true,
      redactionReady: true,
      draftHandoffReady: true,
      finalSubmissionGateReady: true,
      publishRecords: [{
        platform: 'x',
        status: 'pending',
        platform_post_url: null,
      }],
      platformConfigs: [],
    })

    expect(plan.anyAutomaticSubmissionAvailable).toBe(false)
    expect(plan.platforms[0]).toMatchObject({
      platform: 'x',
      label: 'X',
      automaticSubmissionSupported: false,
      publishStatus: 'pending',
      nextAction: 'X automatic submission is not connected yet.',
    })
    expect(plan.platforms[0].stages.map((stage) => [stage.key, stage.state])).toEqual([
      ['human_approval', 'complete'],
      ['asset_readiness', 'complete'],
      ['platform_draft_handoff', 'complete'],
      ['platform_configuration', 'complete'],
      ['final_submission_gate', 'complete'],
      ['automatic_submission', 'blocked'],
    ])
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

  it('blocks video platforms before final submission when the final video asset is missing', () => {
    const plan = buildPlatformOrchestrationPlan({
      item: {
        status: 'approved',
        platform: 'youtube',
        target_platforms: ['youtube', 'tiktok'],
        publishes: [],
        post_text: 'Approved copy',
        image_url: 'https://cdn.example.com/youtube-thumbnail.png',
        video_url: null,
        carousel_slide_urls: null,
        youtube_title: 'A YouTube release title',
        youtube_description: 'A reviewed YouTube release description.',
        rag_context: { source: 'social_content_calendar_authorization' },
      },
      copyApproved: true,
      productionReady: true,
      redactionReady: true,
      draftHandoffReady: true,
      finalSubmissionGateReady: true,
      platformConfigs: [
        { platform: 'youtube', is_active: true, credentials: { access_token: 'token' }, settings: {} },
        {
          platform: 'tiktok',
          is_active: true,
          credentials: { access_token: 'token' },
          settings: { creator_info_confirmed: true, source_url_approved: true } as never,
        },
      ],
    })

    expect(plan.anyAutomaticSubmissionAvailable).toBe(false)
    expect(plan.platforms.map((platform) => platform.nextAction)).toEqual([
      'YouTube needs a final video URL before submission.',
      'TikTok needs a final video URL before Direct Post submission.',
    ])
    expect(plan.platforms.map((platform) => (
      platform.stages.find((stage) => stage.key === 'asset_readiness')?.state
    ))).toEqual(['blocked', 'blocked'])
  })

  it('exposes the full YouTube review path and blocks missing release metadata before submission', () => {
    const plan = buildPlatformOrchestrationPlan({
      item: {
        status: 'approved',
        platform: 'youtube',
        target_platforms: ['youtube'],
        publishes: [],
        post_text: 'Approved script copy',
        image_url: null,
        video_url: 'https://cdn.example.com/final-video.mp4',
        carousel_slide_urls: null,
        youtube_title: null,
        youtube_description: null,
        rag_context: { source_packet_path: 'docs/youtube/source-packet.md' },
      },
      copyApproved: true,
      productionReady: true,
      redactionReady: true,
      draftHandoffReady: true,
      finalSubmissionGateReady: true,
      platformConfigs: [{
        platform: 'youtube',
        is_active: true,
        credentials: { access_token: 'token' },
        settings: { default_privacy: 'unlisted', channel_title: 'AmaduTown' } as never,
      }],
    })

    expect(plan.anyAutomaticSubmissionAvailable).toBe(false)
    expect(plan.platforms[0].youtubeReadiness).toMatchObject({
      ready: false,
      reviewValues: {
        title: null,
        description: null,
        finalVideoUrl: 'https://cdn.example.com/final-video.mp4',
        visibility: 'unlisted',
        targetChannel: 'AmaduTown',
        providerConfig: 'YouTube Data API upload adapter active',
      },
    })
    expect(plan.platforms[0].youtubeReadiness?.checks.map((check) => [check.label, check.state])).toEqual([
      ['Context/source basis', 'complete'],
      ['Script/copy review', 'pending'],
      ['Video/asset/privacy QA', 'blocked'],
      ['Platform draft/readiness', 'complete'],
      ['Final human submission gate', 'complete'],
      ['Configured YouTube upload adapter', 'complete'],
    ])
    expect(plan.platforms[0].nextAction).toBe('Add the final YouTube title and description before submission. YouTube title is required. YouTube description is required. Reviewed thumbnail or thumbnail readiness is required.')
  })

  it('makes a configured YouTube upload adapter available only after release readiness clears', () => {
    const plan = buildPlatformOrchestrationPlan({
      item: {
        status: 'approved',
        platform: 'youtube',
        target_platforms: ['youtube'],
        publishes: [{ platform: 'youtube', status: 'pending', platform_post_url: null } as never],
        post_text: 'Approved script copy',
        image_url: 'https://cdn.example.com/youtube-thumbnail.png',
        video_url: 'https://cdn.example.com/final-video.mp4',
        carousel_slide_urls: null,
        youtube_title: 'A reviewed YouTube title',
        youtube_description: 'A reviewed YouTube description.',
        rag_context: { source: 'youtube_release_packet' },
      },
      copyApproved: true,
      productionReady: true,
      redactionReady: true,
      draftHandoffReady: true,
      finalSubmissionGateReady: true,
      platformConfigs: [{
        platform: 'youtube',
        is_active: true,
        credentials: { access_token: 'token' },
        settings: { default_privacy: 'private', channel_id: 'UC123' } as never,
      }],
    })

    expect(plan.anyAutomaticSubmissionAvailable).toBe(true)
    expect(plan.platforms[0].nextAction).toBe('Submit to YouTube through the configured platform integration.')
    expect(plan.platforms[0].youtubeReadiness?.ready).toBe(true)
    expect(plan.platforms[0].youtubeReadiness?.reviewValues).toMatchObject({
      title: 'A reviewed YouTube title',
      description: 'A reviewed YouTube description.',
      thumbnail: 'https://cdn.example.com/youtube-thumbnail.png',
      finalVideoUrl: 'https://cdn.example.com/final-video.mp4',
      privacyRightsRedaction: 'Clear for submission',
      visibility: 'private',
      targetChannel: 'UC123',
    })
  })

  it('keeps Instagram blocked until an image, carousel, or Reel video exists', () => {
    const plan = buildPlatformOrchestrationPlan({
      item: {
        status: 'approved',
        platform: 'instagram',
        target_platforms: ['instagram'],
        publishes: [],
        post_text: 'Caption only',
        image_url: null,
        video_url: null,
        carousel_slide_urls: [],
      },
      copyApproved: true,
      productionReady: true,
      redactionReady: true,
      draftHandoffReady: true,
      finalSubmissionGateReady: true,
      platformConfigs: [{
        platform: 'instagram',
        is_active: true,
        credentials: { access_token: 'token', ig_user_id: 'ig-user-1' },
        settings: {},
      }],
    })

    expect(plan.anyAutomaticSubmissionAvailable).toBe(false)
    expect(plan.platforms[0].nextAction).toBe('Instagram needs an image, carousel slide URLs, or final Reel video URL before submission.')
    expect(plan.platforms[0].stages.find((stage) => stage.key === 'asset_readiness')?.state).toBe('blocked')
  })
})

describe('platform submission gate helpers', () => {
  it('requires the approved gate scope to include every requested publish platform', () => {
    const ragContext = {
      platform_submission_gate: {
        status: 'approved',
        approved_at: '2026-07-01T00:00:00.000Z',
        approved_by: 'admin-1',
        platforms: ['linkedin'],
      },
    }

    expect(isPlatformSubmissionGateApproved(ragContext, ['linkedin'])).toBe(true)
    expect(isPlatformSubmissionGateApproved(ragContext, ['instagram'])).toBe(false)
    expect(isPlatformSubmissionGateApproved(ragContext, ['linkedin', 'instagram'])).toBe(false)
  })

  it('treats a legacy approved gate without stored platforms as approval for the requested scope', () => {
    expect(isPlatformSubmissionGateApproved({
      platform_submission_gate: {
        status: 'approved',
        approved_at: '2026-07-01T00:00:00.000Z',
        approved_by: 'admin-1',
      },
    }, ['linkedin', 'instagram'])).toBe(true)
  })

  it('ignores malformed gate payloads and invalid platform values safely', () => {
    expect(getPlatformSubmissionGate(null)).toBeNull()
    expect(getPlatformSubmissionGate({ platform_submission_gate: 'approved' })).toBeNull()

    const gate = getPlatformSubmissionGate({
      platform_submission_gate: {
        status: 'approved',
        approved_at: 123,
        approved_by: false,
        platforms: ['linkedin', 'x', 'mastodon', null, 'linkedin'],
        decision_note: 456,
      },
    })

    expect(gate).toMatchObject({
      status: 'approved',
      platforms: ['linkedin', 'x'],
    })
    expect(gate?.approved_at).toBeUndefined()
    expect(gate?.approved_by).toBeUndefined()
    expect(gate?.decision_note).toBeUndefined()
  })
})
