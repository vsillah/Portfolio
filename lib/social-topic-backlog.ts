import { generateJsonCompletion } from '@/lib/llm-dispatch'
import { supabaseAdmin } from '@/lib/supabase'
import {
  extractMeetingSummary,
  extractMeetingTitle,
} from '@/lib/social-content'

export type SourceType =
  | 'meeting'
  | 'shipped_feature'
  | 'client_safe_project'
  | 'chronicle_observation'
  | 'chatgpt_session'
  | 'open_brain'
  | 'portfolio_work'

export type TopicSensitivity = 'public_safe' | 'client_safe_summary' | 'needs_review'

export type SocialContentTopicContext = {
  id: string
  status: string
  post_text: string | null
  cta_text: string | null
  hashtags: string[] | null
  image_prompt: string | null
  topic_extracted: unknown
  hormozi_framework: unknown
  rag_context: Record<string, unknown> | null
}

export type SourceSignal = {
  id: string
  type: SourceType
  label: string
  summary: string
  date?: string | null
  sensitivity: TopicSensitivity
}

export type TopicTriggerCandidate = {
  id: string
  title: string
  triggering_event: string
  source_type: SourceType
  source_label: string
  source_ids: string[]
  why_vambah_can_speak: string
  brand_goal: string
  content_angle: string
  suggested_hook: string
  audience: string
  sensitivity: TopicSensitivity
  evidence_summary: string
  claim_boundaries: string[]
}

type DiscoveryResponse = {
  candidates?: unknown
  notes?: unknown
}

export type TopicTriggerPacket = {
  version: 'social_topic_trigger_discovery_v1'
  status: 'review_ready'
  generated_at: string
  generated_by: string | null
  model: string
  provider: string
  source_policy: 'sanitized_summaries_only'
  source_counts: Record<SourceType, number>
  candidates: TopicTriggerCandidate[]
  notes: string[]
  privacy_boundary: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function truncate(value: string, maxLength: number): string {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 3).trim()}...`
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]')
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[phone redacted]')
    .replace(/https?:\/\/[^\s]+/gi, (match) => {
      try {
        const url = new URL(match)
        return `${url.origin}/[private-path-redacted]`
      } catch {
        return '[url redacted]'
      }
    })
}

function sanitizeSummary(value: unknown, maxLength = 700): string {
  return truncate(redactSensitiveText(asString(value)), maxLength)
}

function normalizeTopicSensitivity(value: unknown, fallback: TopicSensitivity): TopicSensitivity {
  if (value === 'public_safe' || value === 'client_safe_summary' || value === 'needs_review') {
    return value
  }
  return fallback
}

function normalizeSourceType(value: unknown): SourceType {
  if (
    value === 'meeting'
    || value === 'shipped_feature'
    || value === 'client_safe_project'
    || value === 'chronicle_observation'
    || value === 'chatgpt_session'
    || value === 'open_brain'
    || value === 'portfolio_work'
  ) {
    return value
  }
  return 'portfolio_work'
}

export function socialTopicSourceCounts(signals: SourceSignal[]) {
  return signals.reduce<Record<SourceType, number>>((counts, signal) => {
    counts[signal.type] = (counts[signal.type] ?? 0) + 1
    return counts
  }, {
    meeting: 0,
    shipped_feature: 0,
    client_safe_project: 0,
    chronicle_observation: 0,
    chatgpt_session: 0,
    open_brain: 0,
    portfolio_work: 0,
  })
}

function normalizeCandidates(parsed: DiscoveryResponse, signals: SourceSignal[]): TopicTriggerCandidate[] {
  const sourceIdSet = new Set(signals.map((signal) => signal.id))
  return (Array.isArray(parsed.candidates) ? parsed.candidates : [])
    .map((item, index) => {
      const record = asRecord(item)
      if (!record) return null
      const sourceType = normalizeSourceType(record.source_type)
      const candidate: TopicTriggerCandidate = {
        id: asString(record.id).trim() || `topic-trigger-${index + 1}`,
        title: truncate(asString(record.title), 90),
        triggering_event: sanitizeSummary(record.triggering_event, 500),
        source_type: sourceType,
        source_label: truncate(asString(record.source_label), 120),
        source_ids: asStringArray(record.source_ids).filter((id) => sourceIdSet.has(id)).slice(0, 4),
        why_vambah_can_speak: sanitizeSummary(record.why_vambah_can_speak, 500),
        brand_goal: truncate(asString(record.brand_goal), 180),
        content_angle: sanitizeSummary(record.content_angle, 450),
        suggested_hook: sanitizeSummary(record.suggested_hook, 280),
        audience: truncate(asString(record.audience), 140),
        sensitivity: normalizeTopicSensitivity(record.sensitivity, sourceType === 'client_safe_project' ? 'client_safe_summary' : 'needs_review'),
        evidence_summary: sanitizeSummary(record.evidence_summary, 500),
        claim_boundaries: asStringArray(record.claim_boundaries).map((boundary) => truncate(boundary, 160)).slice(0, 5),
      }
      if (!candidate.title || !candidate.triggering_event || !candidate.why_vambah_can_speak) return null
      return candidate
    })
    .filter((item): item is TopicTriggerCandidate => Boolean(item))
    .slice(0, 8)
}

function buildDiscoveryPrompt(row: SocialContentTopicContext | null, signals: SourceSignal[]) {
  const ragContext = asRecord(row?.rag_context) ?? {}
  const currentDraft = row ? {
    id: row.id,
    status: row.status,
    post_text: truncate(row.post_text ?? '', 1200),
    cta_text: row.cta_text,
    hashtags: row.hashtags,
    topic_extracted: row.topic_extracted,
    hormozi_framework: row.hormozi_framework,
    rag_context: {
      source: ragContext.source,
      goal_id: ragContext.goal_id,
      content_packet_id: ragContext.content_packet_id,
      open_brain_references: ragContext.open_brain_references,
      chronicle_packet_status: ragContext.chronicle_packet_status,
      chronicle_evidence_notes: ragContext.chronicle_evidence_notes,
      source_provenance_checklist: ragContext.source_provenance_checklist,
    },
  } : {
    mode: 'standing_social_topic_backlog',
    instruction: 'Cull evergreen and timely candidate topics for future Social Content drafts.',
  }

  return `Shaka is Vambah Sillah's Agent Ops Chief of Staff.

Cull potential LinkedIn topic triggers from sanctioned internal summaries.
The goal is to answer: why is Vambah qualified to speak about this topic now?

Return JSON only:
{
  "candidates": [
    {
      "id": "short-stable-id",
      "title": "topic title",
      "triggering_event": "recent event or proof that makes the topic timely",
      "source_type": "meeting | shipped_feature | client_safe_project | chronicle_observation | chatgpt_session | open_brain | portfolio_work",
      "source_label": "human-readable source label",
      "source_ids": ["internal source ids from the provided signals"],
      "why_vambah_can_speak": "why this comes from Vambah's lived work, shipped work, or approved evidence",
      "brand_goal": "how this advances AmaduTown or Vambah's thought leadership",
      "content_angle": "plain-language angle for the draft",
      "suggested_hook": "first-sentence candidate",
      "audience": "primary reader",
      "sensitivity": "public_safe | client_safe_summary | needs_review",
      "evidence_summary": "sanitized evidence summary only",
      "claim_boundaries": ["what to avoid or verify before publishing"]
    }
  ],
  "notes": ["review-only notes"]
}

Rules:
- Do not quote raw private chats, raw Chronicle notes, raw meeting transcripts, emails, phone numbers, account IDs, or private URLs.
- Use only the sanitized summaries and approved packet fields below.
- Prefer concrete triggers: a meeting theme, shipped feature, client-safe project pattern, approved Open Brain reference, or recent Portfolio work.
- Mark anything involving client work, raw Chronicle, or private ChatGPT-derived material as needs_review unless it is already summarized as public-safe.
- These candidates are review-only. Do not publish, schedule, send, call providers, or create drafts outside this packet.

Current Social Content context:
${JSON.stringify(currentDraft, null, 2)}

Sanitized source signals:
${JSON.stringify(signals, null, 2)}

Vambah voice and brand filters:
- Start from a concrete scene, meeting tension, shipped feature, or practical proof.
- Connect the trigger to a larger system problem.
- Keep the topic grounded in product strategy, AI governance, operational reality, access, dignity, and AmaduTown's build-the-system posture.
- Avoid generic AI hype and detached consulting language.`
}

export async function fetchSocialContentTopicContext(id: string) {
  const { data, error } = await supabaseAdmin
    .from('social_content_queue')
    .select('id, status, post_text, cta_text, hashtags, image_prompt, topic_extracted, hormozi_framework, rag_context')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data as SocialContentTopicContext
}

async function fetchRecentMeetingSignals(): Promise<SourceSignal[]> {
  const { data } = await supabaseAdmin
    .from('meeting_records')
    .select('id, meeting_type, meeting_date, created_at, raw_notes, structured_notes')
    .order('meeting_date', { ascending: false })
    .limit(8)

  return (data ?? []).map((meeting: {
    id: string
    meeting_type: string | null
    meeting_date: string | null
    created_at: string | null
    raw_notes: string | null
    structured_notes: Record<string, unknown> | null
  }) => {
    const title = extractMeetingTitle(meeting.raw_notes, meeting.structured_notes) || meeting.meeting_type || 'Recent meeting'
    const summary = extractMeetingSummary(meeting.raw_notes, meeting.structured_notes)
      || sanitizeSummary(meeting.structured_notes?.summary)
      || 'Meeting summary unavailable; use only as an internal lead.'
    return {
      id: `meeting:${meeting.id}`,
      type: 'meeting' as const,
      label: `${title} (${meeting.meeting_date ?? meeting.created_at ?? 'recent'})`,
      date: meeting.meeting_date ?? meeting.created_at,
      summary: sanitizeSummary(summary),
      sensitivity: 'needs_review' as const,
    }
  }).filter((signal: SourceSignal) => signal.summary)
}

async function fetchClientProjectSignals(): Promise<SourceSignal[]> {
  const { data } = await supabaseAdmin
    .from('client_projects')
    .select('id, project_name, product_purchased, project_status, current_phase, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(8)

  return (data ?? []).map((project: {
    id: string
    project_name: string | null
    product_purchased: string | null
    project_status: string | null
    current_phase: string | null
    created_at: string | null
    updated_at: string | null
  }) => ({
    id: `client_project:${project.id}`,
    type: 'client_safe_project' as const,
    label: project.project_name || project.product_purchased || 'Client-safe project',
    date: project.updated_at ?? project.created_at,
    summary: sanitizeSummary([
      project.project_name && `Project: ${project.project_name}`,
      project.product_purchased && `Offer: ${project.product_purchased}`,
      project.project_status && `Status: ${project.project_status}`,
      project.current_phase && `Phase: ${project.current_phase}`,
    ].filter(Boolean).join('. ')),
    sensitivity: 'client_safe_summary' as const,
  })).filter((signal: SourceSignal) => signal.summary)
}

async function fetchAgentRunSignals(): Promise<SourceSignal[]> {
  const { data } = await supabaseAdmin
    .from('agent_runs')
    .select('id, agent_key, kind, title, status, current_step, subject_label, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  return (data ?? []).map((run: {
    id: string
    agent_key: string | null
    kind: string | null
    title: string | null
    status: string | null
    current_step: string | null
    subject_label: string | null
    metadata: Record<string, unknown> | null
    created_at: string | null
  }) => {
    const metadataSummary = sanitizeSummary([
      asString(run.metadata?.goal_id) && `Goal ${asString(run.metadata?.goal_id)}`,
      asString(run.metadata?.workflow) && `Workflow ${asString(run.metadata?.workflow)}`,
      asString(run.metadata?.operation) && `Operation ${asString(run.metadata?.operation)}`,
    ].filter(Boolean).join('. '), 300)
    return {
      id: `agent_run:${run.id}`,
      type: run.kind?.includes('social_content') ? 'shipped_feature' as const : 'portfolio_work' as const,
      label: run.title || run.subject_label || run.kind || 'Agent run',
      date: run.created_at,
      summary: sanitizeSummary([
        run.agent_key && `Agent: ${run.agent_key}`,
        run.kind && `Kind: ${run.kind}`,
        run.status && `Status: ${run.status}`,
        run.current_step && `Step: ${run.current_step}`,
        metadataSummary,
      ].filter(Boolean).join('. ')),
      sensitivity: 'public_safe' as const,
    }
  }).filter((signal: SourceSignal) => signal.summary)
}

async function fetchRecentSocialContentSignals(currentId?: string): Promise<SourceSignal[]> {
  const { data } = await supabaseAdmin
    .from('social_content_queue')
    .select('id, status, topic_extracted, post_text, rag_context, created_at')
    .in('status', ['draft', 'approved', 'published', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(8)

  return (data ?? [])
    .filter((row: { id: string }) => row.id !== currentId)
    .map((row: {
      id: string
      status: string | null
      topic_extracted: Record<string, unknown> | null
      post_text: string | null
      rag_context: Record<string, unknown> | null
      created_at: string | null
    }) => {
      const topic = asString(row.topic_extracted?.topic) || 'Prior Social Content packet'
      const openBrainRefs = asStringArray(row.rag_context?.open_brain_references)
      const chronicleStatus = asString(row.rag_context?.chronicle_packet_status)
      const chronicleNotes = asStringArray(row.rag_context?.chronicle_evidence_notes)
      const type: SourceType = openBrainRefs.length ? 'open_brain' : 'portfolio_work'
      return {
        id: `social_content:${row.id}`,
        type,
        label: topic,
        date: row.created_at,
        summary: sanitizeSummary([
          `Status: ${row.status ?? 'unknown'}`,
          asString(row.topic_extracted?.angle) && `Angle: ${asString(row.topic_extracted?.angle)}`,
          asString(row.topic_extracted?.personal_tie_in) && `Personal tie-in: ${asString(row.topic_extracted?.personal_tie_in)}`,
          openBrainRefs.length && `Approved Open Brain refs: ${openBrainRefs.join(', ')}`,
          chronicleStatus && `Chronicle status: ${chronicleStatus}`,
          chronicleNotes.length && `Chronicle summaries: ${chronicleNotes.slice(0, 3).join(' | ')}`,
          row.post_text && `Draft excerpt: ${truncate(row.post_text, 300)}`,
        ].filter(Boolean).join('. '), 700),
        sensitivity: chronicleNotes.length ? 'needs_review' as const : 'public_safe' as const,
      }
    })
    .filter((signal: SourceSignal) => signal.summary)
}

export async function collectSocialTopicSignals(currentId?: string): Promise<SourceSignal[]> {
  const [meetings, projects, runs, socialContent] = await Promise.all([
    fetchRecentMeetingSignals().catch(() => []),
    fetchClientProjectSignals().catch(() => []),
    fetchAgentRunSignals().catch(() => []),
    fetchRecentSocialContentSignals(currentId).catch(() => []),
  ])

  return [...meetings, ...projects, ...runs, ...socialContent].slice(0, 30)
}

export async function discoverSocialTopicCandidates(options: {
  row?: SocialContentTopicContext | null
  actorId?: string | null
  operation?: string
}) {
  const signals = await collectSocialTopicSignals(options.row?.id)
  if (signals.length === 0) {
    throw new Error('No sanctioned source summaries were available for topic discovery')
  }

  const model = process.env.SOCIAL_TOPIC_DISCOVERY_MODEL || 'gpt-4o-mini'
  const aiResponse = await generateJsonCompletion({
    model,
    systemPrompt: "You are Shaka (Zulu), Vambah Sillah's Chief of Staff. You create review-only Social Content topic trigger packets from sanitized internal evidence.",
    userPrompt: buildDiscoveryPrompt(options.row ?? null, signals),
    temperature: 0.45,
    maxTokens: 1800,
    costContext: {
      reference: options.row
        ? { type: 'social_content_queue', id: options.row.id }
        : { type: 'social_topic_backlog', id: 'standing-topic-scan' },
      metadata: {
        operation: options.operation || 'social_content_topic_trigger_discovery',
        signal_count: signals.length,
        source_counts: socialTopicSourceCounts(signals),
      },
    },
  })

  let parsed: DiscoveryResponse
  try {
    parsed = JSON.parse(aiResponse.content) as DiscoveryResponse
  } catch {
    throw new Error('Topic discovery returned invalid JSON')
  }

  const candidates = normalizeCandidates(parsed, signals)
  if (candidates.length === 0) {
    throw new Error('Topic discovery did not return usable candidates')
  }

  const packet: TopicTriggerPacket = {
    version: 'social_topic_trigger_discovery_v1',
    status: 'review_ready',
    generated_at: new Date().toISOString(),
    generated_by: options.actorId ?? null,
    model: aiResponse.model,
    provider: aiResponse.provider,
    source_policy: 'sanitized_summaries_only',
    source_counts: socialTopicSourceCounts(signals),
    candidates,
    notes: asStringArray(parsed.notes).map((note) => truncate(note, 240)).slice(0, 5),
    privacy_boundary: 'Review-only topic scouting. Raw meetings, Chronicle media, private ChatGPT exports, provider sends, publishing, and scheduling stay out of this action.',
  }

  return { packet, signals }
}

export async function saveTopicTriggerPacketToSocialContent(
  row: SocialContentTopicContext,
  packet: TopicTriggerPacket,
) {
  const ragContext = asRecord(row.rag_context) ?? {}
  const existingCalibration = asRecord(ragContext.content_calibration) ?? {}
  const nextRagContext = {
    ...ragContext,
    content_calibration: {
      ...existingCalibration,
      status: 'topic_triggers_ready',
      topic_trigger_packet: packet,
    },
  }

  const { data: updated, error } = await supabaseAdmin
    .from('social_content_queue')
    .update({ rag_context: nextRagContext })
    .eq('id', row.id)
    .select('*')
    .single()

  if (error || !updated) {
    throw new Error('Failed to save topic trigger packet')
  }

  return updated
}

function candidateKey(candidate: TopicTriggerCandidate) {
  return [
    candidate.id,
    candidate.source_type,
    candidate.source_ids.join('-') || candidate.title,
  ]
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180)
}

export async function upsertSocialTopicBacklog(packet: TopicTriggerPacket, triggerSource: string) {
  const now = new Date().toISOString()
  const rows = packet.candidates.map((candidate) => ({
    candidate_key: candidateKey(candidate),
    title: candidate.title,
    triggering_event: candidate.triggering_event,
    source_type: candidate.source_type,
    source_label: candidate.source_label || null,
    source_ids: candidate.source_ids,
    why_vambah_can_speak: candidate.why_vambah_can_speak,
    brand_goal: candidate.brand_goal || null,
    content_angle: candidate.content_angle || null,
    suggested_hook: candidate.suggested_hook || null,
    audience: candidate.audience || null,
    sensitivity: candidate.sensitivity,
    evidence_summary: candidate.evidence_summary || null,
    claim_boundaries: candidate.claim_boundaries,
    status: 'available',
    source_policy: packet.source_policy,
    source_counts: packet.source_counts,
    generated_by: packet.generated_by,
    generated_at: packet.generated_at,
    last_seen_at: now,
    metadata: {
      trigger_source: triggerSource,
      model: packet.model,
      provider: packet.provider,
      notes: packet.notes,
      privacy_boundary: packet.privacy_boundary,
    },
  }))

  const { data, error } = await supabaseAdmin
    .from('social_topic_backlog')
    .upsert(rows, { onConflict: 'candidate_key' })
    .select('*')

  if (error) {
    throw new Error(error.message || 'Failed to upsert social topic backlog')
  }

  return data ?? []
}

export async function runSocialTopicBacklogDiscovery(options: {
  actorId?: string | null
  triggerSource: string
}) {
  const { packet, signals } = await discoverSocialTopicCandidates({
    actorId: options.actorId ?? null,
    operation: 'social_topic_backlog_discovery',
  })
  const backlogItems = await upsertSocialTopicBacklog(packet, options.triggerSource)
  return {
    packet,
    signals,
    backlogItems,
    sourceCounts: packet.source_counts,
  }
}
