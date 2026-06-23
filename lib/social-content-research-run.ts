import {
  apifyInputForResearchSource,
  normalizePatternStatus,
  normalizeResearchActorKey,
  normalizeResearchPlatform,
  researchPacketDraftFromApifyItem,
  researchPacketDraftFromRecordedEvidence,
  scoreCreatorAsset,
  SOCIAL_RESEARCH_ACTORS,
  socialMetricsFromUnknown,
  type SocialResearchEvidenceItem,
  type SocialResearchPacketDraft,
  type SocialResearchSource,
} from '@/lib/social-content-intelligence'
import { supabaseAdmin } from '@/lib/supabase'

export type SocialResearchRunMode = 'dry_run' | 'recorded_evidence' | 'apify'

export type SocialResearchRunInput = {
  mode: SocialResearchRunMode
  sources?: SocialResearchSource[]
  evidenceItems?: SocialResearchEvidenceItem[]
  confirmApifyCost?: boolean
  actorId?: string | null
  actorLabel?: string | null
  triggerSource: string
}

export type StoredResearchPacket = {
  id: string
  source_url: string
  platform: string
  title: string | null
  outlier_score: number
}

type ApifyRunResult = {
  items: Record<string, unknown>[]
  run: Record<string, unknown>
}

function apifyToken() {
  return process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN || null
}

function encodeActorId(actorId: string) {
  return actorId.replace('/', '~')
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeSource(value: SocialResearchSource): SocialResearchSource | null {
  const url = asString(value.url)
  if (!url || !/^https?:\/\//i.test(url)) return null
  const actorKey = normalizeResearchActorKey(value.actor_key, url)
  return {
    url,
    actor_key: actorKey,
    platform: value.platform ? normalizeResearchPlatform(value.platform) : SOCIAL_RESEARCH_ACTORS[actorKey].platform,
    label: asString(value.label) || null,
  }
}

async function runApifyActor(input: {
  actorId: string
  payload: Record<string, unknown>
}): Promise<ApifyRunResult> {
  const token = apifyToken()
  if (!token) throw new Error('APIFY_API_TOKEN is not configured')

  const response = await fetch(
    `https://api.apify.com/v2/acts/${encodeActorId(input.actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.payload),
    },
  )

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Apify actor failed (${response.status}): ${text || response.statusText}`)
  }

  const runId = response.headers.get('x-apify-run-id')
  const datasetId = response.headers.get('x-apify-default-dataset-id')
  const parsed = await response.json().catch(() => [])
  const items = Array.isArray(parsed)
    ? parsed.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)))
    : []

  return {
    items,
    run: {
      id: runId,
      defaultDatasetId: datasetId,
    },
  }
}

export function buildSocialResearchRunPlan(sources: SocialResearchSource[]) {
  return sources
    .map(normalizeSource)
    .filter((source): source is SocialResearchSource => Boolean(source))
    .slice(0, 12)
    .map((source) => {
      const actorKey = normalizeResearchActorKey(source.actor_key, source.url)
      const config = SOCIAL_RESEARCH_ACTORS[actorKey]
      return {
        source,
        recommended_method: 'free_first_recorded_evidence',
        free_first_steps: [
          'Use Codex/browser/public page review to capture title, creator, thumbnail reference, metrics, and first-30-second hook where visible.',
          'Store the result as recorded evidence before considering a paid scraper.',
          'Use Apify only when public manual extraction is blocked or too slow for the approved scope.',
        ],
        actor_key: actorKey,
        actor_id: config.actor_id,
        actor_label: config.label,
        platform: source.platform ?? config.platform,
        input: apifyInputForResearchSource(source, config),
      }
    })
}

export async function storeSocialResearchPacket(input: {
  draft: SocialResearchPacketDraft
  createdBy?: string | null
}) {
  const score = scoreCreatorAsset({
    ...socialMetricsFromUnknown(input.draft.metrics),
    retrieved_at: input.draft.retrieved_at,
  })
  const { data, error } = await supabaseAdmin
    .from('social_content_research_packets')
    .insert({
      source_url: input.draft.source_url,
      platform: input.draft.platform,
      creator_name: input.draft.creator_name ?? null,
      creator_handle: input.draft.creator_handle ?? null,
      title: input.draft.title ?? null,
      caption: input.draft.caption ?? null,
      thumbnail_url: input.draft.thumbnail_url ?? null,
      hook_transcript: input.draft.hook_transcript ?? null,
      metrics: input.draft.metrics,
      actor_metadata: input.draft.actor_metadata,
      outlier_score: score.outlier_score,
      score_breakdown: score,
      pattern_packet: input.draft.pattern_packet,
      pattern_status: normalizePatternStatus(input.draft.pattern_status),
      privacy_notes: input.draft.privacy_notes ?? 'Public research packet. Use patterns only.',
      retrieved_at: input.draft.retrieved_at,
      created_by: input.createdBy ?? null,
    })
    .select('id, source_url, platform, title, outlier_score')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to store research packet')
  return data as StoredResearchPacket
}

export async function runSocialContentResearchCollection(input: SocialResearchRunInput) {
  const plan = buildSocialResearchRunPlan(input.sources ?? [])
  const sideEffects = {
    provider_generation: false,
    upload: false,
    publish: false,
    schedule: false,
    external_post: false,
    apify_collection: input.mode === 'apify',
    estimated_scraper_cost_usd: input.mode === 'apify' ? 'variable' : 0,
  }

  if (input.mode === 'dry_run') {
    return {
      ok: true,
      mode: input.mode,
      plan,
      packets: [] as StoredResearchPacket[],
      side_effects: sideEffects,
    }
  }

  const retrievedAt = new Date().toISOString()
  const packets: StoredResearchPacket[] = []

  if (input.mode === 'recorded_evidence') {
    for (const evidence of (input.evidenceItems ?? []).slice(0, 25)) {
      const draft = researchPacketDraftFromRecordedEvidence({
        evidence,
        retrievedAt,
        actorLabel: input.actorLabel ?? null,
      })
      packets.push(await storeSocialResearchPacket({
        draft,
        createdBy: input.actorId ?? null,
      }))
    }
    return {
      ok: true,
      mode: input.mode,
      plan,
      packets,
      side_effects: sideEffects,
    }
  }

  if (!input.confirmApifyCost) {
    throw new Error('Apify collection requires confirm_apify_cost=true; use recorded_evidence for the free-first path')
  }

  for (const step of plan) {
    const config = SOCIAL_RESEARCH_ACTORS[step.actor_key]
    const result = await runApifyActor({
      actorId: step.actor_id,
      payload: step.input,
    })
    for (const item of result.items.slice(0, 10)) {
      const draft = researchPacketDraftFromApifyItem({
        source: step.source,
        config,
        item,
        actorRun: {
          ...result.run,
          trigger_source: input.triggerSource,
          actor_label: input.actorLabel ?? null,
        },
        retrievedAt,
      })
      packets.push(await storeSocialResearchPacket({
        draft,
        createdBy: input.actorId ?? null,
      }))
    }
  }

  return {
    ok: true,
    mode: input.mode,
    plan,
    packets,
    side_effects: sideEffects,
  }
}
