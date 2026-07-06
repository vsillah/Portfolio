import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { buildModelUsageSnapshot, clientSafeModelUsageSnapshot } from '@/lib/model-usage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const searchParams = new URL(request.url).searchParams
  const from = searchParams.get('from') ?? undefined
  const to = searchParams.get('to') ?? undefined
  const clientProjectId = searchParams.get('clientProjectId') ?? undefined
  const clientSafe = searchParams.get('clientSafe') === 'true'

  try {
    const snapshot = await buildModelUsageSnapshot({ from, to, clientProjectId })
    return NextResponse.json({ ok: true, clientSafe, ...(clientSafe ? clientSafeModelUsageSnapshot(snapshot) : snapshot) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build model usage snapshot'
    console.error('[model-usage] summary failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
