import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { collectOfficialLiveSignalPackets, persistPendingOfficialSignalPackets, validOfficialSignalAttribution } from '@/lib/social-official-live-signals'
import { persistPendingPublicSignalMeasurements } from '@/lib/social-public-signal-producer'
import { validatePublicSignalMeasurement } from '@/lib/social-public-signal-measurement'
import { PUBLIC_OBSERVATION_VERSION, publicObservationIdentity, validPublicObservation } from '@/lib/social-public-signal-observation'

export const dynamic = 'force-dynamic'
const LIMIT = 100
const TABLE = 'social_content_research_packets'
type PacketRow = { id: string; title: string; source_url: string; status: string; actor_metadata: Record<string, unknown>; updated_at: string }
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
async function readPackets() {
  const [official, observations] = await Promise.all([
    supabaseAdmin.from(TABLE).select('id, title, source_url, status, actor_metadata, updated_at')
      .contains('actor_metadata', { official_signal: {} }).order('retrieved_at', { ascending: false }).limit(LIMIT),
    supabaseAdmin.from(TABLE).select('id, title, source_url, status, actor_metadata, updated_at')
      .contains('actor_metadata', { public_signal_observation: {} }).order('retrieved_at', { ascending: false }).limit(LIMIT),
  ])
  if (official.error || observations.error) throw new Error('official_signal_read_failed')
  if ((official.data?.length ?? 0) >= LIMIT || (observations.data?.length ?? 0) >= LIMIT) throw new Error('official_signal_result_limit_reached')
  return { official: (official.data ?? []) as PacketRow[], observations: (observations.data ?? []) as PacketRow[] }
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const now = new Date().toISOString()
    const { official, observations } = await readPackets()
    const packets = official.map((packet) => {
      const metadata = record(packet.actor_metadata)
      const signal = record(metadata.official_signal)
      const receipt = metadata.public_signal_measurement_receipt
      const check = validatePublicSignalMeasurement({ stored: receipt, submitted: receipt,
        coverageIdentity: String(signal.coverage_identity ?? ''), officialSourceUrl: packet.source_url, now })
      const priorState = record(metadata.public_signal_measurement_state)
      const matching = observations.filter((row) =>
        record(record(row.actor_metadata).public_signal_observation).coverage_identity === signal.coverage_identity)
      return {
        id: packet.id, title: packet.title, source_url: packet.source_url, status: packet.status,
        updated_at: packet.updated_at, coverage_identity: signal.coverage_identity,
        published_at: signal.published_at, observed_at: signal.observed_at, expires_at: signal.expires_at,
        packet_identity: signal.source_fingerprint, attribution_valid: validOfficialSignalAttribution({
          source_url: packet.source_url, title: packet.title, actor_metadata: metadata,
        }),
        measurement_status: check.valid ? 'Receipt ready' : 'Unscored',
        blocked_reason: check.valid ? null : typeof priorState.reason === 'string' ? priorState.reason
          : receipt ? check.reason : 'measurement_not_attempted',
        observed_value: check.valid ? null : priorState.observed_value ?? null,
        required_value: check.valid ? null : priorState.required_value ?? null,
        owner: priorState.owner ?? 'social_content_research',
        attempt_count: priorState.attempt_count ?? 0,
        max_attempts: 3, measurement_receipt: check.valid ? check.receipt : null,
        observations: matching.map((row) => ({ id: row.id, status: row.status, source_url: row.source_url,
          updated_at: row.updated_at, ...record(record(row.actor_metadata).public_signal_observation) })),
      }
    })
    return NextResponse.json({ packets, review_only: true, release_ready: false,
      exclusions: ['No packet approval', 'No candidate reconciliation', 'No provider or media action', 'No platform draft, schedule, publication, or external send'] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'official_signal_read_failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = record(await request.json().catch(() => null))
  const now = new Date().toISOString()
  try {
    if (body.action === 'measure') {
      if (typeof body.packet_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.packet_id))
        return NextResponse.json({ error: 'Select one pending official packet.' }, { status: 400 })
      const result = await persistPendingPublicSignalMeasurements(now, body.packet_id)
      return NextResponse.json({ ...result, release_ready: false })
    }
    if (body.action === 'collect_official') {
      const result = await collectOfficialLiveSignalPackets({ observedAt: now })
      // Partial public reads are visible blockers; do not persist a partial official scan.
      if (result.blockers.length) return NextResponse.json({ error: 'Official source collection incomplete.', blockers: result.blockers,
        excluded: result.excluded, review_only: true }, { status: 422 })
      if (result.packets.length > 25) return NextResponse.json({ error: 'official_packet_limit_reached' }, { status: 422 })
      const inserted = await persistPendingOfficialSignalPackets(result.packets)
      return NextResponse.json({ discovered: result.packets.length, inserted, excluded: result.excluded,
        review_only: true, release_ready: false })
    }
    if (body.action === 'intake_observation') {
      const input = record(body.observation)
      if (!validPublicObservation(input, now)) return NextResponse.json({ error: 'Source URL, fresh timestamps, exact values, denominators, and a 20–500 character evidence note are required.' }, { status: 400 })
      const rows = await readPackets()
      const official = rows.official.find((packet) => packet.status === 'review_ready'
        && record(record(packet.actor_metadata).official_signal).coverage_identity === input.coverage_identity)
      if (!official || !validOfficialSignalAttribution({ source_url: official.source_url, title: official.title,
        actor_metadata: record(official.actor_metadata) }))
        return NextResponse.json({ error: 'Matching pending official packet is unavailable or unattributable.' }, { status: 422 })
      if (Date.parse(String(record(record(official.actor_metadata).official_signal).expires_at)) <= Date.parse(now))
        return NextResponse.json({ error: 'Official packet is stale. Recollect and review the source.' }, { status: 422 })
      const identity = publicObservationIdentity(input)
      const existing = rows.observations.find((row) =>
        record(record(row.actor_metadata).public_signal_observation).observation_identity === identity)
      if (existing) return NextResponse.json({ packet_id: existing.id, status: existing.status,
        observation_identity: identity, unchanged: true, review_only: true })
      const { data, error } = await supabaseAdmin.from(TABLE).insert({
        source_url: input.source_url, platform: 'other', creator_name: new URL(input.source_url).hostname,
        title: `Public signal observation · ${input.coverage_identity}`,
        status: 'review_ready', pattern_status: 'needs_brand_translation',
        pattern_packet: { source_claim_summary: input.evidence_note.trim() },
        actor_metadata: { public_signal_observation: { version: PUBLIC_OBSERVATION_VERSION,
          ...input, evidence_note: input.evidence_note.trim(), observation_identity: identity,
          official_packet_id: official.id, intake_at: now, intake_by: auth.user.id,
          excluded: false, confidence: 'pending_human_source_review' } },
        privacy_notes: 'Public source URL and numeric observations only. Reviewer must verify both values and denominators at the exact source before approval.',
        retrieved_at: now, created_by: auth.user.id,
      }).select('id, status').single()
      if (error) {
        if (error.code === '23505') return NextResponse.json({ error: 'Concurrent observation intake. Refresh the evidence list.' }, { status: 409 })
        throw new Error('observation_intake_write_failed')
      }
      return NextResponse.json({ packet_id: data.id, status: data.status, observation_identity: identity,
        unchanged: false, review_only: true, release_ready: false })
    }
    return NextResponse.json({ error: 'Unsupported review-only action.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'official_signal_operation_failed' }, { status: 500 })
  }
}
