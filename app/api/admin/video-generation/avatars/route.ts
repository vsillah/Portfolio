import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { listAvatars } from '@/lib/heygen'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const result = await listAvatars()
    if (result.error) {
      return NextResponse.json(
        { avatars: [], error: result.error },
        { status: 500 }
      )
    }
    return NextResponse.json({ avatars: result.avatars })
  } catch (error) {
    console.error('[Video generation] Avatars fetch error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { avatars: [], error: message },
      { status: 500 }
    )
  }
}
