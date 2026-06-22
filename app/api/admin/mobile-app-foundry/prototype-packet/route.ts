import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { parseMobileFoundryBacklogRecord } from '@/lib/mobile-app-foundry-work-items'
import {
  buildMobileFoundryPrototypePacket,
  renderMobileFoundryPrototypePacketMarkdown,
} from '@/lib/mobile-app-foundry-prototype-packet'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const record = parseMobileFoundryBacklogRecord(body.backlog_record)
  if (!record) {
    return NextResponse.json(
      { error: 'backlog_record with id, title, audience, job_to_be_done, and vambah_fit_summary is required' },
      { status: 400 },
    )
  }

  const generatedAt = typeof body.generated_at === 'string' ? body.generated_at : undefined
  const packet = buildMobileFoundryPrototypePacket(record, generatedAt)

  return NextResponse.json({
    ok: true,
    mode: 'read_only',
    packet,
    markdown: renderMobileFoundryPrototypePacketMarkdown(packet),
    side_effects: packet.side_effects,
  })
}
