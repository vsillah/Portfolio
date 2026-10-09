import { createHash } from 'node:crypto'
import type { AgentSlackNotificationInput } from '@/lib/agent-slack-notifications'
import { supabaseAdmin } from '@/lib/supabase'
import { parseMetadata } from '@/lib/social-content-calendar'
import {
  selectSocialContentHistoryReferences,
  type SocialContentCalibrationHistoryRow,
  type SocialContentCalibrationReference,
} from '@/lib/social-content-calibration-library'
import {
  buildLinkedInYoutubeReviewDrafts,
  buildSocialContentEnrichmentReceipt,
  enrichCampaignReviewInsight,
  isSocialContentIntelligenceChannel,
  normalizeSocialChannelLanes,
  socialChannelReviewPublicCopyFields,
} from '@/lib/social-content-intelligence'
import { validateSocialPublicCopyFields } from '@/lib/social-content-lifecycle'
import {
  PRACTITIONER_CONTENT_QUALITY_VERSION,
  requiresPractitionerContentQuality,
  validatePractitionerContentQuality,
} from '@/lib/social-practitioner-content'
import { nextReviewWindow, reviewCadence, reviewWindows, REVIEW_SIDE_EFFECTS, type ReviewProjection, type ReviewRow, type ReviewWindow } from '@/lib/campaign-review-cadence'

type Row = Record<string, any> // Database JSON records are validated before preparing a packet.
const record = parseMetadata
const text = (v: unknown) => typeof v === 'string' ? v : ''
const nextVersion = (value: unknown) => new Date(Math.max(Date.now(), (Date.parse(text(value)) || 0) + 1)).toISOString()
const hash = (v: unknown): string => createHash('sha256').update(JSON.stringify(v, (_k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x)).digest('hex')
const CLAIM_LEASE_MS = 5 * 60 * 1000
const REVIEW_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000
const PRIORITY_WEIGHT = { urgent: 0, high: 1, medium: 2, low: 3 } as const
type PractitionerQualityInput = Parameters<typeof validatePractitionerContentQuality>[0] & { id?: string }

function reviewPriority(value: unknown): ReviewRow['priority'] {
  return value === 'urgent' || value === 'high' || value === 'low' ? value : 'medium'
}

function reviewTriggerAt(calendar: Row) {
  const metadata = record(calendar.metadata)
  return text(metadata.review_trigger_at) || text(metadata.review_due_at) || text(calendar.scheduled_for)
}

function claimIsActive(value: unknown, lineage: string, now: Date) {
  const claim = record(value)
  return claim.status === 'preparing'
    && claim.lineage === lineage
    && Number.isFinite(Date.parse(text(claim.claimed_at)))
    && Date.parse(text(claim.claimed_at)) > now.getTime() - CLAIM_LEASE_MS
}

function packetReadiness(input: {
  insight: Row
  metadata: Row
  socialContent: PractitionerQualityInput
  channel: string
  generatedAt: string
  calibrationReferences: SocialContentCalibrationReference[]
}) {
  const enriched = enrichCampaignReviewInsight({ insight: input.insight, metadata: input.metadata })
  const drafts = buildLinkedInYoutubeReviewDrafts({
    insight: enriched.insight,
    generatedAt: input.generatedAt,
    latestFeedback: record(input.metadata.autoresearch_feedback_latest),
    calibrationReferences: input.calibrationReferences,
  })
  const copyQualityGate = validateSocialPublicCopyFields(socialChannelReviewPublicCopyFields(drafts))
  const enrichmentReceipt = buildSocialContentEnrichmentReceipt({
    insight: enriched.insight,
    copyQualityGate,
    generatedAt: input.generatedAt,
    synthesizedCampaignFields: enriched.synthesizedFields,
    calibrationReferences: input.calibrationReferences,
  })
  for (const draft of Object.values(drafts)) draft.enrichment_receipt = enrichmentReceipt

  if (!isSocialContentIntelligenceChannel(input.channel)) {
    return { packet: null, blockers: ['This channel needs a manual Social Content review.'], practitionerGate: null }
  }
  const packet = drafts[input.channel]
  const practitionerGate = requiresPractitionerContentQuality(input.socialContent)
    ? validatePractitionerContentQuality(input.socialContent)
    : null
  const privacyNotes = packet.orchestration_evidence?.visual_reinforcement.privacy_notes ?? []
  const blockers = [
    ...enrichmentReceipt.blockers,
    ...(enrichmentReceipt.checks.research_frameworks.status === 'passed' ? [] : ['Approved usable-framework receipt is missing.']),
    ...(enrichmentReceipt.checks.voice_calibration.status === 'passed' ? [] : ['Approved voice-calibration receipt is missing.']),
    ...(enrichmentReceipt.checks.editorial_challenger.status === 'passed' ? [] : ['Editorial challenger checks did not pass.']),
    ...(copyQualityGate.status === 'passed' ? [] : copyQualityGate.findings.map(finding => `${finding.label} in ${finding.field}.`)),
    ...(privacyNotes.length ? [] : ['Privacy and source-use boundary is missing.']),
    ...(Object.values(packet.side_effects).every(value => value === false) ? [] : ['External execution must remain disabled.']),
    ...(!practitionerGate
      ? [`Practitioner content quality marker ${PRACTITIONER_CONTENT_QUALITY_VERSION} is missing from the linked Social Content draft.`]
      : practitionerGate.status === 'passed'
        ? []
        : practitionerGate.findings.map(finding => `[${finding.code}] ${finding.message}`)),
  ]
  if (practitionerGate?.status === 'passed') {
    packet.fields.practitioner_content_quality = practitionerGate.record
    packet.fields.practitioner_quality_receipt = {
      version: PRACTITIONER_CONTENT_QUALITY_VERSION,
      status: practitionerGate.status,
      specificity_result: practitionerGate.specificity_result,
      matched_public_details: practitionerGate.matched_public_details,
      validated_at: input.generatedAt,
      social_content_id: text(input.socialContent.id),
    }
  }
  return { packet, blockers: [...new Set(blockers)], practitionerGate }
}
function reviewNotification(id: string, window: ReviewWindow, calendarItemIds: string[]) {
  const input: AgentSlackNotificationInput = { kind: 'review_ready', goalId: 'social-content-calendar', calendarItemIds, dedupeKey: `campaign-review:${id}:${window.key}`, triggerSource: 'campaign_review_backlog' }
  return { ...input, review_path: `/admin/campaigns/${encodeURIComponent(id)}?tab=content-calendar`, delivery_enabled: false, status: 'in_review' }
}
function checked<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message)
  return result.data
}
async function byIds(table: string, ids: string[]): Promise<Row[]> {
  ids = [...new Set(ids)]
  if (!ids.length) return []
  if (ids.length > 500) throw new Error('Too many linked records. Narrow the campaign before preparing a batch.')
  return checked(await supabaseAdmin.from(table).select('*').in('id', [...new Set(ids)])) || []
}
async function load(campaignId: string) {
  const campaign: Row = checked(await supabaseAdmin.from('attraction_campaigns').select('*').eq('id', campaignId).single())
  const calendar: Row[] = checked(await supabaseAdmin.from('social_content_calendar_items').select('*').eq('campaign_id', campaignId).order('created_at').order('id').limit(501)) || []
  if (calendar.length > 500) throw new Error('Campaign exceeds the 500-item review scan. Narrow the calendar before preparing.')
  const workIds = calendar.map(c => text(record(record(c.metadata).platform_draft_handoff).work_item_id)).filter(Boolean)
  const works = await byIds('agent_work_items', workIds)
  const evidenceIds = works.flatMap(w => Array.isArray(record(w.metadata).research_packet_ids) ? record(w.metadata).research_packet_ids as string[] : []).filter(id => typeof id === 'string')
  const [evidence, drafts, calibrationResult] = await Promise.all([
    byIds('social_content_research_packets', evidenceIds),
    byIds('social_content_queue', calendar.map(c => text(c.social_content_id)).filter(Boolean)),
    supabaseAdmin
      .from('social_content_queue')
      .select('id, platform, status, post_text, cta_text, hashtags, topic_extracted, rag_context, content_pillar, target_platforms, published_at, updated_at, created_at')
      .in('status', ['published', 'approved'])
      .order('updated_at', { ascending: false })
      .limit(16),
  ])
  const calibrationRows = checked(calibrationResult) as SocialContentCalibrationHistoryRow[]
  const calibrationReferences = selectSocialContentHistoryReferences(calibrationRows, 3)
  return { campaign, calendar, works, evidence, drafts, calibrationReferences }
}
type Snapshot = Awaited<ReturnType<typeof load>>
function project(s: Snapshot, now: Date): ReviewProjection {
  const anchor = s.calendar[0]
  const config = reviewCadence(record(anchor?.metadata).campaign_review_cadence)
  const horizonStart = Math.max(now.getTime() - REVIEW_LOOKBACK_MS, Date.parse(s.campaign.starts_at) || 0)
  const end = new Date(Math.min(now.getTime() + config.horizon_days * 86400000, Date.parse(s.campaign.ends_at) || Infinity)).toISOString()
  const rows: ReviewRow[] = []
  const seen = new Set<string>()
  for (const c of s.calendar) {
    if (['completed', 'cancelled'].includes(c.due_status)) continue
    const cm = record(c.metadata)
    // An explicit preparation trigger takes precedence over the review date and release milestone.
    const due = reviewTriggerAt(c)
    if (!Number.isFinite(Date.parse(due)) || Date.parse(due) < horizonStart || Date.parse(due) > Date.parse(end)) continue
    const wid = text(record(cm.platform_draft_handoff).work_item_id)
    const w = s.works.find(w => w.id === wid), wm = record(w?.metadata), insight = record(wm.insight)
    const ids = (Array.isArray(wm.research_packet_ids) ? wm.research_packet_ids.filter(id => typeof id === 'string') as string[] : []).sort()
    const evidence = ids.map(id => s.evidence.find(e => e.id === id))
    const lanes = record(wm.channel_lanes), lane = record(lanes[c.channel]), packet = record(lane.draft_packet)
    const draft = s.drafts.find(d => d.id === c.social_content_id)
    const lineage = hash({
      campaign: s.campaign.id,
      calendar: c.id,
      phase: c.campaign_phase,
      channel: c.channel,
      work: wid,
      social: c.social_content_id,
      evidence,
      insight,
      title: c.title,
      angle: c.planned_angle,
      feedback: wm.autoresearch_feedback_latest,
      canonical_content: draft ? {
        post_text: draft.post_text,
        cta_text: draft.cta_text,
        voiceover_text: draft.voiceover_text,
        youtube_title: draft.youtube_title,
        youtube_description: draft.youtube_description,
        hormozi_framework: draft.hormozi_framework,
        practitioner_content_quality: record(draft.rag_context).practitioner_content_quality,
        content_calibration: record(draft.rag_context).content_calibration,
      } : null,
      calibration_references: s.calibrationReferences,
    })
    let href = wid ? `/admin/agents/social-insights/${encodeURIComponent(wid)}?channel=${encodeURIComponent(c.channel)}` : `/admin/agents/content-intelligence?section=calendar&calendar_item=${encodeURIComponent(c.id)}#content-calendar-gate`
    let reason = '', state: ReviewRow['state'] = 'eligible'
    if (s.campaign.status !== 'active') reason = 'Activate the campaign before preparing review batches.'
    else if (c.authorization_status !== 'authorized') reason = 'Authorize this calendar handoff.'
    else if (!w || w.source_type !== 'social_content_calendar_authorization' || wm.draft_handoff_only !== true || wm.calendar_item_id !== c.id || wm.campaign_id !== s.campaign.id || wm.social_content_id !== c.social_content_id || wm.channel !== c.channel || wm.campaign_phase !== c.campaign_phase) reason = 'Recover the authorized calendar handoff.'
    else if (wm.external_execution_enabled === true || Object.keys(REVIEW_SIDE_EFFECTS).some(key => record(wm.side_effects)[key] === true)) reason = 'This handoff has external execution enabled; review its existing controls.'
    else if (!isSocialContentIntelligenceChannel(c.channel)) reason = 'This channel needs a manual Social Content review.'
    else if (!c.social_content_id || !draft) reason = 'Recover the linked Social Content draft.'
    else if (!['draft', 'approved', 'scheduled', 'published'].includes(draft.status)) reason = 'Recover the rejected Social Content draft before preparing.'
    else if (!ids.length || evidence.some(e => !e || e.status !== 'approved' || e.pattern_status !== 'usable_framework' || !text(e.source_url) || !Object.keys(record(e.pattern_packet)).length || (e.expires_at && (!Number.isFinite(Date.parse(e.expires_at)) || Date.parse(e.expires_at) <= now.getTime())))) reason = 'Link current approved, usable research evidence.'
    else if (!Object.keys(insight).length) reason = 'Link approved evidence to complete the insight.'
    else if (['approved', 'published', 'scheduled'].includes(draft.status) || lane.status === 'approved') state = 'reviewed'
    else if (lane.status === 'blocked' && !text(lane.decision_note)) reason = 'Add revision feedback in the existing review panel.'
    if (reason === 'Authorize this calendar handoff.' || reason === 'Recover the authorized calendar handoff.') href = `/admin/agents/content-intelligence?section=calendar&calendar_item=${encodeURIComponent(c.id)}#content-calendar-gate`
    if ((reason === 'This channel needs a manual Social Content review.' || reason === 'Recover the rejected Social Content draft before preparing.') && c.social_content_id) href = `/admin/social-content/${encodeURIComponent(c.social_content_id)}`
    const saved = record(record(wm.rolling_review)[c.channel])
    const claim = record(record(wm.rolling_review_claims)[c.channel])
    if (!reason && state === 'eligible' && lane.status === 'in_review' && packet.approval_status === 'in_review') {
      const source = record(packet.shared_source)
      const packetFields = record(packet.fields)
      const practitionerReceipt = record(packetFields.practitioner_quality_receipt)
      const practitionerRecord = record(packetFields.practitioner_content_quality)
      const existingMatches = source.calendar_item_id === c.id && source.work_item_id === wid && source.campaign_id === s.campaign.id && source.social_content_id === c.social_content_id && source.channel === c.channel
      const practitionerReceiptAttached = practitionerReceipt.version === PRACTITIONER_CONTENT_QUALITY_VERSION
        && practitionerReceipt.status === 'passed'
        && practitionerReceipt.social_content_id === c.social_content_id
        && practitionerRecord.version === PRACTITIONER_CONTENT_QUALITY_VERSION
      if (!practitionerReceiptAttached) {
        reason = 'The prepared packet is missing its passed practitioner-quality receipt. Resolve the linked Social Content checks, then prepare it again.'
        state = 'blocked'
      } else if (saved.lineage === lineage || (!saved.lineage && existingMatches)) state = 'ready'
      else { reason = 'Source changed. Revise this packet in the existing review panel.'; state = 'blocked' }
    }
    if (reason.startsWith('The prepared packet is missing its passed practitioner-quality receipt.') && c.social_content_id) {
      href = `/admin/social-content/${encodeURIComponent(c.social_content_id)}?step=copy`
    }
    if (!reason && state === 'eligible' && claimIsActive(claim, lineage, now)) {
      reason = 'Preparation is already in progress. Retry after the five-minute claim lease expires.'
    }
    // One work/draft/channel lineage can never inflate coverage through duplicate calendar rows.
    const dedupe = [`work:${wid}:${c.channel}`, `draft:${c.social_content_id}:${c.channel}`]
    if (!reason && dedupe.some(key => seen.has(key))) reason = 'Duplicate handoff lineage; use the linked review record.'
    if (!reason) dedupe.forEach(key => seen.add(key))
    if (reason) state = 'blocked'
    rows.push({
      id: c.id,
      title: c.title,
      channel: c.channel,
      phase: c.campaign_phase,
      scheduled_for: due,
      trigger_at: due,
      priority: reviewPriority(cm.review_priority),
      state,
      reason,
      href: s.campaign.status !== 'active' ? `/admin/campaigns/${encodeURIComponent(s.campaign.id)}` : href,
      work_item_id: wid || null,
      social_content_id: c.social_content_id,
      evidence_ids: ids,
      lineage,
      prepared_window: text(saved.window) || null,
      content_version: text(saved.content_version) || null,
    })
  }
  rows.sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] || a.trigger_at.localeCompare(b.trigger_at) || a.id.localeCompare(b.id))
  const ready = rows.filter(r => r.state === 'ready').length
  return { campaign: { id: s.campaign.id, name: s.campaign.name, status: s.campaign.status }, config, anchor_id: anchor?.id || null, batch_remaining: Math.max(0, nextReviewWindow(now, config).limit - rows.filter(r => r.prepared_window === nextReviewWindow(now, config).key).length), rows, ready, eligible: rows.filter(r => r.state === 'eligible').length, blocked: rows.filter(r => r.state === 'blocked').length, gap: Math.max(0, config.target_ready - ready), coverage_days: new Set(rows.filter(r => r.state === 'ready').map(r => new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone }).format(new Date(r.scheduled_for)))).size, horizon_end: end, next_batch: nextReviewWindow(now, config), next_refresh: reviewWindows(now, config).find(w => w.kind === 'refresh' && Date.parse(w.at) >= now.getTime())!, side_effects: REVIEW_SIDE_EFFECTS }
}
export async function getCampaignReviewBacklog(id: string, now = new Date()) { return project(await load(id), now) }

export async function saveCampaignReviewCadence(id: string, value: unknown) {
  const config = reviewCadence(value), s = await load(id), anchor = s.calendar[0]
  if (!anchor) throw new Error('Generate the campaign calendar before setting its cadence.')
  const updated = checked<Row[]>(await supabaseAdmin.from('social_content_calendar_items').update({ updated_at: nextVersion(anchor.updated_at), metadata: { ...record(anchor.metadata), campaign_review_cadence: config } }).eq('id', anchor.id).eq('updated_at', anchor.updated_at).select('id'))
  if (!updated?.length) throw new Error('Calendar changed. Refresh and save the cadence again.')
  return getCampaignReviewBacklog(id)
}

export async function prepareCampaignReviewBatch(id: string, options: {
  now?: Date
  scheduled?: boolean
  dryRun?: boolean
  calendarItemIds?: string[]
  dueOnly?: boolean
} = {}) {
  const now = options.now ?? new Date(), s = await load(id), before = project(s, now)
  const windows = reviewWindows(now, before.config)
  // Scheduled execution only runs today's elapsed review/refresh window. Manual preparation uses the next review window.
  const window: ReviewWindow | undefined = options.scheduled ? windows.find(w => Date.parse(w.at) <= now.getTime()) : before.next_batch
  if (!window || before.campaign.status !== 'active') return {
    ...before,
    prepared_count: 0,
    prepared_items: [],
    blocked_items: [],
    would_prepare_count: 0,
    window: window || null,
    notification: null,
    side_effects: REVIEW_SIDE_EFFECTS,
  }
  const used = before.rows.filter(r => r.prepared_window === window.key).length
  const selectedIds = new Set(options.calendarItemIds ?? [])
  const candidates = before.rows.filter(r => (
    r.state === 'eligible'
      && r.prepared_window !== window.key
      && (!selectedIds.size || selectedIds.has(r.id))
      && (!options.dueOnly || Date.parse(r.trigger_at) <= now.getTime())
  ))
    .sort((a, b) => {
      const priority = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
      if (priority) return priority
      const blocked = (r: ReviewRow) => record(record(s.works.find(w => w.id === r.work_item_id)?.metadata).channel_lanes)[r.channel]
      const revision = window.kind === 'revision'
        ? Number(record(blocked(b)).status === 'blocked') - Number(record(blocked(a)).status === 'blocked')
        : 0
      return revision || a.trigger_at.localeCompare(b.trigger_at) || a.id.localeCompare(b.id)
    }).slice(0, Math.max(0, Math.min(
      window.limit - used,
      selectedIds.size ? selectedIds.size : before.gap,
    )))
  let prepared = 0
  const preparedItems: Array<{ calendar_item_id: string; work_item_id: string; social_content_id: string | null; review_path: string; content_version: string; lineage: string }> = []
  const blockedItems: Array<{ calendar_item_id: string; reason: string; recovery_action: string }> = []
  for (const candidate of candidates) {
    if (options.dryRun) continue
    // Re-read all linked evidence and authorization immediately before writing.
    const current = await load(id), live = project(current, now).rows.find(r => r.id === candidate.id)
    if (!live || live.state !== 'eligible' || live.lineage !== candidate.lineage) {
      if (live?.reason) blockedItems.push({ calendar_item_id: candidate.id, reason: live.reason, recovery_action: live.href })
      continue
    }
    const w = current.works.find(w => w.id === live.work_item_id)!, wm = record(w.metadata)
    const evidence = current.evidence.filter(e => live.evidence_ids.includes(e.id)).map(e => ({ ...e, packet_id: e.id }))
    const insight = { ...record(wm.insight), approved_research_patterns: evidence }
    if (!isSocialContentIntelligenceChannel(live.channel)) {
      blockedItems.push({
        calendar_item_id: live.id,
        reason: 'This channel needs a manual Social Content review.',
        recovery_action: live.href,
      })
      continue
    }
    const socialContent = current.drafts.find(draft => draft.id === live.social_content_id)! as PractitionerQualityInput
    const readiness = packetReadiness({
      insight,
      metadata: wm,
      socialContent,
      channel: live.channel,
      generatedAt: now.toISOString(),
      calibrationReferences: current.calibrationReferences,
    })
    if (!readiness.packet || readiness.blockers.length) {
      blockedItems.push({
        calendar_item_id: live.id,
        reason: readiness.blockers.join(' '),
        recovery_action: live.social_content_id
          ? `/admin/social-content/${encodeURIComponent(live.social_content_id)}?step=copy`
          : live.href,
      })
      continue
    }
    const claimToken = hash({ calendar_item_id: live.id, lineage: live.lineage, claimed_at: now.toISOString() })
    const claimedMetadata = {
      ...wm,
      rolling_review_claims: {
        ...record(wm.rolling_review_claims),
        [live.channel]: {
          status: 'preparing',
          claim_token: claimToken,
          claimed_at: now.toISOString(),
          lineage: live.lineage,
          trigger_at: live.trigger_at,
          priority: live.priority,
        },
      },
    }
    const claimed = checked<Row[]>(await supabaseAdmin
      .from('agent_work_items')
      .update({ updated_at: nextVersion(w.updated_at), metadata: claimedMetadata })
      .eq('id', w.id)
      .eq('updated_at', w.updated_at)
      .select('*'))
    // Compare-and-swap loses safely to another claimant.
    if (!claimed?.length) continue

    const claimedWork = claimed[0]
    const claimedWorkMetadata = record(claimedWork.metadata)
    const packet = readiness.packet
    Object.assign(packet.shared_source, { campaign_id: id, calendar_item_id: live.id, work_item_id: w.id, social_content_id: live.social_content_id, evidence_ids: live.evidence_ids, campaign_phase: live.phase, channel: live.channel })
    const contentVersion = hash({ packet, lineage: live.lineage })
    const lanes = normalizeSocialChannelLanes(claimedWorkMetadata.channel_lanes)
    lanes[live.channel] = { ...lanes[live.channel], status: 'in_review', draft_packet: packet, review_requested_at: now.toISOString(), updated_at: now.toISOString() }
    const reviewPath = live.social_content_id
      ? `/admin/social-content/${encodeURIComponent(live.social_content_id)}?step=copy`
      : `/admin/agents/social-insights/${encodeURIComponent(w.id)}?channel=${encodeURIComponent(live.channel)}`
    const updatedMetadata = {
      ...claimedWorkMetadata,
      channel_lanes: lanes,
      rolling_review_claims: {
        ...record(claimedWorkMetadata.rolling_review_claims),
        [live.channel]: {
          ...record(record(claimedWorkMetadata.rolling_review_claims)[live.channel]),
          status: 'prepared',
          completed_at: now.toISOString(),
          content_version: contentVersion,
        },
      },
      rolling_review: {
        ...record(claimedWorkMetadata.rolling_review),
        [live.channel]: {
          lineage: live.lineage,
          content_version: contentVersion,
          window: window.key,
          prepared_at: now.toISOString(),
          trigger_at: live.trigger_at,
          priority: live.priority,
          status: 'in_review',
          review_path: reviewPath,
          notification: reviewNotification(id, window, [live.id]),
          side_effects: REVIEW_SIDE_EFFECTS,
        },
      },
      review_path: reviewPath,
      external_execution_enabled: false,
      side_effects: REVIEW_SIDE_EFFECTS,
    }
    const updated = checked<Row[]>(await supabaseAdmin
      .from('agent_work_items')
      .update({
        updated_at: nextVersion(claimedWork.updated_at),
        status: 'ready_for_review',
        blocker_summary: null,
        validation_summary: `Receipt-backed ${live.channel} package ${contentVersion.slice(0, 12)} is ready for Human QA.`,
        metadata: updatedMetadata,
      })
      .eq('id', w.id)
      .eq('updated_at', claimedWork.updated_at)
      .select('id'))
    // Final compare-and-swap loses safely to a concurrent review or revision.
    if (updated?.length) {
      prepared++
      preparedItems.push({
        calendar_item_id: live.id,
        work_item_id: w.id,
        social_content_id: live.social_content_id,
        review_path: reviewPath,
        content_version: contentVersion,
        lineage: live.lineage,
      })
    }
  }
  const after = options.dryRun ? before : await getCampaignReviewBacklog(id, now)
  return {
    ...after,
    prepared_count: prepared,
    prepared_items: preparedItems,
    blocked_items: blockedItems,
    would_prepare_count: candidates.length,
    window,
    notification: reviewNotification(id, window, preparedItems.map(row => row.calendar_item_id)),
    side_effects: REVIEW_SIDE_EFFECTS,
  }
}
