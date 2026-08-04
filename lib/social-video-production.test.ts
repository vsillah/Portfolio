import { describe, expect, it } from 'vitest'
import { buildSocialVideoProductionProjection } from './social-video-production'

function baseItem(overrides: Record<string, unknown> = {}) {
  return {
    status: 'approved',
    platform: 'youtube',
    target_platforms: ['youtube'],
    video_url: null,
    image_url: 'https://cdn.example.com/thumb.png',
    rag_context: {
      source: 'social_content_calendar_authorization',
      production_assets: {
        version: 'social_production_assets_v2',
        broll: {
          status: 'matched',
          assets: [{
            id: 'broll-1',
            route: '/admin/social-content/social-1',
            route_description: 'Social Content review',
            filename: 'social-content-review.mp4',
            screenshot_path: null,
            clip_path: '/design-files/broll/social-content-review.mp4',
            captured_at: '2026-08-04T12:00:00.000Z',
          }],
        },
        video_redaction_manifest: {
          items: [],
        },
      },
      ...overrides,
    },
  } as never
}

describe('buildSocialVideoProductionProjection', () => {
  it('projects a completed HeyGen job into final video and thumbnail readiness', () => {
    const projection = buildSocialVideoProductionProjection({
      item: baseItem({
        social_video_production: {
          version: 'social_video_production_v1',
          source: 'youtube_social_content_heygen_bridge',
          video_generation_job_id: 'job-1',
          selected_avatar_id: 'avatar-1',
          selected_voice_id: 'voice-1',
          selected_broll_asset_ids: ['broll-1'],
          broll_candidates: [],
          render_approval: null,
          approval_boundary: 'Internal render only.',
          side_effects: {
            heygen_render: true,
            youtube_upload: false,
            schedule: false,
            publish: false,
            provider_draft: false,
          },
          updated_at: '2026-08-04T12:00:00.000Z',
        },
      }),
      defaults: { avatarId: 'avatar-default', voiceId: 'voice-default' },
      job: {
        id: 'job-1',
        heygenVideoId: 'heygen-1',
        heygenStatus: 'completed',
        videoUrl: 'https://cdn.example.com/final.mp4',
        videoShareUrl: 'https://app.heygen.com/share/heygen-1',
        thumbnailUrl: 'https://cdn.example.com/final-thumb.jpg',
        avatarId: 'avatar-1',
        voiceId: 'voice-1',
        brollAssetIds: ['broll-1'],
        createdAt: '2026-08-04T12:00:00.000Z',
        updatedAt: '2026-08-04T12:10:00.000Z',
      },
    })

    expect(projection.status).toBe('completed')
    expect(projection.finalVideoUrl).toBe('https://cdn.example.com/final.mp4')
    expect(projection.thumbnailUrl).toBe('https://cdn.example.com/final-thumb.jpg')
    expect(projection.selectedAvatarId).toBe('avatar-1')
    expect(projection.selectedVoiceId).toBe('voice-1')
    expect(projection.readiness.nextAction).toContain('final video')
  })
})
