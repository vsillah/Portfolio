import type { SocialContentItem, SocialContentPublish } from '@/lib/social-content'

export const FACEBOOK_COMMENT_REFRESH_QA_FIXTURE = 'facebook_comment_refresh_v1'
export const FACEBOOK_COMMENT_REFRESH_QA_ID = 'afe74739-e547-4714-8840-3ff5792c4ccc'

function publish(
  id: string,
  platform: 'facebook' | 'instagram',
  platformPostId: string,
): SocialContentPublish {
  return {
    id,
    content_id: FACEBOOK_COMMENT_REFRESH_QA_ID,
    platform,
    status: 'published',
    platform_post_id: platformPostId,
    platform_post_url: null,
    error_message: null,
    published_at: '2026-08-06T15:48:28.640Z',
    created_at: '2026-08-06T15:48:28.640Z',
    updated_at: '2026-08-06T15:48:28.640Z',
  }
}

export function facebookCommentRefreshQaFixture(): SocialContentItem {
  return {
    id: FACEBOOK_COMMENT_REFRESH_QA_ID,
    meeting_record_id: null,
    platform: 'instagram',
    status: 'published',
    post_text: 'Read-only comment refresh destination fixture.',
    cta_text: null,
    cta_url: null,
    hashtags: [],
    image_url: null,
    image_prompt: null,
    framework_visual_type: null,
    voiceover_url: null,
    voiceover_text: null,
    video_url: null,
    topic_extracted: null,
    hormozi_framework: null,
    rag_context: {
      source: 'facebook_comment_refresh_qa_fixture',
      publish_gate: 'read_only',
    },
    scheduled_for: null,
    published_at: '2026-08-06T15:48:28.640Z',
    platform_post_id: '18081130589659893',
    admin_notes: null,
    reviewed_by: null,
    created_at: '2026-08-06T13:52:45.419Z',
    updated_at: '2026-11-19T12:00:00.000Z',
    is_test_data: true,
    content_format: 'single_image',
    content_pillar: null,
    companion_post_text: null,
    carousel_slides: null,
    carousel_pdf_url: null,
    carousel_slide_urls: null,
    target_platforms: ['instagram', 'facebook'],
    video_generation_method: 'none',
    youtube_title: null,
    youtube_description: null,
    publishes: [
      publish('b07c88b8-bc71-4e90-9955-d0245dcbda78', 'instagram', '18081130589659893'),
      publish('d8a8bb5b-dd1d-4e4b-8568-64917fbb1f3a', 'facebook', '1266643549861658_122095513095435845'),
    ],
  }
}
