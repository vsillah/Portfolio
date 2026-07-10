import { NextRequest, NextResponse } from 'next/server'
import {
  captureVisualAssetCandidates,
  regenerateRejectedVisualAssetCandidate,
  type VisualAssetReasonCode,
} from '@/lib/visual-assets'
import { parseJsonBody, requireAdmin } from '../../_utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = await requireAdmin(request)
  if ('response' in admin) return admin.response

  try {
    const body = await parseJsonBody(request)
    const replacementCandidate = await regenerateRejectedVisualAssetCandidate({
      sourceCandidateId: params.id,
      requestedBy: admin.auth.user.id,
      feedback: {
        reason: typeof body.reason === 'string' ? body.reason.trim() : undefined,
        recommendation: typeof body.recommendation === 'string' ? body.recommendation.trim() : undefined,
        reasonCodes: Array.isArray(body.reasonCodes)
          ? body.reasonCodes.filter((reasonCode: unknown): reasonCode is VisualAssetReasonCode => typeof reasonCode === 'string') as VisualAssetReasonCode[]
          : undefined,
      },
    })

    const capture = await captureVisualAssetCandidates({
      candidateIds: [replacementCandidate.id],
      baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : new URL(request.url).origin,
      noStartServer: body.noStartServer !== false,
    })

    return NextResponse.json({ replacementCandidate, capture })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
