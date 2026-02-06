/**
 * API Route: Test Data Cleanup
 * 
 * POST /api/testing/cleanup - Clean up test data
 * DELETE /api/testing/cleanup?runId=xxx - Clean up data for a specific run
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/testing/cleanup
 * Clean up all old test data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { daysOld = 7 } = body
    
    // Use the database function to clean up old data
    const { data, error } = await supabase.rpc('cleanup_old_test_data', {
      days_old: daysOld
    })
    
    if (error) {
      console.error('[API] Cleanup function error:', error)
      // Fall back to manual cleanup
      return await manualCleanup(daysOld)
    }
    
    return NextResponse.json({
      success: true,
      message: `Cleaned up test data older than ${daysOld} days`,
      result: data
    })
    
  } catch (error) {
    console.error('[API] Failed to clean up test data:', error)
    return NextResponse.json(
      { error: 'Failed to clean up test data' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/testing/cleanup
 * Clean up data for a specific test run
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('runId')
    
    if (!runId) {
      return NextResponse.json(
        { error: 'runId is required' },
        { status: 400 }
      )
    }
    
    // Fetch the test run
    const { data: testRun, error: runError } = await supabase
      .from('test_runs')
      .select('id')
      .eq('run_id', runId)
      .single()
    
    if (runError || !testRun) {
      return NextResponse.json(
        { error: 'Test run not found' },
        { status: 404 }
      )
    }
    
    // Fetch all sessions for this run
    const { data: sessions } = await supabase
      .from('test_client_sessions')
      .select('*')
      .eq('test_run_id', testRun.id)
    
    const cleanupResults = {
      chatSessions: 0,
      chatMessages: 0,
      contacts: 0,
      diagnostics: 0,
      orders: 0,
      testErrors: 0,
      testSessions: 0
    }
    
    // Clean up created resources for each session
    for (const session of sessions || []) {
      // Clean up chat data
      if (session.created_chat_session_id) {
        const { count: msgCount } = await supabase
          .from('chat_messages')
          .delete({ count: 'exact' })
          .eq('session_id', session.created_chat_session_id)
        
        cleanupResults.chatMessages += msgCount || 0
        
        const { count: sessCount } = await supabase
          .from('chat_sessions')
          .delete({ count: 'exact' })
          .eq('session_id', session.created_chat_session_id)
        
        cleanupResults.chatSessions += sessCount || 0
      }
      
      // Clean up diagnostic
      if (session.created_diagnostic_id) {
        const { count } = await supabase
          .from('diagnostic_audits')
          .delete({ count: 'exact' })
          .eq('id', session.created_diagnostic_id)
        
        cleanupResults.diagnostics += count || 0
      }
      
      // Clean up contact
      if (session.created_contact_id) {
        const { count } = await supabase
          .from('contact_submissions')
          .delete({ count: 'exact' })
          .eq('id', session.created_contact_id)
        
        cleanupResults.contacts += count || 0
      }
      
      // Clean up order
      if (session.created_order_id) {
        await supabase
          .from('order_items')
          .delete()
          .eq('order_id', session.created_order_id)
        
        const { count } = await supabase
          .from('orders')
          .delete({ count: 'exact' })
          .eq('id', session.created_order_id)
        
        cleanupResults.orders += count || 0
      }
    }
    
    // Delete test errors
    const { count: errorCount } = await supabase
      .from('test_errors')
      .delete({ count: 'exact' })
      .eq('test_run_id', testRun.id)
    
    cleanupResults.testErrors = errorCount || 0
    
    // Delete test sessions
    const { count: sessionCount } = await supabase
      .from('test_client_sessions')
      .delete({ count: 'exact' })
      .eq('test_run_id', testRun.id)
    
    cleanupResults.testSessions = sessionCount || 0
    
    // Delete the test run itself
    await supabase
      .from('test_runs')
      .delete()
      .eq('id', testRun.id)
    
    return NextResponse.json({
      success: true,
      runId,
      cleanupResults
    })
    
  } catch (error) {
    console.error('[API] Failed to clean up test run:', error)
    return NextResponse.json(
      { error: 'Failed to clean up test run' },
      { status: 500 }
    )
  }
}

/**
 * Manual cleanup fallback
 */
async function manualCleanup(daysOld: number): Promise<NextResponse> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysOld)
  
  const cleanupResults = {
    testRuns: 0,
    testSessions: 0,
    testErrors: 0
  }
  
  // Get old test runs
  const { data: oldRuns } = await supabase
    .from('test_runs')
    .select('id')
    .lt('started_at', cutoffDate.toISOString())
  
  if (oldRuns && oldRuns.length > 0) {
    const runIds = oldRuns.map(r => r.id)
    
    // Delete errors
    const { count: errorCount } = await supabase
      .from('test_errors')
      .delete({ count: 'exact' })
      .in('test_run_id', runIds)
    
    cleanupResults.testErrors = errorCount || 0
    
    // Delete sessions
    const { count: sessionCount } = await supabase
      .from('test_client_sessions')
      .delete({ count: 'exact' })
      .in('test_run_id', runIds)
    
    cleanupResults.testSessions = sessionCount || 0
    
    // Delete runs
    const { count: runCount } = await supabase
      .from('test_runs')
      .delete({ count: 'exact' })
      .in('id', runIds)
    
    cleanupResults.testRuns = runCount || 0
  }
  
  return NextResponse.json({
    success: true,
    message: `Cleaned up test data older than ${daysOld} days`,
    result: cleanupResults
  })
}
