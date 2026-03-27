import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getMeetingDetail, isReadAiConfigured } from '@/lib/read-ai'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/read-ai/meetings/:id
 *
 * Returns full meeting detail including transcript, summary, and action items.
 * Used when the user selects a specific meeting to import into enrichment.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const configured = await isReadAiConfigured()
  if (!configured) {
    return NextResponse.json({ error: 'Read.ai integration is not configured' }, { status: 503 })
  }

  try {
    const meeting = await getMeetingDetail(params.id)

    return NextResponse.json({ meeting })
  } catch (err) {
    console.error(`[read-ai/meetings/${params.id}] Fetch failed:`, err)
    const message = err instanceof Error ? err.message : 'Failed to fetch meeting'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
