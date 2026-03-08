import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getModuleEntryForDiff } from '@/lib/module-sync-db'
import { runModuleDiff } from '@/lib/module-sync-diff'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/module-sync/diff?module=<moduleId>
 * Run diff between portfolio path and spun-off GitHub repo (default branch).
 * Spun-off repo URL comes from DB (Admin UI). Optional: GITHUB_TOKEN in env.
 * Admin only.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const moduleId = searchParams.get('module')
  if (!moduleId?.trim()) {
    return NextResponse.json(
      { error: 'Missing query parameter: module' },
      { status: 400 }
    )
  }

  const entry = await getModuleEntryForDiff(moduleId.trim())
  if (!entry) {
    return NextResponse.json(
      { error: `Unknown module: ${moduleId}` },
      { status: 404 }
    )
  }

  // Use saved URL or, if none, the suggested URL (so diff works before first Save)
  const effectiveEntry = entry.spunOffRepoUrl
    ? entry
    : { ...entry, spunOffRepoUrl: entry.suggestedSpunOffRepoUrl }

  const projectRoot = process.cwd()
  const githubToken = process.env.GITHUB_TOKEN ?? undefined

  const result = await runModuleDiff(effectiveEntry, projectRoot, githubToken)
  return NextResponse.json(result)
}
