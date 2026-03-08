import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { runModuleSyncScan } from '@/lib/module-sync-scan'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/module-sync/scan
 * Discover spin-off candidates via GitHub API (tree of default branch).
 * Admin only. Requires GITHUB_REPO and GITHUB_TOKEN (contents:read).
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const result = await runModuleSyncScan()
  if (result.error) {
    const status = result.error.includes('rate limit') ? 429 : 400
    const res = NextResponse.json(
      { error: result.error, candidates: [], rateLimitRetryAfter: result.rateLimitRetryAfter },
      { status }
    )
    if (result.rateLimitRetryAfter != null) {
      res.headers.set('Retry-After', String(result.rateLimitRetryAfter))
    }
    return res
  }

  return NextResponse.json({
    candidates: result.candidates,
    ...(result.rateLimitRetryAfter != null && { rateLimitRetryAfter: result.rateLimitRetryAfter }),
  })
}
