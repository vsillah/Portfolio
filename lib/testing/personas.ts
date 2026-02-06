/**
 * E2E Testing Framework - Test Personas
 * 
 * Predefined client personas that simulate realistic user behavior
 * during end-to-end testing.
 */

import type { 
  TestPersona, 
  PersonaRole, 
  UrgencyLevel, 
  BudgetRange, 
  DecisionTimeline,
  CommunicationStyle,
  InterestArea 
} from './types'

// ============================================================================
// Persona Definitions
// ============================================================================

/**
 * Startup Sarah - High urgency, limited budget, wants fast results
 */
export const startupSarah: TestPersona = {
  id: 'startup_sarah',
  name: 'Sarah Mitchell',
  company: 'TechFlow Solutions',
  email: '', // Generated at runtime
  role: 'decision_maker',
  
  urgency: 'high',
  budget: '$5K-$15K',
  techSavvy: 7,
  decisionTimeline: '30_days',
  
  painPoints: [
    'Manual lead follow-up taking too long',
    'Inconsistent sales messaging',
    'No visibility into pipeline health',
    'Losing deals due to slow response times'
  ],
  interestAreas: ['ai_automation', 'sales_pipeline', 'workflow_optimization'],
  
  communicationStyle: 'questioning',
  objectionProbability: 0.3,
  commonObjections: [
    'How quickly can this be implemented?',
    'What kind of ROI can I expect?',
    'Do you have case studies from similar companies?'
  ],
  
  diagnosticResponses: {
    business_challenges: {
      primary_challenges: ['Manual lead follow-up', 'Inconsistent messaging', 'Pipeline visibility'],
      pain_points: ['Slow response times', 'Admin tasks consuming 60% of time'],
      current_impact: 'Estimated $200K in lost revenue due to slow follow-up',
      attempted_solutions: ['Hired more sales reps', 'Tried Zapier but hit limitations']
    },
    tech_stack: {
      crm: 'HubSpot',
      email: 'Google Workspace',
      marketing: 'Mailchimp',
      analytics: 'Google Analytics',
      other_tools: ['Slack', 'Notion', 'Calendly'],
      integration_readiness: 'High - all tools have APIs'
    },
    automation_needs: {
      priority_areas: ['Lead scoring and routing', 'Automated follow-up sequences', 'Pipeline reporting'],
      desired_outcomes: ['Respond to leads within 5 minutes', 'Personalized outreach at scale'],
      complexity_tolerance: 'Medium - want results fast but willing to invest in setup'
    },
    ai_readiness: {
      data_quality: 'Good - clean CRM data',
      team_readiness: 'Excited about AI tools',
      previous_ai_experience: 'Used ChatGPT for email templates',
      concerns: ['Data privacy', 'Cost'],
      readiness_score: 7
    },
    budget_timeline: {
      budget_range: '$5,000-$15,000',
      timeline: 'Want to start within 30 days',
      decision_timeline: 'Can decide within 2 weeks',
      budget_flexibility: 'Could increase for proven ROI'
    },
    decision_making: {
      decision_maker: true,
      stakeholders: ['CEO', 'Sales Manager'],
      approval_process: 'Sarah has final say for tools under $20K',
      previous_vendor_experience: 'Good - currently using 3 SaaS tools'
    }
  }
}

/**
 * Enterprise Eric - Thorough researcher, needs ROI proof, long decision process
 */
export const enterpriseEric: TestPersona = {
  id: 'enterprise_eric',
  name: 'Eric Thompson',
  company: 'GlobalTech Industries',
  email: '',
  role: 'researcher',
  
  urgency: 'low',
  budget: '$50K+',
  techSavvy: 8,
  decisionTimeline: '90_days',
  
  painPoints: [
    'Complex approval processes slow everything down',
    'Need to integrate with legacy systems',
    'Security and compliance requirements',
    'Scaling solutions across multiple departments'
  ],
  interestAreas: ['ai_automation', 'consulting', 'training'],
  
  communicationStyle: 'detailed',
  objectionProbability: 0.5,
  commonObjections: [
    'We need to see detailed documentation and security certifications',
    'How does this integrate with our existing enterprise systems?',
    'What is your SLA and support structure?',
    'We require a formal RFP process'
  ],
  
  diagnosticResponses: {
    business_challenges: {
      primary_challenges: ['Legacy system integration', 'Multi-department coordination', 'Compliance requirements'],
      pain_points: ['Slow procurement process', 'Siloed data across departments'],
      current_impact: 'Inefficiencies costing approximately $500K annually',
      attempted_solutions: ['Internal IT projects', 'Multiple vendor POCs']
    },
    tech_stack: {
      crm: 'Salesforce Enterprise',
      email: 'Microsoft 365',
      erp: 'SAP',
      analytics: 'Tableau',
      other_tools: ['ServiceNow', 'Jira', 'Confluence'],
      integration_readiness: 'Complex - requires security review'
    },
    automation_needs: {
      priority_areas: ['Cross-department workflow automation', 'AI-powered analytics', 'Compliance reporting'],
      desired_outcomes: ['Unified data platform', 'Reduced manual reporting', 'Better forecasting'],
      complexity_tolerance: 'High - willing to invest in comprehensive solution'
    },
    ai_readiness: {
      data_quality: 'Mixed - needs data governance improvement',
      team_readiness: 'Varies by department',
      previous_ai_experience: 'Some ML models in production',
      concerns: ['Data governance', 'Model explainability', 'Vendor lock-in'],
      readiness_score: 6
    },
    budget_timeline: {
      budget_range: '$50,000+',
      timeline: 'Q3 implementation target',
      decision_timeline: '90-day evaluation process',
      budget_flexibility: 'Budget approved, needs business case'
    },
    decision_making: {
      decision_maker: false,
      stakeholders: ['CTO', 'VP of Operations', 'Security Team', 'Procurement'],
      approval_process: 'Requires steering committee approval',
      previous_vendor_experience: 'Formal vendor management process'
    }
  }
}

/**
 * Skeptical Sam - Price-focused, raises objections, needs convincing
 */
export const skepticalSam: TestPersona = {
  id: 'skeptical_sam',
  name: 'Sam Rodriguez',
  company: 'Rodriguez Consulting',
  email: '',
  role: 'budget_holder',
  
  urgency: 'medium',
  budget: '$1K-$5K',
  techSavvy: 5,
  decisionTimeline: 'exploratory',
  
  painPoints: [
    'Have been burned by overpromising vendors before',
    'Tight budget constraints',
    'Not sure if automation is worth the investment',
    'Concerned about learning curve'
  ],
  interestAreas: ['workflow_optimization'],
  
  communicationStyle: 'questioning',
  objectionProbability: 0.8,
  commonObjections: [
    'This seems expensive for what it does',
    'We tried something similar before and it did not work',
    'I do not have time to learn a new system',
    'Can you prove this will actually save us money?',
    'What happens if we want to cancel?'
  ],
  
  diagnosticResponses: {
    business_challenges: {
      primary_challenges: ['Manual processes', 'Limited staff', 'Tight margins'],
      pain_points: ['Spending too much time on admin work', 'Difficult to scale'],
      current_impact: 'Owner working 60+ hours/week on operational tasks',
      attempted_solutions: ['Excel spreadsheets', 'Tried a CRM but abandoned it']
    },
    tech_stack: {
      crm: 'None currently',
      email: 'Gmail',
      accounting: 'QuickBooks',
      other_tools: ['Excel', 'Google Docs'],
      integration_readiness: 'Low - basic tools only'
    },
    automation_needs: {
      priority_areas: ['Client communication', 'Invoice reminders', 'Basic reporting'],
      desired_outcomes: ['Save 10 hours per week', 'Fewer missed follow-ups'],
      complexity_tolerance: 'Low - needs to be simple and proven'
    },
    ai_readiness: {
      data_quality: 'Poor - mostly in spreadsheets',
      team_readiness: 'Skeptical but open',
      previous_ai_experience: 'None',
      concerns: ['Cost', 'Complexity', 'Time investment'],
      readiness_score: 3
    },
    budget_timeline: {
      budget_range: '$1,000-$5,000',
      timeline: 'Only if ROI is clear',
      decision_timeline: 'Need to see proof first',
      budget_flexibility: 'Very limited'
    },
    decision_making: {
      decision_maker: true,
      stakeholders: ['Just me'],
      approval_process: 'I make all decisions',
      previous_vendor_experience: 'Mixed - some bad experiences'
    }
  }
}

/**
 * Ready Rachel - Decision maker, has budget, ready to buy
 */
export const readyRachel: TestPersona = {
  id: 'ready_rachel',
  name: 'Rachel Chen',
  company: 'InnovateTech Co',
  email: '',
  role: 'decision_maker',
  
  urgency: 'high',
  budget: '$15K-$50K',
  techSavvy: 8,
  decisionTimeline: 'immediate',
  
  painPoints: [
    'Current system is failing and need replacement ASAP',
    'Growth is outpacing our processes',
    'Team is frustrated with manual workarounds'
  ],
  interestAreas: ['ai_automation', 'sales_pipeline', 'consulting'],
  
  communicationStyle: 'brief',
  objectionProbability: 0.1,
  commonObjections: [
    'When can we start?',
    'What is the fastest implementation timeline?'
  ],
  
  diagnosticResponses: {
    business_challenges: {
      primary_challenges: ['System failure', 'Rapid growth', 'Process bottlenecks'],
      pain_points: ['Current tool is EOL', 'Manual workarounds everywhere'],
      current_impact: 'Critical - current system failing',
      attempted_solutions: ['Tried to extend current system', 'Evaluated 3 other vendors']
    },
    tech_stack: {
      crm: 'Legacy system (being replaced)',
      email: 'Google Workspace',
      marketing: 'HubSpot Marketing',
      analytics: 'Mixpanel',
      other_tools: ['Slack', 'Asana', 'Figma'],
      integration_readiness: 'High - modern stack except CRM'
    },
    automation_needs: {
      priority_areas: ['Complete CRM replacement', 'Sales automation', 'Customer success workflows'],
      desired_outcomes: ['Unified customer view', 'Automated lifecycle campaigns', 'Self-service reporting'],
      complexity_tolerance: 'High - ready for comprehensive solution'
    },
    ai_readiness: {
      data_quality: 'Good - well structured',
      team_readiness: 'Very ready - championing the change',
      previous_ai_experience: 'Using AI for content and support',
      concerns: ['Migration from legacy system'],
      readiness_score: 9
    },
    budget_timeline: {
      budget_range: '$15,000-$50,000',
      timeline: 'Need to start this month',
      decision_timeline: 'Can sign this week',
      budget_flexibility: 'Approved and available'
    },
    decision_making: {
      decision_maker: true,
      stakeholders: ['CEO already aligned'],
      approval_process: 'Rachel has authority',
      previous_vendor_experience: 'Excellent - long-term partnerships'
    }
  }
}

/**
 * Technical Tom - Technical evaluator, focused on implementation details
 */
export const technicalTom: TestPersona = {
  id: 'technical_tom',
  name: 'Tom Anderson',
  company: 'DevOps Masters',
  email: '',
  role: 'technical',
  
  urgency: 'medium',
  budget: '$5K-$15K',
  techSavvy: 10,
  decisionTimeline: '30_days',
  
  painPoints: [
    'Need to understand API capabilities',
    'Integration complexity with existing systems',
    'Worried about vendor lock-in',
    'Need robust error handling and monitoring'
  ],
  interestAreas: ['ai_automation', 'workflow_optimization'],
  
  communicationStyle: 'detailed',
  objectionProbability: 0.4,
  commonObjections: [
    'What APIs and webhooks do you support?',
    'How do you handle rate limiting and retries?',
    'What is your uptime SLA?',
    'Can we access our data if we leave?'
  ],
  
  diagnosticResponses: {
    business_challenges: {
      primary_challenges: ['Integration complexity', 'System reliability', 'Technical debt'],
      pain_points: ['Manual data syncing', 'Inconsistent APIs across tools'],
      current_impact: 'Dev team spending 30% time on maintenance',
      attempted_solutions: ['Built internal tools', 'Using multiple point solutions']
    },
    tech_stack: {
      crm: 'Custom built on PostgreSQL',
      email: 'SendGrid API',
      infrastructure: 'AWS + Kubernetes',
      analytics: 'Custom + Datadog',
      other_tools: ['GitHub', 'CircleCI', 'PagerDuty', 'Terraform'],
      integration_readiness: 'Very high - API-first approach'
    },
    automation_needs: {
      priority_areas: ['API orchestration', 'Event-driven workflows', 'Monitoring integration'],
      desired_outcomes: ['Reduce custom code', 'Better observability', 'Faster iteration'],
      complexity_tolerance: 'Very high - prefer flexibility over simplicity'
    },
    ai_readiness: {
      data_quality: 'Excellent - well-structured databases',
      team_readiness: 'Enthusiastic about AI/ML',
      previous_ai_experience: 'Running ML models in production',
      concerns: ['Model versioning', 'Inference latency', 'Cost at scale'],
      readiness_score: 9
    },
    budget_timeline: {
      budget_range: '$5,000-$15,000 initially',
      timeline: 'After technical evaluation',
      decision_timeline: 'Need POC first',
      budget_flexibility: 'Can increase based on technical fit'
    },
    decision_making: {
      decision_maker: false,
      stakeholders: ['CTO', 'Engineering Lead'],
      approval_process: 'Tom evaluates, CTO decides',
      previous_vendor_experience: 'Prefer open source when possible'
    }
  }
}

/**
 * Browsing Brenda - Just exploring, not ready to commit
 */
export const browsingBrenda: TestPersona = {
  id: 'browsing_brenda',
  name: 'Brenda Williams',
  company: 'Williams & Associates',
  email: '',
  role: 'researcher',
  
  urgency: 'low',
  budget: '$1K-$5K',
  techSavvy: 4,
  decisionTimeline: 'exploratory',
  
  painPoints: [
    'Not sure what I need yet',
    'Just researching options',
    'Curious about AI but not committed'
  ],
  interestAreas: ['training'],
  
  communicationStyle: 'brief',
  objectionProbability: 0.6,
  commonObjections: [
    'I am just looking for now',
    'Can you send me some information to read later?',
    'I need to think about it',
    'Not ready to make any decisions yet'
  ],
  
  diagnosticResponses: {
    business_challenges: {
      primary_challenges: ['Not sure yet', 'General inefficiencies'],
      pain_points: ['Things could be better but not urgent'],
      current_impact: 'Unknown - have not quantified',
      attempted_solutions: ['Nothing specific']
    },
    tech_stack: {
      crm: 'Maybe HubSpot free tier',
      email: 'Gmail',
      other_tools: ['Not sure what we use'],
      integration_readiness: 'Unknown'
    },
    automation_needs: {
      priority_areas: ['Not sure yet'],
      desired_outcomes: ['General improvement'],
      complexity_tolerance: 'Low - needs to be easy'
    },
    ai_readiness: {
      data_quality: 'Unknown',
      team_readiness: 'Curious but cautious',
      previous_ai_experience: 'Used ChatGPT occasionally',
      concerns: ['Everything - very new to this'],
      readiness_score: 2
    },
    budget_timeline: {
      budget_range: 'Not sure',
      timeline: 'No timeline',
      decision_timeline: 'Not looking to decide anytime soon',
      budget_flexibility: 'Would need to be very cheap'
    },
    decision_making: {
      decision_maker: true,
      stakeholders: ['Just me'],
      approval_process: 'I decide but not ready',
      previous_vendor_experience: 'Limited'
    }
  }
}

// ============================================================================
// Persona Collection
// ============================================================================

export const ALL_PERSONAS: TestPersona[] = [
  startupSarah,
  enterpriseEric,
  skepticalSam,
  readyRachel,
  technicalTom,
  browsingBrenda
]

export const PERSONAS_BY_ID: Record<string, TestPersona> = {
  startup_sarah: startupSarah,
  enterprise_eric: enterpriseEric,
  skeptical_sam: skepticalSam,
  ready_rachel: readyRachel,
  technical_tom: technicalTom,
  browsing_brenda: browsingBrenda
}

// ============================================================================
// Persona Utilities
// ============================================================================

/**
 * Generate a unique email for a test persona
 */
export function generateTestEmail(persona: TestPersona, timestamp?: number): string {
  const ts = timestamp || Date.now()
  return `test-${persona.id}-${ts}@test.amadutown.com`
}

/**
 * Create a persona instance with unique email
 */
export function createPersonaInstance(personaId: string): TestPersona {
  const base = PERSONAS_BY_ID[personaId]
  if (!base) {
    throw new Error(`Unknown persona: ${personaId}`)
  }
  
  return {
    ...base,
    email: generateTestEmail(base)
  }
}

/**
 * Get a random persona from the pool
 */
export function getRandomPersona(pool?: TestPersona[]): TestPersona {
  const personas = pool || ALL_PERSONAS
  const index = Math.floor(Math.random() * personas.length)
  return createPersonaInstance(personas[index].id)
}

/**
 * Get personas by urgency level
 */
export function getPersonasByUrgency(urgency: UrgencyLevel): TestPersona[] {
  return ALL_PERSONAS.filter(p => p.urgency === urgency)
}

/**
 * Get personas by budget range
 */
export function getPersonasByBudget(budget: BudgetRange): TestPersona[] {
  return ALL_PERSONAS.filter(p => p.budget === budget)
}

/**
 * Get personas by role
 */
export function getPersonasByRole(role: PersonaRole): TestPersona[] {
  return ALL_PERSONAS.filter(p => p.role === role)
}

/**
 * Get high-value personas (decision makers with budget)
 */
export function getHighValuePersonas(): TestPersona[] {
  return ALL_PERSONAS.filter(p => 
    p.role === 'decision_maker' && 
    (p.budget === '$15K-$50K' || p.budget === '$50K+')
  )
}

/**
 * Create a custom persona by merging traits
 */
export function createCustomPersona(
  base: Partial<TestPersona>,
  overrides: Partial<TestPersona>
): TestPersona {
  const id = overrides.id || `custom_${Date.now()}`
  const merged = {
    ...startupSarah, // Default base
    ...base,
    ...overrides,
    id,
    email: ''
  } as TestPersona
  
  merged.email = generateTestEmail(merged)
  return merged
}
