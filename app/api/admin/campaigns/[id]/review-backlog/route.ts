import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getCampaignReviewBacklog, prepareCampaignReviewBatch, saveCampaignReviewCadence } from '@/lib/campaign-review-backlog'
export const dynamic = 'force-dynamic'
async function handle(request: NextRequest, id: string) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    if (request.method === 'GET') return NextResponse.json(await getCampaignReviewBacklog(id))
    const body = await request.json()
    if (request.method === 'PATCH') return NextResponse.json(await saveCampaignReviewCadence(id, body.config))
    if (body.action !== 'prepare') return NextResponse.json({ error: 'Choose prepare.' }, { status: 400 })
    return NextResponse.json(await prepareCampaignReviewBatch(id))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Review backlog unavailable. Refresh and retry.' }, { status: 409 })
  }
}
export const GET = (r: NextRequest, { params }: { params: { id: string } }) => handle(r, params.id)
export const POST = GET
export const PATCH = GET
