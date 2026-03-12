import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { fetchVideoContextByEmail, fetchVideoContext } from '@/lib/video-context'

export const dynamic = 'force-dynamic'

/**
 * GET /api/video-context?email=... | ?target=...&id=...
 *
 * Returns video personalization context for script generation.
 * Auth: admin session OR N8N_INGEST_SECRET.
 */
export async function GET(request: NextRequest) {
  try {
    const authorized = await authorizeRequest(request)
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')?.trim().toLowerCase()
    const target = searchParams.get('target') as 'client_project' | 'lead' | 'campaign' | null
    const id = searchParams.get('id')?.trim()

    if (email) {
      const ctx = await fetchVideoContextByEmail(email)
      return NextResponse.json(ctx)
    }

    if (target && id) {
      const ctx = await fetchVideoContext(target, id)
      return NextResponse.json(ctx)
    }

    return NextResponse.json(
      { error: 'Provide email= or target= and id=' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[Video context] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function authorizeRequest(request: NextRequest): Promise<boolean> {
  const authResult = await verifyAdmin(request)
  if (!isAuthError(authResult)) return true
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const expected = process.env.N8N_INGEST_SECRET
  return !!(expected && token === expected)
}
