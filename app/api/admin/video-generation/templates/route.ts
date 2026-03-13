import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { listTemplates } from '@/lib/heygen'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const result = await listTemplates()
    if (result.error) {
      return NextResponse.json(
        { templates: [], error: result.error },
        { status: 500 }
      )
    }
    return NextResponse.json({ templates: result.templates })
  } catch (error) {
    console.error('[Video generation] Templates fetch error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { templates: [], error: message },
      { status: 500 }
    )
  }
}
