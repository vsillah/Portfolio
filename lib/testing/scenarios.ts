/**
 * E2E Testing Framework - Test Scenarios
 * 
 * Predefined test scenarios that simulate realistic user journeys
 * through the website.
 */

import type { 
  TestScenario, 
  ScenarioStep,
  ValidationRule 
} from './types'

// ============================================================================
// Scenario Definitions
// ============================================================================

/**
 * Scenario 1: Browse and Buy
 * Simple e-commerce flow - browse products, add to cart, checkout
 */
export const browseAndBuyScenario: TestScenario = {
  id: 'browse_and_buy',
  name: 'Browse and Buy',
  description: 'Browse products, add to cart, complete checkout with Stripe test payment',
  
  steps: [
    { type: 'navigate', path: '/', waitForSelector: '[data-section="hero"]' },
    { type: 'browse', section: 'store', duration: 3000, interactions: ['scroll'] },
    { type: 'navigate', path: '/store', waitForSelector: '[data-testid="product-grid"]' },
    { type: 'delay', duration: 2000, randomize: true },
    { type: 'addToCart', productType: 'ebook' },
    { type: 'delay', duration: 1000 },
    { type: 'screenshot', name: 'cart-with-item' },
    { type: 'navigate', path: '/checkout', waitForSelector: '[data-testid="checkout-form"]' },
    { type: 'checkout', paymentMethod: 'stripe_test', usePersonaContact: true },
    { type: 'validateDatabase', table: 'orders', conditions: { status: 'completed' }, expectedCount: 1 },
    { type: 'screenshot', name: 'checkout-success' }
  ],
  
  variability: {
    skipProbability: {},
    delayRange: [500, 2000],
    responseVariation: false
  },
  
  expectedOutcomes: {
    mustComplete: ['addToCart', 'checkout'],
    mustNotError: ['navigate', 'validateDatabase'],
    dataValidation: [
      { table: 'orders', field: 'status', condition: 'equals', value: 'completed' },
      { table: 'order_items', field: 'id', condition: 'exists' }
    ]
  },
  
  estimatedDuration: 30000,
  tags: ['e-commerce', 'checkout', 'stripe', 'critical-path']
}

/**
 * Scenario 2: Chat to Diagnostic
 * Open chat, trigger diagnostic mode, complete all categories
 */
export const chatToDiagnosticScenario: TestScenario = {
  id: 'chat_to_diagnostic',
  name: 'Chat to Diagnostic',
  description: 'Engage with chat assistant, trigger diagnostic assessment, complete all 6 categories',
  
  steps: [
    { type: 'navigate', path: '/', waitForSelector: '[data-section="contact"]' },
    { type: 'browse', section: 'contact', duration: 2000, interactions: ['scroll'] },
    { type: 'chat', intent: 'greeting', message: 'Hi, I am interested in learning more about your services' },
    { type: 'delay', duration: 2000, randomize: true },
    { type: 'chat', intent: 'trigger_diagnostic', message: 'I would like to perform an AI audit of my business' },
    { type: 'diagnostic', completeAllCategories: true, usePersonaResponses: true },
    { type: 'screenshot', name: 'diagnostic-complete' },
    { type: 'validateDatabase', table: 'diagnostic_audits', conditions: { status: 'completed' }, expectedCount: 1 },
    { type: 'waitForWebhook', webhookType: 'diagnostic_completion', timeout: 10000 }
  ],
  
  variability: {
    skipProbability: {
      'waitForWebhook': 0.2 // Sometimes skip webhook validation
    },
    delayRange: [1000, 3000],
    responseVariation: true
  },
  
  expectedOutcomes: {
    mustComplete: ['chat', 'diagnostic'],
    mustNotError: ['navigate', 'validateDatabase'],
    dataValidation: [
      { table: 'diagnostic_audits', field: 'status', condition: 'equals', value: 'completed' },
      { table: 'diagnostic_audits', field: 'urgency_score', condition: 'exists' },
      { table: 'diagnostic_audits', field: 'opportunity_score', condition: 'exists' },
      { table: 'chat_messages', field: 'id', condition: 'exists' }
    ]
  },
  
  estimatedDuration: 120000, // Diagnostic takes longer
  tags: ['chat', 'diagnostic', 'lead-qualification', 'critical-path']
}

/**
 * Scenario 3: Service Inquiry
 * Browse services, request a quote via contact form
 */
export const serviceInquiryScenario: TestScenario = {
  id: 'service_inquiry',
  name: 'Service Inquiry',
  description: 'Browse services, select one for inquiry, submit contact form',
  
  steps: [
    { type: 'navigate', path: '/', waitForSelector: '[data-section="hero"]' },
    { type: 'browse', section: 'about', duration: 2000, interactions: ['scroll'] },
    { type: 'navigate', path: '/services', waitForSelector: '[data-testid="services-grid"]' },
    { type: 'delay', duration: 3000, randomize: true },
    { type: 'screenshot', name: 'services-page' },
    { type: 'navigate', path: '/#contact', waitForSelector: '[data-section="contact"]' },
    { type: 'contactForm', fields: {}, usePersonaData: true },
    { type: 'screenshot', name: 'contact-form-submitted' },
    { type: 'validateDatabase', table: 'contact_submissions', conditions: {}, expectedCount: 1 },
    { type: 'waitForWebhook', webhookType: 'lead_qualification', timeout: 10000 }
  ],
  
  variability: {
    skipProbability: {
      'waitForWebhook': 0.3
    },
    delayRange: [500, 2000],
    responseVariation: false
  },
  
  expectedOutcomes: {
    mustComplete: ['contactForm'],
    mustNotError: ['navigate', 'validateDatabase'],
    dataValidation: [
      { table: 'contact_submissions', field: 'email', condition: 'exists' },
      { table: 'contact_submissions', field: 'name', condition: 'exists' }
    ]
  },
  
  estimatedDuration: 25000,
  tags: ['services', 'contact-form', 'lead-generation']
}

/**
 * Scenario 4: Full Funnel Journey
 * Complete journey from chat through diagnostic to proposal
 */
export const fullFunnelScenario: TestScenario = {
  id: 'full_funnel',
  name: 'Full Funnel Journey',
  description: 'Complete customer journey: chat → diagnostic → contact → (simulated proposal)',
  
  steps: [
    // Discovery phase
    { type: 'navigate', path: '/', waitForSelector: '[data-section="hero"]' },
    { type: 'browse', section: 'projects', duration: 3000, interactions: ['scroll', 'hover'] },
    { type: 'browse', section: 'store', duration: 2000, interactions: ['scroll'] },
    { type: 'browse', section: 'about', duration: 2000, interactions: ['scroll'] },
    
    // Engagement phase - Chat
    { type: 'browse', section: 'contact', duration: 1000 },
    { type: 'chat', intent: 'introduction', message: 'Hello, I have been looking at your portfolio and I am impressed' },
    { type: 'delay', duration: 2000, randomize: true },
    { type: 'chat', intent: 'interest', message: 'I think we might need some help with our business processes' },
    { type: 'delay', duration: 1500, randomize: true },
    
    // Diagnostic phase
    { type: 'chat', intent: 'trigger_diagnostic', message: 'Could you help me identify what areas we should focus on? Maybe do an assessment?' },
    { type: 'diagnostic', completeAllCategories: true, usePersonaResponses: true },
    { type: 'screenshot', name: 'diagnostic-results' },
    
    // Contact phase
    { type: 'contactForm', fields: {}, usePersonaData: true },
    
    // Validation
    { type: 'validateDatabase', table: 'diagnostic_audits', conditions: { status: 'completed' } },
    { type: 'validateDatabase', table: 'contact_submissions', conditions: {} },
    { type: 'waitForWebhook', webhookType: 'diagnostic_completion', timeout: 15000 }
  ],
  
  variability: {
    skipProbability: {
      'browse:projects': 0.2,
      'browse:store': 0.3,
      'waitForWebhook': 0.2
    },
    delayRange: [1000, 4000],
    responseVariation: true
  },
  
  expectedOutcomes: {
    mustComplete: ['chat', 'diagnostic', 'contactForm'],
    mustNotError: ['navigate', 'validateDatabase'],
    dataValidation: [
      { table: 'diagnostic_audits', field: 'status', condition: 'equals', value: 'completed' },
      { table: 'contact_submissions', field: 'email', condition: 'exists' },
      { table: 'chat_sessions', field: 'session_id', condition: 'exists' }
    ]
  },
  
  estimatedDuration: 180000, // Full journey takes time
  tags: ['full-funnel', 'chat', 'diagnostic', 'contact', 'critical-path']
}

/**
 * Scenario 5: Abandoned Cart
 * Add items to cart but abandon during checkout - tests exit intent
 */
export const abandonedCartScenario: TestScenario = {
  id: 'abandoned_cart',
  name: 'Abandoned Cart',
  description: 'Add items to cart, start checkout, then abandon (tests exit intent and recovery)',
  
  steps: [
    { type: 'navigate', path: '/store', waitForSelector: '[data-testid="product-grid"]' },
    { type: 'delay', duration: 2000, randomize: true },
    { type: 'addToCart', productType: 'ebook' },
    { type: 'delay', duration: 1500 },
    { type: 'addToCart', productType: 'training' },
    { type: 'screenshot', name: 'cart-multiple-items' },
    { type: 'navigate', path: '/checkout', waitForSelector: '[data-testid="checkout-form"]' },
    { type: 'delay', duration: 3000, randomize: true },
    // Simulate abandonment by navigating away
    { type: 'navigate', path: '/', waitForSelector: '[data-section="hero"]' },
    { type: 'screenshot', name: 'exit-intent-popup' },
    { type: 'delay', duration: 5000 }, // Wait to see if exit intent fires
    // Come back
    { type: 'navigate', path: '/checkout', waitForSelector: '[data-testid="checkout-form"]' },
    { type: 'screenshot', name: 'cart-recovered' }
  ],
  
  variability: {
    skipProbability: {},
    delayRange: [1000, 3000],
    responseVariation: false
  },
  
  expectedOutcomes: {
    mustComplete: ['addToCart'],
    mustNotError: ['navigate'],
    dataValidation: [] // Cart is client-side, no DB validation needed
  },
  
  estimatedDuration: 35000,
  tags: ['cart', 'abandonment', 'exit-intent', 'recovery']
}

/**
 * Scenario 6: Support Escalation
 * Ask complex questions that should trigger escalation
 */
export const supportEscalationScenario: TestScenario = {
  id: 'support_escalation',
  name: 'Support Escalation',
  description: 'Ask complex or urgent questions to trigger human escalation',
  
  steps: [
    { type: 'navigate', path: '/#contact', waitForSelector: '[data-section="contact"]' },
    { type: 'chat', intent: 'urgent_help', message: 'I need urgent help with a problem I am having' },
    { type: 'delay', duration: 2000, randomize: true },
    { type: 'chat', intent: 'complex_question', message: 'We have a very complex integration requirement involving legacy systems, real-time data sync, and compliance requirements. Can I speak to someone who handles enterprise implementations?' },
    { type: 'delay', duration: 2000, randomize: true },
    { type: 'chat', intent: 'request_human', message: 'I would prefer to speak with a human about this' },
    { type: 'screenshot', name: 'escalation-triggered' },
    { type: 'validateDatabase', table: 'chat_sessions', conditions: { is_escalated: true } }
  ],
  
  variability: {
    skipProbability: {},
    delayRange: [1500, 3000],
    responseVariation: true
  },
  
  expectedOutcomes: {
    mustComplete: ['chat'],
    mustNotError: ['navigate'],
    dataValidation: [
      { table: 'chat_sessions', field: 'is_escalated', condition: 'equals', value: true }
    ]
  },
  
  estimatedDuration: 30000,
  tags: ['chat', 'escalation', 'support']
}

/**
 * Scenario 7: Quick Browse (Smoke Test)
 * Fast run through main pages - good for smoke testing
 */
export const quickBrowseScenario: TestScenario = {
  id: 'quick_browse',
  name: 'Quick Browse (Smoke Test)',
  description: 'Quick navigation through all main sections - smoke test',
  
  steps: [
    { type: 'navigate', path: '/', waitForSelector: '[data-section="hero"]' },
    { type: 'screenshot', name: 'home-page' },
    { type: 'browse', section: 'projects', duration: 1000 },
    { type: 'browse', section: 'store', duration: 1000 },
    { type: 'browse', section: 'about', duration: 1000 },
    { type: 'browse', section: 'contact', duration: 1000 },
    { type: 'navigate', path: '/store', waitForSelector: '[data-testid="product-grid"]' },
    { type: 'screenshot', name: 'store-page' },
    { type: 'navigate', path: '/services', waitForSelector: '[data-testid="services-grid"]' },
    { type: 'screenshot', name: 'services-page' },
    { type: 'navigate', path: '/', waitForSelector: '[data-section="hero"]' }
  ],
  
  variability: {
    skipProbability: {},
    delayRange: [200, 500],
    responseVariation: false
  },
  
  expectedOutcomes: {
    mustComplete: [],
    mustNotError: ['navigate'],
    dataValidation: []
  },
  
  estimatedDuration: 15000,
  tags: ['smoke-test', 'navigation', 'quick']
}

// ============================================================================
// Scenario Collections
// ============================================================================

export const ALL_SCENARIOS: TestScenario[] = [
  browseAndBuyScenario,
  chatToDiagnosticScenario,
  serviceInquiryScenario,
  fullFunnelScenario,
  abandonedCartScenario,
  supportEscalationScenario,
  quickBrowseScenario
]

export const SCENARIOS_BY_ID: Record<string, TestScenario> = {
  browse_and_buy: browseAndBuyScenario,
  chat_to_diagnostic: chatToDiagnosticScenario,
  service_inquiry: serviceInquiryScenario,
  full_funnel: fullFunnelScenario,
  abandoned_cart: abandonedCartScenario,
  support_escalation: supportEscalationScenario,
  quick_browse: quickBrowseScenario
}

/**
 * Critical path scenarios that should always pass
 */
export const CRITICAL_SCENARIOS: TestScenario[] = [
  browseAndBuyScenario,
  chatToDiagnosticScenario,
  fullFunnelScenario
]

/**
 * Quick smoke test scenarios
 */
export const SMOKE_TEST_SCENARIOS: TestScenario[] = [
  quickBrowseScenario
]

/**
 * Chat-focused scenarios
 */
export const CHAT_SCENARIOS: TestScenario[] = [
  chatToDiagnosticScenario,
  fullFunnelScenario,
  supportEscalationScenario
]

/**
 * E-commerce focused scenarios
 */
export const ECOMMERCE_SCENARIOS: TestScenario[] = [
  browseAndBuyScenario,
  abandonedCartScenario
]

// ============================================================================
// Scenario Utilities
// ============================================================================

/**
 * Get scenario by ID
 */
export function getScenario(id: string): TestScenario | undefined {
  return SCENARIOS_BY_ID[id]
}

/**
 * Get scenarios by tag
 */
export function getScenariosByTag(tag: string): TestScenario[] {
  return ALL_SCENARIOS.filter(s => s.tags.includes(tag))
}

/**
 * Get a random scenario, optionally weighted
 */
export function getRandomScenario(
  pool?: TestScenario[],
  weights?: Record<string, number>
): TestScenario {
  const scenarios = pool || ALL_SCENARIOS
  
  if (weights) {
    // Weighted random selection
    const totalWeight = scenarios.reduce((sum, s) => sum + (weights[s.id] || 1), 0)
    let random = Math.random() * totalWeight
    
    for (const scenario of scenarios) {
      random -= weights[scenario.id] || 1
      if (random <= 0) {
        return scenario
      }
    }
  }
  
  // Uniform random selection
  const index = Math.floor(Math.random() * scenarios.length)
  return scenarios[index]
}

/**
 * Estimate total duration for a set of scenarios
 */
export function estimateTotalDuration(scenarios: TestScenario[]): number {
  return scenarios.reduce((sum, s) => sum + s.estimatedDuration, 0)
}

/**
 * Create a custom scenario by combining steps from multiple scenarios
 */
export function createCompositeScenario(
  id: string,
  name: string,
  stepSources: { scenarioId: string; stepIndices: number[] }[]
): TestScenario {
  const steps: ScenarioStep[] = []
  const tags = new Set<string>()
  
  for (const source of stepSources) {
    const scenario = getScenario(source.scenarioId)
    if (scenario) {
      for (const index of source.stepIndices) {
        if (scenario.steps[index]) {
          steps.push(scenario.steps[index])
        }
      }
      scenario.tags.forEach(tag => tags.add(tag))
    }
  }
  
  return {
    id,
    name,
    description: `Composite scenario: ${name}`,
    steps,
    variability: {
      skipProbability: {},
      delayRange: [500, 2000],
      responseVariation: true
    },
    expectedOutcomes: {
      mustComplete: [],
      mustNotError: ['navigate'],
      dataValidation: []
    },
    estimatedDuration: steps.length * 5000, // Rough estimate
    tags: ['composite', ...Array.from(tags)]
  }
}
