/**
 * API Route: Start a Test Run
 * 
 * POST /api/testing/run - Start a new E2E test run
 * GET /api/testing/run - List recent test runs
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { 
  createOrchestrator, 
  ALL_SCENARIOS, 
  ALL_PERSONAS,
  CRITICAL_SCENARIOS,
  SMOKE_TEST_SCENARIOS,
  SCENARIOS_BY_ID,
  PERSONAS_BY_ID
} from '@/lib/testing'
import type { OrchestratorConfig, TestScenario, TestPersona } from '@/lib/testing'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Store active orchestrators (in production, use Redis or similar)
const activeOrchestrators = new Map<string, ReturnType<typeof createOrchestrator>>()

/**
 * POST /api/testing/run
 * Start a new test run
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      // Scenario selection
      scenarioIds,  // Specific scenario IDs to run
      scenarioPreset,  // 'all', 'critical', 'smoke', 'chat', 'ecommerce'
      
      // Persona selection
      personaIds,  // Specific persona IDs to use
      
      // Configuration
      maxConcurrentClients = 3,
      spawnInterval = 5000,
      runDuration = 60000,
      maxClients,
      cleanupAfter = true,
      
      // Notes
      notes
    } = body
    
    // Determine scenarios to run
    let scenarios: TestScenario[] = []
    
    if (scenarioIds && scenarioIds.length > 0) {
      scenarios = scenarioIds
        .map((id: string) => SCENARIOS_BY_ID[id])
        .filter(Boolean)
    } else if (scenarioPreset) {
      switch (scenarioPreset) {
        case 'all':
          scenarios = ALL_SCENARIOS
          break
        case 'critical':
          scenarios = CRITICAL_SCENARIOS
          break
        case 'smoke':
          scenarios = SMOKE_TEST_SCENARIOS
          break
        default:
          scenarios = ALL_SCENARIOS
      }
    } else {
      scenarios = ALL_SCENARIOS
    }
    
    if (scenarios.length === 0) {
      return NextResponse.json(
        { error: 'No valid scenarios selected' },
        { status: 400 }
      )
    }
    
    // Determine personas to use
    let personas: TestPersona[] = []
    
    if (personaIds && personaIds.length > 0) {
      personas = personaIds
        .map((id: string) => PERSONAS_BY_ID[id])
        .filter(Boolean)
    } else {
      personas = ALL_PERSONAS
    }
    
    if (personas.length === 0) {
      personas = ALL_PERSONAS
    }
    
    // Create orchestrator config
    const config: OrchestratorConfig = {
      maxConcurrentClients,
      spawnInterval,
      scenarios: scenarios.map(scenario => ({
        scenario,
        weight: 1,
        personaPool: personas
      })),
      runDuration,
      maxClients,
      testDataPrefix: 'test_e2e_',
      cleanupAfter,
      headless: true,
      screenshotOnFailure: true,
      captureNetworkHar: false
    }
    
    // Create and start orchestrator
    const orchestrator = createOrchestrator(config)
    
    // Store reference
    const runId = `e2e_${Date.now()}`
    
    // Start asynchronously
    orchestrator.start().catch(error => {
      console.error(`[API] Test run ${runId} failed to start:`, error)
    })
    
    // Get stats after brief delay to ensure DB record is created
    await new Promise(resolve => setTimeout(resolve, 500))
    const stats = orchestrator.getStats()
    
    activeOrchestrators.set(stats.runId, orchestrator)
    // #endregion
    
    // Schedule cleanup of orchestrator reference
    setTimeout(() => {
      activeOrchestrators.delete(stats.runId)
    }, runDuration + 60000)
    
    return NextResponse.json({
      success: true,
      runId: stats.runId,
      config: {
        scenarios: scenarios.map(s => s.id),
        personas: personas.map(p => p.id),
        maxConcurrentClients,
        runDuration
      },
      message: `Test run started with ${scenarios.length} scenarios and ${personas.length} personas`
    })
    
  } catch (error) {
    console.error('[API] Failed to start test run:', error)
    return NextResponse.json(
      { error: 'Failed to start test run', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/testing/run
 * List recent test runs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')
    
    let query = supabase
      .from('test_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit)
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data, error } = await query
    
    if (error) {
      throw error
    }
    
    // Include stats for active runs
    const enrichedData = data.map(run => {
      const orchestrator = activeOrchestrators.get(run.run_id)
      if (orchestrator) {
        return {
          ...run,
          liveStats: orchestrator.getStats()
        }
      }
      return run
    })
    
    return NextResponse.json({
      runs: enrichedData,
      activeRuns: Array.from(activeOrchestrators.keys())
    })
    
  } catch (error) {
    console.error('[API] Failed to list test runs:', error)
    return NextResponse.json(
      { error: 'Failed to list test runs' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/testing/run
 * Stop a running test
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
    
    const orchestrator = activeOrchestrators.get(runId)
    
    if (!orchestrator) {
      return NextResponse.json(
        { error: 'Test run not found or already completed' },
        { status: 404 }
      )
    }
    
    const result = await orchestrator.stop()
    activeOrchestrators.delete(runId)
    
    return NextResponse.json({
      success: true,
      runId,
      result
    })
    
  } catch (error) {
    console.error('[API] Failed to stop test run:', error)
    return NextResponse.json(
      { error: 'Failed to stop test run' },
      { status: 500 }
    )
  }
}
