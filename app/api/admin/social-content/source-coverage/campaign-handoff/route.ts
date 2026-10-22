import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { prepareOfficialCampaignHandoff, readOfficialCampaignHandoff } from '@/lib/social-official-campaign-store'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const { projection, backlog } = await readOfficialCampaignHandoff()
    return NextResponse.json({ projection, persisted: backlog?.metadata?.official_campaign_handoff ?? null,
      persistence: backlog ? 'saved' : 'not_saved', review_only: true })
  } catch {
    return NextResponse.json({ error: 'Official campaign evidence could not be read. Candidate preparation remains closed.' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await request.json().catch(() => null)
  if (!body || body.action !== 'prepare_review_only')
    return NextResponse.json({ error: 'Only the exact review-only campaign preparation action is supported.' }, { status: 400 })
  try {
    const result = await prepareOfficialCampaignHandoff()
    return NextResponse.json(result, { status: result.projection.status === 'blocked' ? 202 : 200 })
  } catch {
    return NextResponse.json({ error: 'Official campaign handoff could not be persisted. No approval or external action was performed.' }, { status: 503 })
  }
}
