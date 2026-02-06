/**
 * E2E Testing Framework - AI Chat Agent
 * 
 * Uses an LLM to generate realistic, contextual client responses
 * based on the persona and current scenario context.
 */

import type {
  TestPersona,
  TestScenario,
  ChatAgentConfig,
  ChatAgentMessage,
  ChatAgentResponse,
  LLMProvider,
  DiagnosticStep
} from './types'

// ============================================================================
// System Prompts
// ============================================================================

/**
 * Base system prompt for simulating a client
 */
function buildClientSystemPrompt(persona: TestPersona, scenario: TestScenario): string {
  return `You are simulating a potential client visiting a portfolio/consulting website for automated end-to-end testing.

## Your Persona
- **Name**: ${persona.name}
- **Company**: ${persona.company}
- **Role**: ${persona.role}
- **Budget**: ${persona.budget}
- **Urgency**: ${persona.urgency}
- **Decision Timeline**: ${persona.decisionTimeline}
- **Tech Savviness**: ${persona.techSavvy}/10
- **Communication Style**: ${persona.communicationStyle}

## Pain Points
${persona.painPoints.map(p => `- ${p}`).join('\n')}

## Interest Areas
${persona.interestAreas.join(', ')}

## Current Scenario
**${scenario.name}**: ${scenario.description}

## Guidelines
1. Stay in character based on your persona at all times
2. Ask questions a real client would ask
3. Be ${persona.communicationStyle} in your responses
4. ${persona.objectionProbability > 0.5 ? 'You are skeptical and will raise objections frequently' : 'You are generally receptive but may occasionally have concerns'}
5. Your responses should feel natural and human-like
6. Do NOT break character or mention that you are an AI or a test
7. Keep responses concise (1-3 sentences typically)

## Common Objections You Might Raise
${persona.commonObjections.map(o => `- "${o}"`).join('\n')}

Respond naturally as this client would. Remember: you are testing the website's chat system, so interact as a real potential customer would.`
}

/**
 * System prompt specifically for diagnostic mode
 */
function buildDiagnosticSystemPrompt(persona: TestPersona): string {
  const responses = persona.diagnosticResponses || {}
  
  return `You are in a business diagnostic/audit mode. The AI assistant will ask you questions about your business challenges, tech stack, automation needs, AI readiness, budget, and decision-making process.

## Your Pre-Defined Answers

### Business Challenges
${JSON.stringify(responses.business_challenges || {}, null, 2)}

### Tech Stack
${JSON.stringify(responses.tech_stack || {}, null, 2)}

### Automation Needs
${JSON.stringify(responses.automation_needs || {}, null, 2)}

### AI Readiness
${JSON.stringify(responses.ai_readiness || {}, null, 2)}

### Budget & Timeline
${JSON.stringify(responses.budget_timeline || {}, null, 2)}

### Decision Making
${JSON.stringify(responses.decision_making || {}, null, 2)}

## Guidelines
1. Answer questions based on the pre-defined data above
2. Paraphrase and speak naturally - don't just dump JSON
3. You can elaborate or add color commentary that fits your persona
4. Stay consistent with the data provided
5. If asked something not covered above, improvise in a way that's consistent with your persona
6. Keep responses conversational and realistic`
}

// ============================================================================
// Chat Agent Implementation
// ============================================================================

export class ChatAgent {
  private config: ChatAgentConfig
  private conversationHistory: ChatAgentMessage[] = []
  private turnCount = 0
  private inDiagnosticMode = false
  
  constructor(config: ChatAgentConfig) {
    this.config = config
  }
  
  /**
   * Generate a response to the assistant's message
   */
  async generateResponse(
    assistantMessage: string,
    context?: {
      intent?: string
      diagnosticMode?: boolean
      currentCategory?: string
    }
  ): Promise<ChatAgentResponse> {
    // Update diagnostic mode
    if (context?.diagnosticMode !== undefined) {
      this.inDiagnosticMode = context.diagnosticMode
    }
    
    // Check turn limit
    if (this.turnCount >= this.config.maxTurns) {
      return {
        message: "Thank you for the information. I'll think about it and get back to you.",
        shouldContinue: false,
        metadata: { reason: 'max_turns_reached' }
      }
    }
    
    // Add assistant message to history
    this.conversationHistory.push({
      role: 'assistant',
      content: assistantMessage
    })
    
    // Build the prompt
    const systemPrompt = this.inDiagnosticMode
      ? buildDiagnosticSystemPrompt(this.config.persona)
      : buildClientSystemPrompt(this.config.persona, this.config.scenario)
    
    // Generate response using the configured LLM
    const response = await this.callLLM(systemPrompt, context)
    
    // Add user response to history
    this.conversationHistory.push({
      role: 'user',
      content: response.message
    })
    
    this.turnCount++
    
    // Apply response delay
    await this.applyDelay()
    
    return response
  }
  
  /**
   * Generate an initial message to start the conversation
   */
  async generateInitialMessage(intent?: string): Promise<ChatAgentResponse> {
    const { persona, scenario } = this.config
    
    // Generate intent-based opening messages
    const openings: Record<string, string[]> = {
      greeting: [
        `Hi there! I'm ${persona.name} from ${persona.company}.`,
        `Hello! I've been looking at your portfolio.`,
        `Hi, I found your website and I'm interested in learning more.`
      ],
      inquiry: [
        `I'm looking for help with ${persona.painPoints[0]?.toLowerCase() || 'some business challenges'}.`,
        `We're exploring solutions for ${persona.interestAreas[0]?.replace('_', ' ') || 'automation'}.`,
        `I heard you might be able to help with ${persona.interestAreas.join(' and ').replace(/_/g, ' ')}.`
      ],
      trigger_diagnostic: [
        `I'd like to perform an AI audit of my business.`,
        `Can you help me identify areas where we could improve?`,
        `I'm interested in getting a diagnostic assessment.`
      ],
      urgent_help: [
        `I need urgent help with a critical issue.`,
        `We have an urgent situation and need assistance ASAP.`
      ],
      complex_question: [
        `We have a complex integration requirement. Can I speak to someone about enterprise implementations?`
      ]
    }
    
    const intentMessages = openings[intent || 'greeting'] || openings.greeting
    const message = intentMessages[Math.floor(Math.random() * intentMessages.length)]
    
    this.conversationHistory.push({
      role: 'user',
      content: message
    })
    
    this.turnCount++
    
    await this.applyDelay()
    
    return {
      message,
      shouldContinue: true,
      intent
    }
  }
  
  /**
   * Generate a diagnostic response based on the current category
   */
  async generateDiagnosticResponse(
    assistantQuestion: string,
    category: string
  ): Promise<ChatAgentResponse> {
    const responses = this.config.persona.diagnosticResponses || {}
    const categoryData = responses[category as keyof typeof responses]
    
    if (!categoryData) {
      // Improvise a response
      return this.generateResponse(assistantQuestion, {
        diagnosticMode: true,
        currentCategory: category
      })
    }
    
    // Convert the structured data into a natural response
    const naturalResponse = await this.structuredToNatural(categoryData, category)
    
    this.conversationHistory.push({
      role: 'assistant',
      content: assistantQuestion
    })
    
    this.conversationHistory.push({
      role: 'user',
      content: naturalResponse
    })
    
    this.turnCount++
    
    await this.applyDelay()
    
    return {
      message: naturalResponse,
      shouldContinue: true,
      metadata: { category, usedPresetData: true }
    }
  }
  
  /**
   * Reset the conversation state
   */
  reset(): void {
    this.conversationHistory = []
    this.turnCount = 0
    this.inDiagnosticMode = false
  }
  
  /**
   * Get conversation history
   */
  getHistory(): ChatAgentMessage[] {
    return [...this.conversationHistory]
  }
  
  /**
   * Get current turn count
   */
  getTurnCount(): number {
    return this.turnCount
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  /**
   * Call the LLM to generate a response
   */
  private async callLLM(
    systemPrompt: string,
    context?: { intent?: string; currentCategory?: string }
  ): Promise<ChatAgentResponse> {
    const { llmProvider, model, persona } = this.config
    
    // Build messages array
    const messages: ChatAgentMessage[] = [
      { role: 'system', content: systemPrompt },
      ...this.conversationHistory
    ]
    
    // Add context hints
    if (context?.intent) {
      messages.push({
        role: 'system',
        content: `[Context: The user's intent is "${context.intent}". Respond accordingly.]`
      })
    }
    
    try {
      if (llmProvider === 'openai') {
        return await this.callOpenAI(messages, model)
      } else if (llmProvider === 'anthropic') {
        return await this.callAnthropic(messages, model)
      } else {
        // Fallback to mock response
        return this.generateMockResponse(context)
      }
    } catch (error) {
      console.error('LLM call failed:', error)
      // Return a generic fallback response
      return this.generateMockResponse(context)
    }
  }
  
  /**
   * Call OpenAI API
   */
  private async callOpenAI(
    messages: ChatAgentMessage[],
    model: string
  ): Promise<ChatAgentResponse> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role: m.role === 'system' ? 'system' : m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        })),
        temperature: this.config.temperature || 0.7,
        max_tokens: 200
      })
    })
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }
    
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    
    return {
      message: content,
      shouldContinue: this.turnCount < this.config.maxTurns - 1
    }
  }
  
  /**
   * Call Anthropic API
   */
  private async callAnthropic(
    messages: ChatAgentMessage[],
    model: string
  ): Promise<ChatAgentResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured')
    }
    
    // Extract system message and convert format
    const systemMessage = messages.find(m => m.role === 'system')?.content || ''
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        system: systemMessage,
        messages: conversationMessages,
        max_tokens: 200,
        temperature: this.config.temperature || 0.7
      })
    })
    
    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`)
    }
    
    const data = await response.json()
    const content = data.content?.[0]?.text || ''
    
    return {
      message: content,
      shouldContinue: this.turnCount < this.config.maxTurns - 1
    }
  }
  
  /**
   * Generate a mock response when LLM is not available
   */
  private generateMockResponse(
    context?: { intent?: string; currentCategory?: string }
  ): ChatAgentResponse {
    const { persona } = this.config
    
    // Mock responses based on persona style
    const mockResponses: Record<string, string[]> = {
      brief: [
        "Interesting. Tell me more.",
        "That sounds good.",
        "What's the next step?",
        "I understand."
      ],
      detailed: [
        "That's very helpful information. I'd like to understand more about how this would work specifically for our situation.",
        "I appreciate the detail. Can you elaborate on the implementation process and what kind of support we'd receive?",
        "This aligns well with what we're looking for. What would be the typical timeline for getting started?"
      ],
      questioning: [
        "How does that compare to other solutions on the market?",
        "What kind of results have similar companies seen?",
        "What happens if we need to make changes later?",
        "Can you walk me through a specific example?"
      ]
    }
    
    const styleResponses = mockResponses[persona.communicationStyle] || mockResponses.brief
    const message = styleResponses[Math.floor(Math.random() * styleResponses.length)]
    
    return {
      message,
      shouldContinue: this.turnCount < this.config.maxTurns - 1,
      metadata: { mock: true }
    }
  }
  
  /**
   * Convert structured diagnostic data to natural language
   */
  private async structuredToNatural(
    data: Record<string, unknown>,
    category: string
  ): Promise<string> {
    // Simple template-based conversion
    const templates: Record<string, (data: Record<string, unknown>) => string> = {
      business_challenges: (d) => {
        const challenges = (d.primary_challenges as string[]) || []
        const impact = d.current_impact as string || 'significant impact'
        return `Our main challenges are ${challenges.join(', ')}. ${impact}`
      },
      tech_stack: (d) => {
        const crm = d.crm || 'no CRM'
        const tools = (d.other_tools as string[]) || []
        return `We use ${crm} for our CRM, along with ${tools.join(', ')}.`
      },
      automation_needs: (d) => {
        const priorities = (d.priority_areas as string[]) || []
        const outcomes = (d.desired_outcomes as string[]) || []
        return `Our priorities are ${priorities.join(', ')}. We'd like to ${outcomes[0] || 'improve efficiency'}.`
      },
      ai_readiness: (d) => {
        const quality = d.data_quality || 'mixed'
        const readiness = d.team_readiness || 'cautiously optimistic'
        return `Our data quality is ${quality}. The team is ${readiness}.`
      },
      budget_timeline: (d) => {
        const budget = d.budget_range || 'flexible'
        const timeline = d.timeline || 'open'
        return `Our budget is ${budget} and timeline is ${timeline}.`
      },
      decision_making: (d) => {
        const maker = d.decision_maker ? 'I am the decision maker' : 'I need to consult with others'
        const stakeholders = (d.stakeholders as string[]) || []
        return `${maker}. Key stakeholders include ${stakeholders.join(', ')}.`
      }
    }
    
    const template = templates[category]
    if (template) {
      return template(data)
    }
    
    // Fallback: stringify and hope for the best
    return Object.entries(data)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('. ')
  }
  
  /**
   * Apply random delay to simulate human typing
   */
  private async applyDelay(): Promise<void> {
    const [min, max] = this.config.responseDelay
    const delay = Math.floor(Math.random() * (max - min) + min)
    await new Promise(resolve => setTimeout(resolve, delay))
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a chat agent with default configuration
 */
export function createChatAgent(
  persona: TestPersona,
  scenario: TestScenario,
  options?: Partial<ChatAgentConfig>
): ChatAgent {
  const config: ChatAgentConfig = {
    persona,
    scenario,
    llmProvider: (process.env.TEST_LLM_PROVIDER as LLMProvider) || 'openai',
    model: process.env.TEST_LLM_MODEL || 'gpt-4o-mini',
    maxTurns: 20,
    responseDelay: [500, 2000],
    temperature: 0.7,
    ...options
  }
  
  return new ChatAgent(config)
}

/**
 * Create a chat agent that uses mock responses (no LLM calls)
 */
export function createMockChatAgent(
  persona: TestPersona,
  scenario: TestScenario
): ChatAgent {
  return new ChatAgent({
    persona,
    scenario,
    llmProvider: 'openai', // Will fallback to mock
    model: 'mock',
    maxTurns: 20,
    responseDelay: [100, 500] // Faster for testing
  })
}
