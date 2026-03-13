import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { listBrandVoices } from '@/lib/heygen'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const result = await listBrandVoices()
    if (result.error) {
      return NextResponse.json(
        { brandVoices: [], error: result.error },
        { status: 500 }
      )
    }
    return NextResponse.json({ brandVoices: result.brandVoices })
  } catch (error) {
    console.error('[Video generation] Brand voices fetch error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { brandVoices: [], error: message },
      { status: 500 }
    )
  }
}
