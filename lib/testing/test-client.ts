/**
 * E2E Testing Framework - Simulated Client
 * 
 * Implements an automated test client that can navigate the website,
 * interact with chat, complete forms, and validate results.
 */

import type {
  TestPersona,
  TestScenario,
  ScenarioStep,
  ScenarioStepType,
  TestRunResult,
  StepResult,
  TestErrorContext,
  TestStatus,
  LiveClientActivity,
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
  ApiCallStep,
  AdminActionStep,
  WaitForDataStep
} from './types'
import { ChatAgent, createChatAgent, createMockChatAgent } from './chat-agent'
import { createClient } from '@supabase/supabase-js'

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ============================================================================
// Simulated Client Class
// ============================================================================

export class SimulatedClient {
  private persona: TestPersona
  private scenario: TestScenario
  private sessionId: string
  private testRunId: string
  private clientId: string
  
  private chatAgent: ChatAgent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private supabase: any
  
  private stepResults: StepResult[] = []
  private errors: TestErrorContext[] = []
  private screenshots: string[] = []
  
  private createdResources: {
    chatSessionId?: string
    contactId?: number
    diagnosticId?: string
    orderId?: string
  } = {}
  
  private status: TestStatus = 'pending'
  private startedAt: string = ''
  private completedAt?: string
  
  // Live activity tracking
  private currentStepIndex: number = -1
  private currentStepType: ScenarioStepType | 'initializing' | 'validating' | 'complete' = 'initializing'
  private currentStepDescription: string = 'Initializing...'
  private stepStartedAt: string = ''
  private lastAction: string = ''
  
  // For browser-based testing (Playwright), this would hold the browser/page
  // For now, we use API-based testing
  private useBrowser: boolean = false
  
  constructor(config: {
    persona: TestPersona
    scenario: TestScenario
    testRunId: string
    clientId: string
    useBrowser?: boolean
    useMockChat?: boolean
  }) {
    this.persona = config.persona
    this.scenario = config.scenario
    this.testRunId = config.testRunId
    this.clientId = config.clientId
    this.useBrowser = config.useBrowser || false
    
    // Generate session ID with test prefix
    this.sessionId = `test_e2e_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    
    // Initialize chat agent
    this.chatAgent = config.useMockChat
      ? createMockChatAgent(this.persona, this.scenario)
      : createChatAgent(this.persona, this.scenario)
    
    // Initialize Supabase client
    this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  }
  
  /**
   * Get live activity state for this client
   */
  getLiveActivity(): LiveClientActivity {
    return {
      clientId: this.clientId,
      personaName: this.persona.name,
      personaId: this.persona.id,
      scenarioId: this.scenario.id,
      scenarioName: this.scenario.name,
      
      currentStepIndex: this.currentStepIndex,
      totalSteps: this.scenario.steps.length,
      currentStepType: this.currentStepType,
      currentStepDescription: this.currentStepDescription,
      
      startedAt: this.startedAt,
      stepStartedAt: this.stepStartedAt,
      elapsedMs: this.startedAt 
        ? Date.now() - new Date(this.startedAt).getTime() 
        : 0,
      
      status: this.status === 'running' ? 'running' : 
              this.status === 'failed' ? 'error' : 'completing',
      lastAction: this.lastAction
    }
  }
  
  /**
   * Update the current step tracking
   */
  private updateStepProgress(
    stepIndex: number, 
    stepType: ScenarioStepType | 'initializing' | 'validating' | 'complete',
    description: string
  ): void {
    this.currentStepIndex = stepIndex
    this.currentStepType = stepType
    this.currentStepDescription = description
    this.stepStartedAt = new Date().toISOString()
  }
  
  /**
   * Execute the full scenario
   */
  async executeScenario(): Promise<TestRunResult> {
    this.status = 'running'
    this.startedAt = new Date().toISOString()
    this.updateStepProgress(-1, 'initializing', 'Starting scenario...')
    
    console.log(`[${this.clientId}] Starting scenario: ${this.scenario.name}`)
    console.log(`[${this.clientId}] Persona: ${this.persona.name} (${this.persona.id})`)
    
    try {
      for (let i = 0; i < this.scenario.steps.length; i++) {
        const step = this.scenario.steps[i]
        
        // Check if we should skip this step
        const skipKey = `${step.type}:${i}`
        const skipProb = this.scenario.variability.skipProbability[skipKey] || 0
        if (Math.random() < skipProb) {
          this.stepResults.push({
            stepIndex: i,
            stepType: step.type,
            status: 'skipped',
            startedAt: new Date().toISOString()
          })
          continue
        }
        
        // Update progress tracking before executing step
        this.updateStepProgress(i, step.type, this.getStepDescription(step))
        
        // Execute the step
        const result = await this.executeStep(step, i)
        this.stepResults.push(result)
        
        // Stop on failure if this step must not error
        if (result.status === 'failed' && 
            this.scenario.expectedOutcomes.mustNotError.includes(step.type)) {
          console.error(`[${this.clientId}] Critical step failed: ${step.type}`)
          this.status = 'failed'
          break
        }
        
        // Add random delay between steps
        const [minDelay, maxDelay] = this.scenario.variability.delayRange
        const delay = Math.floor(Math.random() * (maxDelay - minDelay) + minDelay)
        await this.delay(delay)
      }
      
      // Run validation if we didn't fail
      if (this.status !== 'failed') {
        this.updateStepProgress(this.scenario.steps.length, 'validating', 'Running validation...')
        const validationPassed = await this.runValidation()
        this.status = validationPassed ? 'completed' : 'failed'
      }
      
      this.updateStepProgress(this.scenario.steps.length, 'complete', 'Scenario complete')
      
    } catch (error) {
      console.error(`[${this.clientId}] Scenario execution error:`, error)
      this.status = 'failed'
      this.recordError({
        errorType: 'exception',
        errorMessage: error instanceof Error ? error.message : String(error),
        stackTrace: error instanceof Error ? error.stack : undefined,
        stepIndex: this.stepResults.length,
        stepType: 'scenario_execution'
      })
    }
    
    this.completedAt = new Date().toISOString()
    
    return this.buildResult()
  }
  
  /**
   * Get a human-readable description for a step
   */
  private getStepDescription(step: ScenarioStep): string {
    switch (step.type) {
      case 'navigate':
        return `Navigating to ${(step as NavigateStep).path}`
      case 'browse':
        return `Browsing ${(step as BrowseStep).section}`
      case 'chat':
        return `Chatting - ${(step as ChatStep).intent}`
      case 'diagnostic':
        return 'Completing diagnostic assessment'
      case 'addToCart':
        return 'Adding item to cart'
      case 'checkout':
        return 'Processing checkout'
      case 'contactForm':
        return 'Submitting contact form'
      case 'waitForWebhook':
        return 'Waiting for webhook response'
      case 'validateDatabase':
        return 'Validating database records'
      case 'screenshot':
        return 'Taking screenshot'
      case 'delay':
        return 'Waiting...'
      case 'apiCall':
        return `API: ${(step as ApiCallStep).method} ${(step as ApiCallStep).endpoint}`
      case 'adminAction':
        return `Admin action: ${(step as AdminActionStep).action}`
      case 'waitForData':
        return `Waiting for data in ${(step as WaitForDataStep).table}`
      default:
        return (step as { type: string }).type
    }
  }
  
  /**
   * Execute a single step
   */
  private async executeStep(step: ScenarioStep, index: number): Promise<StepResult> {
    const startedAt = new Date().toISOString()
    
    console.log(`[${this.clientId}] Step ${index + 1}/${this.scenario.steps.length}: ${step.type}`)
    
    try {
      let data: Record<string, unknown> = {}
      
      switch (step.type) {
        case 'navigate':
          data = await this.executeNavigate(step)
          break
        case 'browse':
          data = await this.executeBrowse(step)
          break
        case 'chat':
          data = await this.executeChat(step)
          break
        case 'diagnostic':
          data = await this.executeDiagnostic(step)
          break
        case 'addToCart':
          data = await this.executeAddToCart(step)
          break
        case 'checkout':
          data = await this.executeCheckout(step)
          break
        case 'contactForm':
          data = await this.executeContactForm(step)
          break
        case 'waitForWebhook':
          data = await this.executeWaitForWebhook(step)
          break
        case 'validateDatabase':
          data = await this.executeValidateDatabase(step)
          break
        case 'screenshot':
          data = await this.executeScreenshot(step)
          break
        case 'delay':
          data = await this.executeDelay(step)
          break
        case 'apiCall':
          data = await this.executeApiCall(step)
          break
        case 'adminAction':
          data = await this.executeAdminAction(step)
          break
        case 'waitForData':
          data = await this.executeWaitForData(step)
          break
        default:
          throw new Error(`Unknown step type: ${(step as ScenarioStep).type}`)
      }
      
      const completedAt = new Date().toISOString()
      return {
        stepIndex: index,
        stepType: step.type,
        status: 'success',
        startedAt,
        completedAt,
        duration: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
        data
      }
      
    } catch (error) {
      const completedAt = new Date().toISOString()
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Include step configuration for better debugging
      const stepConfig = { ...step } as Record<string, unknown>
      
      this.recordError({
        errorType: 'exception',
        errorMessage,
        stackTrace: error instanceof Error ? error.stack : undefined,
        stepIndex: index,
        stepType: step.type,
        stepConfig
      })
      
      return {
        stepIndex: index,
        stepType: step.type,
        status: 'failed',
        startedAt,
        completedAt,
        duration: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
        error: errorMessage
      }
    }
  }
  
  // ============================================================================
  // Step Implementations
  // ============================================================================
  
  private async executeNavigate(step: NavigateStep): Promise<Record<string, unknown>> {
    // For API-based testing, we just validate the path exists
    const url = `${BASE_URL}${step.path}`
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': `E2E-Test-Client/${this.clientId}` }
    })
    
    if (!response.ok && response.status !== 304) {
      throw new Error(`Navigation to ${step.path} failed: ${response.status}`)
    }
    
    return { path: step.path, status: response.status }
  }
  
  private async executeBrowse(step: BrowseStep): Promise<Record<string, unknown>> {
    // Simulate browsing by waiting
    await this.delay(step.duration)
    return { section: step.section, duration: step.duration }
  }
  
  private async executeChat(step: ChatStep): Promise<Record<string, unknown>> {
    // Generate message if not provided
    let message = step.message
    if (!message) {
      const response = await this.chatAgent.generateInitialMessage(step.intent)
      message = response.message
    }
    
    // Send message to chat API
    const chatResponse = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        sessionId: this.sessionId,
        visitorEmail: this.persona.email,
        visitorName: this.persona.name
      })
    })
    
    if (!chatResponse.ok) {
      const errorText = await chatResponse.text()
      throw new Error(`Chat API error: ${chatResponse.status} - ${errorText}`)
    }
    
    const chatData = await chatResponse.json()
    this.createdResources.chatSessionId = this.sessionId
    
    // Validate expected response if specified
    if (step.expectedResponseContains) {
      const responseText = chatData.response?.toLowerCase() || ''
      for (const expected of step.expectedResponseContains) {
        if (!responseText.includes(expected.toLowerCase())) {
          throw new Error(`Expected response to contain "${expected}"`)
        }
      }
    }
    
    return {
      message,
      response: chatData.response,
      sessionId: this.sessionId
    }
  }
  
  private async executeDiagnostic(step: DiagnosticStep): Promise<Record<string, unknown>> {
    // Trigger diagnostic mode
    const triggerResponse = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "I'd like to perform an AI audit of my business",
        sessionId: this.sessionId,
        visitorEmail: this.persona.email,
        visitorName: this.persona.name,
        diagnosticMode: true
      })
    })
    
    if (!triggerResponse.ok) {
      throw new Error(`Failed to trigger diagnostic: ${triggerResponse.status}`)
    }
    
    const triggerData = await triggerResponse.json()
    this.createdResources.diagnosticId = triggerData.diagnosticAuditId
    
    // If we should complete all categories, simulate the diagnostic flow
    if (step.completeAllCategories) {
      const categories = [
        'business_challenges',
        'tech_stack',
        'automation_needs',
        'ai_readiness',
        'budget_timeline',
        'decision_making'
      ]
      
      for (const category of categories) {
        if (step.skipCategories?.includes(category)) continue
        
        // Generate response for this category
        const response = step.usePersonaResponses
          ? await this.chatAgent.generateDiagnosticResponse(
              `Tell me about your ${category.replace('_', ' ')}`,
              category
            )
          : await this.chatAgent.generateResponse(
              `Tell me about your ${category.replace('_', ' ')}`,
              { diagnosticMode: true, currentCategory: category }
            )
        
        // Send to API
        await fetch(`${BASE_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: response.message,
            sessionId: this.sessionId,
            diagnosticMode: true,
            diagnosticAuditId: this.createdResources.diagnosticId
          })
        })
        
        await this.delay(1000) // Brief delay between categories
      }
    }
    
    return {
      diagnosticId: this.createdResources.diagnosticId,
      completed: step.completeAllCategories
    }
  }
  
  private async executeAddToCart(step: AddToCartStep): Promise<Record<string, unknown>> {
    // Get a product to add
    let productId = step.productId
    let searchDetails = ''
    
    if (!productId && step.productType) {
      // Fetch a product of the specified type
      searchDetails = `product_type="${step.productType}"`
      const { data: products, error } = await this.supabase
        .from('products')
        .select('id, name')
        .eq('product_type', step.productType)
        .eq('active', true)
        .limit(1)
      
      if (error) {
        throw new Error(`Database error querying products (${searchDetails}): ${error.message}`)
      }
      
      if (products && products.length > 0) {
        productId = products[0].id
      }
    }
    
    if (!productId) {
      // Get any active product
      searchDetails = searchDetails || 'any active product'
      const { data: products, error } = await this.supabase
        .from('products')
        .select('id, name')
        .eq('active', true)
        .limit(1)
      
      if (error) {
        throw new Error(`Database error querying products (${searchDetails}): ${error.message}`)
      }
      
      if (products && products.length > 0) {
        productId = products[0].id
      }
    }
    
    if (!productId) {
      // Provide detailed error with what was attempted
      const requestedProduct = step.productId 
        ? `specific product ID "${step.productId}"`
        : step.productType 
          ? `product of type "${step.productType}"`
          : 'any active product'
      
      throw new Error(`No products available to add to cart. Attempted to find: ${requestedProduct}. Check that products exist in the database with active=true.`)
    }
    
    // Note: Cart is client-side (localStorage), so we can't truly add via API
    // This is a placeholder for browser-based testing
    return {
      productId,
      quantity: step.quantity || 1,
      note: 'Cart operations require browser-based testing'
    }
  }
  
  private async executeCheckout(step: CheckoutStep): Promise<Record<string, unknown>> {
    const contact = step.usePersonaContact
      ? {
          name: this.persona.name,
          email: this.persona.email,
          company: this.persona.company
        }
      : step.customContact || {
          name: this.persona.name,
          email: this.persona.email
        }
    
    // For API testing, we'd need to simulate the checkout flow
    // This requires a cart with items, which is client-side
    // Placeholder for browser-based testing
    
    return {
      contact,
      paymentMethod: step.paymentMethod,
      note: 'Full checkout requires browser-based testing with cart'
    }
  }
  
  private async executeContactForm(step: ContactFormStep): Promise<Record<string, unknown>> {
    const fields = step.usePersonaData
      ? {
          name: this.persona.name,
          email: this.persona.email,
          company: this.persona.company,
          message: `Test submission from ${this.persona.name}. ${this.persona.painPoints[0] || ''}`,
          annual_revenue: this.persona.budget.replace('$', '').replace('+', '-plus'),
          interest_areas: this.persona.interestAreas,
          is_decision_maker: this.persona.role === 'decision_maker'
        }
      : step.fields
    
    const response = await fetch(`${BASE_URL}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Contact form submission failed: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    this.createdResources.contactId = data.id
    
    return { fields, submissionId: data.id }
  }
  
  private async executeWaitForWebhook(step: WaitForWebhookStep): Promise<Record<string, unknown>> {
    // In a real implementation, we'd have a webhook listener
    // For now, we just wait and check the database for expected changes
    
    const startTime = Date.now()
    const checkInterval = 1000
    
    while (Date.now() - startTime < step.timeout) {
      // Check based on webhook type
      let found = false
      
      switch (step.webhookType) {
        case 'diagnostic_completion':
          if (this.createdResources.diagnosticId) {
            const { data } = await this.supabase
              .from('diagnostic_audits')
              .select('status')
              .eq('id', this.createdResources.diagnosticId)
              .single()
            found = data?.status === 'completed'
          }
          break
          
        case 'lead_qualification':
          if (this.createdResources.contactId) {
            const { data } = await this.supabase
              .from('contact_submissions')
              .select('lead_score')
              .eq('id', this.createdResources.contactId)
              .single()
            found = data?.lead_score !== null
          }
          break
          
        case 'order_created':
          if (this.createdResources.orderId) {
            const { data } = await this.supabase
              .from('orders')
              .select('status')
              .eq('id', this.createdResources.orderId)
              .single()
            found = !!data
          }
          break
      }
      
      if (found) {
        return { webhookType: step.webhookType, receivedAt: new Date().toISOString() }
      }
      
      await this.delay(checkInterval)
    }
    
    throw new Error(`Webhook ${step.webhookType} not received within ${step.timeout}ms`)
  }
  
  private async executeValidateDatabase(step: ValidateDatabaseStep): Promise<Record<string, unknown>> {
    let query = this.supabase.from(step.table).select('*')
    
    // Apply conditions
    for (const [field, value] of Object.entries(step.conditions)) {
      query = query.eq(field, value)
    }
    
    // Add session/contact filters for test isolation
    if (step.table === 'chat_sessions' || step.table === 'chat_messages') {
      query = query.eq('session_id', this.sessionId)
    } else if (step.table === 'contact_submissions' && this.createdResources.contactId) {
      query = query.eq('id', this.createdResources.contactId)
    } else if (step.table === 'diagnostic_audits' && this.createdResources.diagnosticId) {
      query = query.eq('id', this.createdResources.diagnosticId)
    }
    
    const { data, error } = await query
    
    if (error) {
      throw new Error(`Database validation query failed: ${error.message}`)
    }
    
    // Check expected count
    if (step.expectedCount !== undefined && data.length !== step.expectedCount) {
      throw new Error(`Expected ${step.expectedCount} records, found ${data.length}`)
    }
    
    // Check expected fields
    if (step.expectedFields && data.length > 0) {
      for (const [field, expectedValue] of Object.entries(step.expectedFields)) {
        const actualValue = data[0][field]
        if (actualValue !== expectedValue) {
          throw new Error(`Expected ${field} to be ${expectedValue}, got ${actualValue}`)
        }
      }
    }
    
    return { table: step.table, recordCount: data.length, records: data }
  }
  
  private async executeScreenshot(step: ScreenshotStep): Promise<Record<string, unknown>> {
    // Screenshots require browser-based testing
    // Log for now
    const screenshotName = `${this.clientId}_${step.name}_${Date.now()}.png`
    this.screenshots.push(screenshotName)
    
    return {
      name: step.name,
      filename: screenshotName,
      note: 'Full screenshots require browser-based testing'
    }
  }
  
  private async executeDelay(step: DelayStep): Promise<Record<string, unknown>> {
    let duration = step.duration
    
    if (step.randomize) {
      // Add ±20% randomization
      const variance = duration * 0.2
      duration = duration + (Math.random() * variance * 2 - variance)
    }
    
    await this.delay(duration)
    
    return { duration: Math.round(duration) }
  }
  
  private async executeApiCall(step: ApiCallStep): Promise<Record<string, unknown>> {
    this.lastAction = `API call: ${step.method} ${step.endpoint}`
    
    // Get admin session token (for admin actions)
    const sessionResponse = await fetch(`${BASE_URL}/api/auth/session`)
    let authToken = ''
    
    if (sessionResponse.ok) {
      const sessionData = await sessionResponse.json()
      authToken = sessionData?.access_token || ''
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      ...(step.headers || {})
    }
    
    const response = await fetch(`${BASE_URL}${step.endpoint}`, {
      method: step.method,
      headers,
      body: step.body ? JSON.stringify(step.body) : undefined
    })
    
    const responseText = await response.text()
    let responseData: unknown
    
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = responseText
    }
    
    // Validate status if expected
    if (step.expectedStatus && response.status !== step.expectedStatus) {
      throw new Error(`Expected status ${step.expectedStatus}, got ${response.status}. Response: ${responseText}`)
    }
    
    // Validate response if expected
    if (step.expectedResponse) {
      for (const [key, value] of Object.entries(step.expectedResponse)) {
        if (typeof responseData === 'object' && responseData !== null) {
          const actualValue = (responseData as Record<string, unknown>)[key]
          if (actualValue !== value) {
            throw new Error(`Expected response.${key} to be ${value}, got ${actualValue}`)
          }
        }
      }
    }
    
    return {
      status: response.status,
      response: responseData
    }
  }
  
  private async executeAdminAction(step: AdminActionStep): Promise<Record<string, unknown>> {
    this.lastAction = `Admin action: ${step.action}`
    
    // Get admin session token
    const sessionResponse = await fetch(`${BASE_URL}/api/auth/session`)
    if (!sessionResponse.ok) {
      throw new Error('Failed to get admin session')
    }
    
    const sessionData = await sessionResponse.json()
    const authToken = sessionData?.access_token
    
    if (!authToken) {
      throw new Error('No auth token available')
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
    
    switch (step.action) {
      case 'approve_outreach': {
        // Fetch first draft
        const response = await fetch(`${BASE_URL}/api/admin/outreach?status=draft&limit=1`, { headers })
        if (!response.ok) throw new Error('Failed to fetch drafts')
        
        const data = await response.json()
        const draft = data.items?.[0]
        
        if (!draft) throw new Error('No draft found to approve')
        
        // Approve it
        const approveRes = await fetch(`${BASE_URL}/api/admin/outreach`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ action: 'approve', ids: [draft.id] })
        })
        
        if (!approveRes.ok) throw new Error('Failed to approve outreach')
        
        return { approved: draft.id, contact: draft.contact_submission_id }
      }
      
      case 'reject_outreach': {
        // Fetch first draft
        const response = await fetch(`${BASE_URL}/api/admin/outreach?status=draft&limit=1`, { headers })
        if (!response.ok) throw new Error('Failed to fetch drafts')
        
        const data = await response.json()
        const draft = data.items?.[0]
        
        if (!draft) throw new Error('No draft found to reject')
        
        // Reject it
        const rejectRes = await fetch(`${BASE_URL}/api/admin/outreach`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ action: 'reject', ids: [draft.id] })
        })
        
        if (!rejectRes.ok) throw new Error('Failed to reject outreach')
        
        return { rejected: draft.id }
      }
      
      case 'send_outreach': {
        // Fetch first approved
        const response = await fetch(`${BASE_URL}/api/admin/outreach?status=approved&limit=1`, { headers })
        if (!response.ok) throw new Error('Failed to fetch approved')
        
        const data = await response.json()
        const approved = data.items?.[0]
        
        if (!approved) throw new Error('No approved outreach found to send')
        
        // Send it
        const sendRes = await fetch(`${BASE_URL}/api/admin/outreach/${approved.id}/send`, {
          method: 'POST',
          headers
        })
        
        if (!sendRes.ok) throw new Error('Failed to send outreach')
        
        return { sent: approved.id }
      }
      
      case 'trigger_scraping': {
        const triggerRes = await fetch(`${BASE_URL}/api/admin/outreach/trigger`, {
          method: 'POST',
          headers,
          body: JSON.stringify(step.options || { source: 'facebook' })
        })
        
        if (!triggerRes.ok) throw new Error('Failed to trigger scraping')
        
        const result = await triggerRes.json()
        return result
      }
      
      default:
        throw new Error(`Unknown admin action: ${step.action}`)
    }
  }
  
  private async executeWaitForData(step: WaitForDataStep): Promise<Record<string, unknown>> {
    this.lastAction = `Waiting for data in ${step.table}`
    
    const startTime = Date.now()
    const timeout = step.timeout || 30000
    const pollInterval = step.pollInterval || 1000
    
    while (Date.now() - startTime < timeout) {
      let query = this.supabase.from(step.table).select('*')
      
      // Apply conditions
      for (const [field, value] of Object.entries(step.conditions)) {
        if (typeof value === 'object' && value !== null && 'not' in value) {
          // Handle { not: null } condition
          query = query.not(field, 'is', (value as { not: unknown }).not)
        } else {
          query = query.eq(field, value)
        }
      }
      
      // Execute query
      const { data, error } = await query
      
      if (error) {
        throw new Error(`Database query failed: ${error.message}`)
      }
      
      // Check if data meets expectations
      if (data && data.length > 0) {
        if (step.expectedCount === undefined || data.length === step.expectedCount) {
          return {
            found: true,
            count: data.length,
            elapsedMs: Date.now() - startTime,
            data: data
          }
        }
      }
      
      // Wait before polling again
      await this.delay(pollInterval)
    }
    
    throw new Error(`Timeout waiting for data in ${step.table} after ${timeout}ms`)
  }
  
  // ============================================================================
  // Validation
  // ============================================================================
  
  private async runValidation(): Promise<boolean> {
    const validationErrors: string[] = []
    
    for (const rule of this.scenario.expectedOutcomes.dataValidation) {
      try {
        const { data, error } = await this.supabase
          .from(rule.table)
          .select(rule.field)
        
        if (error) {
          validationErrors.push(`Query error for ${rule.table}.${rule.field}: ${error.message}`)
          continue
        }
        
        // Apply validation based on condition
        switch (rule.condition) {
          case 'exists':
            if (!data || data.length === 0) {
              validationErrors.push(`Expected ${rule.table}.${rule.field} to exist`)
            }
            break
          case 'equals':
            if (!data || data.length === 0 || data[0][rule.field] !== rule.value) {
              validationErrors.push(`Expected ${rule.table}.${rule.field} to equal ${rule.value}`)
            }
            break
          // Add other conditions as needed
        }
      } catch (error) {
        validationErrors.push(`Validation error: ${error}`)
      }
    }
    
    return validationErrors.length === 0
  }
  
  // ============================================================================
  // Error Recording
  // ============================================================================
  
  private recordError(params: {
    errorType: TestErrorContext['errorType']
    errorMessage: string
    stackTrace?: string
    stepIndex: number
    stepType: string
    stepConfig?: Record<string, unknown>
    request?: TestErrorContext['request']
    response?: TestErrorContext['response']
    expected?: unknown
    actual?: unknown
  }): void {
    const errorContext: TestErrorContext = {
      errorId: `err_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      testRunId: this.testRunId,
      clientSessionId: this.clientId,
      timestamp: new Date().toISOString(),
      errorType: params.errorType,
      errorMessage: params.errorMessage,
      stackTrace: params.stackTrace,
      scenario: this.scenario.id,
      stepIndex: params.stepIndex,
      stepType: params.stepType,
      stepConfig: params.stepConfig,
      persona: this.persona,
      request: params.request,
      response: params.response,
      expected: params.expected,
      actual: params.actual,
      likelySourceFiles: [],
      relevantCodeSnippets: []
    }
    
    this.errors.push(errorContext)
  }
  
  // ============================================================================
  // Result Building
  // ============================================================================
  
  private buildResult(): TestRunResult {
    const completedAt = this.completedAt || new Date().toISOString()
    
    return {
      clientId: this.clientId,
      testRunId: this.testRunId,
      persona: this.persona,
      scenario: this.scenario,
      status: this.status,
      startedAt: this.startedAt,
      completedAt,
      totalDuration: new Date(completedAt).getTime() - new Date(this.startedAt).getTime(),
      stepResults: this.stepResults,
      createdResources: this.createdResources,
      validationPassed: this.status === 'completed',
      validationErrors: [],
      errors: this.errors
    }
  }
  
  // ============================================================================
  // Cleanup
  // ============================================================================
  
  /**
   * Clean up test data created by this client
   */
  async cleanup(): Promise<void> {
    console.log(`[${this.clientId}] Cleaning up test data...`)
    
    // Delete chat messages and session
    if (this.createdResources.chatSessionId) {
      await this.supabase
        .from('chat_messages')
        .delete()
        .eq('session_id', this.createdResources.chatSessionId)
      
      await this.supabase
        .from('chat_sessions')
        .delete()
        .eq('session_id', this.createdResources.chatSessionId)
    }
    
    // Delete diagnostic audit
    if (this.createdResources.diagnosticId) {
      await this.supabase
        .from('diagnostic_audits')
        .delete()
        .eq('id', this.createdResources.diagnosticId)
    }
    
    // Delete contact submission
    if (this.createdResources.contactId) {
      await this.supabase
        .from('contact_submissions')
        .delete()
        .eq('id', this.createdResources.contactId)
    }
    
    // Delete order (if any)
    if (this.createdResources.orderId) {
      await this.supabase
        .from('order_items')
        .delete()
        .eq('order_id', this.createdResources.orderId)
      
      await this.supabase
        .from('orders')
        .delete()
        .eq('id', this.createdResources.orderId)
    }
    
    console.log(`[${this.clientId}] Cleanup complete`)
  }
  
  // ============================================================================
  // Utility Methods
  // ============================================================================
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  /**
   * Get current status
   */
  getStatus(): TestStatus {
    return this.status
  }
  
  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId
  }
  
  /**
   * Get created resources
   */
  getCreatedResources(): typeof this.createdResources {
    return { ...this.createdResources }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new simulated client
 */
export function createSimulatedClient(config: {
  persona: TestPersona
  scenario: TestScenario
  testRunId: string
  clientId?: string
  useBrowser?: boolean
  useMockChat?: boolean
}): SimulatedClient {
  return new SimulatedClient({
    ...config,
    clientId: config.clientId || `client_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  })
}
