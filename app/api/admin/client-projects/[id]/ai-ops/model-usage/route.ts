import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { buildModelUsageSnapshot } from '@/lib/model-usage'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const searchParams = new URL(request.url).searchParams
  const from = searchParams.get('from') ?? undefined
  const to = searchParams.get('to') ?? undefined

  try {
    const snapshot = await buildModelUsageSnapshot({ from, to, clientProjectId: id })
    return NextResponse.json({
      ok: true,
      clientProjectId: id,
      ...snapshot,
      events: snapshot.clientSafeEvents,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build client model usage snapshot'
    console.error('[client-ai-ops-model-usage] snapshot failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
