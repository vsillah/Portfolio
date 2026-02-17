/**
 * E2E Testing Framework - Test Orchestrator
 * 
 * Manages multiple concurrent simulated clients and coordinates test runs.
 */

import type {
  OrchestratorConfig,
  OrchestratorStats,
  LiveClientActivity,
  TestPersona,
  TestScenario,
  TestRunResult,
  TestSuiteResult,
  TestStatus,
  TestErrorContext
} from './types'
import { SimulatedClient, createSimulatedClient } from './test-client'
import { createPersonaInstance, getRandomPersona } from './personas'
import { getRandomScenario } from './scenarios'
import { createClient } from '@supabase/supabase-js'
import { testDb } from './test-db-cast'

// ============================================================================
// Configuration
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ============================================================================
// Test Orchestrator
// ============================================================================

export class TestOrchestrator {
  private config: OrchestratorConfig
  private supabase: ReturnType<typeof createClient>
  
  private runId: string = ''
  private dbRunId: string = ''
  private status: TestStatus = 'pending'
  private startedAt: string = ''
  private completedAt?: string
  
  private activeClients: Map<string, SimulatedClient> = new Map()
  private completedResults: TestRunResult[] = []
  private errors: TestErrorContext[] = []
  
  private clientsSpawned = 0
  private clientsCompleted = 0
  private clientsFailed = 0
  
  private isRunning = false
  private spawnInterval: NodeJS.Timeout | null = null
  
  // Event callbacks
  private onClientStartedCallback?: (client: SimulatedClient) => void
  private onClientCompletedCallback?: (result: TestRunResult) => void
  private onErrorCallback?: (error: TestErrorContext) => void
  
  constructor(config: OrchestratorConfig) {
    this.config = config
    this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  }
  
  /**
   * Start the test orchestrator
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Orchestrator is already running')
    }
    
    this.isRunning = true
    this.status = 'running'
    this.startedAt = new Date().toISOString()
    
    // Generate run ID
    this.runId = `e2e_${new Date().toISOString().split('T')[0]}_${Date.now().toString(36)}`
    
    console.log(`[Orchestrator] Starting test run: ${this.runId}`)
    console.log(`[Orchestrator] Config:`, {
      maxConcurrent: this.config.maxConcurrentClients,
      duration: this.config.runDuration,
      scenarios: this.config.scenarios.map(s => s.scenario.id)
    })
    
    // Create database record
    await this.createDbRecord()
    
    // Start spawning clients
    this.startSpawning()
    
    // If duration is set, schedule stop
    if (this.config.runDuration > 0) {
      setTimeout(() => this.stop(), this.config.runDuration)
    }
  }
  
  /**
   * Stop the orchestrator and wait for active clients to complete
   */
  async stop(): Promise<TestSuiteResult> {
    console.log(`[Orchestrator] Stopping test run: ${this.runId}`)
    
    this.isRunning = false
    
    // Stop spawning new clients
    if (this.spawnInterval) {
      clearInterval(this.spawnInterval)
      this.spawnInterval = null
    }
    
    // Wait for active clients to complete
    console.log(`[Orchestrator] Waiting for ${this.activeClients.size} active clients to complete...`)
    
    const waitPromises = Array.from(this.activeClients.values()).map(async (client) => {
      // Clients are already running, just wait for them
      // In a real implementation, we'd track their promises
    })
    
    await Promise.all(waitPromises)
    
    this.status = this.clientsFailed > 0 ? 'failed' : 'completed'
    this.completedAt = new Date().toISOString()
    
    // Build final result
    const result = this.buildSuiteResult()
    
    // Update database record
    await this.updateDbRecord(result)
    
    // Cleanup if configured
    if (this.config.cleanupAfter) {
      await this.cleanupTestData()
    }
    
    console.log(`[Orchestrator] Test run complete:`)
    console.log(`  - Spawned: ${this.clientsSpawned}`)
    console.log(`  - Completed: ${this.clientsCompleted}`)
    console.log(`  - Failed: ${this.clientsFailed}`)
    
    return result
  }
  
  /**
   * Get current statistics
   */
  getStats(): OrchestratorStats {
    return {
      runId: this.runId,
      status: this.status,
      startedAt: this.startedAt,
      clientsSpawned: this.clientsSpawned,
      clientsCompleted: this.clientsCompleted,
      clientsFailed: this.clientsFailed,
      clientsRunning: this.activeClients.size,
      averageDuration: this.calculateAverageDuration(),
      scenarioBreakdown: this.calculateScenarioBreakdown(),
      recentErrors: this.errors.slice(-10),
      liveActivity: this.getLiveActivity()
    }
  }
  
  /**
   * Get live activity for all active clients
   */
  getLiveActivity(): LiveClientActivity[] {
    const activities: LiveClientActivity[] = []
    
    for (const [clientId, client] of this.activeClients) {
      try {
        activities.push(client.getLiveActivity())
      } catch (error) {
        // Client may have just completed, skip it
        console.log(`[Orchestrator] Could not get activity for ${clientId}:`, error)
      }
    }
    
    return activities
  }
  
  /**
   * Register callback for when a client starts
   */
  onClientStarted(callback: (client: SimulatedClient) => void): void {
    this.onClientStartedCallback = callback
  }
  
  /**
   * Register callback for when a client completes
   */
  onClientCompleted(callback: (result: TestRunResult) => void): void {
    this.onClientCompletedCallback = callback
  }
  
  /**
   * Register callback for errors
   */
  onError(callback: (error: TestErrorContext) => void): void {
    this.onErrorCallback = callback
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  /**
   * Start the client spawning loop
   */
  private startSpawning(): void {
    // Spawn initial batch
    this.spawnClients()
    
    // Continue spawning at interval
    this.spawnInterval = setInterval(() => {
      if (!this.isRunning) return
      
      // Check if we've hit max clients
      if (this.config.maxClients && this.clientsSpawned >= this.config.maxClients) {
        this.isRunning = false
        return
      }
      
      this.spawnClients()
    }, this.config.spawnInterval)
  }
  
  /**
   * Spawn clients up to the max concurrent limit
   */
  private spawnClients(): void {
    while (
      this.activeClients.size < this.config.maxConcurrentClients &&
      this.isRunning
    ) {
      // Check max clients limit
      if (this.config.maxClients && this.clientsSpawned >= this.config.maxClients) {
        break
      }
      
      this.spawnClient()
    }
  }
  
  /**
   * Spawn a single client
   */
  private async spawnClient(): Promise<void> {
    // Select scenario based on weights
    const scenarioConfig = this.selectScenario()
    const scenario = scenarioConfig.scenario
    
    // Select persona from the pool
    const persona = this.selectPersona(scenarioConfig.personaPool)
    
    // Create client ID
    const clientId = `${this.runId}_client_${this.clientsSpawned + 1}`
    
    // Create the client
    const client = createSimulatedClient({
      persona,
      scenario,
      testRunId: this.runId,
      clientId,
      useMockChat: !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY
    })
    
    this.activeClients.set(clientId, client)
    this.clientsSpawned++
    
    console.log(`[Orchestrator] Spawned client ${clientId} with scenario ${scenario.id}`)
    
    // Notify callback
    if (this.onClientStartedCallback) {
      this.onClientStartedCallback(client)
    }
    
    // Record to database
    await this.recordClientSession(clientId, persona, scenario)
    
    // Execute scenario asynchronously
    this.executeClient(client, clientId)
  }
  
  /**
   * Execute a client's scenario
   */
  private async executeClient(client: SimulatedClient, clientId: string): Promise<void> {
    try {
      const result = await client.executeScenario()
      
      // Record completion
      this.activeClients.delete(clientId)
      this.completedResults.push(result)
      
      if (result.status === 'completed') {
        this.clientsCompleted++
      } else {
        this.clientsFailed++
        this.errors.push(...result.errors)
        
        // Notify error callback
        for (const error of result.errors) {
          if (this.onErrorCallback) {
            this.onErrorCallback(error)
          }
        }
      }
      
      // Update database
      await this.updateClientSession(clientId, result)
      
      // Notify callback
      if (this.onClientCompletedCallback) {
        this.onClientCompletedCallback(result)
      }
      
      console.log(`[Orchestrator] Client ${clientId} ${result.status}`)
      
    } catch (error) {
      console.error(`[Orchestrator] Client ${clientId} crashed:`, error)
      this.activeClients.delete(clientId)
      this.clientsFailed++
    }
  }
  
  /**
   * Select a scenario based on weights
   */
  private selectScenario(): OrchestratorConfig['scenarios'][0] {
    const totalWeight = this.config.scenarios.reduce((sum, s) => sum + s.weight, 0)
    let random = Math.random() * totalWeight
    
    for (const scenarioConfig of this.config.scenarios) {
      random -= scenarioConfig.weight
      if (random <= 0) {
        return scenarioConfig
      }
    }
    
    // Fallback to first scenario
    return this.config.scenarios[0]
  }
  
  /**
   * Select a persona from the pool
   */
  private selectPersona(pool: TestPersona[]): TestPersona {
    if (pool.length === 0) {
      return getRandomPersona()
    }
    
    const index = Math.floor(Math.random() * pool.length)
    return createPersonaInstance(pool[index].id)
  }
  
  /**
   * Calculate average duration of completed tests
   */
  private calculateAverageDuration(): number {
    if (this.completedResults.length === 0) return 0
    
    const totalDuration = this.completedResults.reduce(
      (sum, r) => sum + (r.totalDuration || 0),
      0
    )
    
    return Math.round(totalDuration / this.completedResults.length)
  }
  
  /**
   * Calculate scenario breakdown statistics
   */
  private calculateScenarioBreakdown(): OrchestratorStats['scenarioBreakdown'] {
    const breakdown: OrchestratorStats['scenarioBreakdown'] = {}
    
    for (const result of this.completedResults) {
      const id = result.scenario.id
      if (!breakdown[id]) {
        breakdown[id] = { total: 0, passed: 0, failed: 0, running: 0 }
      }
      
      breakdown[id].total++
      if (result.status === 'completed') {
        breakdown[id].passed++
      } else {
        breakdown[id].failed++
      }
    }
    
    // Add running counts
    for (const [clientId, client] of this.activeClients) {
      // We'd need to track scenario per client to do this properly
      // For now, skip
    }
    
    return breakdown
  }
  
  /**
   * Build the final suite result
   */
  private buildSuiteResult(): TestSuiteResult {
    const completedAt = this.completedAt || new Date().toISOString()
    
    // Calculate scenario breakdown
    const scenarioBreakdown: TestSuiteResult['scenarioBreakdown'] = {}
    
    for (const result of this.completedResults) {
      const id = result.scenario.id
      if (!scenarioBreakdown[id]) {
        scenarioBreakdown[id] = {
          total: 0,
          passed: 0,
          failed: 0,
          averageDuration: 0
        }
      }
      
      scenarioBreakdown[id].total++
      if (result.status === 'completed') {
        scenarioBreakdown[id].passed++
      } else {
        scenarioBreakdown[id].failed++
      }
    }
    
    // Calculate average durations per scenario
    for (const id of Object.keys(scenarioBreakdown)) {
      const scenarioResults = this.completedResults.filter(r => r.scenario.id === id)
      const totalDuration = scenarioResults.reduce((sum, r) => sum + (r.totalDuration || 0), 0)
      scenarioBreakdown[id].averageDuration = Math.round(totalDuration / scenarioResults.length)
    }
    
    return {
      runId: this.runId,
      startedAt: this.startedAt,
      completedAt,
      totalDuration: new Date(completedAt).getTime() - new Date(this.startedAt).getTime(),
      clientsSpawned: this.clientsSpawned,
      clientsCompleted: this.clientsCompleted,
      clientsFailed: this.clientsFailed,
      scenarioBreakdown,
      results: this.completedResults,
      errors: this.errors
    }
  }
  
  // ============================================================================
  // Database Operations
  // ============================================================================
  
  private async createDbRecord(): Promise<void> {
    try {
      const db = testDb(this.supabase)
      const { data, error } = await db
        .from('test_runs')
        .insert({
          run_id: this.runId,
          started_at: this.startedAt,
          config: this.config,
          status: 'running',
          triggered_by: 'api',
          environment: process.env.NODE_ENV || 'development'
        })
        .select('id')
        .single()
      
      if (error) {
        console.error('[Orchestrator] Failed to create DB record:', error)
      } else if (data?.id) {
        this.dbRunId = data.id
      }
    } catch (error) {
      console.error('[Orchestrator] DB error:', error)
    }
  }
  
  private async updateDbRecord(result: TestSuiteResult): Promise<void> {
    if (!this.dbRunId) return
    
    try {
      const db = testDb(this.supabase)
      await db
        .from('test_runs')
        .update({
          completed_at: this.completedAt,
          status: this.status,
          results: result,
          clients_spawned: this.clientsSpawned,
          clients_completed: this.clientsCompleted,
          clients_failed: this.clientsFailed
        })
        .eq('id', this.dbRunId)
    } catch (error) {
      console.error('[Orchestrator] Failed to update DB record:', error)
    }
  }
  
  private async recordClientSession(
    clientId: string,
    persona: TestPersona,
    scenario: TestScenario
  ): Promise<void> {
    if (!this.dbRunId) return
    
    try {
      const db = testDb(this.supabase)
      await db
        .from('test_client_sessions')
        .insert({
          test_run_id: this.dbRunId,
          client_id: clientId,
          persona,
          scenario: scenario.id,
          status: 'running'
        })
    } catch (error) {
      console.error('[Orchestrator] Failed to record client session:', error)
    }
  }
  
  private async updateClientSession(
    clientId: string,
    result: TestRunResult
  ): Promise<void> {
    if (!this.dbRunId) return
    
    try {
      const db = testDb(this.supabase)
      await db
        .from('test_client_sessions')
        .update({
          completed_at: result.completedAt,
          status: result.status,
          steps_completed: result.stepResults,
          errors: result.errors,
          created_chat_session_id: result.createdResources.chatSessionId,
          created_contact_id: result.createdResources.contactId,
          created_diagnostic_id: result.createdResources.diagnosticId,
          created_order_id: result.createdResources.orderId
        })
        .eq('client_id', clientId)
        .eq('test_run_id', this.dbRunId)
      
      // Also record errors to the dedicated table (cast: app schema has no test_errors)
      if (result.errors.length > 0) {
        const db = testDb(this.supabase)
        await db
          .from('test_errors')
          .insert(result.errors.map(e => ({
            error_id: e.errorId,
            test_run_id: this.dbRunId,
            error_type: e.errorType,
            error_message: e.errorMessage,
            stack_trace: e.stackTrace,
            scenario: e.scenario,
            step_index: e.stepIndex,
            step_type: e.stepType,
            step_config: e.stepConfig,
            persona: e.persona,
            request_data: e.request,
            response_data: e.response,
            expected_value: e.expected,
            actual_value: e.actual,
            screenshot_url: e.screenshotUrl
          })))
      }
    } catch (error) {
      console.error('[Orchestrator] Failed to update client session:', error)
    }
  }
  
  /**
   * Clean up all test data created during this run
   */
  private async cleanupTestData(): Promise<void> {
    console.log('[Orchestrator] Cleaning up test data...')
    
    for (const result of this.completedResults) {
      const resources = result.createdResources
      
      // Clean up in reverse order of creation
      if (resources.orderId) {
        await this.supabase.from('order_items').delete().eq('order_id', resources.orderId)
        await this.supabase.from('orders').delete().eq('id', resources.orderId)
      }
      
      if (resources.diagnosticId) {
        await this.supabase.from('diagnostic_audits').delete().eq('id', resources.diagnosticId)
      }
      
      if (resources.contactId) {
        await this.supabase.from('contact_submissions').delete().eq('id', resources.contactId)
      }
      
      if (resources.chatSessionId) {
        await this.supabase.from('chat_messages').delete().eq('session_id', resources.chatSessionId)
        await this.supabase.from('chat_sessions').delete().eq('session_id', resources.chatSessionId)
      }
    }
    
    console.log('[Orchestrator] Cleanup complete')
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new test orchestrator with default configuration
 */
export function createOrchestrator(config: Partial<OrchestratorConfig>): TestOrchestrator {
  const defaultConfig: OrchestratorConfig = {
    maxConcurrentClients: 3,
    spawnInterval: 5000,
    scenarios: [],
    runDuration: 0, // Run once by default
    testDataPrefix: 'test_e2e_',
    cleanupAfter: true,
    headless: true,
    screenshotOnFailure: true,
    captureNetworkHar: false,
    ...config
  }
  
  return new TestOrchestrator(defaultConfig)
}

/**
 * Quick function to run a single scenario
 */
export async function runSingleScenario(
  scenario: TestScenario,
  persona: TestPersona
): Promise<TestRunResult> {
  const client = createSimulatedClient({
    persona,
    scenario,
    testRunId: `quick_${Date.now()}`,
    useMockChat: !process.env.OPENAI_API_KEY
  })
  
  return client.executeScenario()
}
