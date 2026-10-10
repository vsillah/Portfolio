import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { approveSocialContentItem, SocialContentApprovalError } from '@/lib/social-content-approval'
import { isPractitionerContentQaFixtureId } from '@/lib/social-practitioner-content-qa-fixture'
import { isTopicSourceCoverageQaFixtureId } from '@/lib/social-topic-source-coverage-qa-fixture'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/social-content/[id]/approve
 * Approve content and prepare internal handoff/publish records without external execution.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (isPractitionerContentQaFixtureId(params.id) || isTopicSourceCoverageQaFixtureId(params.id)) {
      return NextResponse.json({
        error: 'Synthetic preview fixture is read-only and cannot be approved.',
        fixture: true,
        blocked: true,
      }, { status: 409 })
    }
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const admin = supabaseAdmin
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const result = await approveSocialContentItem({
      admin,
      id: params.id,
      reviewedByUserId: authResult.user.id,
      expectedCopyVersion: body.expected_copy_version,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof SocialContentApprovalError) {
      return NextResponse.json(error.payload, { status: error.status })
    }
    console.error('Error in POST /api/admin/social-content/[id]/approve:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
