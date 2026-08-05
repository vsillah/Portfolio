import type { SupabaseClient } from '@supabase/supabase-js'
import { agentifiedLaunchImportPlan } from '@/lib/agentified-launch-campaign'
import { deriveDueStatus } from '@/lib/social-content-calendar'

type CalendarRow = {
  id: string
  campaign_id: string | null
  scheduled_for: string
  authorization_status: string | null
  metadata: Record<string, unknown> | null
}

type QueueRow = {
  id: string
  status: string | null
  scheduled_for: string | null
  rag_context: Record<string, unknown> | null
}

export type AgentifiedXApprovedDraft = {
  assetId: 'AGT-X-01' | 'AGT-X-02' | 'AGT-X-03' | 'AGT-X-04'
  title: string
  phase: 'tease' | 'teach' | 'proof' | 'offer'
  sourcePatternIds: string[]
  ctaText: string | null
  ctaUrl: string | null
  threadPosts: string[]
  aminaRationale: string
  moremiReview: string[]
}

export const AGENTIFIED_X_APPROVED_DRAFTS: AgentifiedXApprovedDraft[] = [
  {
    assetId: 'AGT-X-01',
    title: 'What breaks first when AI gets faster?',
    phase: 'tease',
    sourcePatternIds: ['XEV-01', 'XEV-03', 'XEV-04', 'XEV-08'],
    ctaText: null,
    ctaUrl: null,
    threadPosts: [
      'AI got faster.\n\nTrust did not.\n\nThe handoff usually breaks first.',
      'Who gave the agent the work?\nWhat source did it use?\nWhere was the boundary?\nWho approved the public step?\n\nIf the system cannot answer those questions, speed just makes the risk travel faster.',
      'That is the problem Agentified is built around.\n\nThe demo may work. The organization still needs a way to slow down the public handoff before the mistake leaves the building.',
      'Where do AI handoffs lose context fastest in your workflow?\n\nThe source?\nThe boundary?\nThe approval?\nThe receipt?',
    ],
    aminaRationale: 'Keeps the speed-versus-trust tension and uses public X patterns only as a signal for workflow-risk framing.',
    moremiReview: [
      'Source-distance: Pass. Uses the demo-to-production risk pattern without copying creator language.',
      'Privacy and rights: Pass. No private records, screenshots, names, client data, or proprietary source material.',
      'Claim support: Pass. Claims are conceptual and tied to the approved Agentified source basis.',
    ],
  },
  {
    assetId: 'AGT-X-02',
    title: 'The operating layer behind AMINA',
    phase: 'teach',
    sourcePatternIds: ['XEV-02', 'XEV-05', 'XEV-06', 'XEV-07'],
    ctaText: null,
    ctaUrl: null,
    threadPosts: [
      'AMINA is the operating loop I want around agentic work:\n\nAlign the job.\nMap the source.\nInstrument the receipt.\nNegotiate the boundary.\nAudit the result.\n\nThat is how speed becomes reviewable.',
      'Align the job.\n\nWhat is the agent actually being asked to do?\n\nWho owns the outcome if the work is wrong?\n\nIf the job is vague, the output will sound confident and still miss the point.',
      'Map the source.\n\nWhich packet, transcript, record, or approved brief is the agent allowed to use?\n\nMost AI risk starts when the system can reach for context nobody meant to approve.',
      'Instrument the receipt.\n\nA team should be able to see what changed, what source was used, and what decision is waiting.\n\nIf the work cannot leave a receipt, it is hard to govern.',
      'Negotiate the boundary.\n\nSome actions can be drafted by AI.\n\nSome actions need a human gate.\n\nThe system should know the difference before the work moves.',
      'Audit the result.\n\nDid the work improve the workflow, or did it just move faster?\n\nThat is the difference between automation and accountable automation.',
    ],
    aminaRationale: 'Spells out Align, Map, Instrument, Negotiate, and Audit on first use and turns each move into one operating question.',
    moremiReview: [
      'Source-distance: Pass. Uses public framework-thread patterns while preserving original AMINA language and operating questions.',
      'Privacy and rights: Pass. No third-party language, private records, screenshots, or proprietary visuals.',
      'Claim support: Pass. Acronym expansion matches the approved campaign brief.',
    ],
  },
  {
    assetId: 'AGT-X-03',
    title: 'The workbook is the receipt path',
    phase: 'proof',
    sourcePatternIds: ['XEV-03', 'XEV-05'],
    ctaText: null,
    ctaUrl: null,
    threadPosts: [
      'The workbook may be the most practical part of Agentified.\n\nThe book makes the argument.\n\nThe workbook asks the leader to point to the actual system.',
      'Where is the source?\n\nWho owns the role?\n\nWhat is the boundary?\n\nWhere is the gate?\n\nWhat receipt proves the work happened?',
      'Those questions matter because agentic work can sound abstract fast.\n\nMemory. Roles. Routing. Approvals. Evals. Drift checks. Receipts.\n\nThey only become useful when a team can point to the workflow.',
      'That is what I want the Agentified workbook to do.\n\nMove the conversation from "AI can do this" to "we can govern this."',
      'The demo is the spark.\n\nThe proof is the system that can show what happened after the demo.',
    ],
    aminaRationale: 'Keeps the workbook proof from the approved seed and avoids claiming public availability.',
    moremiReview: [
      'Source-distance: Pass. Uses proof-artifact logic without copying public examples.',
      'Privacy and rights: Pass. References the workbook concept only; no asset reuse or private screenshot.',
      'Claim support: Pass with condition. No availability language is added.',
    ],
  },
  {
    assetId: 'AGT-X-04',
    title: 'Agentified release thread: build trust before scale',
    phase: 'offer',
    sourcePatternIds: ['XEV-06', 'XEV-08', 'XEV-09', 'XEV-10'],
    ctaText: 'Follow the Agentified release',
    ctaUrl: 'https://amadutown.com/agentified',
    threadPosts: [
      'Agentified is for the leader who already knows AI can move faster than the organization can govern.',
      'The question has changed.\n\nAgents can produce work.\n\nThe system still has to show what happened before the work reaches customers, clients, or the public.',
      'What happened?\nWho owned it?\nWhat source did it use?\nWhere was the boundary?\nWho approved the public step?\nWhat receipt proves the work improved?',
      'That is why the book keeps coming back to trust.\n\nTrust as a workflow a team can inspect.',
      'Build trust before scale.\n\nThat is the operating principle behind Agentified.',
      'Follow the Agentified release:\n\nhttps://amadutown.com/agentified',
    ],
    aminaRationale: 'Uses a release-thread pattern while keeping the voice authorial and operational.',
    moremiReview: [
      'Source-distance: Pass. Uses the general launch-thread pattern without copying source wording or cadence.',
      'Privacy and rights: Pass. No private examples, screenshots, unpublished third-party material, or proprietary assets.',
      'Claim support: Pass. The public CTA route is the approved release path.',
    ],
  },
]

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function displayThread(posts: string[]) {
  return posts.map((post, index) => `${index + 1}.\n${post}`).join('\n\n')
}

function pickFrameworkVisualType(phase: AgentifiedXApprovedDraft['phase']) {
  if (phase === 'teach') return 'cycle'
  if (phase === 'proof') return 'architecture'
  if (phase === 'offer') return 'timeline'
  return 'before_after'
}

function topicFor(draft: AgentifiedXApprovedDraft, calendar: CalendarRow | undefined) {
  return {
    topic: draft.title,
    angle: calendar?.metadata?.planned_angle ?? draft.aminaRationale,
    key_insight: draft.threadPosts[0],
    personal_tie_in: 'Agentified and Portfolio both center governed agentic work: source, boundary, human gate, and receipt.',
    framework_visual: pickFrameworkVisualType(draft.phase),
  }
}

function ragContextFor(input: {
  draft: AgentifiedXApprovedDraft
  calendar?: CalendarRow
  reviewedByUserId: string
  now: string
}) {
  const planItem = agentifiedLaunchImportPlan().calendar_items.find((item) => item.asset_id === input.draft.assetId)
  return {
    source: 'agentified_x_review_packet',
    source_type: 'approved_x_batch_packet',
    source_packet_path: 'docs/content-strategy/agentified-x-review-packets-2026-08-05.md',
    research_packet_path: 'docs/content-strategy/agentified-x-research-evidence-2026-08-05.md',
    calendar_brief_path: 'docs/content-strategy/agentified-youtube-x-calendar-brief.md',
    campaign_id: input.calendar?.campaign_id ?? planItem?.campaign_slug ?? 'agentified-trust-scale-2026-07',
    campaign_slug: planItem?.campaign_slug ?? 'agentified-trust-scale-2026-07',
    campaign_phase: input.draft.phase,
    calendar_item_id: input.calendar?.id ?? null,
    agentified_asset_id: input.draft.assetId,
    target_profile: '@amadutown',
    x_release: {
      asset_id: input.draft.assetId,
      title: input.draft.title,
      thread_posts: input.draft.threadPosts,
      source_pattern_ids: input.draft.sourcePatternIds,
      scheduled_for: input.calendar?.scheduled_for ?? planItem?.scheduled_for ?? null,
      due_status: input.calendar?.scheduled_for
        ? deriveDueStatus(input.calendar.scheduled_for)
        : null,
      provider_action: 'final_platform_submission_required',
    },
    x_thread_posts: input.draft.threadPosts,
    x_batch_approval: {
      status: 'approved',
      approved_at: input.now,
      approved_by: input.reviewedByUserId,
      approved_scope: [
        'copy',
        'source_distance_review',
        'privacy_review',
      ],
    },
    source_distance_review: {
      status: 'approved',
      pattern_use: 'public_patterns_only',
      source_pattern_ids: input.draft.sourcePatternIds,
      boundary: 'Do not copy creator wording, screenshots, proprietary assets, or private analytics.',
    },
    privacy_review: {
      status: 'approved',
      boundary: 'No private records, credentials, client details, or unpublished third-party assets are included.',
    },
    amina_rationale: input.draft.aminaRationale,
    moremi_review: input.draft.moremiReview,
    provider_boundary: {
      external_posting_authorized: true,
      final_submission_gate_required: true,
      native_future_scheduling_supported: false,
      note: 'The X adapter can post due items after final submit. Future schedule remains represented by Portfolio calendar until a native scheduler exists.',
    },
  }
}

function buildQueueRow(input: {
  draft: AgentifiedXApprovedDraft
  calendar?: CalendarRow
  reviewedByUserId: string
  now: string
}) {
  const scheduledFor = input.calendar?.scheduled_for
    ?? agentifiedLaunchImportPlan().calendar_items.find((item) => item.asset_id === input.draft.assetId)?.scheduled_for
    ?? null
  return {
    platform: 'x',
    status: 'scheduled',
    post_text: displayThread(input.draft.threadPosts),
    cta_text: input.draft.ctaText,
    cta_url: input.draft.ctaUrl,
    hashtags: [],
    topic_extracted: topicFor(input.draft, input.calendar),
    hormozi_framework: {
      framework_type: 'agentified_x_thread',
      hook_type: input.draft.phase === 'tease' ? 'tension_first' : 'framework_or_proof_thread',
      proof_pattern: 'source_boundary_gate_receipt',
      cta_pattern: input.draft.ctaUrl ? 'release_link' : 'conversation_or_soft_pointer',
    },
    rag_context: ragContextFor(input),
    scheduled_for: scheduledFor,
    reviewed_by: input.reviewedByUserId,
    target_platforms: ['x'],
    admin_notes: [
      'Agentified X batch approved by Vambah for AGT-X-01 through AGT-X-04.',
      'External X posting/scheduling authorized, with final platform submission routed through the provider gate.',
      'Native future scheduling is not implemented for X; future rows remain scheduled in Portfolio.',
    ].join('\n'),
    video_generation_method: 'none',
    content_format: 'single_image',
  }
}

export async function seedAgentifiedXApprovedDrafts(params: {
  admin: SupabaseClient
  reviewedByUserId: string
}) {
  const now = new Date().toISOString()
  const { data: calendarRows, error: calendarError } = await params.admin
    .from('social_content_calendar_items')
    .select('id, campaign_id, scheduled_for, authorization_status, metadata')
    .in('channel', ['x'])

  if (calendarError) throw calendarError

  const calendarByAssetId = new Map<string, CalendarRow>()
  for (const row of (calendarRows ?? []) as CalendarRow[]) {
    const assetId = asRecord(row.metadata).agentified_asset_id
    if (typeof assetId === 'string') calendarByAssetId.set(assetId, row)
  }

  const { data: existingRows, error: existingError } = await params.admin
    .from('social_content_queue')
    .select('id, status, scheduled_for, rag_context')
    .contains('rag_context', { source: 'agentified_x_review_packet' })

  if (existingError) throw existingError

  const existingByAssetId = new Map<string, QueueRow>()
  for (const row of (existingRows ?? []) as QueueRow[]) {
    const assetId = asRecord(row.rag_context).agentified_asset_id
    if (typeof assetId === 'string') existingByAssetId.set(assetId, row)
  }

  const seeded: Array<{
    assetId: string
    id: string
    status: string | null
    href: string
    scheduledFor: string | null
    dueForPosting: boolean
    calendarItemId: string | null
  }> = []
  const inserted: string[] = []
  const updated: string[] = []

  for (const draft of AGENTIFIED_X_APPROVED_DRAFTS) {
    const calendar = calendarByAssetId.get(draft.assetId)
    const row = buildQueueRow({
      draft,
      calendar,
      reviewedByUserId: params.reviewedByUserId,
      now,
    })
    const existing = existingByAssetId.get(draft.assetId)

    let saved: QueueRow | null = null
    if (existing) {
      const { data, error } = await params.admin
        .from('social_content_queue')
        .update(row)
        .eq('id', existing.id)
        .select('id, status, scheduled_for, rag_context')
        .single()
      if (error) throw error
      saved = data as QueueRow
      updated.push(saved.id)
    } else {
      const { data, error } = await params.admin
        .from('social_content_queue')
        .insert(row)
        .select('id, status, scheduled_for, rag_context')
        .single()
      if (error) throw error
      saved = data as QueueRow
      inserted.push(saved.id)
    }

    const { error: publishError } = await params.admin
      .from('social_content_publishes')
      .upsert(
        [{ content_id: saved.id, platform: 'x', status: 'pending' }],
        { onConflict: 'content_id,platform', ignoreDuplicates: true },
      )
    if (publishError) throw publishError

    if (calendar?.id) {
      const calendarMetadata = {
        ...asRecord(calendar.metadata),
        social_content_id: saved.id,
        x_batch_approval: {
          status: 'approved',
          approved_at: now,
          approved_by: params.reviewedByUserId,
          review_packet_path: 'docs/content-strategy/agentified-x-review-packets-2026-08-05.md',
        },
      }
      const { error: calendarUpdateError } = await params.admin
        .from('social_content_calendar_items')
        .update({
          social_content_id: saved.id,
          authorization_status: 'authorized',
          due_status: saved.scheduled_for ? deriveDueStatus(saved.scheduled_for) : undefined,
          metadata: calendarMetadata,
        })
        .eq('id', calendar.id)
      if (calendarUpdateError) throw calendarUpdateError
    }

    const scheduledDate = saved.scheduled_for ? new Date(saved.scheduled_for) : null
    seeded.push({
      assetId: draft.assetId,
      id: saved.id,
      status: saved.status,
      href: `/admin/social-content/${saved.id}?step=submit`,
      scheduledFor: saved.scheduled_for,
      dueForPosting: Boolean(scheduledDate && scheduledDate.getTime() <= Date.now()),
      calendarItemId: calendar?.id ?? null,
    })
  }

  return {
    success: true,
    inserted,
    updated,
    seeded,
    dueForPosting: seeded.filter((item) => item.dueForPosting),
    scheduledFuture: seeded.filter((item) => !item.dueForPosting),
    targetProfile: '@amadutown',
    providerBoundary: 'No external X API call was made by seeding. Posting still runs through the final platform submission gate.',
  }
}
