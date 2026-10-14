import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getAgentWorkItem: vi.fn(),
  updateAgentWorkItemMetadata: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-work-items', () => ({
  getAgentWorkItem: mocks.getAgentWorkItem,
  updateAgentWorkItemMetadata: mocks.updateAgentWorkItemMetadata,
}))

import { POST } from './route'
import { buildLinkedInYoutubeReviewDrafts } from '@/lib/social-content-intelligence'

function request() {
  return new Request('http://localhost/api/admin/agents/work-items/work-1/social-channels/prepare-review-drafts', {
    method: 'POST',
    headers: { authorization: 'Bearer token' },
  })
}

const baseWorkItem = {
  id: 'work-1',
  title: 'Approval gates create trust',
  metadata: {
    insight: {
      title: 'Approval gates create trust',
      triggering_event: 'The Social Content review flow made the gate visible.',
      why_vambah_can_speak: 'Vambah is building and reviewing the system directly.',
      evidence_summary: 'Review path and visual gate work shipped locally.',
      brand_goal: 'Show AmaduTown\'s governed AI operating model.',
      audience: 'Product leaders and operators evaluating agentic AI.',
      content_angle: 'AI should reduce burden, but only when authority and evidence are separated.',
      suggested_hook: 'AI should reduce burden.',
      claim_boundaries: ['Do not imply publishing is automated.'],
      approved_research_patterns: [
        {
          source_url: 'https://youtube.com/watch?v=abc',
          platform: 'youtube',
          creator_name: 'Creator',
          pattern_status: 'usable_framework',
          pattern_packet: {
            hook_structure: 'Start with the missed approval gate.',
            promise_value: 'Show how review gates build trust.',
            thumbnail_pattern: 'Translate the layout into AmaduTown style.',
          },
        },
      ],
    },
    channel_lanes: {
      linkedin: { status: 'selected', label: 'LinkedIn', required_inputs: ['post text', 'CTA'] },
      youtube_shorts: { status: 'not_started', label: 'YouTube Shorts', required_inputs: ['hook', 'script'] },
      instagram_reels: { status: 'not_started', label: 'Instagram Reels', required_inputs: ['hook', 'caption'] },
      tiktok: { status: 'not_started', label: 'TikTok', required_inputs: ['hook', 'caption', 'audio rights'] },
      x: { status: 'not_started', label: 'X', required_inputs: ['post text', 'thread option', 'CTA'] },
      thumbnail: { status: 'not_started', label: 'Thumbnail', required_inputs: ['promise', '2-3 variants'] },
    },
    autoresearch_feedback_latest: {
      feedback_target: 'both',
      feedback: 'Make the next operator action explicit and route commentary into this item and the next AutoResearch pass.',
      backlog_item_id: 'autoresearch-agentified-agt-x-01',
      status: 'recorded',
    },
  },
}

function cloneBaseWorkItem() {
  return structuredClone(baseWorkItem)
}

function artifactVideoAdaptationRequest() {
  const inputVersion = 'sha256:jev-dashboard-current'
  const linkedinCopy = String(buildLinkedInYoutubeReviewDrafts({
    insight: baseWorkItem.metadata.insight,
    generatedAt: '2026-06-24T15:00:00.000Z',
    latestFeedback: baseWorkItem.metadata.autoresearch_feedback_latest,
  }).linkedin.fields.post_text)
  const receiptKinds = ['source', 'voice', 'framework', 'privacy', 'visual', 'rights', 'challenger', 'script_quality']
  const receipts = Object.fromEntries(receiptKinds.map((kind) => [kind, {
    receipt_id: `receipt-${kind}`,
    kind,
    status: 'passed',
    input_version: inputVersion,
    reviewed_at: '2026-06-24T14:00:00.000Z',
    valid_until: '2026-07-01T14:00:00.000Z',
  }]))
  const scenes = ['problem', 'walkthrough', 'value', 'traceability'].map((purpose, index) => ({
    scene_id: `jev-scene-${index + 1}`,
    target: 'youtube_long_form',
    purpose: `Teach the operator-dashboard ${purpose} with inspectable evidence.`,
    narration: `The approved dashboard ${purpose} scene shows the visible evidence and bounded operator decision without implying live provider activation.`,
    claim_ids: ['claim-jev-value'],
    artifact_ids: ['jev-operator-dashboard'],
    source_receipt_ids: ['receipt-source'],
    on_screen_text: [`Dashboard ${purpose}`],
    motion_direction: 'Start wide, move to the named evidence region, then pause long enough for the viewer to inspect it.',
  }))

  return {
    adaptation_id: 'adaptation-jev-dashboard',
    generated_at: '2026-06-24T15:00:00.000Z',
    input_version: inputVersion,
    target_decision: 'long_form',
    identity: {
      campaign_id: 'campaign-jev-operator-proof',
      product_id: 'jev',
      topic_id: 'topic-governed-capability-analysis',
      source_ids: ['source-jev-product', 'source-jev-dashboard'],
      channel_packet_ids: ['work-1:linkedin', 'work-1:youtube'],
    },
    source_channel_packet: {
      campaign_id: 'campaign-jev-operator-proof',
      product_id: 'jev',
      topic_id: 'topic-governed-capability-analysis',
      source_ids: ['source-jev-product', 'source-jev-dashboard'],
      channel_packet_ids: ['work-1:linkedin', 'work-1:youtube'],
      linkedin_copy: linkedinCopy,
    },
    receipts,
    claims: [{
      claim_id: 'claim-jev-value',
      text: 'The approved Jev operator dashboard keeps evidence, the operator decision, and the bounded next action visible in one review flow.',
      source_receipt_ids: ['receipt-source'],
      proof_receipt_ids: ['receipt-visual', 'receipt-challenger'],
      privacy_boundary: 'Use only the approved redacted dashboard state and do not imply live provider quality or production activation.',
    }],
    evidence_assets: [{
      asset_id: 'jev-operator-dashboard',
      asset_type: 'dashboard_capture',
      label: 'Approved Jev operator dashboard capture',
      reference: '/evidence/jev/operator-dashboard.png',
      source_receipt_ids: ['receipt-source'],
      privacy_receipt_id: 'receipt-privacy',
      rights_receipt_id: 'receipt-rights',
      approved_use: 'Customer-facing teaching walkthrough of the visible, redacted operator path.',
    }],
    draft: {
      title_options: [
        { title: 'What the Jev dashboard teaches operators', targets: ['youtube_long_form'], promise: 'Walk through the evidence and decision path.', claim_ids: ['claim-jev-value'] },
        { title: 'The receipt trail behind an operator decision', targets: ['youtube_long_form'], promise: 'See the artifact, process, and bounded value.', claim_ids: ['claim-jev-value'] },
      ],
      format_adaptations: [{
        target: 'youtube_long_form',
        opening_hook: 'A polished dashboard can still hide who owns the decision and what the evidence actually supports.',
        full_spoken_script: [
          'A polished dashboard can still hide who owns the decision and what the evidence actually supports.',
          'The Jev operator dashboard gives us a concrete artifact to inspect. We can start with the visible source evidence instead of making a generic claim about automation.',
          'The next region records the bounded operator decision. It separates what the system observed from what a human still needs to judge before any provider or public action.',
          'Now follow the review path into the next-action boundary. The dashboard does not claim live model quality, production activation, or autonomous execution. It makes those limits inspectable.',
          'That matters because teams lose time when they must reconstruct why a decision was made across separate notes, tools, and private conversations.',
          'The practical value is a repeatable review sequence: inspect the source, name the decision, verify the owner, and confirm the action that remains blocked.',
          'The motion follows that operating logic. We begin with the full artifact, move to the evidence region, pause on the decision, and finish on the receipt trail.',
          'Use the same test in your own workflow. If the artifact cannot show what supports the claim and who owns the next step, it is not ready to carry the story.',
        ].join('\n\n'),
        target_duration_seconds: 420,
        adaptation_rationale: 'Long form gives the viewer enough time to inspect the approved dashboard, understand the operating sequence, and distinguish proof from activation.',
      }],
      practical_value: 'The walkthrough gives operators a repeatable way to inspect evidence, ownership, and next-action clarity.',
      why_artifact_matters: 'The approved dashboard turns an abstract governance claim into a visible operating sequence.',
      scenes,
      shot_plan: scenes.map((scene, index) => ({
        shot_id: `jev-shot-${index + 1}`,
        scene_id: scene.scene_id,
        artifact_id: 'jev-operator-dashboard',
        framing: index === 0 ? 'Full dashboard establishing frame' : 'Cropped dashboard region with surrounding context retained',
        action: 'Move to the exact proof region named in narration and pause for inspection.',
        source_receipt_ids: ['receipt-source', 'receipt-visual'],
        privacy_boundary: 'Show only the approved redacted capture; exclude private names, messages, tokens, and account state.',
      })),
      thumbnail_brief: {
        headline: 'Show the decision trail',
        visual_subject: 'One legible crop of the approved Jev dashboard with its evidence-to-decision path highlighted.',
        artifact_ids: ['jev-operator-dashboard'],
        claim_ids: ['claim-jev-value'],
        source_receipt_ids: ['receipt-source', 'receipt-visual'],
        composition: 'Dashboard-first composition with one highlighted decision path and no generic three-box overlay.',
        mobile_readability_note: 'Keep the dashboard recognizable at phone size and limit the headline to four words.',
      },
      composition_rationale: {
        dominant_composition: 'jev-operator-dashboard-walkthrough',
        why_this_structure: 'The dashboard already contains the operating sequence, so the camera follows its evidence path instead of imposing a generic template.',
        motion_rationale: 'Motion directs attention from source to decision to receipt and pauses for inspection at each proof point.',
        recent_approved_compositions: ['generic-three-box', 'quote-card'],
      },
      traceability_summary: 'Every title, scene, shot, claim, and thumbnail reference resolves to current source, visual, privacy, rights, challenger, and script-quality receipts.',
    },
  }
}

function preparedLanes() {
  return mocks.updateAgentWorkItemMetadata.mock.calls[0][0].metadata.channel_lanes
}

function nonXPublicDraftText(lanes: Record<string, { draft_packet: { fields: Record<string, unknown> } }>) {
  return JSON.stringify({
    youtube: {
      title_variants: lanes.youtube.draft_packet.fields.title_variants,
      description: lanes.youtube.draft_packet.fields.description,
      opening_hook: lanes.youtube.draft_packet.fields.opening_hook,
      first_30_seconds: lanes.youtube.draft_packet.fields.first_30_seconds,
      full_video_script: lanes.youtube.draft_packet.fields.full_video_script,
    },
    youtube_shorts: {
      hook: lanes.youtube_shorts.draft_packet.fields.hook,
      first_30_seconds: lanes.youtube_shorts.draft_packet.fields.first_30_seconds,
      script: lanes.youtube_shorts.draft_packet.fields.script,
      caption: lanes.youtube_shorts.draft_packet.fields.caption,
      on_screen_text: lanes.youtube_shorts.draft_packet.fields.on_screen_text,
    },
    instagram_reels: {
      hook: lanes.instagram_reels.draft_packet.fields.hook,
      script: lanes.instagram_reels.draft_packet.fields.script,
      cover_text: lanes.instagram_reels.draft_packet.fields.cover_text,
      caption: lanes.instagram_reels.draft_packet.fields.caption,
    },
    tiktok: {
      hook: lanes.tiktok.draft_packet.fields.hook,
      script: lanes.tiktok.draft_packet.fields.script,
      cover_frame: lanes.tiktok.draft_packet.fields.cover_frame,
      caption: lanes.tiktok.draft_packet.fields.caption,
    },
    thumbnail: {
      primary_text: lanes.thumbnail.draft_packet.fields.primary_text,
      alternate_text_options: lanes.thumbnail.draft_packet.fields.alternate_text_options,
      visual_direction: lanes.thumbnail.draft_packet.fields.visual_direction,
    },
  })
}

describe('/api/admin/agents/work-items/[id]/social-channels/prepare-review-drafts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-24T15:00:00.000Z'))
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getAgentWorkItem.mockResolvedValue(baseWorkItem)
    mocks.updateAgentWorkItemMetadata.mockImplementation(async (input) => ({
      ...baseWorkItem,
      metadata: input.metadata,
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request() as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.getAgentWorkItem).not.toHaveBeenCalled()
  })

  it('requires social insight metadata', async () => {
    mocks.getAgentWorkItem.mockResolvedValue({ ...baseWorkItem, metadata: {} })

    const response = await POST(request() as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Social insight metadata is required' })
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })

  it('requires approved research patterns before preparing channel drafts', async () => {
    mocks.getAgentWorkItem.mockResolvedValue({
      ...baseWorkItem,
      metadata: {
        ...baseWorkItem.metadata,
        insight: {
          ...baseWorkItem.metadata.insight,
          approved_research_patterns: [],
        },
      },
    })

    const response = await POST(request() as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Link at least one approved research pattern before preparing channel review drafts',
    })
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })

  it('fails closed when a non-campaign insight lacks voice and audience calibration', async () => {
    const workItem = cloneBaseWorkItem()
    workItem.metadata.insight.why_vambah_can_speak = ''
    workItem.metadata.insight.brand_goal = ''
    workItem.metadata.insight.audience = ''
    mocks.getAgentWorkItem.mockResolvedValue(workItem)

    const response = await POST(request() as never, { params: { id: 'work-1' } })
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toMatchObject({
      current_gate: 'content_enrichment',
      revision_state: 'revision_needed',
      enrichment_receipt: {
        status: 'blocked',
        checks: {
          voice_calibration: { status: 'blocked' },
          avatar_and_visuals: { status: 'pending_visual_stage' },
        },
      },
    })
    expect(body.blockers).toEqual(expect.arrayContaining([
      'Audience calibration is missing.',
      'Brand goal is missing.',
      'Vambah-specific speaker authority is missing.',
    ]))
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })

  it('hydrates missing campaign calibration and records a truthful enrichment receipt', async () => {
    const workItem = cloneBaseWorkItem()
    workItem.metadata.insight.why_vambah_can_speak = ''
    workItem.metadata.insight.brand_goal = ''
    workItem.metadata.insight.audience = ''
    Object.assign(workItem.metadata, {
      source: 'social_content_calendar_authorization',
      calendar_item_id: 'calendar-1',
      campaign_id: 'campaign-1',
      social_content_id: 'draft-1',
      campaign_phase: 'teach',
      channel: 'youtube',
    })
    mocks.getAgentWorkItem.mockResolvedValue(workItem)

    const response = await POST(request() as never, { params: { id: 'work-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.drafts.linkedin.enrichment_receipt).toMatchObject({
      status: 'passed',
      synthesized_campaign_fields: ['why_vambah_can_speak', 'brand_goal', 'audience'],
      checks: {
        research_frameworks: { status: 'passed', approved_pattern_count: 1 },
        voice_calibration: {
          status: 'passed',
          reference_ids: expect.arrayContaining(['linkedin-builder-insight-production-readiness']),
          provenance: expect.arrayContaining(['docs/linkedin-voice.md']),
        },
        editorial_challenger: {
          status: 'passed',
          reviewer: 'Amina ruleset',
          implementation: 'deterministic_pre_human_gate',
        },
        avatar_and_visuals: {
          status: 'pending_visual_stage',
          avatar_policy: 'required_before_render',
          provider_generation_started: false,
        },
      },
    })
    expect(preparedLanes().linkedin.draft_packet.shared_source).toMatchObject({
      audience: expect.stringContaining('Product leaders'),
      brand_goal: expect.stringContaining('AmaduTown'),
      speaker_authority: expect.stringContaining('I am building'),
    })
  })

  it('prepares channel review drafts without external side effects', async () => {
    const response = await POST(request() as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(200)
    expect(mocks.updateAgentWorkItemMetadata).toHaveBeenCalledWith(expect.objectContaining({
      id: 'work-1',
      note: 'Social channel review drafts prepared by admin@example.com.',
      metadata: expect.objectContaining({
        channel_review_workflow: expect.objectContaining({
          status: 'human_review_ready',
          prepared_channels: ['linkedin', 'youtube', 'youtube_shorts', 'instagram_reels', 'tiktok', 'x', 'thumbnail'],
          prepared_at: '2026-06-24T15:00:00.000Z',
          copy_quality_gate: expect.objectContaining({
            status: 'passed',
            ruleset: 'social-content-final-copy-quality',
          }),
          visual_quality_gate: {
            standard_version: 'consulting_reference_v1',
            status: 'required_before_visual_human_review',
            evaluator: 'evaluateSocialVisualQualityCandidate',
            pass_to_human: false,
            blocker: 'A visual candidate must supply subject, source-binding, template-novelty, and responsive-legibility receipts before visual Human QA.',
          },
        }),
        channel_lanes: expect.objectContaining({
          linkedin: expect.objectContaining({
            status: 'in_review',
            review_requested_at: '2026-06-24T15:00:00.000Z',
            draft_packet: expect.objectContaining({
              channel: 'linkedin',
              orchestration_evidence: expect.objectContaining({
                agents: expect.arrayContaining([
                  expect.objectContaining({ name: 'Shaka' }),
                  expect.objectContaining({ name: 'Askia' }),
                  expect.objectContaining({ name: 'Amina' }),
                ]),
                channel_structure: expect.objectContaining({
                  format: expect.stringContaining('Thought-leadership post'),
                }),
                voice_translation: expect.objectContaining({
                  source: expect.stringContaining('Public-safe Vambah voice calibration library'),
                }),
                visual_reinforcement: expect.objectContaining({
                  recommended_assets: expect.arrayContaining(['Framework illustration', 'App screenshot carousel']),
                }),
              }),
              fields: expect.objectContaining({
                post_text: expect.stringContaining('The Social Content review flow made the gate visible.'),
                cta: expect.stringContaining('Where have you seen AI'),
              }),
            }),
          }),
          youtube: expect.objectContaining({
            status: 'in_review',
            review_requested_at: '2026-06-24T15:00:00.000Z',
            draft_packet: expect.objectContaining({
              channel: 'youtube',
              orchestration_evidence: expect.objectContaining({
                channel_structure: expect.objectContaining({
                  format: expect.stringContaining('Long-form YouTube video packet'),
                }),
                visual_reinforcement: expect.objectContaining({
                  recommended_assets: expect.arrayContaining(['Full-video script', 'Thumbnail/title variants']),
                }),
              }),
              fields: expect.objectContaining({
                full_video_script: expect.arrayContaining([
                  'AI should reduce burden, but only when authority and evidence are separated.',
                ]),
                upload_readiness: 'pending_final_human_submission_gate',
                visibility_default: 'private',
              }),
            }),
          }),
          youtube_shorts: expect.objectContaining({
            status: 'in_review',
            review_requested_at: '2026-06-24T15:00:00.000Z',
            draft_packet: expect.objectContaining({
              channel: 'youtube_shorts',
              orchestration_evidence: expect.objectContaining({
                portfolio_surfaces: expect.arrayContaining([
                  expect.objectContaining({ route: '/admin/content/video-generation' }),
                ]),
                visual_reinforcement: expect.objectContaining({
                  recommended_assets: expect.arrayContaining(['Portfolio b-roll', 'Thumbnail direction']),
                }),
              }),
              fields: expect.objectContaining({
                hook: 'AI should reduce burden.',
                first_30_seconds: expect.stringContaining('The mistake is thinking the demo is the finish line'),
              }),
            }),
          }),
          instagram_reels: expect.objectContaining({
            status: 'in_review',
            review_requested_at: '2026-06-24T15:00:00.000Z',
            draft_packet: expect.objectContaining({
              channel: 'instagram_reels',
              orchestration_evidence: expect.objectContaining({
                portfolio_surfaces: expect.arrayContaining([
                  expect.objectContaining({ route: '/admin/content/visual-assets' }),
                ]),
                visual_reinforcement: expect.objectContaining({
                  recommended_assets: expect.arrayContaining(['Cover frame', 'Vertical proof b-roll']),
                }),
              }),
              fields: expect.objectContaining({
                cover_text: expect.any(String),
                export_readiness: 'pending_human_approval',
              }),
            }),
          }),
          tiktok: expect.objectContaining({
            status: 'in_review',
            review_requested_at: '2026-06-24T15:00:00.000Z',
            draft_packet: expect.objectContaining({
              channel: 'tiktok',
              orchestration_evidence: expect.objectContaining({
                channel_structure: expect.objectContaining({
                  success_criteria: expect.arrayContaining([
                    expect.stringContaining('Audio rights'),
                  ]),
                }),
                voice_translation: expect.objectContaining({
                  avoid: expect.arrayContaining(['Generic AI hype.']),
                }),
              }),
              fields: expect.objectContaining({
                audio_rights: expect.stringContaining('platform-safe audio'),
                export_readiness: 'pending_human_approval',
              }),
            }),
          }),
          x: expect.objectContaining({
            status: 'in_review',
            review_requested_at: '2026-06-24T15:00:00.000Z',
            draft_packet: expect.objectContaining({
              channel: 'x',
              orchestration_evidence: expect.objectContaining({
                channel_structure: expect.objectContaining({
                  format: expect.stringContaining('X post'),
                  success_criteria: expect.arrayContaining([
                    expect.stringContaining('X length constraints'),
                  ]),
                }),
                portfolio_surfaces: expect.arrayContaining([
                  expect.objectContaining({ route: '/admin/social-content' }),
                ]),
              }),
              fields: expect.objectContaining({
                post_text: expect.stringContaining('The Social Content review flow made the gate visible.'),
                thread_option: expect.arrayContaining([
                  expect.stringContaining('The Social Content review flow made the gate visible.'),
                ]),
                manual_handoff_gate: 'pending_human_approval_and_connected_x_provider',
              }),
            }),
          }),
          thumbnail: expect.objectContaining({
            status: 'in_review',
            review_requested_at: '2026-06-24T15:00:00.000Z',
            draft_packet: expect.objectContaining({
              channel: 'thumbnail',
              orchestration_evidence: expect.objectContaining({
                channel_structure: expect.objectContaining({
                  format: expect.stringContaining('thumbnail review packet'),
                }),
                visual_reinforcement: expect.objectContaining({
                  recommended_assets: expect.arrayContaining(['AmaduTown shield', 'Portfolio proof screenshot']),
                }),
              }),
              fields: expect.objectContaining({
                primary_text: expect.any(String),
                review_readiness: 'pending_visual_privacy_qa',
              }),
            }),
          }),
        }),
      }),
    }))

    expect(await response.json()).toMatchObject({
      success: true,
      side_effects: {
        provider_generation: false,
        upload: false,
        publish: false,
        schedule: false,
        external_post: false,
      },
    })

    const lanes = preparedLanes()
    expect(lanes.linkedin.draft_packet.reviewer_action_guidance).toMatchObject({
      feedback_target: 'both',
      feedback: 'Make the next operator action explicit and route commentary into this item and the next AutoResearch pass.',
      current_item_action: expect.stringContaining('current channel drafts'),
      next_autoresearch_pass_action: expect.stringContaining('next AutoResearch loop'),
      next_operator_action: expect.stringContaining('current draft packet'),
    })
    expect(lanes.linkedin.draft_packet.reviewer_action_guidance.next_operator_action).toContain('next AutoResearch pass')
    expect(lanes.youtube.draft_packet.fields.reviewer_trace).toMatchObject({
      evidence_summary: 'Review path and visual gate work shipped locally.',
      source_urls: ['https://youtube.com/watch?v=abc'],
      approved_pattern_count: 1,
      transformation_boundary: expect.stringContaining('Do not paste source summaries'),
    })
    expect(lanes.linkedin.draft_packet.fields.post_text).not.toContain('Review path and visual gate work shipped locally.')
    expect(lanes.youtube.draft_packet.fields.description).not.toContain('Source basis:')
    expect(lanes.thumbnail.draft_packet.fields.primary_text).not.toContain('Open the X thread')
  })

  it('keeps source summaries and X-specific instructions out of non-X public copy', async () => {
    const workItem = cloneBaseWorkItem()
    workItem.metadata.insight = {
      ...workItem.metadata.insight,
      title: 'Agentified book and workbook rollout campaign',
      triggering_event: 'Agentified book and workbook rollout campaign',
      evidence_summary: 'Prepared from the Agentified campaign packet and internal source basis.',
      content_angle: 'Prepared from the Agentified campaign packet for the next operator.',
      suggested_hook: 'Open the X thread with the Agentified book and workbook rollout campaign.',
      approved_research_patterns: [
        {
          source_url: 'https://example.com/public-pattern',
          platform: 'x',
          creator_name: 'Creator',
          pattern_status: 'usable_framework',
          pattern_packet: {
            hook_structure: 'Open the X thread with the planning phrase.',
            promise_value: 'Open the X thread for the Agentified book and workbook rollout campaign.',
            thumbnail_pattern: 'Do not copy this packet title.',
          },
        },
      ],
    }
    mocks.getAgentWorkItem.mockResolvedValue(workItem)

    const response = await POST(request() as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(200)
    const lanes = preparedLanes()
    const publicText = nonXPublicDraftText(lanes)
    expect(publicText).not.toContain('Open the X thread')
    expect(publicText).not.toContain('Agentified book and workbook rollout campaign')
    expect(publicText).not.toContain('Prepared from the Agentified campaign packet')
    expect(publicText).not.toContain('internal source basis')
    expect(publicText).not.toMatch(/\bVambah\b/i)
    expect(lanes.youtube.draft_packet.fields.reviewer_trace).toMatchObject({
      evidence_summary: 'Prepared from the Agentified campaign packet and internal source basis.',
      source_urls: ['https://example.com/public-pattern'],
    })
    expect(lanes.thumbnail.draft_packet.fields.primary_text).toBe('Receipts Before Reach')
    expect(lanes.thumbnail.draft_packet.fields.primary_text).not.toContain('Agentified')
  })

  it('normalizes third-person references to Vambah out of public channel copy', async () => {
    const workItem = cloneBaseWorkItem()
    workItem.metadata.insight = {
      ...workItem.metadata.insight,
      title: 'Vambah explains the review gate',
      triggering_event: 'Vambah is reviewing the campaign handoff.',
      content_angle: 'Vambah has a practical test for trustworthy automation.',
      suggested_hook: "Vambah's rule is simple.",
      why_vambah_can_speak: 'Vambah built and reviewed the workflow.',
    }
    mocks.getAgentWorkItem.mockResolvedValue(workItem)

    const response = await POST(request() as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(200)
    const lanes = preparedLanes()
    const publicText = nonXPublicDraftText(lanes)
    expect(publicText).not.toMatch(/\bVambah\b/i)
    expect(lanes.linkedin.draft_packet.fields.post_text).toContain('A working AI workflow still needs a visible approval path.')
    expect(lanes.linkedin.draft_packet.fields.post_text).toContain('I built and reviewed the workflow.')
    expect(lanes.youtube.draft_packet.fields.full_video_script).toContain('I built and reviewed the workflow.')
  })

  it('blocks channel packets before persistence when public fields contain internal production notes', async () => {
    const workItem = cloneBaseWorkItem()
    workItem.metadata.insight = {
      ...workItem.metadata.insight,
      content_angle: 'Reviewer note: publish this framing as written.',
    }
    mocks.getAgentWorkItem.mockResolvedValue(workItem)

    const response = await POST(request() as never, { params: { id: 'work-1' } })
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toMatchObject({
      current_gate: 'final_copy_quality',
      revision_state: 'revision_needed',
      quality_gate: {
        status: 'blocked',
        findings: expect.arrayContaining([
          expect.objectContaining({ code: 'production_script_label' }),
        ]),
      },
    })
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })
  it('preserves campaign lineage in every review packet without putting IDs in copy', async () => {
    const item = cloneBaseWorkItem()
    Object.assign(item.metadata, { campaign_id: 'campaign-1', calendar_item_id: 'calendar-1', social_content_id: 'draft-1', campaign_phase: 'tease', channel: 'linkedin' })
    mocks.getAgentWorkItem.mockResolvedValue(item)
    const response = await POST(request() as never, { params: { id: 'work-1' } })
    expect(response.status).toBe(200)
    const body = await response.json()
    for (const packet of Object.values(body.drafts) as Record<string, any>[]) {
      expect(packet.shared_source).toMatchObject({ campaign_id: 'campaign-1', calendar_item_id: 'calendar-1', social_content_id: 'draft-1', work_item_id: 'work-1' })
      expect(packet.approval_status).toBe('in_review')
      expect(packet.side_effects).toEqual({ provider_generation: false, upload: false, publish: false, schedule: false, external_post: false })
      expect(JSON.stringify(packet.fields)).not.toContain('calendar-1')
    }
    expect(body.drafts.linkedin.fields.post_text).not.toContain('Calendar draft seed')
  })

  it.each([42, { id: 'calendar-object-leak' }, null])(
    'leaves campaign lineage off review packets when calendar_item_id is not a string',
    async (calendarId) => {
      const item = cloneBaseWorkItem()
      Object.assign(item.metadata, {
        campaign_id: 'campaign-should-stay-out',
        calendar_item_id: calendarId,
        social_content_id: 'draft-should-stay-out',
        campaign_phase: 'tease',
        channel: 'linkedin',
      })
      mocks.getAgentWorkItem.mockResolvedValue(item)
      const response = await POST(request() as never, { params: { id: 'work-1' } })
      expect(response.status).toBe(200)
      const body = await response.json()
      for (const packet of Object.values(body.drafts) as Record<string, { shared_source: Record<string, unknown> }>[]) {
        expect(packet.shared_source).not.toHaveProperty('calendar_item_id')
        expect(packet.shared_source).not.toHaveProperty('campaign_id')
        expect(JSON.stringify(packet)).not.toContain('campaign-should-stay-out')
        expect(JSON.stringify(packet)).not.toContain('draft-should-stay-out')
        expect(JSON.stringify(packet)).not.toContain('calendar-object-leak')
      }
    },
  )

  it('carries an approved Jev artifact packet through the canonical channel-review boundary into the provider-free Video Generation handoff', async () => {
    const workItem = cloneBaseWorkItem()
    Object.assign(workItem.metadata, {
      artifact_video_adaptation_request: artifactVideoAdaptationRequest(),
    })
    mocks.getAgentWorkItem.mockResolvedValue(workItem)

    const response = await POST(request() as never, { params: { id: 'work-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.artifact_video_adaptation).toMatchObject({
      adaptation_id: 'adaptation-jev-dashboard',
      status: 'ready_for_render_approval',
      targets: ['youtube_long_form'],
      video_generation_bridge: {
        status: 'manual_draft_packet_ready',
        render_gate: 'explicit_approval_required',
        side_effects: {
          provider_generation: false,
          render: false,
          upload: false,
          platform_draft: false,
          schedule: false,
          publish: false,
          external_send: false,
          credential_change: false,
          spending: false,
        },
      },
    })
    expect(body.drafts.youtube.fields.artifact_video_adaptation).toMatchObject({
      adaptation_id: 'adaptation-jev-dashboard',
      draft: {
        scenes: expect.arrayContaining([
          expect.objectContaining({ artifact_ids: ['jev-operator-dashboard'] }),
        ]),
      },
    })
    expect(body.drafts.youtube.fields.video_generation_bridge).toMatchObject({
      route: '/admin/content/video-generation',
      render_gate: 'explicit_approval_required',
    })
    expect(body.drafts.youtube_shorts.fields).not.toHaveProperty('artifact_video_adaptation')
    expect(mocks.updateAgentWorkItemMetadata).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        channel_review_workflow: expect.objectContaining({
          artifact_video_adaptation: expect.objectContaining({
            status: 'ready_for_render_approval',
            adaptation_id: 'adaptation-jev-dashboard',
            targets: ['youtube_long_form'],
          }),
        }),
      }),
    }))
  })

  it('blocks a receipt-incomplete artifact packet before channel metadata persistence', async () => {
    const workItem = cloneBaseWorkItem()
    const adaptation = artifactVideoAdaptationRequest()
    delete adaptation.receipts.rights
    Object.assign(workItem.metadata, { artifact_video_adaptation_request: adaptation })
    mocks.getAgentWorkItem.mockResolvedValue(workItem)

    const response = await POST(request() as never, { params: { id: 'work-1' } })
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toMatchObject({
      error: 'Artifact-to-video adaptation is incomplete.',
      current_gate: 'artifact_video_adaptation',
      revision_state: 'revision_needed',
      blockers: expect.arrayContaining(['Required rights receipt is missing.']),
    })
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })

})
