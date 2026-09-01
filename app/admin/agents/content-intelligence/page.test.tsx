import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ContentIntelligencePage from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

describe('ContentIntelligencePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/admin/agents/content-intelligence')
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })
    Object.defineProperty(window.HTMLElement.prototype, 'focus', {
      configurable: true,
      value: vi.fn(),
    })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/admin/social-content/intelligence/research-runs') {
        return {
          ok: true,
          json: async () => ({ packets: [{ id: 'packet-new' }], run: { mode: 'recorded_evidence' } }),
        }
      }
      if (url === '/api/admin/agents/work-items/work-social-1/research-packets') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            linked_packet_ids: ['packet-1'],
            side_effects: {
              provider_generation: false,
              upload: false,
              publish: false,
              schedule: false,
              external_post: false,
            },
          }),
        }
      }
      if (url === '/api/admin/social-content/intelligence/daily-digest/activation-request') {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            work_item: {
              id: 'work-digest-activation',
              title: 'Approve daily Social Content Intelligence digest activation',
            },
            activation_requested: true,
            activation_executed: false,
            side_effects: {
              cron_activated: false,
              apify_run: false,
              provider_generation: false,
              upload: false,
              schedule: false,
              publish: false,
              external_post: false,
            },
          }),
        }
      }
      if (url === '/api/admin/social-content/calendar/calendar-1/authorize') {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            item: { id: 'calendar-1', authorization_status: 'authorized', social_content_id: 'social-1' },
            handoff: {
              kind: 'linkedin_social_content_draft',
              work_item_id: 'work-handoff-1',
              social_content_id: 'social-1',
            },
            side_effects: {
              provider_generation: false,
              upload: false,
              external_schedule: false,
              publish: false,
              external_post: false,
              internal_draft_handoff_created: true,
              social_content_draft_created: true,
            },
          }),
        }
      }
      if (url === '/api/admin/social-content/calendar/calendar-1/reject') {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            item: { id: 'calendar-1', authorization_status: 'rejected' },
            revision_work_item_id: 'work-revision-1',
            side_effects: {
              provider_generation: false,
              upload: false,
              external_schedule: false,
              publish: false,
              external_post: false,
              revision_work_item_created: true,
            },
          }),
        }
      }
      if (url === '/api/admin/social-content/calendar/calendar-1') {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            item: {
              id: 'calendar-1',
              title: 'Tease: Edited approval gates',
              authorization_status: 'pending',
            },
            side_effects: {
              provider_generation: false,
              upload: false,
              external_schedule: false,
              publish: false,
              external_post: false,
            },
          }),
        }
      }
      if (url === '/api/admin/social-content/calendar') {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            item: { id: 'calendar-new', title: 'Manual calendar item' },
            side_effects: {
              provider_generation: false,
              upload: false,
              external_schedule: false,
              publish: false,
              external_post: false,
            },
          }),
        }
      }
      if (url.startsWith('/api/admin/social-content/calendar')) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: 'calendar-1',
                campaign_id: 'campaign-1',
                agent_work_item_id: 'work-social-1',
                social_content_id: 'social-1',
                channel: 'linkedin',
                campaign_phase: 'tease',
                title: 'Tease: Approval gates',
                planned_angle: 'Open with the moment an approval path created extra work.',
                scheduled_for: '2026-06-24T14:00:00.000Z',
                due_status: 'planned',
                authorization_status: 'pending',
                authorization_due_at: '2026-06-23T14:00:00.000Z',
                autonomy_eligible: false,
                metadata: {
                  template_label: 'Whisper-to-shout launch',
                  milestone_key: 'small_tension',
                  source_labels: ['HubSpot social calendar template'],
                  milestone_rationale: {
                    summary: 'Tease milestone for LinkedIn: Open with a small tension before the campaign teaches the larger frame.',
                    campaign_fit: 'Whisper-to-shout launch fits "Agent Ops Campaign" because the campaign brief points to governed AI operating layer content.',
                    timing: '14 day lead time keeps tease work reviewable before the scheduled campaign moment.',
                    required_inputs: ['triggering_event'],
                    approval_gates: ['copy_review'],
                    source_labels: ['HubSpot social calendar template'],
                  },
                },
                attraction_campaigns: { id: 'campaign-1', name: 'Agent Ops Campaign', slug: 'agentified-trust-scale-2026-07' },
                agent_work_items: { id: 'work-social-1', title: 'Approval gates create trust', status: 'proposed' },
                social_content_queue: { id: 'social-1', status: 'draft' },
              },
              {
                id: 'calendar-due-now',
                campaign_id: 'campaign-1',
                agent_work_item_id: 'work-social-2',
                social_content_id: 'social-due-now',
                channel: 'tiktok',
                campaign_phase: 'proof',
                title: 'Due-now TikTok proof cutdown',
                planned_angle: 'Prepare the manual proof cutdown gate.',
                scheduled_for: '2099-08-21T14:00:00.000Z',
                due_status: 'due_now',
                authorization_status: 'pending',
                authorization_due_at: '2099-08-20T14:00:00.000Z',
                autonomy_eligible: false,
                metadata: {
                  provider_blocked: true,
                  provider_boundary: 'TikTok direct post remains manual.',
                },
                attraction_campaigns: { id: 'campaign-1', name: 'Agent Ops Campaign', slug: 'agentified-trust-scale-2026-07' },
                agent_work_items: { id: 'work-social-2', title: 'TikTok proof handoff', status: 'proposed' },
                social_content_queue: { id: 'social-due-now', status: 'draft' },
              },
              {
                id: 'calendar-rejected',
                campaign_id: 'campaign-1',
                agent_work_item_id: 'work-social-rejected',
                social_content_id: null,
                channel: 'linkedin',
                campaign_phase: 'teach',
                title: 'Rejected calendar revision',
                planned_angle: 'Needs a clearer revision path before draft handoff.',
                scheduled_for: '2099-08-22T14:00:00.000Z',
                due_status: 'planned',
                authorization_status: 'rejected',
                authorization_due_at: '2099-08-21T14:00:00.000Z',
                autonomy_eligible: false,
                metadata: {
                  authorization_decision_note: 'Clarify the proof point before this can be authorized.',
                  returned_to_shaka: true,
                  external_execution_enabled: false,
                },
                attraction_campaigns: { id: 'campaign-1', name: 'Agent Ops Campaign', slug: 'agentified-trust-scale-2026-07' },
                agent_work_items: { id: 'work-social-rejected', title: 'Revise calendar handoff', status: 'proposed' },
                social_content_queue: null,
              },
              {
                id: 'calendar-recalibrated',
                campaign_id: 'campaign-1',
                agent_work_item_id: 'work-social-3',
                social_content_id: 'social-recalibrated',
                channel: 'x',
                campaign_phase: 'teach',
                title: 'Recalibrated X conversation starter',
                planned_angle: 'Move the campaign sequence forward.',
                scheduled_for: '2099-08-23T14:00:00.000Z',
                due_status: 'planned',
                authorization_status: 'pending',
                authorization_due_at: '2099-08-22T14:00:00.000Z',
                autonomy_eligible: false,
                metadata: {
                  provider_blocked: true,
                  calendar_recalibration: {
                    recalibrated_at: '2026-08-15T12:00:00.000Z',
                    prior_scheduled_for: '2026-08-14T12:00:00.000Z',
                  },
                },
                attraction_campaigns: { id: 'campaign-1', name: 'Agent Ops Campaign', slug: 'agentified-trust-scale-2026-07' },
                agent_work_items: { id: 'work-social-3', title: 'X proof handoff', status: 'proposed' },
                social_content_queue: { id: 'social-recalibrated', status: 'draft' },
              },
              {
                id: 'calendar-learning',
                campaign_id: 'campaign-1',
                agent_work_item_id: 'work-social-4',
                social_content_id: 'social-learning',
                channel: 'linkedin',
                campaign_phase: 'proof',
                title: 'Published LinkedIn learning window',
                planned_angle: 'Wait for signal review.',
                scheduled_for: '2026-08-12T14:00:00.000Z',
                due_status: 'completed',
                authorization_status: 'authorized',
                authorization_due_at: '2026-08-11T14:00:00.000Z',
                autonomy_eligible: false,
                metadata: {},
                attraction_campaigns: { id: 'campaign-1', name: 'Agent Ops Campaign', slug: 'agentified-trust-scale-2026-07' },
                agent_work_items: { id: 'work-social-4', title: 'Learning window', status: 'completed' },
                social_content_queue: { id: 'social-learning', status: 'published' },
              },
            ],
          }),
        }
      }
      if (url.startsWith('/api/admin/campaigns')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'campaign-1',
                name: 'Agent Ops Campaign',
                description: 'Campaign for governed AI operating layer content.',
                campaign_type: 'free_challenge',
                status: 'draft',
                starts_at: '2026-06-24T00:00:00.000Z',
                ends_at: '2026-07-01T00:00:00.000Z',
              },
            ],
          }),
        }
      }
      if (url.startsWith('/api/admin/social-content/intelligence/daily-digest')) {
        return {
          ok: true,
          json: async () => ({
            digest: {
              generated_at: '2026-06-23T12:00:00.000Z',
              lookback_days: 5,
              summary: {
                new_research_packets: 1,
                usable_patterns: 1,
                shaka_insights: 1,
                blocked_or_sensitive_items: 1,
              },
              strongest_patterns: [
                {
                  packet_id: 'packet-1',
                  title: 'Outlier research process',
                  source_url: 'https://youtube.com/watch?v=abc',
                  platform: 'youtube',
                  creator: 'Creator',
                  outlier_score: 87,
                  pattern_status: 'needs_brand_translation',
                  hook_structure: 'The first 30 seconds make the promise clear.',
                  promise_value: 'Clear public research process',
                  thumbnail_pattern: 'High contrast proof frame.',
                },
              ],
              recommended_insights: [
                {
                  work_item_id: 'work-social-1',
                  title: 'Approval gates create trust',
                  status: 'proposed',
                  priority: 'high',
                  triggering_event: 'A shipped review gate changed the work.',
                  why_vambah_can_speak: 'Vambah built the system.',
                  sensitivity: 'needs_review',
                },
              ],
              suggested_channel_lanes: [
                {
                  work_item_id: 'work-social-1',
                  insight_title: 'Approval gates create trust',
                  channel: 'youtube_shorts',
                  label: 'YouTube Shorts',
                  status: 'not_started',
                  required_inputs: ['hook', 'script'],
                },
                {
                  work_item_id: 'work-social-1',
                  insight_title: 'Approval gates create trust',
                  channel: 'tiktok',
                  label: 'TikTok',
                  status: 'not_started',
                  required_inputs: ['hook', 'caption', 'audio rights'],
                },
              ],
              thumbnail_opportunities: [
                {
                  packet_id: 'packet-1',
                  title: 'Outlier research process',
                  thumbnail_pattern: 'High contrast proof frame.',
                },
              ],
              blocked_or_sensitive_items: [
                {
                  type: 'shaka_insight',
                  id: 'work-social-1',
                  title: 'Approval gates create trust',
                  reason: 'needs_review',
                },
              ],
              governance: {
                schedule_activation: 'approval_required',
                apify_collection: 'approval_required',
                publishing: 'approval_required',
              },
              side_effects: {
                provider_generation: false,
                upload: false,
                publish: false,
                schedule: false,
                external_post: false,
                apify_run: false,
              },
            },
          }),
        }
      }
      if (url === '/api/admin/social-content/intelligence/autoresearch-backlog' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            activation: {
              itemId: 'autoresearch-agentified-agt-x-01',
              title: 'What breaks first when AI gets faster?',
              records: [
                {
                  channel: 'x',
                  state: 'linked',
                  calendarItemId: 'calendar-x',
                  socialContentId: 'social-x',
                  providerBlocked: false,
                  manualOnly: false,
                  reason: 'Existing Portfolio records reused.',
                },
                {
                  channel: 'linkedin',
                  state: 'existing',
                  calendarItemId: 'calendar-1',
                  socialContentId: 'social-1',
                  providerBlocked: false,
                  manualOnly: false,
                  reason: 'Existing Portfolio records reused.',
                },
              ],
              summary: {
                requested: 2,
                insertedCalendarItems: 0,
                insertedSocialContentRows: 0,
                reusedCalendarItems: 2,
                reusedSocialContentRows: 2,
                blocked: 0,
              },
              side_effects: {
                provider_call: false,
                slack_send: false,
                cron_activation: false,
                migration: false,
                publish: false,
                schedule: false,
                upload: false,
                production_mutation: false,
                provider_generation: false,
                external_schedule: false,
                external_post: false,
                social_content_draft_created: false,
                calendar_rows_created: false,
              },
              callable_external_actions: [],
            },
          }),
        }
      }
      if (url === '/api/admin/social-content/intelligence/autoresearch-backlog') {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: 'autoresearch-agentified-agt-x-01',
                title: 'What breaks first when AI gets faster?',
                status: 'approved_for_internal_handoff',
                targetAvatar: 'AI product operators and agent-builder educators carrying workflow risk.',
                campaign: { slug: 'agentified-trust-scale-2026-07', phase: 'tease' },
                sourcePacketPaths: [
                  'docs/content-strategy/agentified-x-research-evidence-2026-08-05.md',
                  'agentified/campaign/portfolio-campaign-packet.json',
                ],
                sourceReferences: [
                  {
                    sourceType: 'public_post',
                    urlOrPath: 'https://x.com/example/status/receipt-path',
                    visibleSignalBasis: 'Visible thread structure and public replies.',
                    transferablePattern: 'Open with the handoff failure before naming the receipt path.',
                    confidence: 'high',
                  },
                ],
                variants: [
                  {
                    channel: 'x',
                    recommendedFormat: 'thread',
                    channelFit: 'strong',
                    ctaRole: 'conversation',
                    providerBoundary: 'publish_gate_required',
                    visualNeeds: ['none'],
                  },
                  {
                    channel: 'linkedin',
                    recommendedFormat: 'text_post',
                    channelFit: 'medium',
                    ctaRole: 'discussion',
                    providerBoundary: 'draft_only',
                    visualNeeds: ['none'],
                  },
                ],
                gates: {
                  source_basis: { key: 'source_basis', state: 'approved', rawState: 'approved', missingPrerequisite: null, blockers: [] },
                  copy: { key: 'copy', state: 'approved', rawState: 'approved', missingPrerequisite: null, blockers: [] },
                  visual_media: { key: 'visual_media', state: 'approved', rawState: 'approved', missingPrerequisite: null, blockers: [] },
                  privacy_rights: { key: 'privacy_rights', state: 'approved', rawState: 'approved', missingPrerequisite: null, blockers: [] },
                  draft_handoff: { key: 'draft_handoff', state: 'approved', rawState: 'approved', missingPrerequisite: null, blockers: [] },
                  final_submission: { key: 'final_submission', state: 'pending', rawState: 'pending', missingPrerequisite: null, blockers: [] },
                  provider_execution: { key: 'provider_execution', state: 'pending', rawState: 'pending', missingPrerequisite: 'final_submission', blockers: [] },
                  status_reconciliation: { key: 'status_reconciliation', state: 'pending', rawState: 'pending', missingPrerequisite: 'final_submission', blockers: [] },
                },
                firstBlockedOrPendingGate: 'final_submission',
                learningWindows: {
                  directional: '24_48h',
                  decision: 'seven_day',
                  visibleSampleBasis: 'Public visible replies and manual qualitative review.',
                  trackedSignals: ['hook_resonance', 'comment_quality'],
                },
                improvement: {
                  allowed: true,
                  state: 'directional_signal',
                  canBeDecisionGrade: false,
                  blockers: [],
                },
                externalActions: {
                  provider_call: false,
                  slack_send: false,
                  cron_activation: false,
                  migration: false,
                  publish: false,
                  schedule: false,
                  upload: false,
                  production_mutation: false,
                },
                callableExternalActions: [],
                nextHumanDecision: 'Approve or revise AGT-X-01 for final X provider preparation; this does not authorize posting.',
                blockers: [],
              },
              {
                id: 'autoresearch-agentified-agt-li-02',
                title: 'What makes proof feel credible before a launch?',
                status: 'blocked',
                targetAvatar: 'Founder-operators weighing whether AI workflow claims are grounded in real product evidence.',
                campaign: { slug: 'agentified-trust-scale-2026-07', phase: 'proof' },
                sourcePacketPaths: [
                  'docs/content-strategy/linkedin-autoresearch-loop.md',
                  'docs/agentified-visual-autoresearch.md',
                ],
                sourceReferences: [
                  {
                    sourceType: 'public_video',
                    urlOrPath: 'https://www.youtube.com/watch?v=proof-pattern',
                    visibleSignalBasis: 'Visible proof framing and thumbnail pattern.',
                    transferablePattern: 'Show proof before inviting the audience to believe the launch claim.',
                    confidence: 'medium',
                  },
                ],
                variants: [
                  {
                    channel: 'linkedin',
                    recommendedFormat: 'document_post',
                    channelFit: 'medium',
                    ctaRole: 'proof_request',
                    providerBoundary: 'draft_only',
                    visualNeeds: ['thumbnail', 'portfolio_b_roll'],
                  },
                ],
                gates: {
                  source_basis: { key: 'source_basis', state: 'manual_review', rawState: 'manual_review', missingPrerequisite: null, blockers: ['source reviewer must approve packet distance'] },
                  copy: { key: 'copy', state: 'pending', rawState: 'pending', missingPrerequisite: 'source_basis', blockers: [] },
                  visual_media: { key: 'visual_media', state: 'pending', rawState: 'pending', missingPrerequisite: 'copy', blockers: [] },
                  privacy_rights: { key: 'privacy_rights', state: 'pending', rawState: 'pending', missingPrerequisite: 'visual_media', blockers: [] },
                  draft_handoff: { key: 'draft_handoff', state: 'blocked', rawState: 'pending', missingPrerequisite: 'privacy_rights', blockers: ['source_basis is manual_review'] },
                  final_submission: { key: 'final_submission', state: 'blocked', rawState: 'pending', missingPrerequisite: 'draft_handoff', blockers: [] },
                  provider_execution: { key: 'provider_execution', state: 'blocked', rawState: 'pending', missingPrerequisite: 'final_submission', blockers: [] },
                  status_reconciliation: { key: 'status_reconciliation', state: 'blocked', rawState: 'pending', missingPrerequisite: 'provider_execution', blockers: [] },
                },
                firstBlockedOrPendingGate: 'source_basis',
                learningWindows: {
                  directional: '24_48h',
                  decision: 'seven_day',
                  visibleSampleBasis: 'Pending visible sample basis.',
                  trackedSignals: ['thumbnail_hold', 'source_click_quality'],
                },
                improvement: {
                  allowed: false,
                  state: 'blocked',
                  canBeDecisionGrade: false,
                  blockers: ['manual source review required'],
                },
                externalActions: {
                  provider_call: false,
                  slack_send: false,
                  cron_activation: false,
                  migration: false,
                  publish: false,
                  schedule: false,
                  upload: false,
                  production_mutation: false,
                },
                callableExternalActions: [],
                nextHumanDecision: 'Complete source basis review before any internal handoff.',
                blockers: ['manual source review required'],
              },
            ],
            summary: {
              total: 2,
              readyForInternalHandoff: 1,
              blockedOrManual: 2,
              callableExternalActions: 0,
            },
            opportunity_summary: {
              total: 2,
              highPriority: 1,
              channels: ['x', 'linkedin'],
              requiresHumanGate: 2,
            },
            opportunities: [
              {
                id: 'opportunity-autoresearch-agentified-agt-x-01-x',
                itemId: 'autoresearch-agentified-agt-x-01',
                title: 'What breaks first when AI gets faster?',
                priority: 'high',
                channel: 'x',
                recommendedFormat: 'thread',
                campaign: { slug: 'agentified-trust-scale-2026-07', phase: 'tease' },
                targetAvatarFit: 'The idea works as a compact tension-first thread tied to the Agentified tease phase.',
                whyNow: 'AI got faster; the first failure is usually the handoff.',
                nextContentMove: 'Name the receipt path before asking operators where trust breaks.',
                measurementHypothesis: 'Seven-day review decides whether to repeat as LinkedIn proof post.',
                recommendedImprovement: 'hook',
                requiredGate: 'final_submission',
                evidenceBasis: 'Early public conversation quality only.',
                sourceDistanceBoundary: 'Use public creator patterns only for tension, structure, and proof placement.',
                calendarLinkage: {
                  campaignSlug: 'agentified-trust-scale-2026-07',
                  calendarAssetId: 'AGT-X-01',
                  socialContentId: 'social-1',
                },
              },
              {
                id: 'opportunity-autoresearch-agentified-agt-li-02-linkedin',
                itemId: 'autoresearch-agentified-agt-li-02',
                title: 'What makes proof feel credible before a launch?',
                priority: 'medium',
                channel: 'linkedin',
                recommendedFormat: 'document_post',
                campaign: { slug: 'agentified-trust-scale-2026-07', phase: 'proof' },
                targetAvatarFit: 'Founder-operators need credible proof before the launch claim becomes a carousel.',
                whyNow: 'Proof is the missing bridge between campaign interest and release readiness.',
                nextContentMove: 'Turn the proof packet into a document post only after source review clears.',
                measurementHypothesis: 'Review source click quality and save behavior before changing the next proof asset.',
                recommendedImprovement: 'thumbnail',
                requiredGate: 'source_basis',
                evidenceBasis: 'Manual source review required.',
                sourceDistanceBoundary: 'Use Portfolio proof surfaces and avoid external creator wording.',
                calendarLinkage: {
                  campaignSlug: 'agentified-trust-scale-2026-07',
                  calendarAssetId: 'AGT-LI-02',
                },
                blockedReason: 'manual source review required',
              },
            ],
            side_effects: {
              provider_call: false,
              slack_send: false,
              cron_activation: false,
              migration: false,
              publish: false,
              schedule: false,
              upload: false,
              production_mutation: false,
            },
            callable_external_actions: [],
          }),
        }
      }
      if (url.startsWith('/api/admin/social-content/intelligence/research-packets')) {
        return {
          ok: true,
          json: async () => ({
            packets: [
              {
                id: 'packet-1',
                source_url: 'https://youtube.com/watch?v=abc',
                platform: 'youtube',
                creator_name: 'Creator',
                creator_handle: '@creator',
                title: 'Outlier research process',
                caption: null,
                thumbnail_url: 'https://example.com/thumb.jpg',
                hook_transcript: 'The first 30 seconds make the promise clear.',
                outlier_score: 87,
                pattern_status: 'needs_brand_translation',
                retrieved_at: '2026-06-22T12:00:00.000Z',
                actor_metadata: { actor_id: 'pintostudio/youtube-transcript-scraper' },
                metrics: { views: 120000, likes: 8000, comments: 900 },
              },
            ],
          }),
        }
      }
      if (url === '/api/admin/agents/work-items/work-social-1/research-packets') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            work_item: {
              id: 'work-social-1',
              title: 'Approval gates create trust',
              status: 'proposed',
              priority: 'high',
              source_type: 'social_topic_trigger',
              metadata: {
                suggested_research_packet_ids: ['packet-1'],
                insight: {
                  title: 'Approval gates create trust',
                  triggering_event: 'A shipped review gate changed the work.',
                  why_vambah_can_speak: 'Vambah built the system.',
                  approved_research_patterns: [
                    {
                      packet_id: 'packet-1',
                      source_url: 'https://youtube.com/watch?v=abc',
                      pattern_packet: {
                        hook_structure: 'The first 30 seconds make the promise clear.',
                      },
                    },
                  ],
                },
                channel_lanes: {
                  linkedin: { status: 'selected', label: 'LinkedIn', required_inputs: ['post text', 'CTA'] },
                  youtube: { status: 'not_started', label: 'YouTube', required_inputs: ['title', 'description', 'script'] },
                  youtube_shorts: { status: 'not_started', label: 'YouTube Shorts', required_inputs: ['hook', 'script'] },
                  instagram_reels: { status: 'not_started', label: 'Instagram Reels', required_inputs: ['hook', 'caption'] },
                  tiktok: { status: 'not_started', label: 'TikTok', required_inputs: ['hook', 'caption', 'audio rights'] },
                },
              },
              updated_at: '2026-06-23T12:00:00.000Z',
            },
            side_effects: {
              provider_generation: false,
              upload: false,
              publish: false,
              schedule: false,
              external_post: false,
            },
          }),
        }
      }
      if (url === '/api/admin/agents/work-items/work-social-1/social-channels/prepare-review-drafts') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            work_item: {
              id: 'work-social-1',
              title: 'Approval gates create trust',
              status: 'proposed',
              priority: 'high',
              source_type: 'social_topic_trigger',
              metadata: {
                suggested_research_packet_ids: ['packet-1'],
                insight: {
                  title: 'Approval gates create trust',
                  triggering_event: 'A shipped review gate changed the work.',
                  why_vambah_can_speak: 'Vambah built the system.',
                  approved_research_patterns: [
                    {
                      packet_id: 'packet-1',
                      source_url: 'https://youtube.com/watch?v=abc',
                    },
                  ],
                },
                channel_lanes: {
                  linkedin: {
                    status: 'in_review',
                    label: 'LinkedIn',
                    draft_packet: { channel: 'linkedin', fields: { post_text: 'LinkedIn draft' } },
                    required_inputs: ['post text', 'CTA'],
                  },
                  youtube: {
                    status: 'in_review',
                    label: 'YouTube',
                    draft_packet: { channel: 'youtube', fields: { full_video_script: ['YouTube long-form draft'] } },
                    required_inputs: ['title', 'description', 'script'],
                  },
                  youtube_shorts: {
                    status: 'in_review',
                    label: 'YouTube Shorts',
                    draft_packet: { channel: 'youtube_shorts', fields: { script: ['YouTube draft'] } },
                    required_inputs: ['hook', 'script'],
                  },
                  instagram_reels: {
                    status: 'in_review',
                    label: 'Instagram Reels',
                    draft_packet: { channel: 'instagram_reels', fields: { caption: 'Instagram draft' } },
                    required_inputs: ['hook', 'caption'],
                  },
                  tiktok: {
                    status: 'in_review',
                    label: 'TikTok',
                    draft_packet: { channel: 'tiktok', fields: { caption: 'TikTok draft', audio_rights: 'platform-safe audio' } },
                    required_inputs: ['hook', 'caption', 'audio rights'],
                  },
                },
              },
              updated_at: '2026-06-23T12:00:00.000Z',
            },
            side_effects: {
              provider_generation: false,
              upload: false,
              publish: false,
              schedule: false,
              external_post: false,
            },
          }),
        }
      }
      if (url === '/api/admin/agents/work-items/work-social-1/autoresearch-feedback') {
        const recordedFeedbackHandoff = {
          id: 'autoresearch-feedback-1',
          created_at: '2026-06-23T15:00:00.000Z',
          created_by: 'vambah@amadutown.com',
          backlog_item_id: 'autoresearch-agentified-agt-x-01',
          backlog_item_title: 'What breaks first when AI gets faster?',
          feedback_target: 'both',
          feedback: 'Strengthen the CTA and carry the b-roll lesson into the next pass.',
          status: 'recorded',
          current_gate: 'final_submission',
          release_title: 'Tease: Approval gates',
          release_scheduled_for: '2026-06-24T14:00:00.000Z',
        }
        return {
          ok: true,
          json: async () => ({
            ok: true,
            feedback_handoff: recordedFeedbackHandoff,
            work_item: {
              id: 'work-social-1',
              title: 'Approval gates create trust',
              status: 'proposed',
              priority: 'high',
              source_type: 'social_topic_trigger',
              metadata: {
                suggested_research_packet_ids: ['packet-1'],
                insight: {
                  title: 'Approval gates create trust',
                  triggering_event: 'A shipped review gate changed the work.',
                  why_vambah_can_speak: 'Vambah built the system.',
                  approved_research_patterns: [],
                },
                channel_lanes: {
                  linkedin: { status: 'selected', label: 'LinkedIn', required_inputs: ['post text', 'CTA'] },
                  youtube: { status: 'not_started', label: 'YouTube', required_inputs: ['title', 'description', 'script'] },
                  youtube_shorts: { status: 'not_started', label: 'YouTube Shorts', required_inputs: ['hook', 'script'] },
                  instagram_reels: { status: 'not_started', label: 'Instagram Reels', required_inputs: ['hook', 'caption'] },
                  tiktok: { status: 'not_started', label: 'TikTok', required_inputs: ['hook', 'caption', 'audio rights'] },
                },
                autoresearch_feedback_handoffs: [recordedFeedbackHandoff],
                autoresearch_feedback_latest: recordedFeedbackHandoff,
              },
              updated_at: '2026-06-23T15:00:00.000Z',
            },
            side_effects: {
              provider_generation: false,
              provider_call: false,
              upload: false,
              schedule: false,
              publish: false,
              external_post: false,
              production_mutation: false,
            },
          }),
        }
      }
      if (url.startsWith('/api/admin/agents/work-items')) {
        return {
          ok: true,
          json: async () => ({
            work_items: [
              {
                id: 'work-social-1',
                title: 'Approval gates create trust',
                status: 'proposed',
                priority: 'high',
                source_type: 'social_topic_trigger',
                metadata: {
                  suggested_research_packet_ids: ['packet-1'],
                  insight: {
                    title: 'Approval gates create trust',
                    triggering_event: 'A shipped review gate changed the work.',
                    why_vambah_can_speak: 'Vambah built the system.',
                    approved_research_patterns: [],
                  },
                  channel_lanes: {
                    linkedin: { status: 'selected', label: 'LinkedIn', required_inputs: ['post text', 'CTA'] },
                    youtube: { status: 'not_started', label: 'YouTube', required_inputs: ['title', 'description', 'script'] },
                    youtube_shorts: { status: 'not_started', label: 'YouTube Shorts', required_inputs: ['hook', 'script'] },
                    instagram_reels: { status: 'not_started', label: 'Instagram Reels', required_inputs: ['hook', 'caption'] },
                    tiktok: { status: 'not_started', label: 'TikTok', required_inputs: ['hook', 'caption', 'audio rights'] },
                  },
                },
                updated_at: '2026-06-22T12:00:00.000Z',
              },
            ],
          }),
        }
      }
      return { ok: false, status: 404, json: async () => ({ error: 'not found' }) }
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows research packets and central Shaka insights', async () => {
    render(<ContentIntelligencePage />)

    expect(await screen.findByRole('heading', { name: 'Research and Shaka insight queue' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Content intelligence sections' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Release dates and approval gates' })).toBeInTheDocument()
    for (const label of ['Campaign', 'Channel', 'Phase', 'Authorization']) {
      const control = screen.getAllByLabelText(label)[0]
      expect(control.className).toContain('[color-scheme:light]')
      expect(control.className).toContain('dark:[color-scheme:dark]')
    }
    const templateLibrarySection = screen.getByRole('heading', { name: 'Source-backed campaign patterns' }).closest('section') as HTMLElement
    expect(templateLibrarySection).toBeInTheDocument()
    const templateLibrary = within(templateLibrarySection)
    const templateDetailsButton = templateLibrary.getByRole('button', { name: /Template details/ })
    expect(templateDetailsButton).toBeInTheDocument()
    expect(templateDetailsButton).toHaveAttribute('aria-expanded', 'false')
    expect(templateLibrary.queryByText('YouTube video release')).not.toBeInTheDocument()
    fireEvent.click(templateDetailsButton)
    expect(templateDetailsButton).toHaveAttribute('aria-expanded', 'true')
    expect(templateLibrary.getByText('Template 1 of 5')).toBeInTheDocument()
    expect(templateLibrary.getAllByText('Whisper-to-shout launch')).toHaveLength(2)
    expect(templateLibrary.getByText('1 / 5')).toBeInTheDocument()
    expect(templateLibrary.getAllByRole('link', { name: /HubSpot social calendar template/ }).length).toBeGreaterThan(0)
    expect(templateLibrary.getByText('1–1 of 5')).toBeInTheDocument()
    expect(templateLibrary.queryByText('YouTube video release')).not.toBeInTheDocument()
    expect(templateLibrary.queryByText('Short-form series')).not.toBeInTheDocument()
    expect(templateLibrary.queryByText('Case study proof drop')).not.toBeInTheDocument()
    fireEvent.click(templateLibrary.getByRole('button', { name: 'Next' }))
    expect(templateLibrary.getByText('Template 2 of 5')).toBeInTheDocument()
    expect(templateLibrary.getAllByText('YouTube video release')).toHaveLength(2)
    expect(templateLibrary.getByText('2 / 5')).toBeInTheDocument()
    expect(templateLibrary.queryByText('Whisper-to-shout launch')).not.toBeInTheDocument()
    expect(templateLibrary.queryByText('Short-form series')).not.toBeInTheDocument()
    expect(templateLibrary.getAllByRole('link', { name: /YouTube creator optimization guidance/ }).length).toBeGreaterThan(0)
    fireEvent.click(templateLibrary.getByRole('button', { name: 'Prev' }))
    expect(templateLibrary.getByText('Template 1 of 5')).toBeInTheDocument()
    expect(templateLibrary.getAllByText('Whisper-to-shout launch')).toHaveLength(2)
    expect(templateLibrary.queryByText('YouTube video release')).not.toBeInTheDocument()
    fireEvent.click(templateLibrary.getByRole('button', { name: 'Next' }))
    expect(templateLibrary.getAllByText('YouTube video release')).toHaveLength(2)
    expect(screen.getByText('Tease: Approval gates')).toBeInTheDocument()
    expect(screen.getAllByText('Content').length).toBeGreaterThan(0)
    expect(screen.getByText('Approval gates create trust')).toBeInTheDocument()
    expect(screen.getByText('Open with the moment an approval path created extra work.')).toBeInTheDocument()
    expect(screen.getAllByText('Release').length).toBeGreaterThan(0)
    expect(screen.getByText(/Jun 24, 2026/)).toBeInTheDocument()
    expect(screen.getAllByText(/1 day approval lead/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Whisper-to-shout launch').length).toBeGreaterThan(0)
    expect(screen.getByText(/Tease milestone for LinkedIn/)).toBeInTheDocument()
    expect(screen.getAllByText('Agent Ops Campaign').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Stale date').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Due now').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Recalibrated').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Learning window').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Visual/media readiness').length).toBeGreaterThan(0)
    const planItemButton = screen.getByRole('button', { name: /\+ Plan item/ })
    expect(planItemButton).toBeInTheDocument()
    expect(planItemButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Pending internal gate only')).toBeInTheDocument()
    expect(screen.queryByText(/Manual planning creates a pending internal calendar gate/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Evidence/ }))
    expect(screen.getByRole('heading', { name: 'Free-first evidence layer' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Source options/ }))
    expect(screen.getByText('Recorded public evidence from Codex/browser review. Cost: $0.')).toBeInTheDocument()
    expect(screen.getByText('pintostudio/youtube-transcript-scraper only after cost approval')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Daily Digest/ }))
    expect(screen.getByRole('heading', { name: 'What Shaka should review next' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Activation review/ }))
    expect(screen.getByRole('button', { name: 'Request Daily Activation Review' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Strongest patterns' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Channel lanes' })).toBeInTheDocument()
    expect(screen.getByText('YouTube Shorts: Approval gates create trust')).toBeInTheDocument()

    const autoResearchTab = screen.getByRole('button', { name: /AutoResearch/ })
    expect(autoResearchTab).toHaveTextContent('2')
    fireEvent.click(autoResearchTab)
    expect(screen.getByRole('heading', { name: 'Decision workspace' })).toBeInTheDocument()
    expect(screen.queryByText('No AutoResearch backlog projection loaded.')).not.toBeInTheDocument()
    const backlogSearch = screen.getByLabelText('Backlog search')
    expect(backlogSearch.parentElement?.className).toContain('[color-scheme:light]')
    expect(backlogSearch.parentElement?.className).toContain('dark:[color-scheme:dark]')
    expect(screen.getByText('Showing 1-1 of 2 backlog items · 2 ranked opportunities match.')).toBeInTheDocument()
    expect(screen.getAllByText('What breaks first when AI gets faster?').length).toBeGreaterThan(0)
    expect(screen.getByText('docs/content-strategy/agentified-x-research-evidence-2026-08-05.md')).toBeInTheDocument()
    expect(screen.getAllByText('final submission').length).toBeGreaterThan(0)
    const actionSummary = screen.getAllByText('Action summary')[0]
    const operatorAction = screen.getAllByText('Operator action')[0]
    const auditSummary = screen.getAllByText('Full audit details')[0]
    expect(actionSummary.compareDocumentPosition(operatorAction) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(operatorAction.compareDocumentPosition(auditSummary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(auditSummary.closest('details')).not.toHaveAttribute('open')
    expect(screen.getAllByRole('link', { name: 'Content row: social-1' })[0]).toHaveAttribute('href', '/admin/social-content/social-1')
    expect(screen.queryByText(/command center/i)).not.toBeInTheDocument()
    const backlogActionList = screen.getByLabelText('Paginated AutoResearch backlog actions')
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    expect(within(backlogActionList).getAllByText('What breaks first when AI gets faster?').length).toBeGreaterThan(0)
    expect(within(backlogActionList).queryByText('What makes proof feel credible before a launch?')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(within(backlogActionList).getAllByText('What makes proof feel credible before a launch?').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Prev' }))
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Feedback follow-through/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /Queue summary/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /Ranked opportunities/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /Recommended next moves/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /Diagnostics and external-action state/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Target-avatar fit')).not.toBeInTheDocument()
    expect(screen.queryByText('Strongest bet')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'What needs a decision next' })).not.toBeInTheDocument()
    expect(screen.getAllByText('Generated backlog item').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Content').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Backlog linkage').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Due date').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Learning window').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Reference basis').length).toBeGreaterThan(0)
    expect(screen.getAllByText('https://x.com/example/status/receipt-path').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Open with the handoff failure before naming the receipt path.').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Full audit details').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Research and pattern basis').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Source packets explain why the backlog item exists; they are not generated draft content.').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Draft/backlog variants').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Release calendar linkage').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1 connected row').length).toBeGreaterThan(0)
    expect(screen.getByText('Tease: Approval gates')).toBeInTheDocument()
    expect(screen.getByText('LinkedIn · Tease · pending')).toBeInTheDocument()
    expect(screen.getAllByText('1 day approval lead').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Jun 24, 2026/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Jun 23, 2026/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Work item: Approval gates create trust').length).toBeGreaterThan(0)
    const connectedContentLink = screen.getByRole('link', { name: 'social-1' })
    expect(connectedContentLink).toHaveAttribute('href', '/admin/social-content/social-1')
    expect(connectedContentLink.closest('p')?.textContent).toContain('Connected content row: social-1 (draft)')
    fireEvent.click(screen.getByRole('button', { name: /Queue summary/ }))
    expect(screen.getByRole('heading', { name: 'What needs a decision next' })).toBeInTheDocument()
    expect(screen.getByText('Use this as the top-level readout before drilling into the backlog cards. It points to the existing content or work-item record and keeps feedback, approval, and signal-waiting separate.')).toBeInTheDocument()
    expect(screen.getAllByText('Ready for approval').length).toBeGreaterThan(0)
    expect(screen.getByText('Open the connected content row and approve or revise the final submission direction.')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Open content row/ })[0]).toHaveAttribute('href', '/admin/social-content/social-1')
    expect(screen.getAllByText('Template basis: Whisper-to-shout launch').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Operator action').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Route commentary to this item, the next AutoResearch pass, or both.').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Calendar activation bridge').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Activate internal records' }).length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByRole('button', { name: 'Activate internal records' })[0])
    expect(await screen.findByText(/Activated What breaks first when AI gets faster/)).toBeInTheDocument()
    const activationCall = vi.mocked(fetch).mock.calls.find(([input, init]) => (
      String(input) === '/api/admin/social-content/intelligence/autoresearch-backlog'
      && init?.method === 'POST'
    ))
    expect(activationCall).toBeTruthy()
    expect(JSON.parse(String(activationCall?.[1]?.body))).toEqual({
      item_id: 'autoresearch-agentified-agt-x-01',
      channels: ['x', 'linkedin'],
    })
    expect(screen.getAllByText('Feedback routable').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /Feedback follow-through/ }))
    expect(screen.getByRole('heading', { name: 'Feedback follow-through' })).toBeInTheDocument()
    expect(screen.getAllByText('0 handoffs').length).toBeGreaterThan(0)
    expect(screen.getByText(/No operator feedback handoffs recorded yet/)).toBeInTheDocument()
    const feedbackAreas = screen.getAllByLabelText('Commentary for Amina')
    const feedbackButtons = screen.getAllByRole('button', { name: 'Record feedback handoff' })
    expect(feedbackButtons[0]).toBeDisabled()
    fireEvent.change(feedbackAreas[0], {
      target: { value: 'Strengthen the CTA and carry the b-roll lesson into the next pass.' },
    })
    expect(feedbackButtons[0]).not.toBeDisabled()
    fireEvent.click(feedbackButtons[0])
    expect(await screen.findByText('Feedback recorded for this item and the next AutoResearch pass.')).toBeInTheDocument()
    const feedbackCall = vi.mocked(fetch).mock.calls.find(([input]) => String(input) === '/api/admin/agents/work-items/work-social-1/autoresearch-feedback')
    expect(feedbackCall).toBeTruthy()
    expect(feedbackCall?.[1]).toMatchObject({ method: 'POST' })
    expect(JSON.parse(String(feedbackCall?.[1]?.body))).toMatchObject({
      backlog_item_id: 'autoresearch-agentified-agt-x-01',
      backlog_item_title: 'What breaks first when AI gets faster?',
      feedback_target: 'both',
      feedback: 'Strengthen the CTA and carry the b-roll lesson into the next pass.',
      current_gate: 'final_submission',
      release_link_id: 'calendar-1',
      release_title: 'Tease: Approval gates',
      release_scheduled_for: '2026-06-24T14:00:00.000Z',
    })
    expect(screen.getAllByText('1 handoff').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Do both').length).toBeGreaterThan(0)
    expect(screen.getByText('Strengthen the CTA and carry the b-roll lesson into the next pass.')).toBeInTheDocument()
    expect(screen.getAllByText('Work item: Approval gates create trust').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Open work item/ })).toHaveAttribute('href', '/admin/agents/social-insights/work-social-1')
    fireEvent.click(screen.getByRole('button', { name: /Ranked opportunities/ }))
    expect(screen.getAllByText('Target-avatar fit').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Measurement hypothesis').length).toBeGreaterThan(0)
    expect(screen.getByText('Name the receipt path before asking operators where trust breaks.')).toBeInTheDocument()
    expect(screen.getByText('Seven-day review decides whether to repeat as LinkedIn proof post.')).toBeInTheDocument()
    expect(screen.getAllByText('No external action').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /Recommended next moves/ }))
    expect(screen.getByText('Strongest bet')).toBeInTheDocument()
    expect(screen.getByText('Move the X thread through final submission.')).toBeInTheDocument()
    expect(screen.getByText('Improvement lever')).toBeInTheDocument()
    expect(screen.getByText('Review hook resonance, comment quality before revising the next variant.')).toBeInTheDocument()
    expect(screen.getByText('Missing gate')).toBeInTheDocument()
    expect(screen.getAllByText('Complete source basis review before any internal handoff.').length).toBeGreaterThan(0)
    expect(screen.getByText('Channel priority')).toBeInTheDocument()
    expect(screen.getByText('X: strong')).toBeInTheDocument()
    expect(screen.getByText('Boundary')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Diagnostics and external-action state/ }))
    expect(screen.getByText('Callable external actions: 0')).toBeInTheDocument()
    expect(screen.getByText('No provider, schedule, publish, or upload action is available from this view.')).toBeInTheDocument()
    expect(screen.getByText('provider call: locked')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Callable external actions: 0' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Backlog search'), { target: { value: 'Approval gates create trust' } })
    expect(screen.getByText('Showing 1-1 of 1 backlog item · 0 ranked opportunities match.')).toBeInTheDocument()
    expect(screen.getAllByText('What breaks first when AI gets faster?').length).toBeGreaterThan(0)
    expect(screen.queryByText('What makes proof feel credible before a launch?')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Backlog search'), { target: { value: 'receipt path' } })
    expect(screen.getByText('Showing 1-1 of 1 backlog item · 1 ranked opportunity match.')).toBeInTheDocument()
    expect(screen.getByText('Name the receipt path before asking operators where trust breaks.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Backlog search'), { target: { value: 'missing release row' } })
    expect(screen.getByText('No AutoResearch backlog items match the current search.')).toBeInTheDocument()
    expect(screen.getByText('No ranked content opportunities match the current search.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /ResearchCreator evidence/ }))
    expect(screen.getByRole('heading', { name: 'Public creator research' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Link pattern to Shaka insight/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Outlier research process' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Backlog/ }))
    expect(screen.getByRole('heading', { name: 'Shaka insight backlog' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Approval gates create trust/ }).map((link) => link.getAttribute('href'))).toContain('/admin/agents/social-insights/work-social-1')
    expect(screen.getByText('LinkedIn: selected')).toBeInTheDocument()
    expect(screen.getByText('YouTube: not started')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Link Suggested Research' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prepare Review Drafts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prepare Review Drafts' })).toBeDisabled()
  })

  it('filters release calendar rows by content title and linked work item', async () => {
    render(<ContentIntelligencePage />)

    await screen.findByRole('heading', { name: 'Release dates and approval gates' })
    const contentSearch = screen.getByLabelText('Content title')

    fireEvent.change(contentSearch, { target: { value: 'Approval gates create trust' } })
    expect(screen.getByText('Tease: Approval gates')).toBeInTheDocument()
    expect(screen.getByText('Showing 1-1 of 1 release row. Search checks content title, work item, planned angle, campaign, template label, and source basis.')).toBeInTheDocument()

    fireEvent.change(contentSearch, { target: { value: 'missing content title' } })
    expect(screen.queryByText('Tease: Approval gates')).not.toBeInTheDocument()
    expect(screen.getByText('Showing 0-0 of 0 release rows. Search checks content title, work item, planned angle, campaign, template label, and source basis.')).toBeInTheDocument()
  })

  it('stores recorded evidence without paid scraper fields', async () => {
    render(<ContentIntelligencePage />)

    await screen.findByRole('heading', { name: 'Research and Shaka insight queue' })
    fireEvent.click(screen.getByRole('button', { name: /Evidence/ }))

    fireEvent.change(screen.getByLabelText('Source URL'), { target: { value: 'https://youtube.com/watch?v=recorded' } })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Recorded hook pattern' } })
    fireEvent.change(screen.getByLabelText('Creator'), { target: { value: 'Public Creator' } })
    fireEvent.change(screen.getByLabelText('Hook or first 30 seconds'), { target: { value: 'The hook makes a specific promise first.' } })
    fireEvent.change(screen.getByLabelText('Views'), { target: { value: '24000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Store Evidence Packet' }))

    await screen.findByText('Recorded public evidence stored.')

    const postCall = vi.mocked(fetch).mock.calls.find(([input]) => String(input) === '/api/admin/social-content/intelligence/research-runs')
    expect(postCall).toBeTruthy()

    const [, init] = postCall!
    const body = JSON.parse(String(init?.body))
    expect(body).toMatchObject({
      mode: 'recorded_evidence',
      evidence_items: [
        {
          source_url: 'https://youtube.com/watch?v=recorded',
          platform: 'youtube',
          title: 'Recorded hook pattern',
          creator_name: 'Public Creator',
          hook_transcript: 'The hook makes a specific promise first.',
          retrieval_method: 'codex_browser',
          metrics: {
            views: 24000,
          },
        },
      ],
    })
    expect(body.confirm_apify_cost).toBeUndefined()
    expect(body.sources).toBeUndefined()

    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.filter(([input]) => String(input).startsWith('/api/admin/social-content/intelligence/research-packets'))).toHaveLength(2)
    })
  })

  it('links a research pattern to a central Shaka insight without production side effects', async () => {
    render(<ContentIntelligencePage />)

    await screen.findByRole('heading', { name: 'Research and Shaka insight queue' })
    fireEvent.click(screen.getByRole('button', { name: /ResearchCreator evidence/ }))
    fireEvent.click(screen.getByRole('button', { name: /Link pattern to Shaka insight/ }))

    fireEvent.change(screen.getByLabelText('Decision note'), {
      target: { value: 'Use the structure, not the source wording.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Link Pattern' }))

    await screen.findByText('Research pattern linked to Shaka insight.')

    const linkCall = vi.mocked(fetch).mock.calls.find(([input]) => String(input) === '/api/admin/agents/work-items/work-social-1/research-packets')
    expect(linkCall).toBeTruthy()
    expect(linkCall?.[1]).toMatchObject({ method: 'POST' })
    expect(JSON.parse(String(linkCall?.[1]?.body))).toEqual({
      packet_ids: ['packet-1'],
      decision_note: 'Use the structure, not the source wording.',
    })
  })

  it('prepares channel drafts from the backlog without publishing side effects', async () => {
    render(<ContentIntelligencePage />)

    await screen.findByRole('heading', { name: 'Research and Shaka insight queue' })
    fireEvent.click(screen.getByRole('button', { name: /Backlog/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Link Suggested Research' }))

    await screen.findByText('Suggested research linked to Shaka insight.')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Prepare Review Drafts' })).not.toBeDisabled()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Prepare Review Drafts' }))

    expect(await screen.findByText('LinkedIn, YouTube, YouTube Shorts, Instagram Reels, and TikTok review drafts are ready for human approval.')).toBeInTheDocument()
    expect(screen.getByText('LinkedIn: in review')).toBeInTheDocument()
    expect(screen.getByText('YouTube: in review')).toBeInTheDocument()
    expect(screen.getByText('Shorts: in review')).toBeInTheDocument()
    expect(screen.getByText('Instagram: in review')).toBeInTheDocument()
    expect(screen.getByText('TikTok: in review')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open human review' })).toHaveAttribute('href', '/admin/agents/social-insights/work-social-1')

    const prepareCall = vi.mocked(fetch).mock.calls.find(([input]) => String(input) === '/api/admin/agents/work-items/work-social-1/social-channels/prepare-review-drafts')
    expect(prepareCall).toBeTruthy()
    expect(prepareCall?.[1]).toMatchObject({ method: 'POST' })
    const suggestedLinkCall = vi.mocked(fetch).mock.calls.find(([input, init]) => (
      String(input) === '/api/admin/agents/work-items/work-social-1/research-packets'
      && String(init?.body).includes('Linked suggested public research pattern')
    ))
    expect(suggestedLinkCall).toBeTruthy()
    expect(JSON.parse(String(suggestedLinkCall?.[1]?.body))).toEqual({
      packet_ids: ['packet-1'],
      decision_note: 'Linked suggested public research pattern from Content Intelligence backlog.',
    })
  })

  it('requests daily digest activation review without enabling the schedule', async () => {
    render(<ContentIntelligencePage />)

    await screen.findByRole('heading', { name: 'Research and Shaka insight queue' })
    fireEvent.click(screen.getByRole('button', { name: /Daily Digest/ }))
    fireEvent.click(screen.getByRole('button', { name: /Activation review/ }))

    fireEvent.change(screen.getByLabelText('Activation review note'), {
      target: { value: 'Start with free public research and Shaka internal triggers.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Request Daily Activation Review' }))

    await screen.findByText('Daily activation review added to Agentic Dashboard backlog.')

    const activationCall = vi.mocked(fetch).mock.calls.find(([input]) => String(input) === '/api/admin/social-content/intelligence/daily-digest/activation-request')
    expect(activationCall).toBeTruthy()
    expect(activationCall?.[1]).toMatchObject({ method: 'POST' })
    expect(JSON.parse(String(activationCall?.[1]?.body))).toEqual({
      cadence: 'daily',
      lookback_days: 5,
      scope_note: 'Start with free public research and Shaka internal triggers.',
    })
  })

  it('creates a pending calendar item without publishing side effects', async () => {
    render(<ContentIntelligencePage />)

    const planItemButton = await screen.findByRole('button', { name: /\+ Plan item/ })
    expect(planItemButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Scheduled for')).not.toBeInTheDocument()
    fireEvent.click(planItemButton)
    expect(planItemButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Manual planning creates a pending internal calendar gate/)).toBeInTheDocument()

    fireEvent.change(screen.getAllByLabelText('Title')[0], {
      target: { value: 'Teach: Campaign operating lesson' },
    })
    fireEvent.change(screen.getByLabelText('Scheduled for'), {
      target: { value: '2026-06-25T10:00' },
    })
    fireEvent.change(screen.getAllByLabelText('Campaign')[0], {
      target: { value: 'campaign-1' },
    })
    fireEvent.change(screen.getByLabelText('Planned angle'), {
      target: { value: 'Teach the operating framework behind the campaign.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Plan Item' }))

    await screen.findByText('Calendar item planned. Human authorization remains pending.')

    const calendarCall = vi.mocked(fetch).mock.calls.find(([input, init]) => (
      String(input) === '/api/admin/social-content/calendar' && init?.method === 'POST'
    ))
    expect(calendarCall).toBeTruthy()
    expect(JSON.parse(String(calendarCall?.[1]?.body))).toMatchObject({
      title: 'Teach: Campaign operating lesson',
      campaign_id: 'campaign-1',
      channel: 'linkedin',
      campaign_phase: 'tease',
      planned_angle: 'Teach the operating framework behind the campaign.',
    })
  })

  it('applies a researched template milestone to the calendar planner metadata', async () => {
    render(<ContentIntelligencePage />)

    const templateDetailsButton = await screen.findByRole('button', { name: /Template details/ })
    const templateLibrarySection = screen.getByRole('heading', { name: 'Source-backed campaign patterns' }).closest('section') as HTMLElement
    const templateLibrary = within(templateLibrarySection)
    fireEvent.click(templateDetailsButton)
    expect(templateLibrary.getAllByText('Whisper-to-shout launch')).toHaveLength(2)
    expect(templateLibrary.queryByText('YouTube video release')).not.toBeInTheDocument()
    fireEvent.click(templateLibrary.getByRole('button', { name: 'Next' }))
    expect(templateLibrary.getAllByText('YouTube video release')).toHaveLength(2)
    expect(templateLibrary.queryByText('Whisper-to-shout launch')).not.toBeInTheDocument()
    const planItemButton = screen.getByRole('button', { name: /\+ Plan item/ })
    expect(planItemButton).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(planItemButton)

    fireEvent.change(screen.getAllByLabelText('Campaign')[0], {
      target: { value: 'campaign-1' },
    })
    fireEvent.click(planItemButton)
    expect(planItemButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(templateLibrary.getByRole('button', { name: 'Use YouTube video release Proof milestone' }))

    expect(planItemButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByLabelText('Title')[0]).toHaveValue('Thumbnail and title: Agent Ops Campaign')
    expect(screen.getAllByLabelText('Channel')[0]).toHaveValue('thumbnail')
    expect(screen.getAllByLabelText('Phase')[0]).toHaveValue('proof')
    expect(screen.getByText('Template applied:')).toBeInTheDocument()
    expect(screen.getAllByText(/YouTube video release/).length).toBeGreaterThan(0)

    fireEvent.change(screen.getByLabelText('Scheduled for'), {
      target: { value: '2026-06-25T10:00' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Plan Item' }))

    await screen.findByText('Calendar item planned. Human authorization remains pending.')

    const calendarCall = vi.mocked(fetch).mock.calls.find(([input, init]) => (
      String(input) === '/api/admin/social-content/calendar' && init?.method === 'POST'
    ))
    expect(calendarCall).toBeTruthy()
    expect(JSON.parse(String(calendarCall?.[1]?.body))).toMatchObject({
      title: 'Thumbnail and title: Agent Ops Campaign',
      campaign_id: 'campaign-1',
      channel: 'thumbnail',
      campaign_phase: 'proof',
      planned_angle: expect.stringContaining('Develop title and thumbnail variants'),
      metadata: {
        generated_from: 'content_intelligence_template_milestone',
        template_key: 'youtube_video_release',
        template_label: 'YouTube video release',
        milestone_key: 'thumbnail_title_package',
        campaign_fit_summary: expect.stringContaining('Agent Ops Campaign'),
        source_labels: expect.arrayContaining(['YouTube creator optimization guidance']),
        required_assets: expect.arrayContaining(['thumbnail_reference', 'title_variants']),
        approval_gates: expect.arrayContaining(['thumbnail_review']),
        external_execution_enabled: false,
      },
    })
  })

  it('authorizes a calendar item as an internal draft handoff', async () => {
    render(<ContentIntelligencePage />)

    await screen.findByText('Tease: Approval gates')

    fireEvent.click(screen.getAllByRole('button', { name: 'Authorize Draft Handoff' })[0])

    await screen.findByText('Draft handoff authorized and Social Content draft created.')

    const authorizeCall = vi.mocked(fetch).mock.calls.find(([input]) => (
      String(input) === '/api/admin/social-content/calendar/calendar-1/authorize'
    ))
    expect(authorizeCall).toBeTruthy()
    expect(authorizeCall?.[1]).toMatchObject({ method: 'POST' })
    expect(JSON.parse(String(authorizeCall?.[1]?.body))).toEqual({})
  })

  it('focuses a calendar approval row from the Slack deep-link query', async () => {
    window.history.replaceState({}, '', '/admin/agents/content-intelligence?section=calendar&calendar_item=calendar-due-now')

    render(<ContentIntelligencePage />)

    expect(await screen.findByText('Linked calendar row focused')).toBeInTheDocument()
    expect(screen.getByText(/Opened from a Slack approval reminder for calendar-due-now/)).toBeInTheDocument()

    const focusedRow = await screen.findByLabelText('Focused calendar row Due-now TikTok proof cutdown')
    expect(focusedRow).toHaveClass('ring-2')
    expect(within(focusedRow).getByRole('button', { name: 'Authorize Draft Handoff' })).toBeInTheDocument()
    expect(within(focusedRow).getByRole('button', { name: 'Reject' })).toBeInTheDocument()

    await waitFor(() => {
      expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
      expect(window.HTMLElement.prototype.focus).toHaveBeenCalledWith({ preventScroll: true })
    })
  })

  it('shows a recovery notice when a Slack-linked calendar row is absent', async () => {
    window.history.replaceState({}, '', '/admin/agents/content-intelligence?section=calendar&calendar_item=missing-calendar-item')

    render(<ContentIntelligencePage />)

    expect(await screen.findByText('Linked calendar row unavailable')).toBeInTheDocument()
    expect(screen.getByText('Calendar row missing-calendar-item is not present in this environment.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear focus' }))

    await waitFor(() => {
      expect(screen.queryByText('Linked calendar row unavailable')).not.toBeInTheDocument()
    })
  })

  it('edits a pending calendar item without authorizing or publishing it', async () => {
    render(<ContentIntelligencePage />)

    await screen.findByText('Tease: Approval gates')

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
    fireEvent.change(screen.getAllByLabelText('Title')[0], {
      target: { value: 'Tease: Edited approval gates' },
    })
    fireEvent.change(screen.getAllByLabelText('Scheduled for')[0], {
      target: { value: '2026-06-26T09:30' },
    })
    fireEvent.change(screen.getAllByLabelText('Planned angle')[0], {
      target: { value: 'Open with the handoff moment, then show the gate.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await screen.findByText('Calendar item updated. Human authorization remains pending.')

    const patchCall = vi.mocked(fetch).mock.calls.find(([input, init]) => (
      String(input) === '/api/admin/social-content/calendar/calendar-1' && init?.method === 'PATCH'
    ))
    expect(patchCall).toBeTruthy()
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      title: 'Tease: Edited approval gates',
      campaign_id: 'campaign-1',
      channel: 'linkedin',
      campaign_phase: 'tease',
      planned_angle: 'Open with the handoff moment, then show the gate.',
      authorization_status: 'pending',
    })
  })

  it('requires a decision note before rejecting a calendar item', async () => {
    render(<ContentIntelligencePage />)

    await screen.findByText('Tease: Approval gates')

    fireEvent.click(screen.getAllByRole('button', { name: 'Reject' })[0])
    fireEvent.change(screen.getAllByLabelText('Decision note')[0], {
      target: { value: 'Needs stronger proof before this is due.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit Rejection' }))

    await screen.findByText('Calendar item rejected and returned to Shaka for revision.')

    const rejectCall = vi.mocked(fetch).mock.calls.find(([input]) => (
      String(input) === '/api/admin/social-content/calendar/calendar-1/reject'
    ))
    expect(rejectCall).toBeTruthy()
    expect(rejectCall?.[1]).toMatchObject({ method: 'POST' })
    expect(JSON.parse(String(rejectCall?.[1]?.body))).toEqual({
      decision_note: 'Needs stronger proof before this is due.',
    })
  })

  it('locks rejected calendar authorization actions until the item is revised', async () => {
    render(<ContentIntelligencePage />)

    const rejectedRow = await screen.findByLabelText('Calendar row Rejected calendar revision')

    expect(within(rejectedRow).getByText('Rejected rows stay locked until the calendar item is revised.')).toBeInTheDocument()
    expect(within(rejectedRow).getByRole('button', { name: 'Edit and Return to Review' })).toBeInTheDocument()
    expect(within(rejectedRow).queryByRole('button', { name: 'Authorize Draft Handoff' })).not.toBeInTheDocument()
    expect(within(rejectedRow).queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()

    fireEvent.click(within(rejectedRow).getByRole('button', { name: 'Edit and Return to Review' }))

    const expandedRejectedRow = await screen.findByLabelText('Calendar row Rejected calendar revision')
    expect(within(expandedRejectedRow).getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
    expect(within(expandedRejectedRow).queryByRole('button', { name: 'Authorize Draft Handoff' })).not.toBeInTheDocument()
    expect(within(expandedRejectedRow).queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
  })
})
