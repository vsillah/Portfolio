import { NextRequest, NextResponse } from 'next/server'
import { reviewVisualAssetCandidate } from '@/lib/visual-assets'
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
    const candidate = await reviewVisualAssetCandidate({
      id: params.id,
      status: 'approved',
      reviewedBy: admin.auth.user.id,
      reason: typeof body.reason === 'string' ? body.reason : undefined,
    })
    return NextResponse.json({ candidate })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
