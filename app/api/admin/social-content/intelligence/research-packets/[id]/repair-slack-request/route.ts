import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { requestEvidenceRepairSlackReview } from '@/lib/evidence-repair-slack'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  if (typeof body?.packet_version !== 'string' || typeof body?.binding_hash !== 'string') {
    return NextResponse.json({ error: 'Provide the exact visible review binding before requesting Slack.' }, { status: 400 })
  }
  try {
    const result = await requestEvidenceRepairSlackReview(id, body?.dry_run === true,
      { packetVersion: body.packet_version, bindingHash: body.binding_hash })
    return NextResponse.json(result, { status: result.status === 'uncertain' ? 502 : 200 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Slack review request unavailable.' }, { status: 409 })
  }
}
