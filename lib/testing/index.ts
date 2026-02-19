/**
 * E2E Testing Framework
 * 
 * Automated client simulation for end-to-end testing of the portfolio website.
 * 
 * @example
 * ```typescript
 * import { 
 *   createOrchestrator, 
 *   ALL_SCENARIOS, 
 *   ALL_PERSONAS 
 * } from '@/lib/testing'
 * 
 * const orchestrator = createOrchestrator({
 *   maxConcurrentClients: 3,
 *   scenarios: ALL_SCENARIOS.map(s => ({
 *     scenario: s,
 *     weight: 1,
 *     personaPool: ALL_PERSONAS
 *   })),
 *   runDuration: 60000, // 1 minute
 *   cleanupAfter: true
 * })
 * 
 * await orchestrator.start()
 * const results = await orchestrator.stop()
 * console.log(results)
 * ```
 */

// Types
export type {
  // Persona types
  TestPersona,
  PersonaRole,
  UrgencyLevel,
  BudgetRange,
  DecisionTimeline,
  CommunicationStyle,
  InterestArea,
  
  // Scenario types
  TestScenario,
  ScenarioStep,
  ScenarioStepType,
  NavigateStep,
  BrowseStep,
  ChatStep,
  DiagnosticStep,
  AddToCartStep,
  CheckoutStep,
  ContactFormStep,
  WaitForWebhookStep,
  ValidateDatabaseStep,
  ScreenshotStep,
  DelayStep,
  ValidationRule,
  
  // Execution types
  TestStatus,
  StepResult,
  TestRunResult,
  TestSuiteResult,
  
  // Error types
  ErrorType,
  CodeSnippet,
  TestErrorContext,
  
  // Remediation types
  RemediationStatus,
  RemediationOutput,
  RemediationOptions,
  RemediationRequest,
  RemediationAnalysis,
  CodeFix,
  RemediationResult,
  
  // Orchestrator types
  OrchestratorConfig,
  OrchestratorStats,
  LiveClientActivity,
  
  // Chat agent types
  LLMProvider,
  ChatAgentConfig,
  ChatAgentMessage,
  ChatAgentResponse,
  
  // Database types
  TestRun,
  TestClientSession,
  TestRemediationRequest
} from './types'

// Personas
export {
  // Individual personas
  startupSarah,
  enterpriseEric,
  skepticalSam,
  readyRachel,
  technicalTom,
  browsingBrenda,
  
  // Collections
  ALL_PERSONAS,
  PERSONAS_BY_ID,
  
  // Utilities
  generateTestEmail,
  createPersonaInstance,
  getRandomPersona,
  getPersonasByUrgency,
  getPersonasByBudget,
  getPersonasByRole,
  getHighValuePersonas,
  createCustomPersona
} from './personas'

// Scenarios
export {
  // Individual scenarios
  browseAndBuyScenario,
  chatToDiagnosticScenario,
  serviceInquiryScenario,
  fullFunnelScenario,
  abandonedCartScenario,
  supportEscalationScenario,
  quickBrowseScenario,
  standaloneAuditToolScenario,

  // Collections
  ALL_SCENARIOS,
  SCENARIOS_BY_ID,
  CRITICAL_SCENARIOS,
  SMOKE_TEST_SCENARIOS,
  CHAT_SCENARIOS,
  ECOMMERCE_SCENARIOS,
  
  // Utilities
  getScenario,
  getScenariosByTag,
  getRandomScenario,
  estimateTotalDuration,
  createCompositeScenario
} from './scenarios'

// Chat Agent
export {
  ChatAgent,
  createChatAgent,
  createMockChatAgent
} from './chat-agent'

// Test Client
export {
  SimulatedClient,
  createSimulatedClient
} from './test-client'

// Orchestrator
export {
  TestOrchestrator,
  createOrchestrator,
  runSingleScenario
} from './orchestrator'

// Remediation
export {
  RemediationEngine,
  getRemediationEngine
} from './remediation'

// ============================================================================
// Convenience Functions
// ============================================================================

import { createOrchestrator } from './orchestrator'
import { ALL_SCENARIOS } from './scenarios'
import { ALL_PERSONAS } from './personas'
import type { OrchestratorConfig, TestSuiteResult } from './types'

/**
 * Run a quick smoke test
 */
export async function runSmokeTest(): Promise<TestSuiteResult> {
  const { quickBrowseScenario } = await import('./scenarios')
  const { startupSarah } = await import('./personas')
  
  const orchestrator = createOrchestrator({
    maxConcurrentClients: 1,
    spawnInterval: 1000,
    scenarios: [{
      scenario: quickBrowseScenario,
      weight: 1,
      personaPool: [startupSarah]
    }],
    runDuration: 0,
    maxClients: 1,
    cleanupAfter: true
  })
  
  await orchestrator.start()
  
  // Wait for completion
  await new Promise(resolve => setTimeout(resolve, 20000))
  
  return orchestrator.stop()
}

/**
 * Run a full test suite with all scenarios
 */
export async function runFullTestSuite(
  options?: Partial<OrchestratorConfig>
): Promise<TestSuiteResult> {
  const orchestrator = createOrchestrator({
    maxConcurrentClients: 3,
    spawnInterval: 5000,
    scenarios: ALL_SCENARIOS.map(scenario => ({
      scenario,
      weight: 1,
      personaPool: ALL_PERSONAS
    })),
    runDuration: 300000, // 5 minutes
    cleanupAfter: true,
    ...options
  })
  
  await orchestrator.start()
  
  // Wait for duration + buffer
  await new Promise(resolve => 
    setTimeout(resolve, (options?.runDuration || 300000) + 30000)
  )
  
  return orchestrator.stop()
}

/**
 * Run critical path tests only
 */
export async function runCriticalPathTests(): Promise<TestSuiteResult> {
  const { CRITICAL_SCENARIOS } = await import('./scenarios')
  
  const orchestrator = createOrchestrator({
    maxConcurrentClients: 2,
    spawnInterval: 3000,
    scenarios: CRITICAL_SCENARIOS.map(scenario => ({
      scenario,
      weight: 1,
      personaPool: ALL_PERSONAS
    })),
    runDuration: 180000, // 3 minutes
    cleanupAfter: true
  })
  
  await orchestrator.start()
  
  await new Promise(resolve => setTimeout(resolve, 210000))
  
  return orchestrator.stop()
}
