import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { campaignSlackProjection, routeCampaignToSlack } from '@/lib/campaign-slack-bridge'
export const dynamic = 'force-dynamic'
type Context = { params: { id: string } }
export async function GET(request: NextRequest, { params }: Context) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const releaseId = z.string().uuid().parse(request.nextUrl.searchParams.get('release'))
    return NextResponse.json(await campaignSlackProjection(params.id, releaseId))
  } catch { return NextResponse.json({ error: 'Slack outcome unavailable. Refresh before retrying.' }, { status: 503 }) }
}
export async function POST(request: NextRequest, { params }: Context) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const input = z.object({ releaseId: z.string().uuid(), hash: z.string().regex(/^[a-f0-9]{64}$/),
      version: z.number().int().positive().max(9999999999), dispatch: z.boolean() }).strict().parse(await request.json())
    const result = await routeCampaignToSlack({ ...input, campaignId: params.id, actor: auth.user.id })
    return NextResponse.json({ ...result, providerExecutionEnabled: false })
  } catch { return NextResponse.json({ error: 'Slack request unconfirmed. Refresh the release and receipt before retrying.' }, { status: 409 }) }
}
