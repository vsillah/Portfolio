import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { setModuleSpunOffRepoUrl } from '@/lib/module-sync-db'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/module-sync/modules/[moduleId]
 * Update spun-off repo URL for a module (stored in DB, editable in UI).
 * Body: { spunOffRepoUrl: string | null }
 * Admin only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { moduleId } = await params
  if (!moduleId?.trim()) {
    return NextResponse.json({ error: 'Missing moduleId' }, { status: 400 })
  }

  let body: { spunOffRepoUrl?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const spunOffRepoUrl =
    body.spunOffRepoUrl === undefined ? undefined : body.spunOffRepoUrl === null || body.spunOffRepoUrl === '' ? null : String(body.spunOffRepoUrl).trim() || null

  const result = await setModuleSpunOffRepoUrl(moduleId.trim(), spunOffRepoUrl ?? null)
  if (result.error) {
    const status = result.error.startsWith('Unknown module') ? 404 : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ ok: true })
}
