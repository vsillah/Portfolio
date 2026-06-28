import { NextRequest, NextResponse } from 'next/server'
import { captureVisualAssetCandidates } from '@/lib/visual-assets'
import { parseCandidateIds, parseJsonBody, requireAdmin } from '../_utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if ('response' in admin) return admin.response

  try {
    const body = await parseJsonBody(request)
    const result = await captureVisualAssetCandidates({
      candidateIds: parseCandidateIds(body.candidateIds),
      baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : new URL(request.url).origin,
      noStartServer: body.noStartServer !== false,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
