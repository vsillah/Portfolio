import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/value-evidence/extract-leads/cancel
 * Set last_vep_status to 'failed' for given contact_submission_ids that are currently 'pending'.
 * Allows users to cancel a stuck extraction and then use Retry.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json().catch(() => ({}))
    const idsInput = body.contact_submission_ids as unknown

    if (!Array.isArray(idsInput) || idsInput.length === 0) {
      return NextResponse.json(
        { error: 'contact_submission_ids is required and must be a non-empty array' },
        { status: 400 }
      )
    }

    const ids = [...new Set(idsInput)].filter(
      (id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0
    )
    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'Each contact_submission_id must be a positive integer' },
        { status: 400 }
      )
    }

    const { data: updated, error } = await supabaseAdmin
      .from('contact_submissions')
      .update({ last_vep_status: 'failed' })
      .eq('last_vep_status', 'pending')
      .in('id', ids)
      .select('id')

    if (error) {
      console.error('Extract-leads cancel update error:', error)
      return NextResponse.json(
        { error: 'Failed to cancel extraction' },
        { status: 500 }
      )
    }

    const cancelledCount = updated?.length ?? 0
    return NextResponse.json({
      cancelled: cancelledCount,
      message: cancelledCount > 0
        ? `Cancelled extraction for ${cancelledCount} contact(s).`
        : 'No pending extractions found for the given contact(s).',
    })
  } catch (err) {
    console.error('Extract-leads cancel error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Cancel failed' },
      { status: 500 }
    )
  }
}
