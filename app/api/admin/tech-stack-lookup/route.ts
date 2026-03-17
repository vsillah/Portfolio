import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { fetchTechStackByDomain, domainForLookup } from '@/lib/tech-stack-lookup'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/tech-stack-lookup?domain=example.com
 * Fetches website tech stack via BuiltWith so sales doesn't need to ask during calls.
 * Admin-only.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const domain = searchParams.get('domain')
  if (!domain || !domain.trim()) {
    return NextResponse.json(
      { error: 'Missing or empty query parameter: domain' },
      { status: 400 }
    )
  }

  const normalized = domainForLookup(domain.trim())
  if (!normalized) {
    return NextResponse.json(
      { error: 'Invalid domain. Use a hostname or URL (e.g. example.com or https://example.com).' },
      { status: 400 }
    )
  }

  const result = await fetchTechStackByDomain(normalized)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, domain: result.domain, creditsRemaining: result.creditsRemaining },
      { status: 422 }
    )
  }

  return NextResponse.json({
    domain: result.domain,
    technologies: result.technologies,
    byTag: result.byTag,
    creditsRemaining: result.creditsRemaining,
  })
}
