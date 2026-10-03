import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { assembleCampaignReleasePacket, releasePacketRequestSchema, verifyCampaignReleasePacket, type ReleaseSourceReader } from '@/lib/campaign-release-packet'

export const dynamic = 'force-dynamic'
/** Read-only preparation. Saving and exact-hash approval remain separate existing operations. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const input = releasePacketRequestSchema.parse(await request.json())
    if (input.campaignId !== params.id) return NextResponse.json({ error: 'Campaign mismatch.' }, { status: 400 })
    const read: ReleaseSourceReader = async (table, id) => {
      const { data, error } = await supabaseAdmin.from(table).select('*').eq('id', id).single()
      if (error || !data) throw new Error('Canonical source unavailable.')
      return data
    }
    const packet = await assembleCampaignReleasePacket(input, read)
    await verifyCampaignReleasePacket(packet, read)
    return NextResponse.json({ packet, saved: false, providerExecutionEnabled: false })
  } catch {
    return NextResponse.json({ error: 'Assembly blocked. Check campaign links, final copy/media, recipient evidence, and channel review. No release saved.' }, { status: 409 })
  }
}
