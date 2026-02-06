/**
 * API Route: Test Error Management
 * 
 * PATCH /api/testing/errors/[id] - Update error remediation status
 * GET /api/testing/errors/[id] - Get error details
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
 * GET /api/testing/errors/[id]
 * Get error details including remediation info
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const { data: error, error: fetchError } = await supabase
      .from('test_errors')
      .select('*, test_remediation_requests(*)')
      .eq('error_id', id)
      .single()
    
    if (fetchError || !error) {
      return NextResponse.json(
        { error: 'Error not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ error })
    
  } catch (err) {
    console.error('[API] Failed to get error:', err)
    return NextResponse.json(
      { error: 'Failed to get error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/testing/errors/[id]
 * Update error remediation status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { remediation_status } = body
    
    // Validate status
    if (!remediation_status || !VALID_REMEDIATION_STATUSES.includes(remediation_status as RemediationStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_REMEDIATION_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }
    
    // Update the error
    const { data: updated, error: updateError } = await supabase
      .from('test_errors')
      .update({ remediation_status })
      .eq('error_id', id)
      .select()
      .single()
    
    if (updateError) {
      console.error('[API] Failed to update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update error' },
        { status: 500 }
      )
    }
    
    if (!updated) {
      return NextResponse.json(
        { error: 'Error not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      error: updated
    })
    
  } catch (err) {
    console.error('[API] Failed to update error:', err)
    return NextResponse.json(
      { error: 'Failed to update error' },
      { status: 500 }
    )
  }
}
