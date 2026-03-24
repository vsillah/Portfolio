import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { bulkLinkEvidence } from '@/lib/value-evidence-linker'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/value-evidence/calculations/recalculate
 *
 * Bulk-link evidence to calculations and recalculate values where monetary
 * evidence supports it. Optionally scoped to a single category or industry.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const { pain_point_category_id, industry } = body as {
    pain_point_category_id?: string
    industry?: string
  }

  try {
    const result = await bulkLinkEvidence(pain_point_category_id, industry)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Bulk recalculate error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
