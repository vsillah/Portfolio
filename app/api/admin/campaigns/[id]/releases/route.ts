import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { CAMPAIGN_RELEASE_KIND, createCampaignRelease, decideStoredCampaignRelease, getCampaignRelease } from '@/lib/campaign-release-store'
import { parseCampaignManifest } from '@/lib/campaign-release-manifest'
import { campaignReleaseSlackBlocks } from '@/lib/campaign-release-slack'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
type Context = { params: { id: string } }
export async function GET(request: NextRequest, { params }: Context) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const selected = request.nextUrl.searchParams.get('release')
  if (selected) {
    try {
      const record = await getCampaignRelease(z.uuid().parse(selected))
      if (record.manifest.campaignId !== params.id) return NextResponse.json({ error: 'Campaign mismatch.' }, { status: 404 })
      return NextResponse.json({ releases: [record], providerExecutionEnabled: false })
    } catch { return NextResponse.json({ error: 'Release unavailable.' }, { status: 404 }) }
  }
  const { data, error } = await supabaseAdmin.from('agent_runs').select('id,metadata')
    .eq('kind', CAMPAIGN_RELEASE_KIND).eq('subject_id', params.id).order('created_at', { ascending: false }).limit(30)
  if (error) return NextResponse.json({ error: 'Release records unavailable.' }, { status: 503 })
  return NextResponse.json({ releases: (data ?? []).map((row: { metadata: unknown }) => row.metadata), providerExecutionEnabled: false })
}
export async function POST(request: NextRequest, { params }: Context) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const manifest = parseCampaignManifest(await request.json())
    if (manifest.campaignId !== params.id) return NextResponse.json({ error: 'Campaign mismatch.' }, { status: 400 })
    const { data, error } = await supabaseAdmin.from('attraction_campaigns').select('id').eq('id', params.id).single()
    if (error || !data) return NextResponse.json({ error: 'Campaign unavailable.' }, { status: 404 })
    const record = await createCampaignRelease(manifest, auth.user.id)
    return NextResponse.json({ record, blocks: campaignReleaseSlackBlocks(record), slackPosted: false, providerExecutionEnabled: false })
  } catch {
    return NextResponse.json({ error: 'Release could not be prepared. Check manifest fields, dates, duplicate targets, and release identity.' }, { status: 400 })
  }
}
export async function PATCH(request: NextRequest, { params }: Context) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const input = z.object({ releaseId: z.string().uuid(), hash: z.string().regex(/^[a-f0-9]{64}$/), decision: z.enum(['approve', 'hold', 'revise', 'stop']) }).strict().parse(await request.json())
    const current = await getCampaignRelease(input.releaseId)
    if (current.manifest.campaignId !== params.id) return NextResponse.json({ error: 'Campaign mismatch.' }, { status: 400 })
    const record = await decideStoredCampaignRelease(input.releaseId, input.hash, input.decision, `portfolio:${auth.user.id}`)
    return NextResponse.json({ record, providerExecutionEnabled: false })
  } catch {
    return NextResponse.json({ error: 'Decision unconfirmed. Refresh; the release may have changed, expired, or stopped.' }, { status: 409 })
  }
}
