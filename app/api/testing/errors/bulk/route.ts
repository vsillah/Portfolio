/**
 * API Route: Bulk Error Management
 * 
 * PATCH /api/testing/errors/bulk - Update multiple errors at once
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VALID_REMEDIATION_STATUSES = ['pending', 'in_progress', 'fixed', 'ignored', 'wont_fix'] as const
type RemediationStatus = typeof VALID_REMEDIATION_STATUSES[number]

/**
 * PATCH /api/testing/errors/bulk
 * Update multiple errors' remediation status
 * 
 * Body:
 * - error_ids: string[] - Array of error IDs to update
 * - remediation_status: string - New status
 * - remediation_request_id?: string - Optional: update all errors for a remediation request
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { error_ids, remediation_request_id, remediation_status } = body
    
    // Validate status
    if (!remediation_status || !VALID_REMEDIATION_STATUSES.includes(remediation_status as RemediationStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_REMEDIATION_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }
    
    // Must provide either error_ids or remediation_request_id
    if (!error_ids && !remediation_request_id) {
      return NextResponse.json(
        { error: 'Must provide either error_ids or remediation_request_id' },
        { status: 400 }
      )
    }
    
    let query = supabase
      .from('test_errors')
      .update({ remediation_status })
    
    if (remediation_request_id) {
      // Update all errors linked to this remediation request
      query = query.eq('remediation_request_id', remediation_request_id)
    } else if (error_ids && Array.isArray(error_ids)) {
      // Update specific errors by ID
      query = query.in('error_id', error_ids)
    }
    
    const { data: updated, error: updateError } = await query.select()
    
    if (updateError) {
      console.error('[API] Failed to bulk update errors:', updateError)
      return NextResponse.json(
        { error: 'Failed to update errors' },
        { status: 500 }
      )
    }
    
    // Also update the remediation request status if marking as fixed or wont_fix
    if (remediation_request_id && (remediation_status === 'fixed' || remediation_status === 'wont_fix')) {
      const newRequestStatus = remediation_status === 'fixed' ? 'applied' : 'rejected'
      await supabase
        .from('test_remediation_requests')
        .update({ 
          status: newRequestStatus,
          completed_at: new Date().toISOString()
        })
        .eq('id', remediation_request_id)
    }
    
    return NextResponse.json({
      success: true,
      updatedCount: updated?.length || 0,
      errors: updated
    })
    
  } catch (err) {
    console.error('[API] Failed to bulk update errors:', err)
    return NextResponse.json(
      { error: 'Failed to update errors' },
      { status: 500 }
    )
  }
}
