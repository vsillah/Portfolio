/**
 * API Route: Test Run Status
 * 
 * GET /api/testing/status?runId=xxx - Get status of a specific test run
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
    
    if (!runId) {
      return NextResponse.json(
        { error: 'runId is required' },
        { status: 400 }
      )
    }
    
    // Fetch test run
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
    
    // Fetch client sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('test_client_sessions')
      .select('*')
      .eq('test_run_id', testRun.id)
      .order('started_at', { ascending: false })
    
    // Fetch errors
    const { data: errors, error: errorsError } = await supabase
      .from('test_errors')
      .select('*')
      .eq('test_run_id', testRun.id)
      .order('occurred_at', { ascending: false })
      .limit(20)
    
    // Calculate real-time stats
    const stats = {
      clientsSpawned: testRun.clients_spawned,
      clientsCompleted: testRun.clients_completed,
      clientsFailed: testRun.clients_failed,
      clientsRunning: sessions?.filter(s => s.status === 'running').length || 0,
      successRate: testRun.clients_spawned > 0 
        ? Math.round((testRun.clients_completed / testRun.clients_spawned) * 100) 
        : 0,
      errorCount: errors?.length || 0
    }
    
    // Calculate scenario breakdown
    const scenarioBreakdown: Record<string, { 
      total: number
      passed: number
      failed: number
      running: number 
    }> = {}
    
    for (const session of sessions || []) {
      const scenario = session.scenario
      if (!scenarioBreakdown[scenario]) {
        scenarioBreakdown[scenario] = { total: 0, passed: 0, failed: 0, running: 0 }
      }
      
      scenarioBreakdown[scenario].total++
      
      switch (session.status) {
        case 'completed':
          scenarioBreakdown[scenario].passed++
          break
        case 'failed':
          scenarioBreakdown[scenario].failed++
          break
        case 'running':
          scenarioBreakdown[scenario].running++
          break
      }
    }
    
    // Calculate duration
    const duration = testRun.completed_at
      ? new Date(testRun.completed_at).getTime() - new Date(testRun.started_at).getTime()
      : Date.now() - new Date(testRun.started_at).getTime()
    
    return NextResponse.json({
      runId: testRun.run_id,
      status: testRun.status,
      startedAt: testRun.started_at,
      completedAt: testRun.completed_at,
      duration,
      config: testRun.config,
      stats,
      scenarioBreakdown,
      recentErrors: errors || [],
      sessions: sessions?.slice(0, 10) || [] // Return last 10 sessions
    })
    
  } catch (error) {
    console.error('[API] Failed to get test status:', error)
    return NextResponse.json(
      { error: 'Failed to get test status' },
      { status: 500 }
    )
  }
}
