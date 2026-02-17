import { NextRequest, NextResponse } from 'next/server'
import { validateDashboardToken } from '@/lib/client-dashboard'
import { dismissRecommendation, convertRecommendation } from '@/lib/acceleration-engine'

/**
 * PATCH /api/client/dashboard/[token]/accelerators/[recId]
 * Client interactions with acceleration recommendations.
 * Actions: 'dismiss' (hide) or 'convert' (clicked CTA).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; recId: string }> }
) {
  const { token, recId } = await params

  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Invalid dashboard link' }, { status: 400 })
  }

  const { projectId, error: tokenError } = await validateDashboardToken(token)
  if (!projectId) {
    return NextResponse.json({ error: tokenError || 'Invalid token' }, { status: 404 })
  }

  let body: { action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { action } = body
  if (!action || !['dismiss', 'convert'].includes(action)) {
    return NextResponse.json(
      { error: 'Invalid action. Must be dismiss or convert' },
      { status: 400 }
    )
  }

  if (action === 'dismiss') {
    const { success } = await dismissRecommendation(recId, projectId)
    return NextResponse.json({ success })
  }

  if (action === 'convert') {
    const { success, ctaUrl } = await convertRecommendation(recId, projectId)
    return NextResponse.json({ success, ctaUrl })
  }

  return NextResponse.json({ success: false }, { status: 400 })
}
