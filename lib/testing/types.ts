/**
 * E2E Testing Framework - Type Definitions
 * 
 * Core types for the automated client simulator that tests
 * end-to-end user journeys through the website.
 */

// ============================================================================
// Test Persona Types
// ============================================================================

export type PersonaRole = 'decision_maker' | 'researcher' | 'technical' | 'budget_holder'
export type UrgencyLevel = 'high' | 'medium' | 'low'
export type BudgetRange = '$1K-$5K' | '$5K-$15K' | '$15K-$50K' | '$50K+'
export type DecisionTimeline = 'immediate' | '30_days' | '90_days' | 'exploratory'
export type CommunicationStyle = 'brief' | 'detailed' | 'questioning'
export type InterestArea = 'ai_automation' | 'sales_pipeline' | 'workflow_optimization' | 'consulting' | 'training'

export interface TestPersona {
  id: string
  name: string
  company: string
  email: string  // Pattern: test-{persona}-{timestamp}@test.amadutown.com
  role: PersonaRole
  
  // Behavioral traits
  urgency: UrgencyLevel
  budget: BudgetRange
  techSavvy: number  // 1-10
  decisionTimeline: DecisionTimeline
  
  // Pain points and interests
  painPoints: string[]
  interestAreas: InterestArea[]
  
  // Chat behavior
  communicationStyle: CommunicationStyle
  objectionProbability: number  // 0-1
  commonObjections: string[]
  
  // Diagnostic responses (pre-defined for consistency)
  diagnosticResponses?: {
    business_challenges?: Record<string, unknown>
    tech_stack?: Record<string, unknown>
    automation_needs?: Record<string, unknown>
    ai_readiness?: Record<string, unknown>
    budget_timeline?: Record<string, unknown>
    decision_making?: Record<string, unknown>
  }
}

// ============================================================================
// Test Scenario Types
// ============================================================================

export type ScenarioStepType = 
  | 'navigate'
  | 'browse'
  | 'chat'
  | 'diagnostic'
  | 'addToCart'
  | 'checkout'
  | 'contactForm'
  | 'waitForWebhook'
  | 'validateDatabase'
  | 'screenshot'
  | 'delay'
  | 'apiCall'
  | 'adminAction'
  | 'waitForData'

export interface NavigateStep {
  type: 'navigate'
  path: string
  waitForSelector?: string
}

export interface BrowseStep {
  type: 'browse'
  section: string
  duration: number  // ms
  interactions?: ('scroll' | 'hover' | 'click')[]
}

export interface ChatStep {
  type: 'chat'
  intent: string
  message?: string  // If not provided, AI generates based on intent
  expectedResponseContains?: string[]
  maxTurns?: number
}

export interface DiagnosticStep {
  type: 'diagnostic'
  completeAllCategories: boolean
  skipCategories?: string[]
  usePersonaResponses?: boolean  // Use pre-defined persona responses
}

export interface AddToCartStep {
  type: 'addToCart'
  productId?: string
  productType?: string  // If no ID, pick random of this type
  quantity?: number
}

export interface CheckoutStep {
  type: 'checkout'
  paymentMethod: 'stripe_test' | 'free'
  usePersonaContact?: boolean
  customContact?: {
    name: string
    email: string
    company?: string
  }
}

export interface ContactFormStep {
  type: 'contactForm'
  fields: Record<string, string>
  usePersonaData?: boolean
}

export interface WaitForWebhookStep {
  type: 'waitForWebhook'
  webhookType: 'lead_qualification' | 'diagnostic_completion' | 'order_created' | 'stripe_payment'
  timeout: number  // ms
}

export interface ValidateDatabaseStep {
  type: 'validateDatabase'
  table: string
  conditions: Record<string, unknown>
  expectedCount?: number
  expectedFields?: Record<string, unknown>
}

export interface ScreenshotStep {
  type: 'screenshot'
  name: string
  fullPage?: boolean
}

export interface DelayStep {
  type: 'delay'
  duration: number  // ms
  randomize?: boolean  // Add ±20% randomization
  description?: string  // Human-readable description for logging
}

export interface ApiCallStep {
  type: 'apiCall'
  endpoint: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: Record<string, unknown>
  headers?: Record<string, string>
  expectedStatus?: number
  expectedResponse?: Record<string, unknown>
  description?: string  // Human-readable description for logging
}

export interface AdminActionStep {
  type: 'adminAction'
  action: 'approve_outreach' | 'reject_outreach' | 'send_outreach' | 'trigger_scraping'
  target?: 'first_draft' | 'first_approved' | 'all' | string
  options?: Record<string, unknown>
  description?: string  // Human-readable description for logging
}

export interface WaitForDataStep {
  type: 'waitForData'
  table: string
  conditions: Record<string, unknown>
  timeout: number  // ms
  pollInterval?: number  // ms, default 1000
  expectedCount?: number  // Expected number of rows
  description?: string  // Human-readable description for logging
}

export type ScenarioStep = 
  | NavigateStep
  | BrowseStep
  | ChatStep
  | DiagnosticStep
  | AddToCartStep
  | CheckoutStep
  | ContactFormStep
  | WaitForWebhookStep
  | ValidateDatabaseStep
  | ScreenshotStep
  | DelayStep
  | ApiCallStep
  | AdminActionStep
  | WaitForDataStep

export interface ValidationRule {
  table: string
  field: string
  condition: 'exists' | 'equals' | 'contains' | 'greater_than' | 'less_than'
  value?: unknown
}

export interface TestScenario {
  id: string
  name: string
  description: string
  
  // Journey definition
  steps: ScenarioStep[]
  
  // Randomization config
  variability: {
    skipProbability: Record<string, number>  // Chance to skip optional steps
    delayRange: [number, number]  // Random delays between actions (ms)
    responseVariation: boolean  // Use AI to vary chat responses
  }
  
  // Success criteria
  expectedOutcomes: {
    mustComplete: string[]  // Step IDs that must complete
    mustNotError: string[]  // Step IDs that must not error
    dataValidation: ValidationRule[]
  }
  
  // Metadata
  estimatedDuration: number  // ms
  tags: string[]
}

// ============================================================================
// Test Execution Types
// ============================================================================

export type TestStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface StepResult {
  stepIndex: number
  stepType: ScenarioStepType
  status: 'success' | 'failed' | 'skipped'
  startedAt: string
  completedAt?: string
  duration?: number  // ms
  error?: string
  data?: Record<string, unknown>
  screenshots?: string[]
}

export interface TestRunResult {
  clientId: string
  testRunId: string
  persona: TestPersona
  scenario: TestScenario
  
  status: TestStatus
  startedAt: string
  completedAt?: string
  totalDuration?: number  // ms
  
  stepResults: StepResult[]
  
  // Created resources (for cleanup)
  createdResources: {
    chatSessionId?: string
    contactId?: number
    diagnosticId?: string
    orderId?: string
  }
  
  // Validation results
  validationPassed: boolean
  validationErrors: string[]
  
  // Error details
  errors: TestErrorContext[]
}

export interface TestSuiteResult {
  runId: string
  startedAt: string
  completedAt: string
  totalDuration: number
  
  // Stats
  clientsSpawned: number
  clientsCompleted: number
  clientsFailed: number
  
  // Results by scenario
  scenarioBreakdown: Record<string, {
    total: number
    passed: number
    failed: number
    averageDuration: number
  }>
  
  // All individual results
  results: TestRunResult[]
  
  // Aggregated errors
  errors: TestErrorContext[]
}

// ============================================================================
// Error Context Types (for Remediation)
// ============================================================================

export type ErrorType = 'api_error' | 'validation_error' | 'timeout' | 'assertion' | 'exception' | 'network_error'

export interface CodeSnippet {
  file: string
  startLine: number
  endLine: number
  content: string
}

export interface TestErrorContext {
  // Error identification
  errorId: string
  testRunId: string
  clientSessionId: string
  timestamp: string
  
  // Error details
  errorType: ErrorType
  errorMessage: string
  stackTrace?: string
  
  // Test context
  scenario: string
  stepIndex: number
  stepType: string
  stepConfig?: Record<string, unknown>  // The step configuration that was being executed
  persona: TestPersona
  
  // Request/Response context
  request?: {
    method: string
    url: string
    headers: Record<string, string>
    body?: unknown
  }
  response?: {
    status: number
    headers: Record<string, string>
    body?: unknown
  }
  
  // Expected vs Actual
  expected?: unknown
  actual?: unknown
  
  // Related code locations (auto-detected)
  likelySourceFiles: string[]
  relevantCodeSnippets: CodeSnippet[]
  
  // Database state at failure
  dbSnapshot?: Record<string, unknown>
  
  // Screenshots/HAR (if browser test)
  screenshotUrl?: string
  networkHarUrl?: string
}

// ============================================================================
// Remediation Types
// ============================================================================

export type RemediationStatus = 
  | 'pending' 
  | 'analyzing' 
  | 'generating_fix' 
  | 'review_required' 
  | 'applied' 
  | 'failed'
  | 'rejected'

export type RemediationOutput = 'github_pr' | 'cursor_task' | 'n8n_workflow' | 'report'

export interface RemediationOptions {
  output: RemediationOutput
  autoCreatePR?: boolean
  targetBranch?: string
  assignees?: string[]
  
  // AI behavior
  fixScope: 'minimal' | 'comprehensive'
  includeTests: boolean
  requireApproval: boolean
}

export interface RemediationRequest {
  id: string
  testRunId: string
  errorIds: string[]
  errors: TestErrorContext[]
  
  options: RemediationOptions
  additionalNotes?: string
  priorityLevel: 'critical' | 'high' | 'medium' | 'low'
  
  createdAt: string
  createdBy?: string
}

export interface RemediationAnalysis {
  rootCause: string
  affectedFiles: string[]
  suggestedApproach: string
  confidence: number  // 0-1
  estimatedComplexity: 'simple' | 'moderate' | 'complex'
}

export interface CodeFix {
  file: string
  originalContent: string
  fixedContent: string
  explanation: string
  lineChanges: {
    added: number
    removed: number
  }
}

export interface RemediationResult {
  requestId: string
  status: RemediationStatus
  
  // Analysis results
  analysis?: RemediationAnalysis
  
  // Generated fixes
  fixes?: CodeFix[]
  
  // Output links
  prUrl?: string
  cursorTaskId?: string
  n8nExecutionId?: string
  
  // Timestamps
  startedAt?: string
  completedAt?: string
  
  // Outcome
  outcome?: 'success' | 'partial' | 'failed' | 'rejected'
  outcomeNotes?: string
}

// ============================================================================
// Orchestrator Types
// ============================================================================

export interface OrchestratorConfig {
  // Concurrency
  maxConcurrentClients: number
  spawnInterval: number  // ms between spawning new clients
  
  // Scenarios to run
  scenarios: {
    scenario: TestScenario
    weight: number  // Relative frequency (higher = more likely)
    personaPool: TestPersona[]
  }[]
  
  // Duration
  runDuration: number  // Total test run time (ms), 0 = run once
  maxClients?: number  // Max total clients to spawn
  
  // Database
  testDataPrefix: string  // Prefix for identifying test data
  cleanupAfter: boolean
  
  // Browser config
  headless: boolean
  slowMo?: number  // Slow down actions by this many ms
  
  // Reporting
  screenshotOnFailure: boolean
  captureNetworkHar: boolean
}

export interface OrchestratorStats {
  runId: string
  status: TestStatus
  startedAt: string
  
  clientsSpawned: number
  clientsCompleted: number
  clientsFailed: number
  clientsRunning: number
  
  averageDuration: number
  
  scenarioBreakdown: Record<string, {
    total: number
    passed: number
    failed: number
    running: number
  }>
  
  recentErrors: TestErrorContext[]
  
  // Live activity for active clients
  liveActivity?: LiveClientActivity[]
}

/**
 * Live activity state for a running client
 */
export interface LiveClientActivity {
  clientId: string
  personaName: string
  personaId: string
  scenarioId: string
  scenarioName: string
  
  // Progress tracking
  currentStepIndex: number
  totalSteps: number
  currentStepType: ScenarioStepType | 'initializing' | 'validating' | 'complete'
  currentStepDescription: string
  
  // Timing
  startedAt: string
  stepStartedAt: string
  elapsedMs: number
  
  // Status
  status: 'running' | 'completing' | 'error'
  lastAction?: string
}

// ============================================================================
// Chat Agent Types
// ============================================================================

export type LLMProvider = 'openai' | 'anthropic'

export interface ChatAgentConfig {
  persona: TestPersona
  scenario: TestScenario
  
  // AI provider
  llmProvider: LLMProvider
  model: string
  
  // Behavior modifiers
  maxTurns: number
  responseDelay: [number, number]  // Random delay range [min, max] ms
  temperature?: number
}

export interface ChatAgentMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatAgentResponse {
  message: string
  shouldContinue: boolean
  intent?: string
  metadata?: Record<string, unknown>
}

// ============================================================================
// Database Types
// ============================================================================

export interface TestRun {
  id: string
  run_id: string
  started_at: string
  completed_at?: string
  config: OrchestratorConfig
  status: TestStatus
  results?: TestSuiteResult
  clients_spawned: number
  clients_completed: number
  clients_failed: number
}

export interface TestClientSession {
  id: string
  test_run_id: string
  client_id: string
  persona: TestPersona
  scenario: string
  started_at: string
  completed_at?: string
  status: TestStatus
  steps_completed: StepResult[]
  errors: TestErrorContext[]
  created_chat_session_id?: string
  created_contact_id?: number
  created_diagnostic_id?: string
  created_order_id?: string
}

export interface TestRemediationRequest {
  id: string
  test_run_id: string
  created_at: string
  created_by?: string
  error_ids: string[]
  options: RemediationOptions
  additional_notes?: string
  priority: string
  status: RemediationStatus
  started_at?: string
  completed_at?: string
  analysis?: RemediationAnalysis
  fixes?: CodeFix[]
  github_pr_url?: string
  cursor_task_id?: string
  n8n_execution_id?: string
  outcome?: string
  outcome_notes?: string
}
