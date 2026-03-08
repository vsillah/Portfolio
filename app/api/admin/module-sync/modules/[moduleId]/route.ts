import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  setModuleSpunOffRepoUrl,
  isCustomModuleId,
  updateCustomModule,
  deleteCustomModule,
} from '@/lib/module-sync-db'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/module-sync/modules/[moduleId]
 * Update spun-off repo URL (and for custom modules, name).
 * Body: { spunOffRepoUrl?: string | null, name?: string }
 * Admin only. Custom modules (UUID) can update name; code-defined only spunOffRepoUrl.
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

  let body: { spunOffRepoUrl?: string | null; name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const id = moduleId.trim()
  const spunOffRepoUrl =
    body.spunOffRepoUrl === undefined
      ? undefined
      : body.spunOffRepoUrl === null || body.spunOffRepoUrl === ''
        ? null
        : String(body.spunOffRepoUrl).trim() || null

  if (isCustomModuleId(id)) {
    const result = await updateCustomModule(id, {
      name: body.name,
      spunOffRepoUrl,
    })
    if (result.error) {
      const status = result.error.startsWith('Unknown module') || result.error.startsWith('Not a custom') ? 404 : 500
      return NextResponse.json({ error: result.error }, { status })
    }
    return NextResponse.json({ ok: true })
  }

  const result = await setModuleSpunOffRepoUrl(id, spunOffRepoUrl ?? null)
  if (result.error) {
    const status = result.error.startsWith('Unknown module') ? 404 : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ ok: true })
}

/**
 * DELETE /api/admin/module-sync/modules/[moduleId]
 * Remove a custom module from the list only (does not delete the GitHub repo).
 * Only custom modules (UUID) can be deleted. Admin only.
 */
export async function DELETE(
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

  const id = moduleId.trim()
  if (!isCustomModuleId(id)) {
    return NextResponse.json(
      { error: 'Only custom modules can be removed. Code-defined modules cannot be deleted.' },
      { status: 400 }
    )
  }

  const result = await deleteCustomModule(id)
  if (result.error) {
    const status = result.error.startsWith('Unknown module') ? 404 : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ ok: true })
}
