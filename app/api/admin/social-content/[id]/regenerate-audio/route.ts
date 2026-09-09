import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/** Legacy external regeneration writes are not version-fenced. Keep native asset attachment usable. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  return NextResponse.json({
    error: 'External audio regeneration is unavailable because its completion workflow can overwrite an active release. Attach a reviewed asset in Portfolio instead.',
    code: 'external_regeneration_unfenced',
    triggered: false,
    recovery_url: `/admin/social-content/${encodeURIComponent(params.id)}?step=visuals#social-visual-assets-gate`,
  }, { status: 409 })
}
