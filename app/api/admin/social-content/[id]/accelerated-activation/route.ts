import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { socialReleaseFingerprint } from '@/lib/social-release-evidence'
import {
  ACCELERATED_ACTIVATION_ITEMS, ACCELERATED_ACTIVATION_SCOPE, ACCELERATED_CAMPAIGN_ID,
  evaluateAcceleratedActivation, isAcceleratedActivationId, approvedRasterUrls, approvedMediaBinding,
} from '@/lib/accelerated-campaign-activation'

export const dynamic = 'force-dynamic'

async function readAsset(url: string): Promise<Buffer> {
  const response = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) })
  if (!response.ok || !response.headers.get('content-type')?.toLowerCase().startsWith('image/png')) throw new Error('Approved PNG unavailable')
  const length = Number(response.headers.get('content-length') || 0)
  if (length > 12_000_000) throw new Error('Approved PNG too large')
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > 12_000_000) throw new Error('Approved PNG too large')
  return bytes
}

async function current(id: string) {
  const admin = supabaseAdmin
  if (!admin) return { error: 'Server configuration unavailable.' }
  const expected = ACCELERATED_ACTIVATION_ITEMS[id as keyof typeof ACCELERATED_ACTIVATION_ITEMS]
  const [itemRead, calendarRead, publishesRead, configRead] = await Promise.all([
    admin.from('social_content_queue').select('*').eq('id', id).maybeSingle(),
    admin.from('social_content_calendar_items').select('*').eq('social_content_id', id),
    admin.from('social_content_publishes').select('*').eq('content_id', id),
    admin.from('social_content_config').select('*').eq('platform', expected.channel).maybeSingle(),
  ])
  if (itemRead.error || calendarRead.error || publishesRead.error || configRead.error) return { error: 'Current activation evidence could not be read.' }
  const calendars = calendarRead.data ?? []
  const calendar = calendars.length === 1 && calendars[0].id === expected.calendarId ? calendars[0] : null
  const result = await evaluateAcceleratedActivation({
    id, item: itemRead.data, calendar, publishes: publishesRead.data ?? [], config: configRead.data, readAsset,
  })
  if (calendars.length !== 1) result.blockers.push('Exactly one approved calendar item must be linked.')
  result.ready = result.blockers.length === 0
  return { result, item: itemRead.data }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!isAcceleratedActivationId(params.id)) return NextResponse.json({ error: 'Outside approved campaign scope.' }, { status: 404 })
  const state = await current(params.id)
  if ('error' in state) return NextResponse.json({ error: state.error }, { status: 503 })
  const enabled = process.env.ACCELERATED_THREE_RECORD_ACTIVATION_ENABLED === 'true'
  return NextResponse.json({ ...state.result, ready: state.result!.ready && enabled, blockers: enabled ? state.result!.blockers : [...state.result!.blockers, 'Campaign activation is disabled in this deployment.'], scope: ACCELERATED_ACTIVATION_SCOPE, campaignId: ACCELERATED_CAMPAIGN_ID })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!isAcceleratedActivationId(params.id)) return NextResponse.json({ error: 'Outside approved campaign scope.' }, { status: 404 })
  if (process.env.ACCELERATED_THREE_RECORD_ACTIVATION_ENABLED !== 'true') return NextResponse.json({ error: 'Campaign activation is disabled.' }, { status: 409 })
  const expected = ACCELERATED_ACTIVATION_ITEMS[params.id]
  const body = await request.json().catch(() => null)
  if (!body || body.scope !== ACCELERATED_ACTIVATION_SCOPE || body.campaign_id !== ACCELERATED_CAMPAIGN_ID
    || body.content_id !== params.id || body.calendar_item_id !== expected.calendarId
    || body.channel !== expected.channel || body.scheduled_for !== expected.scheduledFor
    || body.copy_sha256 !== expected.copyHash || typeof body.expected_updated_at !== 'string') {
    return NextResponse.json({ error: 'Exact approved activation binding is required.' }, { status: 400 })
  }
  const state = await current(params.id)
  if ('error' in state) return NextResponse.json({ error: state.error }, { status: 503 })
  if (!state.result!.ready || !state.item || state.item.updated_at !== body.expected_updated_at) {
    return NextResponse.json({ error: 'Activation evidence changed or is incomplete.', blockers: state.result!.blockers }, { status: 409 })
  }
  const now = new Date().toISOString()
  const assetUrls = approvedRasterUrls(expected.assetCount)
  const mediaBinding = approvedMediaBinding(expected.assetCount)
  const context = state.item.rag_context as Record<string, unknown>
  const nextContext = {
    ...context,
    accelerated_campaign_activation: {
      scope: ACCELERATED_ACTIVATION_SCOPE, campaign_id: ACCELERATED_CAMPAIGN_ID,
      calendar_item_id: expected.calendarId, channel: expected.channel,
      scheduled_for: expected.scheduledFor, copy_sha256: expected.copyHash,
      asset_sha256: state.result!.assetHashes,
      asset_urls: assetUrls,
      source_manifest_sha256: '6cc68cc04befaeee4e946db98c3610d3152e5cec56dc63fa6f1b00047ba34297',
      jit_packet_sha256: '039488c2ef7fa22f6872617f70060893c49d03ee0936170379a44a2e1f9a18b8',
      activated_at: now, activated_by: auth.user.id,
      fee_usd: 0, no_spend: true,
    },
  }
  const candidate = { ...state.item, ...mediaBinding, status: 'scheduled', scheduled_for: expected.scheduledFor, reviewed_by: auth.user.id, rag_context: nextContext }
  const approvedContext = {
    ...nextContext,
    platform_submission_gate: {
      status: 'approved', approved_at: now, approved_by: auth.user.id,
      approved_version: state.item.updated_at, approved_fingerprint: socialReleaseFingerprint(candidate),
      platforms: [expected.channel], submit_after_approval: false,
      decision_note: 'Exact three-record Accelerated campaign schedule only; no immediate submission.',
    },
  }
  // A pending row carries no provider side effect. If the following CAS fails, the
  // receipt remains and the route fails closed until an operator reconciles it.
  const { error: publishError } = await supabaseAdmin.from('social_content_publishes')
    .insert({ content_id: params.id, platform: expected.channel, status: 'pending' })
  if (publishError) return NextResponse.json({ error: 'Publish receipt could not be prepared. No schedule was saved.' }, { status: 409 })
  const { data: saved, error: saveError } = await supabaseAdmin.from('social_content_queue')
    .update({ ...mediaBinding, status: 'scheduled', scheduled_for: expected.scheduledFor, reviewed_by: auth.user.id, rag_context: approvedContext })
    .eq('id', params.id).eq('status', 'draft').eq('updated_at', body.expected_updated_at)
    .is('scheduled_for', null).select('id, status, scheduled_for, updated_at').maybeSingle()
  if (saveError || !saved) return NextResponse.json({ error: 'Schedule claim was not confirmed. Reconcile the pending receipt before retrying.' }, { status: 409 })
  return NextResponse.json({ scheduled: true, item: saved, scope: ACCELERATED_ACTIVATION_SCOPE, platform: expected.channel, fee_usd: 0 })
}
