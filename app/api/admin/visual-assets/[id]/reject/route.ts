import { NextRequest, NextResponse } from 'next/server'
import { reviewVisualAssetCandidate, type VisualAssetReasonCode } from '@/lib/visual-assets'
import { parseJsonBody, requireAdmin } from '../../_utils'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = await requireAdmin(request)
  if ('response' in admin) return admin.response

  try {
    const body = await parseJsonBody(request)
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (!reason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
    }
    const candidate = await reviewVisualAssetCandidate({
      id: params.id,
      status: 'rejected',
      reviewedBy: admin.auth.user.id,
      reason,
      recommendation: typeof body.recommendation === 'string' ? body.recommendation.trim() : undefined,
      reasonCodes: Array.isArray(body.reasonCodes)
        ? body.reasonCodes.filter((reasonCode: unknown): reasonCode is VisualAssetReasonCode => typeof reasonCode === 'string') as VisualAssetReasonCode[]
        : undefined,
    })
    return NextResponse.json({ candidate })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
