/**
 * API Route: Test Run Results
 * 
 * GET /api/testing/results?runId=xxx - Get detailed results of a completed test run
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('runId')
    const includeSessionDetails = searchParams.get('includeSessionDetails') === 'true'
    
    if (!runId) {
      return NextResponse.json(
        { error: 'runId is required' },
        { status: 400 }
      )
    }
    
    // Fetch test run with results
    const { data: testRun, error: runError } = await supabase
      .from('test_runs')
      .select('*')
      .eq('run_id', runId)
      .single()
    
    if (runError || !testRun) {
      return NextResponse.json(
        { error: 'Test run not found' },
        { status: 404 }
      )
    }
    
    // Fetch all sessions
    let sessionsQuery = supabase
      .from('test_client_sessions')
      .select('*')
      .eq('test_run_id', testRun.id)
      .order('started_at', { ascending: true })
    
    const { data: sessions } = await sessionsQuery
    
    // Fetch all errors
    const { data: errors } = await supabase
      .from('test_errors')
      .select('*')
      .eq('test_run_id', testRun.id)
      .order('occurred_at', { ascending: true })
    
    // Calculate detailed metrics
    const metrics = {
      totalClients: testRun.clients_spawned,
      successfulClients: testRun.clients_completed,
      failedClients: testRun.clients_failed,
      successRate: testRun.clients_spawned > 0 
        ? (testRun.clients_completed / testRun.clients_spawned) * 100 
        : 0,
      totalErrors: errors?.length || 0,
      uniqueErrorTypes: new Set(errors?.map(e => e.error_type) || []).size,
      
      // Duration metrics
      totalDuration: testRun.completed_at
        ? new Date(testRun.completed_at).getTime() - new Date(testRun.started_at).getTime()
        : 0,
      averageSessionDuration: 0,
      
      // Scenario metrics
      scenarioStats: {} as Record<string, {
        total: number
        passed: number
        failed: number
        avgDuration: number
      }>
    }
    
    // Calculate session durations and scenario stats
    if (sessions && sessions.length > 0) {
      let totalSessionDuration = 0
      let completedSessions = 0
      
      for (const session of sessions) {
        const scenario = session.scenario
        
        if (!metrics.scenarioStats[scenario]) {
          metrics.scenarioStats[scenario] = { 
            total: 0, 
            passed: 0, 
            failed: 0, 
            avgDuration: 0 
          }
        }
        
        metrics.scenarioStats[scenario].total++
        
        if (session.status === 'completed') {
          metrics.scenarioStats[scenario].passed++
        } else if (session.status === 'failed') {
          metrics.scenarioStats[scenario].failed++
        }
        
        if (session.completed_at && session.started_at) {
          const duration = new Date(session.completed_at).getTime() - 
                          new Date(session.started_at).getTime()
          totalSessionDuration += duration
          completedSessions++
        }
      }
      
      metrics.averageSessionDuration = completedSessions > 0 
        ? Math.round(totalSessionDuration / completedSessions) 
        : 0
    }
    
    // Group errors by type
    const errorsByType: Record<string, {
      count: number
      scenarios: string[]
      samples: Array<{ message: string; stepType: string }>
    }> = {}
    
    for (const error of errors || []) {
      const type = error.error_type
      if (!errorsByType[type]) {
        errorsByType[type] = { count: 0, scenarios: [], samples: [] }
      }
      
      errorsByType[type].count++
      
      if (!errorsByType[type].scenarios.includes(error.scenario)) {
        errorsByType[type].scenarios.push(error.scenario)
      }
      
      if (errorsByType[type].samples.length < 3) {
        errorsByType[type].samples.push({
          message: error.error_message,
          stepType: error.step_type
        })
      }
    }
    
    // Build response
    const response: Record<string, unknown> = {
      runId: testRun.run_id,
      status: testRun.status,
      startedAt: testRun.started_at,
      completedAt: testRun.completed_at,
      config: testRun.config,
      metrics,
      errorsByType,
      errorCount: errors?.length || 0
    }
    
    // Include session details if requested
    if (includeSessionDetails) {
      response.sessions = sessions?.map(s => ({
        clientId: s.client_id,
        persona: s.persona,
        scenario: s.scenario,
        status: s.status,
        startedAt: s.started_at,
        completedAt: s.completed_at,
        stepsCompleted: s.steps_completed?.length || 0,
        errorCount: s.errors?.length || 0,
        createdResources: {
          chatSessionId: s.created_chat_session_id,
          contactId: s.created_contact_id,
          diagnosticId: s.created_diagnostic_id,
          orderId: s.created_order_id
        }
      }))
      
      response.errors = errors
    }
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('[API] Failed to get test results:', error)
    return NextResponse.json(
      { error: 'Failed to get test results' },
      { status: 500 }
    )
  }
}
