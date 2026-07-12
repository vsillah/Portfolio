/**
 * Server-side demo seed data (replaces SQL scripts for Admin → Testing E2E).
 * Called only from POST /api/admin/testing/demo-seed (verifyAdmin).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { campaignContentPlanSlots } from './social-content-calendar'
import { buildLinkedInYoutubeReviewDrafts } from './social-content-intelligence'

export const DEMO_SEED_KEYS = [
  'sarah_mitchell_lead',
  'paid_proposal_jordan',
  'lead_qualification_99999',
  'onboarding_test_project',
  'kickoff_test_project',
  'discovery_call_test_contact',
  'social_content_calendar_fixture',
  'social_channel_review_fixture',
  'accelerated_workshop_campaign_fixture',
  'agentic_book_rollout_campaign_fixture',
] as const

export type DemoSeedKey = (typeof DEMO_SEED_KEYS)[number]

export function isDemoSeedKey(k: string): k is DemoSeedKey {
  return (DEMO_SEED_KEYS as readonly string[]).includes(k)
}

const SARAH_SESSION = 'test-lead-session-001'
const SARAH_EMAIL = 'sarah.mitchell@techflow.io'
export const SOCIAL_CONTENT_CALENDAR_FIXTURE_SLUG = 'demo-content-calendar-smoke'
export const SOCIAL_CONTENT_CALENDAR_FIXTURE_KEY = 'social_content_calendar_fixture'
export const SOCIAL_CHANNEL_REVIEW_FIXTURE_KEY = 'social_channel_review_fixture'
export const SOCIAL_CHANNEL_REVIEW_FIXTURE_IDEMPOTENCY_KEY = 'demo:social-channel-review-fixture'
export const ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_KEY = 'accelerated_workshop_campaign_fixture'
export const ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_SLUG = 'accelerated-workshop-whisper-to-shout'
export const ACCELERATED_WORKSHOP_CAMPAIGN_IDEMPOTENCY_PREFIX = 'demo:accelerated-workshop-campaign'
export const AGENTIC_BOOK_ROLLOUT_CAMPAIGN_FIXTURE_KEY = 'agentic_book_rollout_campaign_fixture'
export const AGENTIC_BOOK_ROLLOUT_CAMPAIGN_FIXTURE_SLUG = 'agentic-book-rollout-whisper-to-shout'
export const AGENTIC_BOOK_ROLLOUT_CAMPAIGN_IDEMPOTENCY_PREFIX = 'demo:agentic-book-rollout-campaign'

const BUSINESS_CHALLENGES = {
  primary_challenges: [
    'Manual lead follow-up taking too long',
    'Inconsistent sales messaging',
    'No visibility into pipeline health',
  ],
  pain_points: [
    'Losing deals due to slow response times',
    'Sales team spending 60% of time on admin tasks',
  ],
  current_impact: 'Estimated $200K in lost revenue due to slow follow-up',
  attempted_solutions: ['Hired more sales reps', 'Tried Zapier but hit limitations'],
}

const TECH_STACK = {
  crm: 'HubSpot',
  email: 'Google Workspace',
  marketing: 'Mailchimp',
  analytics: 'Google Analytics',
  other_tools: ['Slack', 'Notion', 'Calendly'],
  integration_readiness: 'High - all tools have APIs',
}

const AUTOMATION_NEEDS = {
  priority_areas: ['Lead scoring and routing', 'Automated follow-up sequences', 'Pipeline reporting'],
  desired_outcomes: [
    'Respond to leads within 5 minutes',
    'Personalized outreach at scale',
    'Real-time deal insights',
  ],
  complexity_tolerance: 'Medium - want results fast but willing to invest in setup',
}

const AI_READINESS = {
  data_quality: 'Good - clean CRM data',
  team_readiness: 'Excited about AI tools',
  previous_ai_experience: 'Used ChatGPT for email templates',
  concerns: ['Data privacy', 'Cost'],
  readiness_score: 7,
}

const BUDGET_TIMELINE = {
  budget_range: '$5,000-$15,000',
  timeline: 'Want to start within 30 days',
  decision_timeline: 'Can decide within 2 weeks',
  budget_flexibility: 'Could increase for proven ROI',
}

const DECISION_MAKING = {
  decision_maker: true,
  stakeholders: ['CEO', 'Sales Manager'],
  approval_process: 'Sarah has final say for tools under $20K',
  previous_vendor_experience: 'Good - currently using 3 SaaS tools',
}

const PROPOSAL_LINE_ITEMS = [
  {
    content_type: 'project',
    content_id: '00000000-0000-0000-0000-000000000001',
    title: 'Custom AI Chatbot',
    description:
      'Full-stack AI chatbot with RAG pipeline, custom knowledge base, and multi-channel deployment.',
    offer_role: 'core_offer',
    price: 4500.0,
    perceived_value: 7500.0,
  },
  {
    content_type: 'service',
    content_id: '00000000-0000-0000-0000-000000000002',
    title: 'Chatbot Training & Handoff',
    description: 'Training session for client team on chatbot management and customization.',
    offer_role: 'upsell',
    price: 500.0,
    perceived_value: 1000.0,
  },
]

function addDaysISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function addDaysAtHourISO(days: number, hour: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

async function removeSarahMitchellChain(supabase: SupabaseClient): Promise<void> {
  const { data: contact } = await supabase
    .from('contact_submissions')
    .select('id')
    .eq('email', SARAH_EMAIL)
    .maybeSingle()

  if (contact?.id != null) {
    await supabase.from('diagnostic_audits').delete().eq('contact_submission_id', contact.id)
  }
  await supabase.from('diagnostic_audits').delete().eq('session_id', SARAH_SESSION)
  await supabase.from('contact_submissions').delete().eq('email', SARAH_EMAIL)
  await supabase.from('chat_sessions').delete().eq('session_id', SARAH_SESSION)
}

async function removeSocialContentCalendarFixture(supabase: SupabaseClient): Promise<void> {
  const { data: campaign } = await supabase
    .from('attraction_campaigns')
    .select('id')
    .eq('slug', SOCIAL_CONTENT_CALENDAR_FIXTURE_SLUG)
    .maybeSingle()

  await supabase
    .from('social_content_calendar_items')
    .delete()
    .contains('metadata', { demo_seed_key: SOCIAL_CONTENT_CALENDAR_FIXTURE_KEY })

  if (campaign?.id != null) {
    await supabase
      .from('social_content_calendar_items')
      .delete()
      .eq('campaign_id', campaign.id)
  }

  await supabase
    .from('attraction_campaigns')
    .delete()
    .eq('slug', SOCIAL_CONTENT_CALENDAR_FIXTURE_SLUG)
}

async function removeSocialChannelReviewFixture(supabase: SupabaseClient): Promise<void> {
  await supabase
    .from('agent_work_items')
    .delete()
    .eq('idempotency_key', SOCIAL_CHANNEL_REVIEW_FIXTURE_IDEMPOTENCY_KEY)

  await supabase
    .from('social_content_research_packets')
    .delete()
    .contains('actor_metadata', { demo_seed_key: SOCIAL_CHANNEL_REVIEW_FIXTURE_KEY })
}

async function removeAcceleratedWorkshopCampaignFixture(supabase: SupabaseClient): Promise<void> {
  const { data: campaign } = await supabase
    .from('attraction_campaigns')
    .select('id')
    .eq('slug', ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_SLUG)
    .maybeSingle()

  await supabase
    .from('social_content_calendar_items')
    .delete()
    .contains('metadata', { demo_seed_key: ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_KEY })

  await supabase
    .from('agent_work_items')
    .delete()
    .like('idempotency_key', `${ACCELERATED_WORKSHOP_CAMPAIGN_IDEMPOTENCY_PREFIX}:%`)

  await supabase
    .from('social_content_research_packets')
    .delete()
    .contains('actor_metadata', { demo_seed_key: ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_KEY })

  if (campaign?.id != null) {
    await supabase
      .from('social_content_calendar_items')
      .delete()
      .eq('campaign_id', campaign.id)
  }

  await supabase
    .from('attraction_campaigns')
    .delete()
    .eq('slug', ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_SLUG)
}

async function removeAgenticBookRolloutCampaignFixture(supabase: SupabaseClient): Promise<void> {
  const { data: campaign } = await supabase
    .from('attraction_campaigns')
    .select('id')
    .eq('slug', AGENTIC_BOOK_ROLLOUT_CAMPAIGN_FIXTURE_SLUG)
    .maybeSingle()

  await supabase
    .from('social_content_calendar_items')
    .delete()
    .contains('metadata', { demo_seed_key: AGENTIC_BOOK_ROLLOUT_CAMPAIGN_FIXTURE_KEY })

  await supabase
    .from('agent_work_items')
    .delete()
    .like('idempotency_key', `${AGENTIC_BOOK_ROLLOUT_CAMPAIGN_IDEMPOTENCY_PREFIX}:%`)

  await supabase
    .from('social_content_research_packets')
    .delete()
    .contains('actor_metadata', { demo_seed_key: AGENTIC_BOOK_ROLLOUT_CAMPAIGN_FIXTURE_KEY })

  if (campaign?.id != null) {
    await supabase
      .from('social_content_calendar_items')
      .delete()
      .eq('campaign_id', campaign.id)
  }

  await supabase
    .from('attraction_campaigns')
    .delete()
    .eq('slug', AGENTIC_BOOK_ROLLOUT_CAMPAIGN_FIXTURE_SLUG)
}

const ACCELERATED_WORKSHOP_PHASES = [
  {
    phase: 'tease',
    titlePrefix: 'Tease',
    day: 1,
    insightTitle: 'AI can create faster than most teams can govern',
    triggeringEvent:
      'The Portfolio social-content workflow exposed the real gap: generating a post was easier than knowing whether the evidence, owner, and approval gate were visible.',
    contentAngle:
      'AI makes production faster. Teams still need a way to slow down the risky handoff before the work reaches the public.',
    suggestedHook:
      'AI can create faster than most teams can govern.',
    linkedinCta:
      'Where have you seen AI speed expose a missing approval path?',
    thumbnailText: 'FAST OUTPUT. SLOW TRUST.',
  },
  {
    phase: 'teach',
    titlePrefix: 'Teach',
    day: 4,
    insightTitle: 'The operating loop behind smarter product work',
    triggeringEvent:
      'The Accelerated Workshop turns the book idea into a working loop: sense the signal, assemble the proof, make the decision, then govern the handoff.',
    contentAngle:
      'The useful AI lesson is an operating rhythm, not a prompt trick. The loop has to connect raw input, structured judgment, and visible approval.',
    suggestedHook:
      'The prompt is rarely the operating system.',
    linkedinCta:
      'What part of your AI workflow still depends on memory instead of an operating loop?',
    thumbnailText: 'THE LOOP BEHIND THE WORK',
  },
  {
    phase: 'proof',
    titlePrefix: 'Proof',
    day: 9,
    insightTitle: 'The Portfolio workflow is the receipt',
    triggeringEvent:
      'This campaign can point to the actual Portfolio workflow: Shaka insights, Content Intelligence research, calendar planning, channel drafts, and explicit human approval gates.',
    contentAngle:
      'The proof is the system itself. The draft, calendar, research packet, channel lane, and approval decision all stay visible before any external action is allowed.',
    suggestedHook:
      'The receipt is the workflow.',
    linkedinCta:
      'What would your customers trust more: the AI output, or the visible path that produced it?',
    thumbnailText: 'SHOW THE RECEIPTS',
  },
  {
    phase: 'offer',
    titlePrefix: 'Offer',
    day: 13,
    insightTitle: 'Join the Accelerated Workshop path',
    triggeringEvent:
      'The Accelerated Workshop is the next public bridge from the book into hands-on practice for teams trying to turn AI experimentation into governed product work.',
    contentAngle:
      'The offer is simple: learn how to turn messy AI-assisted work into an operating system your team can review, trust, and improve.',
    suggestedHook:
      'If AI is already inside the work, the next question is who governs the handoff.',
    linkedinCta:
      'If this is the kind of operating layer your team needs, join the Accelerated Workshop interest path or book a discovery call.',
    thumbnailText: 'BUILD THE OPERATING LAYER',
  },
] as const

const AGENTIC_BOOK_ROLLOUT_PHASES = [
  {
    phase: 'tease',
    titlePrefix: 'Tease',
    day: 1,
    insightTitle: 'Anyone can launch an agent now',
    triggeringEvent:
      'The Agentic rollout work exposed the public-facing tension: agent demos are easy to get excited about, but the operating questions show up the moment an agent needs authority.',
    contentAngle:
      'The launch should start with the pain: AI agents are moving into real workflows before teams have receipts, scopes, owners, and approval paths.',
    suggestedHook:
      'Anyone can launch an agent now. The harder question is who is responsible when it acts.',
    linkedinCta:
      'Where have you seen an AI demo move faster than the operating system around it?',
    thumbnailText: 'AGENTS NEED RECEIPTS',
  },
  {
    phase: 'teach',
    titlePrefix: 'Teach',
    day: 4,
    insightTitle: 'The harness matters more than the agent',
    triggeringEvent:
      'The Agentic source plan frames the production harness as source inventory, artifact specification, constrained creation, challenger review, repair, and human approval.',
    contentAngle:
      'The audience needs the core model before the bigger announcement: agents become useful when the work is bounded, sourced, challenged, and reviewed.',
    suggestedHook:
      'The agent is not the operating system. The harness is.',
    linkedinCta:
      'What would you put in the harness before giving an agent more authority?',
    thumbnailText: 'BUILD THE HARNESS',
  },
  {
    phase: 'proof',
    titlePrefix: 'Proof',
    day: 9,
    insightTitle: 'The Portfolio workflow is the rollout receipt',
    triggeringEvent:
      'Portfolio already has named agents, Agent Ops approvals, work items, platform gates, content intelligence, and review packets that can show the operating layer in motion.',
    contentAngle:
      'The proof milestone should show the actual system: review queues, source packets, calendar milestones, challenger packets, and gated platform submission.',
    suggestedHook:
      'The receipt is not the content. The receipt is the path the content traveled.',
    linkedinCta:
      'What proof would make you trust an agentic workflow before it touched a customer?',
    thumbnailText: 'SHOW THE PATH',
  },
  {
    phase: 'offer',
    titlePrefix: 'Offer',
    day: 13,
    insightTitle: 'Follow the Agentic book rollout',
    triggeringEvent:
      'The Agentic book rollout can become the public container for the system Vambah is building: a practical field guide for governed AI work, not another autonomy hype cycle.',
    contentAngle:
      'The shout moment invites people into the Agentic rollout: follow the series, review the proof, and book a discovery path if they need governed Agent Ops in their own organization.',
    suggestedHook:
      'The next wave of AI work will be judged by its receipts.',
    linkedinCta:
      'If you want the Agentic rollout notes as they become public, follow along or reach out through AmaduTown.',
    thumbnailText: 'THE AGENTIC ROLLOUT',
  },
] as const

function acceleratedWorkshopThumbnailPacket(input: {
  phase: string
  generatedAt: string
  insightTitle: string
  contentAngle: string
  thumbnailText: string
}) {
  return {
    channel: 'thumbnail',
    generated_at: input.generatedAt,
    approval_status: 'in_review',
    shared_source: {
      insight_title: input.insightTitle,
      triggering_event: `Accelerated Workshop ${input.phase} phase`,
      content_angle: input.contentAngle,
      evidence_summary: 'Uses the shared Accelerated Workshop campaign proof packet and Portfolio Agent Ops workflow evidence.',
    },
    source_insight_title: input.insightTitle,
    source_use_boundary:
      'Thumbnail concepts are generated for human review only. Public research patterns are layout inputs, not source artwork.',
    fields: {
      source_thumbnail_reference: 'Use approved public creator research patterns as structure only.',
      pattern_explanation:
        'High-contrast first-frame promise with one clear tension and a visible operating-system proof cue.',
      amadutown_adaptation_direction:
        'Use AmaduTown navy/gold/white styling, proof-surface screenshots, and Vambah as the teacher/operator rather than copying a creator visual identity.',
      short_thumbnail_text: input.thumbnailText,
      face_photo_avatar_choice: 'Vambah face/photo or clean AmaduTown proof-screen frame.',
      brand_colors_style: 'AmaduTown navy, radiant gold, white, restrained proof-console accents.',
      variants: [
        `${input.thumbnailText} over a blurred Portfolio approval-gate screenshot.`,
        `Vambah on one side, proof dashboard on the other, with ${input.phase.toUpperCase()} phase label.`,
        `Minimal AmaduTown shield plus one screenshot receipt and a short tension line.`,
      ],
      approval_state: 'in_review',
    },
    source_research_patterns: [],
    side_effects: {
      provider_generation: false,
      upload: false,
      publish: false,
      schedule: false,
      external_post: false,
    },
  }
}

function acceleratedWorkshopInsightMetadata(input: {
  packetId: string
  phase: typeof ACCELERATED_WORKSHOP_PHASES[number]
  generatedAt: string
}) {
  const approvedResearchPattern = {
    packet_id: input.packetId,
    source_url: 'https://amadutown.com/ebook/accelerated',
    platform: 'other',
    creator_name: 'AmaduTown',
    title: 'Accelerated Workshop proof campaign research packet',
    outlier_score: 0,
    pattern_status: 'usable_framework',
    pattern_packet: {
      hook_structure:
        'Open with a specific operating tension, then show the system that makes the work reviewable.',
      promise_value:
        'Help operators turn AI-assisted creation into governed product work they can trust.',
      thumbnail_pattern:
        'Pair a short tension line with visible proof from the operating surface.',
      source_use_boundary:
        'Use AmaduTown-owned proof and public-safe positioning only. Do not expose raw private meetings, Chronicle notes, client material, or provider outputs.',
    },
  }
  const insight = {
    title: input.phase.insightTitle,
    triggering_event: input.phase.triggeringEvent,
    source_type: 'portfolio_work',
    source_label: 'Accelerated Workshop proof campaign',
    source_ids: [ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_KEY],
    why_vambah_can_speak:
      'Vambah wrote the Accelerated product-management frame, is building the Portfolio Agent Ops workflow directly, and can show the difference between AI output and governed work.',
    brand_goal:
      'Position the Accelerated Workshop as the practical bridge from AI experimentation to governed product execution.',
    content_angle: input.phase.contentAngle,
    suggested_hook: input.phase.suggestedHook,
    audience:
      'Product leaders, builders, founders, nonprofit and small-business operators, and AI-curious teams.',
    sensitivity: 'public_safe',
    evidence_summary:
      'Evidence comes from the Accelerated book/workshop path, AmaduTown offer architecture, and the live Portfolio workflow for Shaka insights, research packets, calendar planning, channel drafts, and human approval gates.',
    claim_boundaries: [
      'Do not imply the Accelerated Workshop is already open for paid enrollment unless a separate launch gate approves it.',
      'Do not claim external publishing, uploading, rendering, or provider generation is authorized by this campaign seed.',
      'Use Portfolio and AmaduTown-owned proof surfaces; do not expose private meetings, Chronicle notes, client records, or raw AI chat exports.',
      'Treat public creator research as reusable structure only, not copy.',
    ],
    approved_research_patterns: [approvedResearchPattern],
  }
  const drafts = buildLinkedInYoutubeReviewDrafts({ insight, generatedAt: input.generatedAt })

  drafts.linkedin.fields = {
    ...drafts.linkedin.fields,
    cta: input.phase.linkedinCta,
    cta_url: 'https://amadutown.com/ebook/accelerated',
    visual_mode: input.phase.phase === 'proof'
      ? 'app_screenshot_carousel'
      : 'framework_illustration_or_carousel_review',
    screenshot_routes: [
      '/admin/agents/content-intelligence',
      '/admin/agents/coordination',
      '/admin/agents/social-insights',
      '/ebook/accelerated',
    ],
  }
  drafts.youtube_shorts.fields = {
    ...drafts.youtube_shorts.fields,
    target_duration_seconds: 45,
    caption: `${input.phase.contentAngle} Built for the Accelerated Workshop proof campaign.`,
    b_roll_hints: [
      'Accelerated ebook page',
      'Content Intelligence dashboard',
      'Campaign calendar arc',
      'Social Insight approval tabs',
      'AmaduTown proof surface',
    ],
    on_screen_text: [
      input.phase.thumbnailText,
      'Evidence before output.',
      'Approval before handoff.',
    ],
  }
  drafts.instagram_reels.fields = {
    ...drafts.instagram_reels.fields,
    caption: `${input.phase.contentAngle} Built for the Accelerated Workshop proof campaign.`,
    b_roll_assets: [
      'Accelerated ebook page',
      'Content Intelligence dashboard',
      'Campaign calendar arc',
      'Social Insight approval tabs',
      'AmaduTown proof surface',
    ],
    safe_area_notes: [
      'Keep captions and CTA clear of top and bottom app chrome.',
      'Frame Portfolio proof screens in the vertical center.',
      'Redact private admin, client, Chronicle, or meeting-derived detail before export.',
    ],
  }
  drafts.tiktok.fields = {
    ...drafts.tiktok.fields,
    caption: `${input.phase.suggestedHook} Built for the Accelerated Workshop proof campaign.`,
    b_roll_assets: [
      'Accelerated ebook page',
      'Content Intelligence dashboard',
      'Campaign calendar arc',
      'Social Insight approval tabs',
      'AmaduTown proof surface',
    ],
    audio_rights: 'Use original narration, approved provider voiceover, or platform-safe audio only.',
  }

  return {
    social_topic_trigger: true,
    insight_version: 'accelerated_workshop_campaign_v1',
    demo_seed_key: ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_KEY,
    fixture_version: 1,
    fixture_purpose: 'accelerated_workshop_whisper_to_shout_review_ready_campaign',
    campaign_target: 'Accelerated Workshop',
    campaign_window_days: 14,
    campaign_template_key: 'whisper_to_shout',
    campaign_language: 'Tease/Wispr/Shout overlay; stored phases remain tease/teach/proof/offer.',
    conversion_path: 'Accelerated Workshop interest, then AI Quick Win or discovery call.',
    research_packet_ids: [input.packetId],
    suggested_research_packet_ids: [input.packetId],
    channel_lanes: {
      linkedin: {
        status: 'in_review',
        label: 'LinkedIn',
        decision_note: null,
        draft_packet: drafts.linkedin,
        review_requested_at: input.generatedAt,
        updated_at: input.generatedAt,
        required_inputs: ['post text', 'CTA', 'CTA URL', 'hashtags', 'references'],
      },
      youtube_shorts: {
        status: 'in_review',
        label: 'YouTube Shorts',
        decision_note: null,
        draft_packet: drafts.youtube_shorts,
        review_requested_at: input.generatedAt,
        updated_at: input.generatedAt,
        required_inputs: ['hook', 'first 30 seconds', 'script', 'storyboard scenes', 'b-roll hints'],
      },
      instagram_reels: {
        status: 'in_review',
        label: 'Instagram Reels',
        decision_note: null,
        draft_packet: drafts.instagram_reels,
        review_requested_at: input.generatedAt,
        updated_at: input.generatedAt,
        required_inputs: ['hook', 'script', 'caption', 'safe-area notes'],
      },
      tiktok: {
        status: 'in_review',
        label: 'TikTok',
        decision_note: null,
        draft_packet: drafts.tiktok,
        review_requested_at: input.generatedAt,
        updated_at: input.generatedAt,
        required_inputs: ['hook', 'script', 'caption', 'audio rights', 'safe-area notes'],
      },
      thumbnail: {
        status: 'in_review',
        label: 'Thumbnail',
        decision_note: null,
        draft_packet: acceleratedWorkshopThumbnailPacket({
          phase: input.phase.phase,
          generatedAt: input.generatedAt,
          insightTitle: input.phase.insightTitle,
          contentAngle: input.phase.contentAngle,
          thumbnailText: input.phase.thumbnailText,
        }),
        review_requested_at: input.generatedAt,
        updated_at: input.generatedAt,
        required_inputs: ['pattern explanation', 'short thumbnail text', '2-3 variants'],
      },
    },
    insight,
    side_effects: {
      provider_generation: false,
      upload: false,
      publish: false,
      schedule: false,
      external_post: false,
    },
  }
}

function agenticBookRolloutThumbnailPacket(input: {
  phase: string
  generatedAt: string
  insightTitle: string
  contentAngle: string
  thumbnailText: string
}) {
  return {
    channel: 'thumbnail',
    generated_at: input.generatedAt,
    approval_status: 'in_review',
    shared_source: {
      insight_title: input.insightTitle,
      triggering_event: `Agentic book rollout ${input.phase} phase`,
      content_angle: input.contentAngle,
      evidence_summary:
        'Uses the shared Agentic rollout source packet, Portfolio Agent Ops proof, and public-safe communications plan.',
    },
    source_insight_title: input.insightTitle,
    source_use_boundary:
      'Thumbnail concepts are generated for human review only. Public creator and source patterns are structure only, not artwork to copy.',
    fields: {
      source_thumbnail_reference: 'Use approved public creator research patterns and owned Portfolio proof screenshots as structure only.',
      pattern_explanation:
        'Short accountability promise, one visible operating-system proof cue, and no exaggerated autonomy claim.',
      amadutown_adaptation_direction:
        'Use AmaduTown navy/gold/white styling, Agent Ops proof screens, and Vambah as the practitioner explaining the operating layer.',
      short_thumbnail_text: input.thumbnailText,
      face_photo_avatar_choice: 'Vambah face/photo, HeyGen avatar still, or clean Agent Ops proof-screen frame.',
      brand_colors_style: 'AmaduTown navy, radiant gold, white, restrained proof-console accents.',
      variants: [
        `${input.thumbnailText} over an Agent Ops approval-gate screenshot.`,
        `Vambah beside a visible source packet and review path with ${input.phase.toUpperCase()} phase label.`,
        `Minimal AmaduTown shield plus one proof-screen receipt and a short agent accountability line.`,
      ],
      approval_state: 'in_review',
    },
    source_research_patterns: [],
    side_effects: {
      provider_generation: false,
      upload: false,
      publish: false,
      schedule: false,
      external_post: false,
    },
  }
}

function agenticBookRolloutInsightMetadata(input: {
  packetId: string
  phase: typeof AGENTIC_BOOK_ROLLOUT_PHASES[number]
  generatedAt: string
}) {
  const approvedResearchPattern = {
    packet_id: input.packetId,
    source_url: 'local:docs/agentic-value-communications-plan.md',
    platform: 'other',
    creator_name: 'AmaduTown',
    title: 'Agentic book rollout communications plan',
    outlier_score: 0,
    pattern_status: 'usable_framework',
    pattern_packet: {
      hook_structure:
        'Open with the agent accountability tension, then show the operating layer that makes agent work reviewable.',
      promise_value:
        'Help operators understand agentic AI as governed work, not model novelty.',
      thumbnail_pattern:
        'Pair a short accountability line with visible proof from the review, source, or approval surface.',
      source_use_boundary:
        'Use owned Portfolio proof, public-safe research summaries, and approved review packets only. Do not expose raw private chats, Chronicle notes, client material, credentials, or hidden admin data.',
    },
  }
  const insight = {
    title: input.phase.insightTitle,
    triggering_event: input.phase.triggeringEvent,
    source_type: 'portfolio_work',
    source_label: 'Agentic book rollout campaign',
    source_ids: [
      AGENTIC_BOOK_ROLLOUT_CAMPAIGN_FIXTURE_KEY,
      'docs/agentic-value-communications-plan.md',
      'docs/agentic-content-research-briefs/phase-2-research-dossier.md',
    ],
    why_vambah_can_speak:
      'Vambah is building the Portfolio Agent Ops operating layer directly: named agents, work items, approvals, source packets, challenger review, cost checks, and platform submission gates.',
    brand_goal:
      'Position the Agentic book rollout as a practical field guide for governed AI operations and responsible agent adoption.',
    content_angle: input.phase.contentAngle,
    suggested_hook: input.phase.suggestedHook,
    audience:
      'Product leaders, founders, operators, advisors, and teams trying to move from agent demos to governed execution.',
    sensitivity: 'public_safe',
    evidence_summary:
      'Evidence comes from the Agentic communications plan, research dossier, Portfolio Agent Ops workflow, review packets, content calendar, and gated multi-channel platform submission path.',
    claim_boundaries: [
      'Do not imply the Agentic book is publicly launched or available for purchase unless a separate launch gate approves it.',
      'Do not imply autonomous publishing, rendering, uploads, scheduling, or provider generation is active from this campaign seed.',
      'Use Portfolio proof surfaces only after privacy review; redact private admin, Chronicle, meeting, client, account, and credential detail.',
      'Treat public creator or outlier research as reusable structure only, not copy.',
    ],
    approved_research_patterns: [approvedResearchPattern],
  }
  const drafts = buildLinkedInYoutubeReviewDrafts({ insight, generatedAt: input.generatedAt })

  drafts.linkedin.fields = {
    ...drafts.linkedin.fields,
    cta: input.phase.linkedinCta,
    cta_url: 'https://amadutown.com',
    visual_mode: input.phase.phase === 'proof'
      ? 'app_screenshot_carousel'
      : 'framework_illustration_or_carousel_review',
    screenshot_routes: [
      '/admin/agents/content-intelligence',
      '/admin/content/video-generation',
      '/admin/social-content',
      '/admin/agents/runs',
    ],
  }
  drafts.youtube_shorts.fields = {
    ...drafts.youtube_shorts.fields,
    target_duration_seconds: 45,
    caption: `${input.phase.contentAngle} Built for the Agentic book rollout campaign.`,
    b_roll_hints: [
      'Agent Ops review queue',
      'Content Intelligence campaign calendar',
      'Video Generation script review workspace',
      'Social Content platform submission path',
      'Agentic source packet or research dossier',
    ],
    on_screen_text: [
      input.phase.thumbnailText,
      'Receipts before authority.',
      'Approval before action.',
    ],
  }
  drafts.instagram_reels.fields = {
    ...drafts.instagram_reels.fields,
    caption: `${input.phase.contentAngle} Built for the Agentic book rollout campaign.`,
    b_roll_assets: [
      'Agent Ops review queue',
      'Content Intelligence campaign calendar',
      'Video Generation script review workspace',
      'Social Content platform submission path',
      'Agentic source packet or research dossier',
    ],
    safe_area_notes: [
      'Keep captions and CTA clear of top and bottom app chrome.',
      'Frame Portfolio proof screens in the vertical center.',
      'Redact private admin, client, Chronicle, account, or meeting-derived detail before export.',
    ],
  }
  drafts.tiktok.fields = {
    ...drafts.tiktok.fields,
    caption: `${input.phase.suggestedHook} Built for the Agentic book rollout campaign.`,
    b_roll_assets: [
      'Agent Ops review queue',
      'Content Intelligence campaign calendar',
      'Video Generation script review workspace',
      'Social Content platform submission path',
      'Agentic source packet or research dossier',
    ],
    audio_rights: 'Use original narration, approved provider voiceover, or platform-safe audio only.',
  }

  return {
    social_topic_trigger: true,
    insight_version: 'agentic_book_rollout_campaign_v1',
    demo_seed_key: AGENTIC_BOOK_ROLLOUT_CAMPAIGN_FIXTURE_KEY,
    fixture_version: 1,
    fixture_purpose: 'agentic_book_rollout_whisper_to_shout_review_ready_campaign',
    campaign_target: 'Agentic book rollout',
    campaign_window_days: 14,
    campaign_template_key: 'whisper_to_shout',
    campaign_language: 'Tease/Wispr/Shout overlay; stored phases remain tease/teach/proof/offer.',
    conversion_path: 'Agentic rollout interest, then Agent Ops advisory, AI Quick Win, or discovery call.',
    research_packet_ids: [input.packetId],
    suggested_research_packet_ids: [input.packetId],
    channel_lanes: {
      linkedin: {
        status: 'in_review',
        label: 'LinkedIn',
        decision_note: null,
        draft_packet: drafts.linkedin,
        review_requested_at: input.generatedAt,
        updated_at: input.generatedAt,
        required_inputs: ['post text', 'CTA', 'CTA URL', 'hashtags', 'references'],
      },
      youtube_shorts: {
        status: 'in_review',
        label: 'YouTube Shorts',
        decision_note: null,
        draft_packet: drafts.youtube_shorts,
        review_requested_at: input.generatedAt,
        updated_at: input.generatedAt,
        required_inputs: ['hook', 'first 30 seconds', 'script', 'storyboard scenes', 'b-roll hints'],
      },
      instagram_reels: {
        status: 'in_review',
        label: 'Instagram Reels',
        decision_note: null,
        draft_packet: drafts.instagram_reels,
        review_requested_at: input.generatedAt,
        updated_at: input.generatedAt,
        required_inputs: ['hook', 'script', 'caption', 'safe-area notes'],
      },
      tiktok: {
        status: 'in_review',
        label: 'TikTok',
        decision_note: null,
        draft_packet: drafts.tiktok,
        review_requested_at: input.generatedAt,
        updated_at: input.generatedAt,
        required_inputs: ['hook', 'script', 'caption', 'audio rights', 'safe-area notes'],
      },
      thumbnail: {
        status: 'in_review',
        label: 'Thumbnail',
        decision_note: null,
        draft_packet: agenticBookRolloutThumbnailPacket({
          phase: input.phase.phase,
          generatedAt: input.generatedAt,
          insightTitle: input.phase.insightTitle,
          contentAngle: input.phase.contentAngle,
          thumbnailText: input.phase.thumbnailText,
        }),
        review_requested_at: input.generatedAt,
        updated_at: input.generatedAt,
        required_inputs: ['pattern explanation', 'short thumbnail text', '2-3 variants'],
      },
    },
    insight,
    side_effects: {
      provider_generation: false,
      upload: false,
      publish: false,
      schedule: false,
      external_post: false,
    },
  }
}

export async function runDemoSeed(
  key: DemoSeedKey,
  supabase: SupabaseClient
): Promise<{ ok: true; key: DemoSeedKey; detail: string } | { ok: false; error: string }> {
  try {
    switch (key) {
      case 'sarah_mitchell_lead': {
        await removeSarahMitchellChain(supabase)

        const { error: e1 } = await supabase.from('chat_sessions').insert({
          session_id: SARAH_SESSION,
          visitor_email: SARAH_EMAIL,
          visitor_name: 'Sarah Mitchell',
        })
        if (e1) return { ok: false, error: `chat_sessions: ${e1.message}` }

        const { data: contactRow, error: e2 } = await supabase
          .from('contact_submissions')
          .insert({
            name: 'Sarah Mitchell',
            email: SARAH_EMAIL,
            message:
              'I am looking for help automating our sales pipeline and improving our AI capabilities. We currently use HubSpot for CRM and are interested in integrating AI-powered lead scoring and automated follow-ups.',
            company: 'TechFlow Solutions',
            company_domain: 'techflow.io',
            linkedin_url: 'https://linkedin.com/in/sarahmitchell',
            annual_revenue: '$1M-$5M',
            interest_areas: ['ai_automation', 'sales_pipeline', 'workflow_optimization'],
            interest_summary: 'AI Automation, Sales Pipeline, Workflow Optimization',
            is_decision_maker: true,
            lead_score: 85,
            qualification_status: 'qualified',
            ai_readiness_score: 7,
            lead_source: 'website_form',
          })
          .select('id')
          .single()

        if (e2 || !contactRow) return { ok: false, error: `contact_submissions: ${e2?.message ?? 'no row'}` }

        const contactId = contactRow.id as number
        const now = new Date()
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
        const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)

        const { error: e3 } = await supabase.from('diagnostic_audits').insert({
          audit_type: 'chat',
          session_id: SARAH_SESSION,
          contact_submission_id: contactId,
          status: 'completed',
          business_challenges: BUSINESS_CHALLENGES,
          tech_stack: TECH_STACK,
          automation_needs: AUTOMATION_NEEDS,
          ai_readiness: AI_READINESS,
          budget_timeline: BUDGET_TIMELINE,
          decision_making: DECISION_MAKING,
          diagnostic_summary:
            'Sarah from TechFlow Solutions is a highly qualified lead looking to automate their sales pipeline. They have a clear pain point (slow lead response times costing ~$200K), a compatible tech stack (HubSpot + Google), and budget authority. The urgency is high as they want to implement within 30 days.',
          key_insights: [
            'High urgency: Currently losing deals due to slow response times',
            'Strong tech foundation: HubSpot CRM with clean data',
            'Budget approved: $5K-$15K range with flexibility',
            'Decision maker: Can approve within 2 weeks',
            'AI-ready: Team is excited, some ChatGPT experience',
          ],
          recommended_actions: [
            'Schedule demo of AI-powered lead scoring solution',
            'Show ROI calculator based on their $200K lost revenue estimate',
            'Propose HubSpot integration that can go live in 2 weeks',
            'Address data privacy concerns with security documentation',
            'Offer pilot program to reduce perceived risk',
          ],
          urgency_score: 8,
          opportunity_score: 9,
          sales_notes:
            'Hot lead - Sarah is the decision maker with approved budget. Follow up within 24 hours. She mentioned competing with a similar solution from a competitor.',
          started_at: twoDaysAgo.toISOString(),
          completed_at: oneDayAgo.toISOString(),
        })
        if (e3) return { ok: false, error: `diagnostic_audits: ${e3.message}` }

        return { ok: true, key, detail: `Sarah Mitchell lead + diagnostic (contact id ${contactId})` }
      }

      case 'paid_proposal_jordan': {
        const jordanEmail = 'jordan@acmecorp.com'
        const bundleName = 'AI Chatbot Solution - Full Package'
        await supabase.from('proposals').delete().eq('client_email', jordanEmail).eq('bundle_name', bundleName)

        const validUntil = new Date()
        validUntil.setDate(validUntil.getDate() + 30)

        const { error } = await supabase.from('proposals').insert({
          client_name: 'Jordan Rivera',
          client_email: jordanEmail,
          client_company: 'Acme Corporation',
          bundle_name: bundleName,
          line_items: PROPOSAL_LINE_ITEMS,
          subtotal: 5000.0,
          total_amount: 5000.0,
          status: 'paid',
          paid_at: new Date().toISOString(),
          terms_text: 'Standard terms apply. 12-month warranty included.',
          valid_until: validUntil.toISOString(),
        })
        if (error) return { ok: false, error: `proposals: ${error.message}` }
        return { ok: true, key, detail: 'Paid proposal for Jordan Rivera' }
      }

      case 'lead_qualification_99999': {
        const { error } = await supabase.from('contact_submissions').upsert(
          {
            id: 99999,
            name: 'Test User',
            email: 'test-lead-qual-99999@example.com',
            company: 'Test Co',
            company_domain: 'test.com',
            linkedin_url: 'https://linkedin.com/in/test',
            annual_revenue: '100k_500k',
            interest_summary: 'AI adoption, process automation, lead qualification',
            message: 'Interested in exploring AI automation for our sales team.',
            is_decision_maker: true,
            lead_source: 'website_form',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        if (error) return { ok: false, error: `contact_submissions upsert: ${error.message}` }
        return { ok: true, key, detail: 'contact_submissions id=99999' }
      }

      case 'onboarding_test_project': {
        const email = 'test-onboarding@example.com'
        await supabase.from('client_projects').delete().eq('client_email', email)

        const { error } = await supabase.from('client_projects').insert({
          client_name: 'Test Onboarding Caller',
          client_email: email,
          project_status: 'active',
          project_name: 'Test Onboarding Project',
          project_start_date: addDaysISO(7),
          estimated_end_date: addDaysISO(90),
        })
        if (error) return { ok: false, error: `client_projects: ${error.message}` }
        return { ok: true, key, detail: 'Onboarding test client project' }
      }

      case 'kickoff_test_project': {
        const email = 'test-kickoff@example.com'
        await supabase.from('client_projects').delete().eq('client_email', email)

        const { error } = await supabase.from('client_projects').insert({
          client_name: 'Test Kickoff Caller',
          client_email: email,
          project_status: 'onboarding_completed',
          project_name: 'Test Kickoff Project',
          project_start_date: addDaysISO(7),
          estimated_end_date: addDaysISO(90),
        })
        if (error) return { ok: false, error: `client_projects: ${error.message}` }
        return { ok: true, key, detail: 'Kickoff test client project' }
      }

      case 'discovery_call_test_contact': {
        const email = 'test-discovery@example.com'
        await supabase.from('contact_submissions').delete().eq('email', email)

        const { error } = await supabase.from('contact_submissions').insert({
          name: 'Test Discovery Caller',
          email,
          company: 'Test Co',
          lead_source: 'website_form',
        })
        if (error) return { ok: false, error: `contact_submissions: ${error.message}` }
        return { ok: true, key, detail: 'test-discovery@example.com' }
      }

      case 'social_content_calendar_fixture': {
        await removeSocialContentCalendarFixture(supabase)

        const startsAt = addDaysAtHourISO(1, 9)
        const endsAt = addDaysAtHourISO(21, 17)

        const { data: campaign, error: campaignError } = await supabase
          .from('attraction_campaigns')
          .insert({
            name: 'Demo Content Calendar Smoke Campaign',
            slug: SOCIAL_CONTENT_CALENDAR_FIXTURE_SLUG,
            description:
              'Dev-safe campaign fixture for Content Intelligence calendar smoke tests.',
            campaign_type: 'free_challenge',
            status: 'draft',
            starts_at: startsAt,
            ends_at: endsAt,
            completion_window_days: 30,
            min_purchase_amount: 0,
            payout_type: 'credit',
            payout_amount_type: 'fixed',
            payout_amount_value: 0,
            rollover_bonus_multiplier: 1,
            promo_copy:
              'Seeded only for local/admin calendar review. No external execution is enabled.',
          })
          .select('id, name, slug, starts_at, ends_at')
          .single()

        if (campaignError || !campaign) {
          return {
            ok: false,
            error: `attraction_campaigns: ${campaignError?.message ?? 'no row'}`,
          }
        }

        const slots = campaignContentPlanSlots({
          name: String(campaign.name),
          starts_at: String(campaign.starts_at),
          ends_at: String(campaign.ends_at),
        })

        const channels = ['linkedin', 'youtube_shorts', 'instagram_reels', 'tiktok'] as const
        const rows = slots.map((slot, index) => ({
          ...slot,
          campaign_id: campaign.id,
          channel: channels[index],
          title: `${slot.title} (${channels[index].replace(/_/g, ' ')})`,
          authorization_status: index === 2 ? 'rejected' : slot.authorization_status,
          metadata: {
            ...slot.metadata,
            demo_seed_key: SOCIAL_CONTENT_CALENDAR_FIXTURE_KEY,
            fixture_version: 1,
            fixture_purpose: 'content_intelligence_calendar_smoke',
            external_execution_enabled: false,
            provider_generation_enabled: false,
            publish_enabled: false,
            decision_note: index === 2
              ? 'Demo rejected item for the calendar revision path.'
              : null,
          },
        }))

        const { error: calendarError } = await supabase
          .from('social_content_calendar_items')
          .insert(rows)

        if (calendarError) {
          return { ok: false, error: `social_content_calendar_items: ${calendarError.message}` }
        }

        return {
          ok: true,
          key,
          detail: `Content calendar fixture campaign ${campaign.id} with ${rows.length} items`,
        }
      }

      case 'social_channel_review_fixture': {
        await removeSocialChannelReviewFixture(supabase)

        const retrievedAt = new Date().toISOString()
        const { data: packet, error: packetError } = await supabase
          .from('social_content_research_packets')
          .insert({
            source_url: 'https://youtube.com/watch?v=demo-social-review',
            platform: 'youtube',
            creator_name: 'Public Creator Demo',
            creator_handle: '@publiccreatordemo',
            title: 'Demo research pattern for accountable AI content',
            caption:
              'Public demo packet for Content Intelligence smoke testing. Use the pattern only.',
            thumbnail_url: 'https://example.com/demo-social-review-thumbnail.jpg',
            hook_transcript:
              'The first thirty seconds frame the tension: AI content only works when the proof and approval path are visible.',
            metrics: {
              views: 128000,
              likes: 8600,
              comments: 940,
              shares: 520,
              follower_count: 22000,
              retrieved_at: retrievedAt,
            },
            actor_metadata: {
              provider: 'free_recorded_evidence',
              retrieval_method: 'demo_seed',
              demo_seed_key: SOCIAL_CHANNEL_REVIEW_FIXTURE_KEY,
              cost_usd: 0,
              external_execution_enabled: false,
            },
            outlier_score: 87,
            score_breakdown: {
              view_to_follower_ratio: 5.82,
              engagement_rate: 0.0785,
              comment_density: 0.0073,
              small_creator_outlier_boost: 15,
              strategic_fit: 80,
            },
            pattern_packet: {
              hook_structure: 'Open with the missed approval gate before explaining the system.',
              tension_or_missed_opportunity:
                'AI output creates risk when evidence and authority are hidden.',
              promise_value:
                'Show how visible review gates turn AI content into accountable work.',
              proof_style: 'Use product-screen proof and decision history, not generic claims.',
              title_pattern: 'Why [system] needs [visible proof] before [public action]',
              thumbnail_pattern:
                'High-contrast proof frame with a clear approval/status artifact; translate into AmaduTown style.',
              pacing_visual_framing:
                'Start face-to-camera, cut to the dashboard proof, close on the principle.',
              cta_style: 'Ask where automation added work because the gate was missing.',
              source_use_boundary:
                'Use reusable frameworks only; do not copy creator scripts, titles, thumbnails, or visual identity.',
            },
            pattern_status: 'needs_brand_translation',
            status: 'review_ready',
            privacy_notes:
              'Public demo research packet. No private meetings, Chronicle notes, client records, uploads, schedules, or publishes.',
            retrieved_at: retrievedAt,
          })
          .select('id')
          .single()

        if (packetError || !packet) {
          return {
            ok: false,
            error: `social_content_research_packets: ${packetError?.message ?? 'no row'}`,
          }
        }

        const { data: workItem, error: workItemError } = await supabase
          .from('agent_work_items')
          .insert({
            title: 'Demo: turn a Shaka insight into multi-channel review drafts',
            objective:
              'Link the demo public research pattern, prepare LinkedIn, YouTube Shorts, Instagram Reels, and TikTok drafts from the same Shaka insight, then approve or reject each channel lane.',
            status: 'proposed',
            priority: 'high',
            owner_agent_key: 'chief-of-staff',
            owner_runtime: 'manual',
            source_type: 'social_topic_trigger',
            source_id: SOCIAL_CHANNEL_REVIEW_FIXTURE_KEY,
            source_label: 'Demo Content Intelligence channel review fixture',
            expected_files: [],
            touched_files: [],
            overlap_group: 'social-content-intelligence',
            dependency_ids: [],
            idempotency_key: SOCIAL_CHANNEL_REVIEW_FIXTURE_IDEMPOTENCY_KEY,
            metadata: {
              social_topic_trigger: true,
              demo_seed_key: SOCIAL_CHANNEL_REVIEW_FIXTURE_KEY,
              fixture_version: 1,
              fixture_purpose: 'content_intelligence_social_channel_review_smoke',
              research_packet_ids: [],
              suggested_research_packet_ids: [packet.id],
              insight: {
                title: 'Approval gates turn AI content into accountable work',
                triggering_event:
                  'A Portfolio review flow showed that AI-generated social content needs visible proof before public handoff.',
                why_vambah_can_speak:
                  'Vambah is building the operating layer directly and can show the difference between AI output and governed work.',
                evidence_summary:
                  'The Content Intelligence backlog, research packet, channel lanes, and human approval controls all stay inside Portfolio before any external action.',
                brand_goal:
                  'Show AmaduTown as the practical operating layer for governed AI content production.',
                audience: 'Operators, founders, and product leaders adopting agentic AI workflows.',
                content_angle:
                  'AI should reduce burden, but only when the evidence, owner, and approval gate are visible before the output reaches the public.',
                suggested_hook:
                  'AI content does not earn trust because it sounds polished. It earns trust when the handoff is visible.',
                claim_boundaries: [
                  'Do not imply publishing is automated.',
                  'Do not claim provider generation, upload, or scheduling has been approved.',
                  'Use the public research packet as a framework only.',
                ],
                approved_research_patterns: [],
              },
              channel_lanes: {
                linkedin: {
                  status: 'selected',
                  label: 'LinkedIn',
                  decision_note: null,
                  draft_packet: null,
                  required_inputs: ['post text', 'CTA', 'CTA URL', 'hashtags', 'references'],
                },
                youtube_shorts: {
                  status: 'not_started',
                  label: 'YouTube Shorts',
                  decision_note: null,
                  draft_packet: null,
                  required_inputs: ['hook', 'first 30 seconds', 'script', 'storyboard scenes', 'b-roll hints'],
                },
                instagram_reels: {
                  status: 'not_started',
                  label: 'Instagram Reels',
                  decision_note: null,
                  draft_packet: null,
                  required_inputs: ['hook', 'script', 'caption', 'safe-area notes'],
                },
                tiktok: {
                  status: 'not_started',
                  label: 'TikTok',
                  decision_note: null,
                  draft_packet: null,
                  required_inputs: ['hook', 'script', 'caption', 'audio rights', 'safe-area notes'],
                },
                thumbnail: {
                  status: 'not_started',
                  label: 'Thumbnail',
                  decision_note: null,
                  draft_packet: null,
                  required_inputs: ['pattern explanation', 'short thumbnail text', '2-3 variants'],
                },
              },
              side_effects: {
                provider_generation: false,
                upload: false,
                publish: false,
                schedule: false,
                external_post: false,
              },
            },
          })
          .select('id')
          .single()

        if (workItemError || !workItem) {
          return {
            ok: false,
            error: `agent_work_items: ${workItemError?.message ?? 'no row'}`,
          }
        }

        return {
          ok: true,
          key,
          detail: `Social channel review fixture work item ${workItem.id} with research packet ${packet.id}`,
        }
      }

      case 'accelerated_workshop_campaign_fixture': {
        await removeAcceleratedWorkshopCampaignFixture(supabase)

        const generatedAt = new Date().toISOString()
        const startsAt = addDaysAtHourISO(1, 9)
        const endsAt = addDaysAtHourISO(14, 17)

        const { data: campaign, error: campaignError } = await supabase
          .from('attraction_campaigns')
          .insert({
            name: 'Accelerated Workshop Whisper-to-Shout Campaign',
            slug: ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_SLUG,
            description:
              'A 14-day review-ready launch campaign for the Accelerated Workshop, using AmaduTown proof surfaces and Agent Ops human approval gates.',
            campaign_type: 'free_challenge',
            status: 'draft',
            starts_at: startsAt,
            ends_at: endsAt,
            completion_window_days: 14,
            min_purchase_amount: 0,
            payout_type: 'credit',
            payout_amount_type: 'fixed',
            payout_amount_value: 0,
            rollover_bonus_multiplier: 1,
            promo_copy:
              'Move from AI experimentation to governed product work. Join the Accelerated Workshop interest path or book a discovery call.',
          })
          .select('id, name, slug, starts_at, ends_at')
          .single()

        if (campaignError || !campaign) {
          return {
            ok: false,
            error: `attraction_campaigns: ${campaignError?.message ?? 'no row'}`,
          }
        }

        const { data: packet, error: packetError } = await supabase
          .from('social_content_research_packets')
          .insert({
            source_url: 'https://amadutown.com/ebook/accelerated',
            platform: 'other',
            creator_name: 'AmaduTown',
            creator_handle: '@amadutown',
            title: 'Accelerated Workshop proof campaign research packet',
            caption:
              'Public-safe campaign evidence packet for the Accelerated Workshop. It uses AmaduTown-owned positioning and Portfolio Agent Ops proof surfaces.',
            thumbnail_url: null,
            hook_transcript:
              'AI can create faster than most teams can govern. The Accelerated Workshop teaches the operating loop behind reviewable AI-assisted product work.',
            metrics: {
              views: null,
              likes: null,
              comments: null,
              shares: null,
              follower_count: null,
              retrieved_at: generatedAt,
            },
            actor_metadata: {
              provider: 'free_recorded_evidence',
              retrieval_method: 'demo_seed',
              demo_seed_key: ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_KEY,
              cost_usd: 0,
              external_execution_enabled: false,
              source_policy: 'public_safe_owned_positioning',
            },
            outlier_score: 0,
            score_breakdown: {
              strategic_fit: 1,
              source_type: 'owned_campaign_evidence',
            },
            pattern_packet: {
              hook_structure:
                'Open with the speed-versus-governance tension, then point to a concrete operating layer.',
              tension_or_missed_opportunity:
                'Teams are adopting AI faster than they are designing evidence, ownership, and approval paths.',
              promise_value:
                'The Accelerated Workshop helps teams turn AI-assisted work into reviewable product execution.',
              proof_style:
                'Use AmaduTown-owned proof surfaces: the Accelerated book path, Portfolio Agent Ops, Content Intelligence, and explicit human approval gates.',
              title_pattern: 'From AI output to governed product work',
              thumbnail_pattern:
                'Short tension text plus a visible proof-screen receipt from Portfolio or the Accelerated page.',
              pacing_visual_framing:
                'Start with the tension, show the operating loop, cut to the proof surface, close with the workshop invitation.',
              cta_style:
                'Invite operators to join the Accelerated Workshop interest path or book a discovery call.',
              source_use_boundary:
                'Use AmaduTown-owned proof and public-safe positioning only. Do not expose private meetings, Chronicle notes, client records, or raw AI chats.',
            },
            pattern_status: 'usable_framework',
            status: 'review_ready',
            privacy_notes:
              'Owned public-safe campaign packet. No provider calls, uploads, publishing, schedules, private meeting excerpts, Chronicle notes, client records, or raw AI chat exports.',
            retrieved_at: generatedAt,
          })
          .select('id')
          .single()

        if (packetError || !packet) {
          return {
            ok: false,
            error: `social_content_research_packets: ${packetError?.message ?? 'no row'}`,
          }
        }

        const { data: campaignGoal, error: campaignGoalError } = await supabase
          .from('agent_work_items')
          .insert({
            title: 'Launch Accelerated Workshop proof campaign',
            objective:
              'Turn the Accelerated book and workshop idea into a complete 14-day whisper_to_shout campaign with shared research, campaign calendar items, and human-review-ready LinkedIn, YouTube Shorts, and Thumbnail drafts.',
            status: 'proposed',
            priority: 'high',
            owner_agent_key: 'chief-of-staff',
            owner_runtime: 'manual',
            source_type: 'campaign_goal',
            source_id: ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_KEY,
            source_label: 'Accelerated Workshop whisper_to_shout campaign goal',
            expected_files: [],
            touched_files: [],
            overlap_group: 'social-content-intelligence',
            dependency_ids: [],
            idempotency_key: `${ACCELERATED_WORKSHOP_CAMPAIGN_IDEMPOTENCY_PREFIX}:goal`,
            metadata: {
              social_campaign_goal: true,
              demo_seed_key: ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_KEY,
              campaign_id: campaign.id,
              campaign_target: 'Accelerated Workshop',
              campaign_template_key: 'whisper_to_shout',
              campaign_window_days: 14,
              conversion_path: 'Accelerated Workshop interest, then AI Quick Win or discovery call.',
              phase_work_item_count: ACCELERATED_WORKSHOP_PHASES.length,
              side_effects: {
                provider_generation: false,
                upload: false,
                publish: false,
                schedule: false,
                external_post: false,
              },
            },
          })
          .select('id')
          .single()

        if (campaignGoalError || !campaignGoal) {
          return {
            ok: false,
            error: `agent_work_items goal: ${campaignGoalError?.message ?? 'no row'}`,
          }
        }

        const workItemRows = ACCELERATED_WORKSHOP_PHASES.map((phase) => ({
          title: `Accelerated Workshop ${phase.titlePrefix}: ${phase.insightTitle}`,
          objective:
            'Prepare human-review-ready LinkedIn, YouTube Shorts, and Thumbnail draft packets for one phase of the 14-day Accelerated Workshop whisper_to_shout launch campaign.',
          status: 'proposed',
          priority: 'high',
          owner_agent_key: 'chief-of-staff',
          owner_runtime: 'manual',
          source_type: 'social_topic_trigger',
          source_id: `${ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_KEY}:${phase.phase}`,
          source_label: 'Accelerated Workshop whisper_to_shout campaign',
          parent_work_item_id: campaignGoal.id,
          expected_files: [],
          touched_files: [],
          overlap_group: 'social-content-intelligence',
          dependency_ids: [campaignGoal.id],
          idempotency_key: `${ACCELERATED_WORKSHOP_CAMPAIGN_IDEMPOTENCY_PREFIX}:${phase.phase}`,
          metadata: acceleratedWorkshopInsightMetadata({
            packetId: String(packet.id),
            phase,
            generatedAt,
          }),
        }))

        const { data: workItems, error: workItemError } = await supabase
          .from('agent_work_items')
          .insert(workItemRows)
          .select('id, metadata')

        if (workItemError || !workItems || workItems.length !== ACCELERATED_WORKSHOP_PHASES.length) {
          return {
            ok: false,
            error: `agent_work_items: ${workItemError?.message ?? 'unexpected row count'}`,
          }
        }

        const slots = campaignContentPlanSlots({
          name: String(campaign.name),
          starts_at: String(campaign.starts_at),
          ends_at: String(campaign.ends_at),
        }, { templateKey: 'whisper_to_shout' })

        const calendarRows = slots.flatMap((slot, index) => {
          const phase = ACCELERATED_WORKSHOP_PHASES[index]
          const workItem = workItems[index]
          const scheduledFor = addDaysAtHourISO(phase.day, phase.phase === 'offer' ? 11 : 10)
          const commonMetadata = {
            ...slot.metadata,
            demo_seed_key: ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_KEY,
            fixture_version: 1,
            campaign_target: 'Accelerated Workshop',
            campaign_template_key: 'whisper_to_shout',
            campaign_window_days: 14,
            campaign_language: 'Tease/Wispr/Shout overlay; stored phase remains canonical.',
            linked_work_item_id: workItem.id,
            linked_research_packet_id: packet.id,
            conversion_path: 'Accelerated Workshop interest, then AI Quick Win or discovery call.',
            external_execution_enabled: false,
            provider_generation_enabled: false,
            upload_enabled: false,
            publish_enabled: false,
            schedule_enabled: false,
          }
          const primaryRow = {
            ...slot,
            campaign_id: campaign.id,
            agent_work_item_id: workItem.id,
            channel: 'linkedin',
            title: `${phase.titlePrefix}: ${phase.insightTitle}`,
            planned_angle: `${phase.contentAngle} LinkedIn, YouTube Shorts, Instagram Reels, TikTok, and Thumbnail drafts are ready for human approval.`,
            scheduled_for: scheduledFor,
            authorization_due_at: addDaysAtHourISO(Math.max(0, phase.day - 1), 10),
            authorization_status: 'pending',
            metadata: {
              ...commonMetadata,
              calendar_item_role: 'primary_phase_item',
              channel_draft_targets: ['linkedin', 'youtube_shorts', 'instagram_reels', 'tiktok', 'thumbnail'],
            },
          }
          const youtubeRow = {
            ...slot,
            campaign_id: campaign.id,
            agent_work_item_id: workItem.id,
            channel: 'youtube_shorts',
            title: `${phase.titlePrefix} Short: ${phase.insightTitle}`,
            planned_angle: `${phase.suggestedHook} Adapt this phase into the review-ready YouTube Shorts lane before any render or upload.`,
            scheduled_for: addDaysAtHourISO(phase.day, phase.phase === 'offer' ? 14 : 13),
            authorization_due_at: addDaysAtHourISO(Math.max(0, phase.day - 1), 10),
            authorization_status: 'pending',
            metadata: {
              ...commonMetadata,
              calendar_item_role: 'companion_channel_item',
              primary_channel: 'linkedin',
              channel_draft_targets: ['youtube_shorts', 'instagram_reels', 'tiktok', 'thumbnail'],
            },
          }
          return [primaryRow, youtubeRow]
        })

        const { error: calendarError } = await supabase
          .from('social_content_calendar_items')
          .insert(calendarRows)

        if (calendarError) {
          return { ok: false, error: `social_content_calendar_items: ${calendarError.message}` }
        }

        return {
          ok: true,
          key,
          detail: `Accelerated Workshop campaign ${campaign.id} with campaign goal ${campaignGoal.id}, ${calendarRows.length} calendar items, ${workItems.length} insight work items, and research packet ${packet.id}`,
        }
      }

      case 'agentic_book_rollout_campaign_fixture': {
        await removeAgenticBookRolloutCampaignFixture(supabase)

        const generatedAt = new Date().toISOString()
        const startsAt = addDaysAtHourISO(1, 9)
        const endsAt = addDaysAtHourISO(14, 17)

        const { data: campaign, error: campaignError } = await supabase
          .from('attraction_campaigns')
          .insert({
            name: 'Agentic Book Rollout Whisper-to-Shout Campaign',
            slug: AGENTIC_BOOK_ROLLOUT_CAMPAIGN_FIXTURE_SLUG,
            description:
              'A 14-day review-ready campaign for the Agentic book rollout, using Portfolio Agent Ops proof, source packets, challenger review, and gated platform submission.',
            campaign_type: 'free_challenge',
            status: 'draft',
            starts_at: startsAt,
            ends_at: endsAt,
            completion_window_days: 14,
            min_purchase_amount: 0,
            payout_type: 'credit',
            payout_amount_type: 'fixed',
            payout_amount_value: 0,
            rollover_bonus_multiplier: 1,
            promo_copy:
              'Follow the Agentic rollout: a practical field guide for governed AI operations, built from the Portfolio Agent Ops system.',
          })
          .select('id, name, slug, starts_at, ends_at')
          .single()

        if (campaignError || !campaign) {
          return {
            ok: false,
            error: `attraction_campaigns: ${campaignError?.message ?? 'no row'}`,
          }
        }

        const { data: packet, error: packetError } = await supabase
          .from('social_content_research_packets')
          .insert({
            source_url: 'local:docs/agentic-value-communications-plan.md',
            platform: 'other',
            creator_name: 'AmaduTown',
            creator_handle: '@amadutown',
            title: 'Agentic book rollout communications packet',
            caption:
              'Public-safe campaign evidence packet for the Agentic book rollout. It reuses the Agentic communications plan, research dossier, review packets, and Portfolio Agent Ops proof surfaces.',
            thumbnail_url: null,
            hook_transcript:
              'Anyone can launch an agent now. The harder question is whether the team can show the source, scope, owner, challenger pass, and human approval before the agent acts.',
            metrics: {
              views: null,
              likes: null,
              comments: null,
              shares: null,
              follower_count: null,
              retrieved_at: generatedAt,
            },
            actor_metadata: {
              provider: 'free_recorded_evidence',
              retrieval_method: 'demo_seed',
              demo_seed_key: AGENTIC_BOOK_ROLLOUT_CAMPAIGN_FIXTURE_KEY,
              cost_usd: 0,
              external_execution_enabled: false,
              source_policy: 'public_safe_owned_positioning',
              source_paths: [
                'docs/agentic-value-communications-plan.md',
                'docs/agentic-content-research-briefs/phase-2-research-dossier.md',
                'docs/agentic-content-review-packets/p0-challenger-review-packets.md',
                'docs/agentic-content-review-packets/p1-challenger-review-packets.md',
              ],
            },
            outlier_score: 0,
            score_breakdown: {
              strategic_fit: 1,
              source_type: 'owned_campaign_evidence',
            },
            pattern_packet: {
              hook_structure:
                'Open with the agent accountability tension, then point to a concrete operating layer.',
              tension_or_missed_opportunity:
                'Teams are excited about agent demos before they can explain source boundaries, review gates, ownership, and authority.',
              promise_value:
                'The Agentic rollout shows how AI agent work becomes safer when the operating path is visible.',
              proof_style:
                'Use owned proof surfaces: Agent Ops approvals, Content Intelligence calendar, Video Generation review workspace, Social Content platform submission gates, and source packets.',
              title_pattern: 'From agent demo to governed operating system',
              thumbnail_pattern:
                'Short accountability text plus a visible proof-screen receipt from Portfolio.',
              pacing_visual_framing:
                'Start with a human risk, show the operating harness, cut to proof screens, close with the rollout invitation.',
              cta_style:
                'Invite people to follow the Agentic rollout or talk through how governed Agent Ops would apply to their own team.',
              source_use_boundary:
                'Use owned proof and public-safe summaries only. Do not expose private meetings, raw Chronicle notes, client records, secrets, or raw AI chat exports.',
            },
            pattern_status: 'usable_framework',
            status: 'review_ready',
            privacy_notes:
              'Owned public-safe campaign packet. No provider calls, uploads, publishing, schedules, private meeting excerpts, Chronicle notes, client records, credentials, or raw AI chat exports.',
            retrieved_at: generatedAt,
          })
          .select('id')
          .single()

        if (packetError || !packet) {
          return {
            ok: false,
            error: `social_content_research_packets: ${packetError?.message ?? 'no row'}`,
          }
        }

        const { data: campaignGoal, error: campaignGoalError } = await supabase
          .from('agent_work_items')
          .insert({
            title: 'Launch Agentic book rollout campaign',
            objective:
              'Turn the Agentic book rollout into a complete 14-day whisper_to_shout campaign with shared source evidence, campaign calendar items, and human-review-ready LinkedIn, YouTube Shorts, Instagram Reels, TikTok, and Thumbnail draft packets.',
            status: 'proposed',
            priority: 'high',
            owner_agent_key: 'chief-of-staff',
            owner_runtime: 'manual',
            source_type: 'campaign_goal',
            source_id: AGENTIC_BOOK_ROLLOUT_CAMPAIGN_FIXTURE_KEY,
            source_label: 'Agentic book rollout whisper_to_shout campaign goal',
            expected_files: [],
            touched_files: [],
            overlap_group: 'social-content-intelligence',
            dependency_ids: [],
            idempotency_key: `${AGENTIC_BOOK_ROLLOUT_CAMPAIGN_IDEMPOTENCY_PREFIX}:goal`,
            metadata: {
              social_campaign_goal: true,
              demo_seed_key: AGENTIC_BOOK_ROLLOUT_CAMPAIGN_FIXTURE_KEY,
              campaign_id: campaign.id,
              campaign_target: 'Agentic book rollout',
              campaign_template_key: 'whisper_to_shout',
              campaign_window_days: 14,
              conversion_path: 'Agentic rollout interest, then Agent Ops advisory, AI Quick Win, or discovery call.',
              phase_work_item_count: AGENTIC_BOOK_ROLLOUT_PHASES.length,
              source_paths: [
                'docs/agentic-value-communications-plan.md',
                'docs/agentic-content-research-briefs/phase-2-research-dossier.md',
              ],
              side_effects: {
                provider_generation: false,
                upload: false,
                publish: false,
                schedule: false,
                external_post: false,
              },
            },
          })
          .select('id')
          .single()

        if (campaignGoalError || !campaignGoal) {
          return {
            ok: false,
            error: `agent_work_items goal: ${campaignGoalError?.message ?? 'no row'}`,
          }
        }

        const workItemRows = AGENTIC_BOOK_ROLLOUT_PHASES.map((phase) => ({
          title: `Agentic Rollout ${phase.titlePrefix}: ${phase.insightTitle}`,
          objective:
            'Prepare human-review-ready LinkedIn, YouTube Shorts, Instagram Reels, TikTok, and Thumbnail draft packets for one phase of the 14-day Agentic book rollout whisper_to_shout campaign.',
          status: 'proposed',
          priority: 'high',
          owner_agent_key: 'chief-of-staff',
          owner_runtime: 'manual',
          source_type: 'social_topic_trigger',
          source_id: `${AGENTIC_BOOK_ROLLOUT_CAMPAIGN_FIXTURE_KEY}:${phase.phase}`,
          source_label: 'Agentic book rollout whisper_to_shout campaign',
          parent_work_item_id: campaignGoal.id,
          expected_files: [],
          touched_files: [],
          overlap_group: 'social-content-intelligence',
          dependency_ids: [campaignGoal.id],
          idempotency_key: `${AGENTIC_BOOK_ROLLOUT_CAMPAIGN_IDEMPOTENCY_PREFIX}:${phase.phase}`,
          metadata: agenticBookRolloutInsightMetadata({
            packetId: String(packet.id),
            phase,
            generatedAt,
          }),
        }))

        const { data: workItems, error: workItemError } = await supabase
          .from('agent_work_items')
          .insert(workItemRows)
          .select('id, metadata')

        if (workItemError || !workItems || workItems.length !== AGENTIC_BOOK_ROLLOUT_PHASES.length) {
          return {
            ok: false,
            error: `agent_work_items: ${workItemError?.message ?? 'unexpected row count'}`,
          }
        }

        const slots = campaignContentPlanSlots({
          name: String(campaign.name),
          starts_at: String(campaign.starts_at),
          ends_at: String(campaign.ends_at),
        }, { templateKey: 'whisper_to_shout' })

        const calendarRows = slots.flatMap((slot, index) => {
          const phase = AGENTIC_BOOK_ROLLOUT_PHASES[index]
          const workItem = workItems[index]
          const scheduledFor = addDaysAtHourISO(phase.day, phase.phase === 'offer' ? 11 : 10)
          const commonMetadata = {
            ...slot.metadata,
            demo_seed_key: AGENTIC_BOOK_ROLLOUT_CAMPAIGN_FIXTURE_KEY,
            fixture_version: 1,
            campaign_target: 'Agentic book rollout',
            campaign_template_key: 'whisper_to_shout',
            campaign_window_days: 14,
            campaign_language: 'Tease/Wispr/Shout overlay; stored phase remains canonical.',
            linked_work_item_id: workItem.id,
            linked_research_packet_id: packet.id,
            conversion_path: 'Agentic rollout interest, then Agent Ops advisory, AI Quick Win, or discovery call.',
            source_paths: [
              'docs/agentic-value-communications-plan.md',
              'docs/agentic-content-research-briefs/phase-2-research-dossier.md',
            ],
            external_execution_enabled: false,
            provider_generation_enabled: false,
            upload_enabled: false,
            publish_enabled: false,
            schedule_enabled: false,
          }
          const primaryRow = {
            ...slot,
            campaign_id: campaign.id,
            agent_work_item_id: workItem.id,
            channel: 'linkedin',
            title: `${phase.titlePrefix}: ${phase.insightTitle}`,
            planned_angle: `${phase.contentAngle} LinkedIn, YouTube Shorts, Instagram Reels, TikTok, and Thumbnail drafts are ready for human approval.`,
            scheduled_for: scheduledFor,
            authorization_due_at: addDaysAtHourISO(Math.max(0, phase.day - 1), 10),
            authorization_status: 'pending',
            metadata: {
              ...commonMetadata,
              calendar_item_role: 'primary_phase_item',
              channel_draft_targets: ['linkedin', 'youtube_shorts', 'instagram_reels', 'tiktok', 'thumbnail'],
            },
          }
          const youtubeRow = {
            ...slot,
            campaign_id: campaign.id,
            agent_work_item_id: workItem.id,
            channel: 'youtube_shorts',
            title: `${phase.titlePrefix} Short: ${phase.insightTitle}`,
            planned_angle: `${phase.suggestedHook} Adapt this phase into the review-ready YouTube Shorts lane before any render or upload.`,
            scheduled_for: addDaysAtHourISO(phase.day, phase.phase === 'offer' ? 14 : 13),
            authorization_due_at: addDaysAtHourISO(Math.max(0, phase.day - 1), 10),
            authorization_status: 'pending',
            metadata: {
              ...commonMetadata,
              calendar_item_role: 'companion_channel_item',
              primary_channel: 'linkedin',
              channel_draft_targets: ['youtube_shorts', 'instagram_reels', 'tiktok', 'thumbnail'],
            },
          }
          return [primaryRow, youtubeRow]
        })

        const { error: calendarError } = await supabase
          .from('social_content_calendar_items')
          .insert(calendarRows)

        if (calendarError) {
          return { ok: false, error: `social_content_calendar_items: ${calendarError.message}` }
        }

        return {
          ok: true,
          key,
          detail: `Agentic book rollout campaign ${campaign.id} with campaign goal ${campaignGoal.id}, ${calendarRows.length} calendar items, ${workItems.length} insight work items, and research packet ${packet.id}`,
        }
      }

      default: {
        const _exhaustive: never = key
        return { ok: false, error: `Unknown key: ${_exhaustive}` }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}
