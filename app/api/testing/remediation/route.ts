/**
 * API Route: Error Remediation
 * 
 * POST /api/testing/remediation - Create a new remediation request
 * GET /api/testing/remediation - List remediation requests
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRemediationEngine } from '@/lib/testing'
import type { RemediationOptions, TestErrorContext } from '@/lib/testing'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/testing/remediation
 * Create a new remediation request
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      errorIds,
      output = 'cursor_task',
      autoCreatePR = false,
      targetBranch = 'main',
      assignees = [],
      fixScope = 'minimal',
      includeTests = false,
      requireApproval = true,
      additionalNotes,
      priorityLevel = 'medium'
    } = body
    
    if (!errorIds || errorIds.length === 0) {
      return NextResponse.json(
        { error: 'errorIds is required' },
        { status: 400 }
      )
    }
    
    // Fetch error details
    const { data: errors, error: fetchError } = await supabase
      .from('test_errors')
      .select('*')
      .in('error_id', errorIds)
    
    if (fetchError || !errors || errors.length === 0) {
      return NextResponse.json(
        { error: 'No errors found with the provided IDs' },
        { status: 404 }
      )
    }
    
    // Build options
    const options: RemediationOptions = {
      output: output as RemediationOptions['output'],
      autoCreatePR,
      targetBranch,
      assignees,
      fixScope,
      includeTests,
      requireApproval
    }
    
    // Create remediation request
    const engine = getRemediationEngine()
    const remediationRequest = await engine.createRequest(
      errors as unknown as TestErrorContext[],
      options,
      additionalNotes,
      priorityLevel
    )
    
    // Process the request asynchronously
    engine.processRequest(remediationRequest.id).catch(error => {
      console.error('[API] Remediation processing failed:', error)
    })
    
    return NextResponse.json({
      success: true,
      requestId: remediationRequest.id,
      errorCount: errors.length,
      output,
      message: 'Remediation request created and processing started'
    })
    
  } catch (error) {
    console.error('[API] Failed to create remediation request:', error)
    return NextResponse.json(
      { error: 'Failed to create remediation request' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/testing/remediation
 * List remediation requests
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')
    const testRunId = searchParams.get('testRunId')
    
    let query = supabase
      .from('test_remediation_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (status) {
      query = query.eq('status', status)
    }
    
    if (testRunId) {
      // Get the test run UUID first
      const { data: testRun } = await supabase
        .from('test_runs')
        .select('id')
        .eq('run_id', testRunId)
        .single()
      
      if (testRun) {
        query = query.eq('test_run_id', testRun.id)
      }
    }
    
    const { data, error } = await query
    
    if (error) {
      throw error
    }
    
    return NextResponse.json({
      requests: data,
      count: data?.length || 0
    })
    
  } catch (error) {
    console.error('[API] Failed to list remediation requests:', error)
    return NextResponse.json(
      { error: 'Failed to list remediation requests' },
      { status: 500 }
    )
  }
}
