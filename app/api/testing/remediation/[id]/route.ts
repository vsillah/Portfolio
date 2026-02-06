/**
 * API Route: Remediation Request Details
 * 
 * GET /api/testing/remediation/[id] - Get remediation request details
 * POST /api/testing/remediation/[id] - Process/reprocess a remediation request
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRemediationEngine } from '@/lib/testing'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/testing/remediation/[id]
 * Get remediation request details including Cursor task prompt
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Fetch the remediation request
    const { data: remediationRequest, error } = await supabase
      .from('test_remediation_requests')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error || !remediationRequest) {
      return NextResponse.json(
        { error: 'Remediation request not found' },
        { status: 404 }
      )
    }
    
    // Fetch associated errors
    const { data: errors } = await supabase
      .from('test_errors')
      .select('*')
      .in('error_id', remediationRequest.error_ids || [])
    
    // Get Cursor task prompt if applicable
    let cursorTaskPrompt: string | null = null
    if (remediationRequest.cursor_task_id || 
        remediationRequest.options?.output === 'cursor_task') {
      const engine = getRemediationEngine()
      cursorTaskPrompt = await engine.getCursorTaskPrompt(id)
    }
    
    return NextResponse.json({
      request: remediationRequest,
      errors,
      cursorTaskPrompt
    })
    
  } catch (error) {
    console.error('[API] Failed to get remediation request:', error)
    return NextResponse.json(
      { error: 'Failed to get remediation request' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/testing/remediation/[id]
 * Process or reprocess a remediation request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action = 'process' } = body
    
    // Verify the request exists
    const { data: remediationRequest, error } = await supabase
      .from('test_remediation_requests')
      .select('id, status')
      .eq('id', id)
      .single()
    
    if (error || !remediationRequest) {
      return NextResponse.json(
        { error: 'Remediation request not found' },
        { status: 404 }
      )
    }
    
    const engine = getRemediationEngine()
    
    switch (action) {
      case 'process':
      case 'reprocess':
        // Reset status if reprocessing
        if (action === 'reprocess') {
          await supabase
            .from('test_remediation_requests')
            .update({ 
              status: 'pending',
              analysis: null,
              fixes: null,
              started_at: null,
              completed_at: null
            })
            .eq('id', id)
        }
        
        // Process asynchronously
        engine.processRequest(id).catch(err => {
          console.error('[API] Remediation processing failed:', err)
        })
        
        return NextResponse.json({
          success: true,
          message: 'Remediation processing started',
          requestId: id
        })
        
      case 'cancel':
        await supabase
          .from('test_remediation_requests')
          .update({ 
            status: 'rejected',
            outcome: 'rejected',
            outcome_notes: 'Cancelled by user',
            completed_at: new Date().toISOString()
          })
          .eq('id', id)
        
        return NextResponse.json({
          success: true,
          message: 'Remediation request cancelled',
          requestId: id
        })
        
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
    
  } catch (error) {
    console.error('[API] Failed to process remediation request:', error)
    return NextResponse.json(
      { error: 'Failed to process remediation request' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/testing/remediation/[id]
 * Delete a remediation request
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Delete associated history first
    await supabase
      .from('test_error_remediation_history')
      .delete()
      .eq('remediation_request_id', id)
    
    // Delete the request
    const { error } = await supabase
      .from('test_remediation_requests')
      .delete()
      .eq('id', id)
    
    if (error) {
      throw error
    }
    
    return NextResponse.json({
      success: true,
      message: 'Remediation request deleted',
      requestId: id
    })
    
  } catch (error) {
    console.error('[API] Failed to delete remediation request:', error)
    return NextResponse.json(
      { error: 'Failed to delete remediation request' },
      { status: 500 }
    )
  }
}
