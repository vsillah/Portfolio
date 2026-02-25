/**
 * E2E Testing Framework - Error Remediation System
 * 
 * AI-powered error analysis and fix generation for test failures.
 * Supports multiple output targets: GitHub PR, Cursor tasks, n8n workflows.
 */

import type {
  TestErrorContext,
  RemediationRequest,
  RemediationResult,
  RemediationAnalysis,
  CodeFix,
  RemediationOptions,
  RemediationOutput,
  CodeSnippet
} from './types'
import { createClient } from '@supabase/supabase-js'
import { n8nWebhookUrl } from '../n8n'
import { testDb } from './test-db-cast'

// ============================================================================
// Configuration
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_REPO = process.env.GITHUB_REPO || 'owner/my-portfolio'

// ============================================================================
// Remediation Engine
// ============================================================================

export class RemediationEngine {
  private supabase: ReturnType<typeof createClient>
  
  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  }
  
  /**
   * Create a new remediation request
   */
  async createRequest(
    errors: TestErrorContext[],
    options: RemediationOptions,
    additionalNotes?: string,
    priorityLevel: 'critical' | 'high' | 'medium' | 'low' = 'medium',
    createdBy?: string
  ): Promise<RemediationRequest> {
    // Let database generate UUID
    const insertData = {
      test_run_id: errors[0]?.testRunId || null,
      error_ids: errors.map(e => e.errorId),
      options: options,
      additional_notes: additionalNotes,
      priority: priorityLevel,
      created_by: createdBy,
      status: 'pending'
    }
    
    // Save to database and get the generated ID (test table not in app schema)
    const db = testDb(this.supabase)
    const { data: inserted, error: insertError } = await db
      .from('test_remediation_requests')
      .insert(insertData)
      .select('id')
      .single()
    
    if (insertError || !inserted) {
      const msg = insertError && typeof insertError === 'object' && 'message' in insertError
        ? String((insertError as { message: unknown }).message)
        : 'Unknown error'
      throw new Error(`Failed to create remediation request: ${msg}`)
    }
    
    // Link errors to this remediation request
    const errorIds = errors.map(e => e.errorId)
    if (errorIds.length > 0) {
      await db
        .from('test_errors')
        .update({
          remediation_request_id: inserted.id,
          remediation_status: 'in_progress'
        })
        .in('error_id', errorIds)
    }
    
    const request: RemediationRequest = {
      id: inserted.id,
      testRunId: errors[0]?.testRunId || '',
      errorIds: errorIds,
      errors,
      options,
      additionalNotes,
      priorityLevel,
      createdAt: new Date().toISOString()
    }
    
    return request
  }
  
  /**
   * Process a remediation request
   */
  async processRequest(requestId: string): Promise<RemediationResult> {
    // Update status
    await this.updateStatus(requestId, 'analyzing')
    
    const db = testDb(this.supabase)
    // Fetch the request (row shape from test_remediation_requests)
    const { data: requestData } = await db
      .from('test_remediation_requests')
      .select('*')
      .eq('id', requestId)
      .single()
    
    if (!requestData) {
      throw new Error(`Remediation request ${requestId} not found`)
    }
    const request = requestData as { id: string; error_ids: string[]; options: RemediationOptions }
    
    // Fetch error details
    const { data: errors } = await db
      .from('test_errors')
      .select('*')
      .in('error_id', request.error_ids)
    
    const errorContexts = errors as unknown as TestErrorContext[]
    
    // Analyze the errors
    const analysis = await this.analyzeErrors(errorContexts)
    
    await db
      .from('test_remediation_requests')
      .update({ analysis, status: 'generating_fix' })
      .eq('id', requestId)
    
    // Generate fixes
    const fixes = await this.generateFixes(errorContexts, analysis)
    
    await db
      .from('test_remediation_requests')
      .update({ fixes, status: 'review_required' })
      .eq('id', requestId)
    
    // Route to appropriate output
    const result = await this.routeToOutput(
      requestId,
      request.options,
      analysis,
      fixes,
      errorContexts
    )
    
    // Update final status
    await db
      .from('test_remediation_requests')
      .update({
        status: result.status,
        github_pr_url: result.prUrl,
        cursor_task_id: result.cursorTaskId,
        n8n_execution_id: result.n8nExecutionId,
        completed_at: new Date().toISOString()
      })
      .eq('id', requestId)
    
    return result
  }
  
  /**
   * Analyze errors to determine root cause
   */
  async analyzeErrors(errors: TestErrorContext[]): Promise<RemediationAnalysis> {
    // Group errors by type and location
    const errorsByType: Record<string, TestErrorContext[]> = {}
    const affectedFiles = new Set<string>()
    
    for (const error of errors) {
      const key = `${error.errorType}:${error.stepType}`
      if (!errorsByType[key]) {
        errorsByType[key] = []
      }
      errorsByType[key].push(error)
      
      error.likelySourceFiles?.forEach(f => affectedFiles.add(f))
    }
    
    // Determine most common error pattern
    const sortedTypes = Object.entries(errorsByType)
      .sort((a, b) => b[1].length - a[1].length)
    
    const primaryErrors = sortedTypes[0]?.[1] || []
    const primaryError = primaryErrors[0]
    
    // Infer likely source files based on error type and step
    const inferredFiles = this.inferSourceFiles(primaryError)
    inferredFiles.forEach(f => affectedFiles.add(f))
    
    // Build analysis
    const analysis: RemediationAnalysis = {
      rootCause: this.inferRootCause(primaryError),
      affectedFiles: Array.from(affectedFiles),
      suggestedApproach: this.suggestApproach(primaryError),
      confidence: this.calculateConfidence(errors),
      estimatedComplexity: this.estimateComplexity(errors)
    }
    
    // If we have an LLM available, enhance the analysis
    if (process.env.OPENAI_API_KEY) {
      const enhancedAnalysis = await this.enhanceAnalysisWithLLM(errors, analysis)
      return enhancedAnalysis
    }
    
    return analysis
  }
  
  /**
   * Generate code fixes based on analysis
   */
  async generateFixes(
    errors: TestErrorContext[],
    analysis: RemediationAnalysis
  ): Promise<CodeFix[]> {
    const fixes: CodeFix[] = []
    
    // For each affected file, try to generate a fix
    for (const filePath of analysis.affectedFiles.slice(0, 5)) { // Limit to 5 files
      const relevantSnippets = errors
        .flatMap(e => e.relevantCodeSnippets || [])
        .filter(s => s.file === filePath)
      
      if (relevantSnippets.length > 0) {
        const fix = await this.generateFixForFile(
          filePath,
          relevantSnippets,
          errors,
          analysis
        )
        
        if (fix) {
          fixes.push(fix)
        }
      }
    }
    
    return fixes
  }
  
  /**
   * Route the remediation to the appropriate output
   */
  async routeToOutput(
    requestId: string,
    options: RemediationOptions,
    analysis: RemediationAnalysis,
    fixes: CodeFix[],
    errors: TestErrorContext[]
  ): Promise<RemediationResult> {
    const result: RemediationResult = {
      requestId,
      status: 'review_required',
      analysis,
      fixes
    }
    
    switch (options.output) {
      case 'github_pr':
        if (options.autoCreatePR && GITHUB_TOKEN) {
          const prResult = await this.createGitHubPR(
            errors,
            analysis,
            fixes,
            options.targetBranch || 'main',
            options.assignees
          )
          result.prUrl = prResult.url
          result.status = 'applied'
        }
        break
        
      case 'cursor_task':
        const cursorTask = this.buildCursorTask(errors, analysis, fixes)
        result.cursorTaskId = cursorTask.id
        // Store the task for retrieval
        await this.storeCursorTask(requestId, cursorTask)
        break
        
      case 'n8n_workflow':
        const n8nResult = await this.triggerN8nWorkflow(
          requestId,
          errors,
          analysis,
          fixes
        )
        result.n8nExecutionId = n8nResult.executionId
        break
        
      case 'report':
        // Just generate a report, no automated action
        result.status = 'review_required'
        break
    }
    
    return result
  }
  
  // ============================================================================
  // Analysis Helpers
  // ============================================================================
  
  private inferRootCause(error: TestErrorContext | undefined): string {
    if (!error) return 'Unable to determine root cause - no error context available'
    
    const causes: Record<string, string> = {
      api_error: `API endpoint failure in ${error.stepType} step. The server returned an unexpected response.`,
      validation_error: `Data validation failed in ${error.stepType} step. Expected data did not match actual results.`,
      timeout: `Operation timed out in ${error.stepType} step. The target operation took longer than expected.`,
      assertion: `Assertion failed in ${error.stepType} step. Test expectations were not met.`,
      exception: `Unhandled exception in ${error.stepType} step. An unexpected error occurred during execution.`,
      network_error: `Network connectivity issue in ${error.stepType} step. Unable to reach the target endpoint.`
    }
    
    return causes[error.errorType] || `Unknown error type: ${error.errorType}`
  }
  
  private inferSourceFiles(error: TestErrorContext | undefined): string[] {
    if (!error) return []
    
    const filesByStep: Record<string, string[]> = {
      chat: ['app/api/chat/route.ts', 'lib/n8n.ts', 'components/chat/Chat.tsx'],
      diagnostic: ['app/api/chat/route.ts', 'lib/diagnostic.ts', 'lib/n8n.ts'],
      checkout: ['app/api/checkout/route.ts', 'lib/stripe.ts', 'components/checkout/'],
      contactForm: ['app/api/contact/route.ts', 'components/Contact.tsx'],
      navigate: ['app/', 'components/Navigation.tsx'],
      addToCart: ['lib/cart.ts', 'components/ShoppingCart.tsx'],
      validateDatabase: ['lib/supabase.ts']
    }
    
    return filesByStep[error.stepType] || []
  }
  
  private suggestApproach(error: TestErrorContext | undefined): string {
    if (!error) return 'Review the test logs for more context.'
    
    const approaches: Record<string, string> = {
      api_error: 'Check API route handlers, verify request/response formats, and review error handling.',
      validation_error: 'Review database queries, check data transformations, and verify schema constraints.',
      timeout: 'Increase timeout values, optimize slow queries, or add caching for expensive operations.',
      assertion: 'Update test expectations or fix the underlying logic that produces incorrect results.',
      exception: 'Add try-catch blocks, validate inputs, and handle edge cases in the affected code.',
      network_error: 'Check network configuration, verify API endpoints, and review firewall settings.'
    }
    
    return approaches[error.errorType] || 'Review the error details and stack trace for insights.'
  }
  
  private calculateConfidence(errors: TestErrorContext[]): number {
    // Higher confidence if:
    // - Errors are consistent (same type)
    // - Stack traces are available
    // - Source files are identified
    
    let confidence = 0.5 // Base confidence
    
    // Check consistency
    const types = new Set(errors.map(e => e.errorType))
    if (types.size === 1) confidence += 0.2
    
    // Check for stack traces
    const hasStacks = errors.some(e => e.stackTrace)
    if (hasStacks) confidence += 0.15
    
    // Check for identified source files
    const hasFiles = errors.some(e => e.likelySourceFiles?.length > 0)
    if (hasFiles) confidence += 0.15
    
    return Math.min(confidence, 1)
  }
  
  private estimateComplexity(
    errors: TestErrorContext[]
  ): 'simple' | 'moderate' | 'complex' {
    // Estimate based on:
    // - Number of unique error types
    // - Number of affected files
    // - Error messages suggesting deep issues
    
    const types = new Set(errors.map(e => e.errorType))
    const files = new Set(errors.flatMap(e => e.likelySourceFiles || []))
    
    if (types.size === 1 && files.size <= 2) return 'simple'
    if (types.size <= 2 && files.size <= 5) return 'moderate'
    return 'complex'
  }
  
  // ============================================================================
  // Fix Generation
  // ============================================================================
  
  private async generateFixForFile(
    filePath: string,
    snippets: CodeSnippet[],
    errors: TestErrorContext[],
    analysis: RemediationAnalysis
  ): Promise<CodeFix | null> {
    // If we have an LLM, use it to generate fixes
    if (process.env.OPENAI_API_KEY) {
      return this.generateFixWithLLM(filePath, snippets, errors, analysis)
    }
    
    // Otherwise, return a placeholder
    return {
      file: filePath,
      originalContent: snippets[0]?.content || '',
      fixedContent: '// TODO: Manual fix required',
      explanation: `Review ${filePath} for issues related to: ${errors[0]?.errorMessage}`,
      lineChanges: { added: 0, removed: 0 }
    }
  }
  
  private async generateFixWithLLM(
    filePath: string,
    snippets: CodeSnippet[],
    errors: TestErrorContext[],
    analysis: RemediationAnalysis
  ): Promise<CodeFix | null> {
    const prompt = `You are a code fixer. Analyze this error and generate a fix.

## Error Details
${errors.map(e => `- ${e.errorType}: ${e.errorMessage}`).join('\n')}

## Root Cause
${analysis.rootCause}

## File: ${filePath}
\`\`\`
${snippets.map(s => s.content).join('\n\n')}
\`\`\`

## Instructions
1. Identify the bug in the code
2. Generate a fixed version
3. Explain what was changed and why

Respond with JSON in this format:
{
  "fixedContent": "... the fixed code ...",
  "explanation": "... what was changed and why ..."
}`

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      })
      
      if (!response.ok) {
        console.error('LLM fix generation failed:', response.status)
        return null
      }
      
      const data = await response.json()
      const result = JSON.parse(data.choices[0].message.content)
      
      return {
        file: filePath,
        originalContent: snippets[0]?.content || '',
        fixedContent: result.fixedContent,
        explanation: result.explanation,
        lineChanges: {
          added: (result.fixedContent.match(/\n/g) || []).length,
          removed: (snippets[0]?.content.match(/\n/g) || []).length
        }
      }
    } catch (error) {
      console.error('LLM fix generation error:', error)
      return null
    }
  }
  
  private async enhanceAnalysisWithLLM(
    errors: TestErrorContext[],
    baseAnalysis: RemediationAnalysis
  ): Promise<RemediationAnalysis> {
    const prompt = `Analyze these test errors and provide insights.

## Errors
${errors.map(e => `
- Type: ${e.errorType}
- Message: ${e.errorMessage}
- Step: ${e.stepType}
- Scenario: ${e.scenario}
${e.stackTrace ? `- Stack: ${e.stackTrace.substring(0, 500)}` : ''}
`).join('\n')}

## Current Analysis
- Root Cause: ${baseAnalysis.rootCause}
- Affected Files: ${baseAnalysis.affectedFiles.join(', ')}

Provide a more detailed analysis in JSON format:
{
  "rootCause": "detailed explanation of root cause",
  "suggestedApproach": "step by step fix approach",
  "additionalFiles": ["any additional files that might be involved"]
}`

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        const result = JSON.parse(data.choices[0].message.content)
        
        return {
          ...baseAnalysis,
          rootCause: result.rootCause || baseAnalysis.rootCause,
          suggestedApproach: result.suggestedApproach || baseAnalysis.suggestedApproach,
          affectedFiles: [
            ...baseAnalysis.affectedFiles,
            ...(result.additionalFiles || [])
          ]
        }
      }
    } catch (error) {
      console.error('LLM analysis enhancement error:', error)
    }
    
    return baseAnalysis
  }
  
  // ============================================================================
  // Output Handlers
  // ============================================================================
  
  private async createGitHubPR(
    errors: TestErrorContext[],
    analysis: RemediationAnalysis,
    fixes: CodeFix[],
    targetBranch: string,
    assignees?: string[]
  ): Promise<{ url: string; number: number }> {
    if (!GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN not configured')
    }
    
    const [owner, repo] = GITHUB_REPO.split('/')
    const branchName = `fix/test-error-${Date.now()}`
    
    // For now, return a placeholder - full implementation would:
    // 1. Create branch
    // 2. Commit fixes
    // 3. Create PR
    
    console.log('[Remediation] Would create GitHub PR:', {
      branch: branchName,
      target: targetBranch,
      fixes: fixes.length,
      assignees
    })
    
    return {
      url: `https://github.com/${GITHUB_REPO}/pull/0`,
      number: 0
    }
  }
  
  private buildCursorTask(
    errors: TestErrorContext[],
    analysis: RemediationAnalysis,
    fixes: CodeFix[]
  ): { id: string; prompt: string } {
    const prompt = `## Task: Fix E2E Test Failure

### Error Summary
${errors.map(e => `
**${e.scenario} - Step ${e.stepIndex} (${e.stepType})**
- Error: ${e.errorMessage}
${e.expected ? `- Expected: ${JSON.stringify(e.expected)}` : ''}
${e.actual ? `- Actual: ${JSON.stringify(e.actual)}` : ''}
`).join('\n')}

### Root Cause Analysis
${analysis.rootCause}

### Suggested Approach
${analysis.suggestedApproach}

### Affected Files
${analysis.affectedFiles.map(f => `- ${f}`).join('\n')}

${fixes.length > 0 ? `
### Suggested Fixes
${fixes.map(f => `
#### ${f.file}
${f.explanation}

\`\`\`
${f.fixedContent.substring(0, 500)}${f.fixedContent.length > 500 ? '...' : ''}
\`\`\`
`).join('\n')}
` : ''}

### Instructions
1. Analyze the root cause of this test failure
2. Implement a fix that addresses the issue
3. Ensure the fix doesn't break other functionality
4. Re-run the test to verify the fix

### Constraints
- Maintain existing API contracts
- Follow the codebase's existing patterns
- Don't modify test expectations unless they were incorrect`

    return {
      id: `cursor_${Date.now()}`,
      prompt
    }
  }
  
  private async storeCursorTask(
    requestId: string,
    task: { id: string; prompt: string }
  ): Promise<void> {
    const db = testDb(this.supabase)
    await db
      .from('test_remediation_requests')
      .update({
        cursor_task_id: task.id
      })
      .eq('id', requestId)
  }
  
  private async triggerN8nWorkflow(
    requestId: string,
    errors: TestErrorContext[],
    analysis: RemediationAnalysis,
    fixes: CodeFix[]
  ): Promise<{ executionId: string }> {
    const webhookUrl = process.env.N8N_REMEDIATION_WEBHOOK_URL
      || n8nWebhookUrl('remediation')
    
    if (!webhookUrl) {
      console.log('[Remediation] N8N_REMEDIATION_WEBHOOK_URL not configured')
      return { executionId: '' }
    }
    
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remediate_test_failure',
          requestId,
          errors: errors.map(e => ({
            errorId: e.errorId,
            type: e.errorType,
            message: e.errorMessage,
            scenario: e.scenario,
            step: e.stepType
          })),
          analysis,
          fixes: fixes.map(f => ({
            file: f.file,
            explanation: f.explanation
          })),
          callbackUrl: `${process.env.NEXT_PUBLIC_URL}/api/testing/remediation/callback`
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        return { executionId: data.executionId || `n8n_${Date.now()}` }
      }
    } catch (error) {
      console.error('[Remediation] N8N trigger failed:', error)
    }
    
    return { executionId: '' }
  }
  
  // ============================================================================
  // Utility Methods
  // ============================================================================
  
  private async updateStatus(
    requestId: string,
    status: RemediationResult['status']
  ): Promise<void> {
    const db = testDb(this.supabase)
    await db
      .from('test_remediation_requests')
      .update({ status, started_at: new Date().toISOString() })
      .eq('id', requestId)
  }
  
  /**
   * Get remediation request by ID
   */
  async getRequest(requestId: string): Promise<RemediationRequest | null> {
    const db = testDb(this.supabase)
    const { data } = await db
      .from('test_remediation_requests')
      .select('*')
      .eq('id', requestId)
      .single()
    
    return data as RemediationRequest | null
  }
  
  /**
   * Get Cursor task prompt for a request
   */
  async getCursorTaskPrompt(requestId: string): Promise<string | null> {
    const db = testDb(this.supabase)
    const { data: raw } = await db
      .from('test_remediation_requests')
      .select('error_ids, analysis, fixes, status')
      .eq('id', requestId)
      .single()
    
    if (!raw) return null
    const data = raw as { error_ids: string[]; analysis: RemediationAnalysis | null; fixes: CodeFix[] | null; status: string }
    
    // Don't generate prompt if still processing
    if (!data.analysis) {
      return null
    }
    
    // Fetch errors
    const { data: errors } = await db
      .from('test_errors')
      .select('*')
      .in('error_id', data.error_ids)
    
    const task = this.buildCursorTask(
      errors as unknown as TestErrorContext[],
      data.analysis,
      data.fixes ?? []
    )
    
    return task.prompt
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let remediationEngine: RemediationEngine | null = null

export function getRemediationEngine(): RemediationEngine {
  if (!remediationEngine) {
    remediationEngine = new RemediationEngine()
  }
  return remediationEngine
}
