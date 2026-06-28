import { NextRequest, NextResponse } from 'next/server'
import { listVisualAssetCandidates } from '@/lib/visual-assets'
import { parseCandidateQuery, requireAdmin } from '../_utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if ('response' in admin) return admin.response

  try {
    const candidates = await listVisualAssetCandidates(parseCandidateQuery(request.url))
    return NextResponse.json({ candidates })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
