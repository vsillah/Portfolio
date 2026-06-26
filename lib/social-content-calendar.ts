import type { AttractionCampaign } from '@/lib/campaigns'

export const SOCIAL_CONTENT_CALENDAR_CHANNELS = [
  'linkedin',
  'youtube_shorts',
  'instagram_reels',
  'thumbnail',
] as const

export const SOCIAL_CONTENT_CAMPAIGN_PHASES = ['tease', 'teach', 'proof', 'offer'] as const

export const SOCIAL_CONTENT_CALENDAR_DUE_STATUSES = [
  'planned',
  'due_soon',
  'due_now',
  'past_due',
  'completed',
  'cancelled',
] as const

export const SOCIAL_CONTENT_CALENDAR_AUTHORIZATION_STATUSES = [
  'not_required',
  'pending',
  'authorized',
  'rejected',
  'expired',
] as const

export const SOCIAL_CONTENT_CALENDAR_TEMPLATE_KEYS = [
  'whisper_to_shout',
  'youtube_video_release',
  'short_form_series',
  'evergreen_authority',
  'case_study_proof_drop',
] as const

export type SocialContentCalendarChannel = (typeof SOCIAL_CONTENT_CALENDAR_CHANNELS)[number]
export type SocialContentCampaignPhase = (typeof SOCIAL_CONTENT_CAMPAIGN_PHASES)[number]
export type SocialContentCalendarDueStatus = (typeof SOCIAL_CONTENT_CALENDAR_DUE_STATUSES)[number]
export type SocialContentCalendarAuthorizationStatus =
  (typeof SOCIAL_CONTENT_CALENDAR_AUTHORIZATION_STATUSES)[number]
export type SocialContentCalendarTemplateKey = (typeof SOCIAL_CONTENT_CALENDAR_TEMPLATE_KEYS)[number]

export type SocialContentCalendarItem = {
  id: string
  campaign_id: string | null
  agent_work_item_id: string | null
  social_content_id: string | null
  channel: SocialContentCalendarChannel
  campaign_phase: SocialContentCampaignPhase
  title: string
  planned_angle: string | null
  scheduled_for: string
  due_status: SocialContentCalendarDueStatus
  authorization_status: SocialContentCalendarAuthorizationStatus
  authorization_due_at: string | null
  last_pinged_at: string | null
  autonomy_eligible: boolean
  metadata: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
  attraction_campaigns?: {
    id: string
    name: string
    slug: string
    status: string
    starts_at: string | null
    ends_at: string | null
  } | null
  agent_work_items?: {
    id: string
    title: string
    status: string
    priority?: string | null
  } | null
  social_content_queue?: {
    id: string
    status: string
    post_text?: string | null
    scheduled_for?: string | null
  } | null
}

export const CALENDAR_SIDE_EFFECTS = {
  provider_generation: false,
  upload: false,
  external_schedule: false,
  publish: false,
  external_post: false,
} as const

export const CALENDAR_CHANNEL_LABELS: Record<SocialContentCalendarChannel, string> = {
  linkedin: 'LinkedIn',
  youtube_shorts: 'YouTube Shorts',
  instagram_reels: 'Instagram Reels',
  thumbnail: 'Thumbnail',
}

export const CAMPAIGN_PHASE_LABELS: Record<SocialContentCampaignPhase, string> = {
  tease: 'Tease',
  teach: 'Teach',
  proof: 'Proof',
  offer: 'Offer',
}

export type SocialContentCalendarTemplateMilestone = {
  key: string
  campaign_phase: SocialContentCampaignPhase
  channel: SocialContentCalendarChannel
  title_prefix: string
  planned_angle: string
  relative_position: number
  fallback_day_offset: number
  recommended_lead_time_days: number
  required_assets: string[]
  approval_gates: string[]
  source_urls: string[]
}

export type SocialContentCalendarTemplate = {
  key: SocialContentCalendarTemplateKey
  label: string
  description: string
  goal_types: string[]
  source_urls: string[]
  milestones: SocialContentCalendarTemplateMilestone[]
}

export type SocialContentCalendarTemplateRecommendation = {
  key: SocialContentCalendarTemplateKey
  label: string
  score: number
  reasons: string[]
  matched_terms: string[]
}

const SOURCE_URLS = {
  youtubeCreators: 'https://www.youtube.com/creators/grow/optimize-your-content/',
  youtubePremieres: 'https://support.google.com/youtube/answer/9080341',
  thinkWithGooglePlaybook: 'https://www.thinkwithgoogle.com/_qs/documents/1601/youtube-playbook.pdf',
  instagramBestPractices: 'https://about.fb.com/news/2024/10/best-practices-education-hub-creators-instagram/',
  hubspotCalendar: 'https://offers.hubspot.com/social-media-content-calendar',
  asanaCalendar: 'https://asana.com/templates/social-media-calendar',
} as const

export const SOCIAL_CONTENT_CALENDAR_SOURCE_LABELS: Record<string, string> = {
  [SOURCE_URLS.youtubeCreators]: 'YouTube creator optimization guidance',
  [SOURCE_URLS.youtubePremieres]: 'YouTube premiere launch guidance',
  [SOURCE_URLS.thinkWithGooglePlaybook]: 'Think with Google Creator Playbook',
  [SOURCE_URLS.instagramBestPractices]: 'Instagram creator best practices',
  [SOURCE_URLS.hubspotCalendar]: 'HubSpot social calendar template',
  [SOURCE_URLS.asanaCalendar]: 'Asana social media calendar template',
}

export const SOCIAL_CONTENT_CALENDAR_TEMPLATES: Record<
  SocialContentCalendarTemplateKey,
  SocialContentCalendarTemplate
> = {
  whisper_to_shout: {
    key: 'whisper_to_shout',
    label: 'Whisper-to-shout launch',
    description: 'A campaign arc that starts with a small signal, teaches the frame, shows proof, then makes the offer.',
    goal_types: ['campaign_launch', 'product_release', 'offer_push'],
    source_urls: [SOURCE_URLS.hubspotCalendar, SOURCE_URLS.asanaCalendar],
    milestones: [
      {
        key: 'small_tension',
        campaign_phase: 'tease',
        channel: 'linkedin',
        title_prefix: 'Tease',
        planned_angle: 'Open with a small tension, observation, or question that makes the campaign problem visible.',
        relative_position: 0.1,
        fallback_day_offset: 0,
        recommended_lead_time_days: 14,
        required_assets: ['triggering_event', 'campaign_problem', 'audience'],
        approval_gates: ['copy_review'],
        source_urls: [SOURCE_URLS.hubspotCalendar, SOURCE_URLS.asanaCalendar],
      },
      {
        key: 'teaching_frame',
        campaign_phase: 'teach',
        channel: 'linkedin',
        title_prefix: 'Teach',
        planned_angle: 'Give the audience a useful framework or operating lesson connected to the campaign promise.',
        relative_position: 0.35,
        fallback_day_offset: 3,
        recommended_lead_time_days: 10,
        required_assets: ['framework', 'claim_boundaries'],
        approval_gates: ['copy_review', 'source_review'],
        source_urls: [SOURCE_URLS.hubspotCalendar],
      },
      {
        key: 'proof_signal',
        campaign_phase: 'proof',
        channel: 'linkedin',
        title_prefix: 'Proof',
        planned_angle: 'Show evidence, a shipped example, client-safe result, or lived project insight that earns trust.',
        relative_position: 0.65,
        fallback_day_offset: 6,
        recommended_lead_time_days: 7,
        required_assets: ['proof_asset', 'privacy_review'],
        approval_gates: ['copy_review', 'privacy_review'],
        source_urls: [SOURCE_URLS.asanaCalendar],
      },
      {
        key: 'clear_offer',
        campaign_phase: 'offer',
        channel: 'linkedin',
        title_prefix: 'Offer',
        planned_angle: 'Make the clearest campaign offer, bonus, release, or invitation as the campaign reaches the shout moment.',
        relative_position: 0.9,
        fallback_day_offset: 9,
        recommended_lead_time_days: 3,
        required_assets: ['offer', 'cta_url', 'publishing_gate'],
        approval_gates: ['copy_review', 'authorization_gate'],
        source_urls: [SOURCE_URLS.hubspotCalendar],
      },
    ],
  },
  youtube_video_release: {
    key: 'youtube_video_release',
    label: 'YouTube video release',
    description: 'A video-led calendar with topic validation, hook/script readiness, thumbnail/title work, launch, and post-publish learning.',
    goal_types: ['youtube_release', 'video_launch', 'authority_building'],
    source_urls: [
      SOURCE_URLS.youtubeCreators,
      SOURCE_URLS.youtubePremieres,
      SOURCE_URLS.thinkWithGooglePlaybook,
    ],
    milestones: [
      {
        key: 'topic_and_promise',
        campaign_phase: 'tease',
        channel: 'linkedin',
        title_prefix: 'Topic promise',
        planned_angle: 'Validate why this video should exist now: the audience problem, searchable promise, and Vambah-specific reason to speak.',
        relative_position: 0.12,
        fallback_day_offset: 0,
        recommended_lead_time_days: 21,
        required_assets: ['topic_trigger', 'audience_problem', 'research_pattern'],
        approval_gates: ['insight_review'],
        source_urls: [SOURCE_URLS.youtubeCreators, SOURCE_URLS.thinkWithGooglePlaybook],
      },
      {
        key: 'hook_script_and_broll',
        campaign_phase: 'teach',
        channel: 'youtube_shorts',
        title_prefix: 'Hook and script',
        planned_angle: 'Prepare the first 30 seconds, short-form cutdown, storyboard, b-roll list, and claim boundaries before production.',
        relative_position: 0.38,
        fallback_day_offset: 4,
        recommended_lead_time_days: 14,
        required_assets: ['hook', 'script', 'storyboard', 'b_roll_hints'],
        approval_gates: ['script_review', 'privacy_review'],
        source_urls: [SOURCE_URLS.youtubeCreators],
      },
      {
        key: 'thumbnail_title_package',
        campaign_phase: 'proof',
        channel: 'thumbnail',
        title_prefix: 'Thumbnail and title',
        planned_angle: 'Develop title and thumbnail variants that translate the source pattern into AmaduTown style without copying the creator reference.',
        relative_position: 0.68,
        fallback_day_offset: 8,
        recommended_lead_time_days: 7,
        required_assets: ['thumbnail_reference', 'title_variants', 'brand_adaptation'],
        approval_gates: ['thumbnail_review', 'brand_review'],
        source_urls: [SOURCE_URLS.youtubeCreators, SOURCE_URLS.thinkWithGooglePlaybook],
      },
      {
        key: 'publish_and_retro',
        campaign_phase: 'offer',
        channel: 'youtube_shorts',
        title_prefix: 'Publish gate and retro',
        planned_angle: 'Schedule the internal authorization gate, prepare premiere or publish notes, then review first-day and seven-day performance before the next variation.',
        relative_position: 0.9,
        fallback_day_offset: 12,
        recommended_lead_time_days: 2,
        required_assets: ['publish_copy', 'engagement_plan', 'analytics_retro'],
        approval_gates: ['authorization_gate', 'post_publish_review'],
        source_urls: [SOURCE_URLS.youtubePremieres, SOURCE_URLS.youtubeCreators],
      },
    ],
  },
  short_form_series: {
    key: 'short_form_series',
    label: 'Short-form series',
    description: 'A repeatable Reels/Shorts sequence that tests multiple hooks from one approved insight before scaling the winning angle.',
    goal_types: ['short_form_series', 'reels_series', 'shorts_series'],
    source_urls: [SOURCE_URLS.instagramBestPractices, SOURCE_URLS.youtubeCreators],
    milestones: [
      {
        key: 'series_hypothesis',
        campaign_phase: 'tease',
        channel: 'linkedin',
        title_prefix: 'Series hypothesis',
        planned_angle: 'State the recurring audience tension and the internal insight that makes this a useful short-form series.',
        relative_position: 0.1,
        fallback_day_offset: 0,
        recommended_lead_time_days: 10,
        required_assets: ['triggering_event', 'series_thesis'],
        approval_gates: ['insight_review'],
        source_urls: [SOURCE_URLS.instagramBestPractices],
      },
      {
        key: 'hook_batch',
        campaign_phase: 'teach',
        channel: 'instagram_reels',
        title_prefix: 'Hook batch',
        planned_angle: 'Draft three hook/script variants with safe-area notes, captions, b-roll hints, and a clear first-frame promise.',
        relative_position: 0.35,
        fallback_day_offset: 2,
        recommended_lead_time_days: 7,
        required_assets: ['hook_variants', 'script', 'safe_area_notes'],
        approval_gates: ['script_review', 'visual_review'],
        source_urls: [SOURCE_URLS.instagramBestPractices],
      },
      {
        key: 'proof_cutdown',
        campaign_phase: 'proof',
        channel: 'youtube_shorts',
        title_prefix: 'Proof cutdown',
        planned_angle: 'Create the proof-driven cutdown that points to the shipped feature, client-safe project, or Chronicle observation.',
        relative_position: 0.65,
        fallback_day_offset: 5,
        recommended_lead_time_days: 4,
        required_assets: ['proof_asset', 'b_roll', 'privacy_review'],
        approval_gates: ['privacy_review', 'visual_qa'],
        source_urls: [SOURCE_URLS.youtubeCreators],
      },
      {
        key: 'winning_angle_review',
        campaign_phase: 'offer',
        channel: 'instagram_reels',
        title_prefix: 'Winning angle review',
        planned_angle: 'Review performance and comments, select the next variation, and queue the follow-up authorization gate.',
        relative_position: 0.9,
        fallback_day_offset: 8,
        recommended_lead_time_days: 1,
        required_assets: ['metrics_snapshot', 'comment_review', 'next_variation'],
        approval_gates: ['performance_review'],
        source_urls: [SOURCE_URLS.instagramBestPractices, SOURCE_URLS.asanaCalendar],
      },
    ],
  },
  evergreen_authority: {
    key: 'evergreen_authority',
    label: 'Evergreen authority',
    description: 'A durable thought-leadership sequence for topics that should keep earning trust after the campaign window ends.',
    goal_types: ['authority', 'evergreen', 'education'],
    source_urls: [SOURCE_URLS.youtubeCreators, SOURCE_URLS.hubspotCalendar],
    milestones: [
      {
        key: 'evergreen_problem',
        campaign_phase: 'tease',
        channel: 'linkedin',
        title_prefix: 'Evergreen problem',
        planned_angle: 'Name the recurring operational problem in plain language and connect it to a current trigger.',
        relative_position: 0.15,
        fallback_day_offset: 0,
        recommended_lead_time_days: 14,
        required_assets: ['triggering_event', 'audience_problem'],
        approval_gates: ['copy_review'],
        source_urls: [SOURCE_URLS.hubspotCalendar],
      },
      {
        key: 'framework_asset',
        campaign_phase: 'teach',
        channel: 'linkedin',
        title_prefix: 'Framework',
        planned_angle: 'Publish the core framework, mental model, or operating principle that the audience can reuse.',
        relative_position: 0.42,
        fallback_day_offset: 4,
        recommended_lead_time_days: 10,
        required_assets: ['framework', 'reference_sources'],
        approval_gates: ['source_review', 'copy_review'],
        source_urls: [SOURCE_URLS.youtubeCreators],
      },
      {
        key: 'visual_explainer',
        campaign_phase: 'proof',
        channel: 'thumbnail',
        title_prefix: 'Visual explainer',
        planned_angle: 'Create a reusable visual, carousel, or thumbnail-style asset that makes the framework memorable.',
        relative_position: 0.7,
        fallback_day_offset: 7,
        recommended_lead_time_days: 6,
        required_assets: ['visual_brief', 'brand_review'],
        approval_gates: ['visual_review'],
        source_urls: [SOURCE_URLS.youtubeCreators, SOURCE_URLS.asanaCalendar],
      },
      {
        key: 'evergreen_cta',
        campaign_phase: 'offer',
        channel: 'linkedin',
        title_prefix: 'Evergreen CTA',
        planned_angle: 'Point the audience toward the durable resource, service, or next conversation without making the post feel like a hard launch.',
        relative_position: 0.9,
        fallback_day_offset: 10,
        recommended_lead_time_days: 2,
        required_assets: ['resource_link', 'cta'],
        approval_gates: ['authorization_gate'],
        source_urls: [SOURCE_URLS.hubspotCalendar],
      },
    ],
  },
  case_study_proof_drop: {
    key: 'case_study_proof_drop',
    label: 'Case study proof drop',
    description: 'A proof-first sequence for client-safe shipped work, product evidence, or operating results that need privacy review.',
    goal_types: ['case_study', 'proof_drop', 'client_safe_project'],
    source_urls: [SOURCE_URLS.asanaCalendar, SOURCE_URLS.hubspotCalendar],
    milestones: [
      {
        key: 'context_without_secrets',
        campaign_phase: 'tease',
        channel: 'linkedin',
        title_prefix: 'Context',
        planned_angle: 'Set up the before-state and why the work mattered without exposing client, meeting, or Chronicle-sensitive details.',
        relative_position: 0.12,
        fallback_day_offset: 0,
        recommended_lead_time_days: 14,
        required_assets: ['client_safe_context', 'privacy_boundaries'],
        approval_gates: ['privacy_review'],
        source_urls: [SOURCE_URLS.asanaCalendar],
      },
      {
        key: 'operating_lesson',
        campaign_phase: 'teach',
        channel: 'linkedin',
        title_prefix: 'Lesson',
        planned_angle: 'Extract the operating lesson from the project so the content teaches instead of merely announcing.',
        relative_position: 0.38,
        fallback_day_offset: 3,
        recommended_lead_time_days: 10,
        required_assets: ['lesson', 'claim_boundaries'],
        approval_gates: ['copy_review', 'source_review'],
        source_urls: [SOURCE_URLS.hubspotCalendar],
      },
      {
        key: 'evidence_package',
        campaign_phase: 'proof',
        channel: 'linkedin',
        title_prefix: 'Evidence',
        planned_angle: 'Prepare screenshots, metrics, before/after notes, or a carousel from approved evidence only.',
        relative_position: 0.68,
        fallback_day_offset: 7,
        recommended_lead_time_days: 7,
        required_assets: ['screenshots', 'metrics', 'redaction_review'],
        approval_gates: ['visual_review', 'privacy_review'],
        source_urls: [SOURCE_URLS.asanaCalendar],
      },
      {
        key: 'objection_and_offer',
        campaign_phase: 'offer',
        channel: 'linkedin',
        title_prefix: 'Objection and offer',
        planned_angle: 'Address the likely objection, then invite the audience into the relevant offer or conversation.',
        relative_position: 0.9,
        fallback_day_offset: 10,
        recommended_lead_time_days: 2,
        required_assets: ['objection', 'offer', 'cta'],
        approval_gates: ['authorization_gate'],
        source_urls: [SOURCE_URLS.hubspotCalendar],
      },
    ],
  },
}

export function isCalendarChannel(value: unknown): value is SocialContentCalendarChannel {
  return typeof value === 'string'
    && SOCIAL_CONTENT_CALENDAR_CHANNELS.includes(value as SocialContentCalendarChannel)
}

export function isCampaignPhase(value: unknown): value is SocialContentCampaignPhase {
  return typeof value === 'string'
    && SOCIAL_CONTENT_CAMPAIGN_PHASES.includes(value as SocialContentCampaignPhase)
}

export function isDueStatus(value: unknown): value is SocialContentCalendarDueStatus {
  return typeof value === 'string'
    && SOCIAL_CONTENT_CALENDAR_DUE_STATUSES.includes(value as SocialContentCalendarDueStatus)
}

export function isAuthorizationStatus(value: unknown): value is SocialContentCalendarAuthorizationStatus {
  return typeof value === 'string'
    && SOCIAL_CONTENT_CALENDAR_AUTHORIZATION_STATUSES.includes(
      value as SocialContentCalendarAuthorizationStatus,
    )
}

export function isCalendarTemplateKey(value: unknown): value is SocialContentCalendarTemplateKey {
  return typeof value === 'string'
    && SOCIAL_CONTENT_CALENDAR_TEMPLATE_KEYS.includes(value as SocialContentCalendarTemplateKey)
}

export function normalizeCalendarChannel(value: unknown): SocialContentCalendarChannel {
  return isCalendarChannel(value) ? value : 'linkedin'
}

export function normalizeCampaignPhase(value: unknown): SocialContentCampaignPhase {
  return isCampaignPhase(value) ? value : 'tease'
}

export function normalizeDueStatus(value: unknown): SocialContentCalendarDueStatus {
  return isDueStatus(value) ? value : 'planned'
}

export function normalizeAuthorizationStatus(value: unknown): SocialContentCalendarAuthorizationStatus {
  return isAuthorizationStatus(value) ? value : 'pending'
}

export function normalizeCalendarTemplateKey(value: unknown): SocialContentCalendarTemplateKey {
  return isCalendarTemplateKey(value) ? value : 'whisper_to_shout'
}

export function getCalendarTemplate(value?: unknown): SocialContentCalendarTemplate {
  return SOCIAL_CONTENT_CALENDAR_TEMPLATES[normalizeCalendarTemplateKey(value)]
}

const TEMPLATE_RECOMMENDATION_ORDER: SocialContentCalendarTemplateKey[] = [
  'whisper_to_shout',
  'youtube_video_release',
  'short_form_series',
  'evergreen_authority',
  'case_study_proof_drop',
]

const TEMPLATE_RECOMMENDATION_TERMS: Record<
  SocialContentCalendarTemplateKey,
  Array<{ term: string; reason: string; weight: number }>
> = {
  whisper_to_shout: [
    { term: 'launch', reason: 'Campaign language points to a launch arc.', weight: 3 },
    { term: 'offer', reason: 'Offer language needs tease-to-conversion pacing.', weight: 3 },
    { term: 'bonus', reason: 'Bonus language fits a whisper-to-shout sequence.', weight: 2 },
    { term: 'release', reason: 'Release language benefits from staged announcements.', weight: 2 },
    { term: 'promotion', reason: 'Promotional language maps to campaign pacing.', weight: 2 },
  ],
  youtube_video_release: [
    { term: 'youtube', reason: 'YouTube language calls for video-led milestones.', weight: 4 },
    { term: 'video', reason: 'Video language needs hook, script, thumbnail, and launch gates.', weight: 3 },
    { term: 'thumbnail', reason: 'Thumbnail language makes the video release template stronger.', weight: 3 },
    { term: 'premiere', reason: 'Premiere language maps to YouTube launch planning.', weight: 3 },
    { term: 'creator', reason: 'Creator language points to public video research patterns.', weight: 2 },
  ],
  short_form_series: [
    { term: 'reel', reason: 'Reels language needs short-form batches and safe-area planning.', weight: 4 },
    { term: 'short', reason: 'Short-form language benefits from repeatable hook testing.', weight: 3 },
    { term: 'tiktok', reason: 'TikTok language maps to short-form series planning.', weight: 3 },
    { term: 'instagram', reason: 'Instagram language fits the Reels planning lane.', weight: 3 },
    { term: 'series', reason: 'Series language benefits from repeated variations.', weight: 2 },
  ],
  evergreen_authority: [
    { term: 'evergreen', reason: 'Evergreen language calls for durable authority content.', weight: 4 },
    { term: 'authority', reason: 'Authority language fits a reusable education sequence.', weight: 3 },
    { term: 'education', reason: 'Education language needs framework and reference milestones.', weight: 3 },
    { term: 'framework', reason: 'Framework language fits an evergreen teaching asset.', weight: 3 },
    { term: 'guide', reason: 'Guide language points to durable thought-leadership content.', weight: 2 },
  ],
  case_study_proof_drop: [
    { term: 'case study', reason: 'Case-study language needs proof and privacy review.', weight: 4 },
    { term: 'proof', reason: 'Proof language calls for evidence packaging.', weight: 3 },
    { term: 'client', reason: 'Client language needs privacy-safe evidence handling.', weight: 3 },
    { term: 'shipped', reason: 'Shipped-work language maps to a proof drop.', weight: 3 },
    { term: 'result', reason: 'Result language benefits from metrics and before/after framing.', weight: 2 },
    { term: 'evidence', reason: 'Evidence language points to screenshot and source review.', weight: 2 },
  ],
}

function recommendationText(campaign: Pick<AttractionCampaign, 'name' | 'description' | 'campaign_type'>) {
  return `${campaign.name} ${campaign.description ?? ''} ${campaign.campaign_type}`.toLowerCase()
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values))
}

export function recommendCalendarTemplates(
  campaign: Pick<AttractionCampaign, 'name' | 'description' | 'campaign_type'>,
): SocialContentCalendarTemplateRecommendation[] {
  const text = recommendationText(campaign)

  return TEMPLATE_RECOMMENDATION_ORDER
    .map((key, orderIndex) => {
      const template = SOCIAL_CONTENT_CALENDAR_TEMPLATES[key]
      const termMatches = TEMPLATE_RECOMMENDATION_TERMS[key].filter(({ term }) => text.includes(term))
      const matchedTerms = termMatches.map(({ term }) => term)
      const reasons = termMatches.map(({ reason }) => reason)
      let score = termMatches.reduce((total, match) => total + match.weight, 0)

      if (campaign.campaign_type === 'free_challenge' && key === 'short_form_series') {
        score += 3
        reasons.push('Challenge campaigns benefit from repeatable short-form prompts.')
        matchedTerms.push('free_challenge')
      }
      if ((campaign.campaign_type === 'bonus_credit' || campaign.campaign_type === 'win_money_back') && key === 'whisper_to_shout') {
        score += 3
        reasons.push('Offer-backed campaigns benefit from staged campaign pacing.')
        matchedTerms.push(campaign.campaign_type)
      }
      if (key === 'whisper_to_shout') {
        score += 1
        reasons.push('Safe default for time-bound campaign announcements.')
      }

      return {
        key,
        label: template.label,
        score,
        reasons: uniqueValues(reasons).slice(0, 3),
        matched_terms: uniqueValues(matchedTerms),
        orderIndex,
      }
    })
    .filter((recommendation) => recommendation.score > 0)
    .sort((a, b) => b.score - a.score || a.orderIndex - b.orderIndex)
    .map(({ orderIndex: _orderIndex, ...recommendation }) => recommendation)
}

export function defaultAuthorizationDueAt(scheduledFor: string | Date) {
  const scheduled = typeof scheduledFor === 'string' ? new Date(scheduledFor) : scheduledFor
  if (!Number.isFinite(scheduled.getTime())) return null
  const due = new Date(scheduled.getTime() - 24 * 60 * 60 * 1000)
  return due.toISOString()
}

export function deriveDueStatus(
  scheduledFor: string | Date,
  now: Date = new Date(),
): SocialContentCalendarDueStatus {
  const scheduled = typeof scheduledFor === 'string' ? new Date(scheduledFor) : scheduledFor
  if (!Number.isFinite(scheduled.getTime())) return 'planned'

  const diffMs = scheduled.getTime() - now.getTime()
  if (diffMs < -2 * 60 * 60 * 1000) return 'past_due'
  if (diffMs <= 2 * 60 * 60 * 1000) return 'due_now'
  if (diffMs <= 24 * 60 * 60 * 1000) return 'due_soon'
  return 'planned'
}

export function dueGateWindow(scheduledFor: string | Date, now: Date = new Date()): '24h' | '2h' | null {
  const scheduled = typeof scheduledFor === 'string' ? new Date(scheduledFor) : scheduledFor
  if (!Number.isFinite(scheduled.getTime())) return null
  const diffMs = scheduled.getTime() - now.getTime()
  if (diffMs < -2 * 60 * 60 * 1000 || diffMs > 24 * 60 * 60 * 1000) return null
  if (diffMs <= 2 * 60 * 60 * 1000) return '2h'
  return '24h'
}

export function parseMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function dateOrNull(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function atLocalWorkHour(date: Date, hour = 10) {
  const next = new Date(date)
  next.setHours(hour, 0, 0, 0)
  return next
}

function campaignDateAt(start: Date, end: Date, ratio: number) {
  const time = start.getTime() + (end.getTime() - start.getTime()) * ratio
  return atLocalWorkHour(new Date(time))
}

export function campaignContentPlanSlots(
  campaign: Pick<AttractionCampaign, 'name' | 'starts_at' | 'ends_at'>,
  options: { templateKey?: SocialContentCalendarTemplateKey } = {},
) {
  const start = dateOrNull(campaign.starts_at) ?? addDays(new Date(), 1)
  const end = dateOrNull(campaign.ends_at) ?? addDays(start, 21)
  const hasUsableWindow = end.getTime() > start.getTime()
  const baseStart = atLocalWorkHour(start)
  const template = getCalendarTemplate(options.templateKey)

  return template.milestones.map((milestone) => {
    const scheduledDate = hasUsableWindow
      ? campaignDateAt(start, end, milestone.relative_position)
      : addDays(baseStart, milestone.fallback_day_offset)

    return {
      campaign_phase: milestone.campaign_phase,
      channel: milestone.channel,
      title: `${milestone.title_prefix}: ${campaign.name}`,
      planned_angle: milestone.planned_angle,
      scheduled_for: scheduledDate.toISOString(),
      authorization_due_at: defaultAuthorizationDueAt(scheduledDate),
      authorization_status: 'pending' as SocialContentCalendarAuthorizationStatus,
      due_status: deriveDueStatus(scheduledDate),
      autonomy_eligible: false,
      metadata: {
        generated_from: 'campaign_content_plan',
        campaign_arc: template.key,
        template_key: template.key,
        template_label: template.label,
        template_goal_types: template.goal_types,
        template_source_urls: template.source_urls,
        milestone_key: milestone.key,
        recommended_lead_time_days: milestone.recommended_lead_time_days,
        required_assets: milestone.required_assets,
        approval_gates: milestone.approval_gates,
        source_urls: milestone.source_urls,
        external_execution_enabled: false,
      },
    }
  })
}
