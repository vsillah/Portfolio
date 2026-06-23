import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  runSocialContentResearchCollection,
  type SocialResearchRunMode,
} from '@/lib/social-content-research-run'
import type {
  SocialResearchEvidenceItem,
  SocialResearchSource,
} from '@/lib/social-content-intelligence'
import {
  normalizePatternStatus,
  normalizeResearchActorKey,
  normalizeResearchPlatform,
} from '@/lib/social-content-intelligence'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isMode(value: unknown): value is SocialResearchRunMode {
  return value === 'dry_run' || value === 'recorded_evidence' || value === 'apify'
}

function sourceArray(value: unknown): SocialResearchSource[] {
  return Array.isArray(value)
    ? value.map((item) => asRecord(item))
        .map((item) => ({
          url: asString(item.url),
          platform: item.platform ? normalizeResearchPlatform(item.platform) : null,
          actor_key: item.actor_key ? normalizeResearchActorKey(item.actor_key, asString(item.url)) : null,
          label: asString(item.label) || null,
        }))
        .filter((item) => item.url)
    : []
}

function evidenceArray(value: unknown): SocialResearchEvidenceItem[] {
  return Array.isArray(value)
    ? value.map((item) => asRecord(item))
        .map((item) => ({
          source_url: asString(item.source_url),
          platform: item.platform ? normalizeResearchPlatform(item.platform) : null,
          creator_name: asString(item.creator_name) || null,
          creator_handle: asString(item.creator_handle) || null,
          title: asString(item.title) || null,
          caption: asString(item.caption) || null,
          thumbnail_url: asString(item.thumbnail_url) || null,
          hook_transcript: asString(item.hook_transcript) || null,
          metrics: asRecord(item.metrics),
          pattern_packet: asRecord(item.pattern_packet),
          pattern_status: normalizePatternStatus(item.pattern_status),
          retrieval_method: normalizeRetrievalMethod(item.retrieval_method),
          retrieval_notes: asString(item.retrieval_notes) || null,
        }))
        .filter((item) => item.source_url)
    : []
}

function normalizeRetrievalMethod(value: unknown): SocialResearchEvidenceItem['retrieval_method'] {
  if (
    value === 'codex_browser'
    || value === 'manual_public_review'
    || value === 'public_page_fetch'
    || value === 'apify'
    || value === 'other'
  ) {
    return value
  }
  return 'codex_browser'
}

export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const body = asRecord(await request.json().catch(() => ({})))
  const mode = isMode(body.mode) ? body.mode : 'dry_run'
  const sources = sourceArray(body.sources)
  const evidenceItems = evidenceArray(body.evidence_items)

  if (mode === 'recorded_evidence' && evidenceItems.length === 0) {
    return NextResponse.json({ error: 'evidence_items are required for recorded_evidence mode' }, { status: 400 })
  }
  if ((mode === 'dry_run' || mode === 'apify') && sources.length === 0) {
    return NextResponse.json({ error: 'sources are required for dry_run or apify mode' }, { status: 400 })
  }

  try {
    const result = await runSocialContentResearchCollection({
      mode,
      sources,
      evidenceItems,
      confirmApifyCost: body.confirm_apify_cost === true,
      actorId: authResult.user.id,
      actorLabel: authResult.user.email ?? authResult.user.id,
      triggerSource: mode === 'apify'
        ? 'admin_social_content_intelligence_apify_confirmed'
        : mode === 'recorded_evidence'
          ? 'admin_social_content_intelligence_recorded_evidence'
          : 'admin_social_content_intelligence_dry_run',
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[social-content-intelligence] research run failed:', error)
    const message = error instanceof Error ? error.message : 'Research run failed'
    return NextResponse.json({ error: message }, { status: message.includes('confirm_apify_cost') ? 400 : 500 })
  }
}
