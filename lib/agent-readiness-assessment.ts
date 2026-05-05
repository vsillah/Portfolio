export type AgentReadinessSystemCategory =
  | 'crm'
  | 'erp'
  | 'hris'
  | 'payroll'
  | 'ticketing'
  | 'project_management'
  | 'documents'
  | 'spreadsheet'
  | 'communication'
  | 'database'
  | 'custom'
  | 'other'

export type AgentReadinessClassification =
  | 'context_only'
  | 'structured_reference'
  | 'workflow_ready'
  | 'agent_ready'

export type RecommendedAiRole = 'read' | 'recommend' | 'draft_with_approval' | 'act_with_guardrails'
export type AgentReadinessLevel =
  | 'organize_first'
  | 'context_layer_first'
  | 'workflow_copilot'
  | 'approval_gated_agent'
  | 'bounded_autonomy'

export interface AgentReadinessSystemAssessment {
  name: string
  category: AgentReadinessSystemCategory
  classification: AgentReadinessClassification
  confidence: 'low' | 'medium' | 'high'
  scores: {
    ownership: number
    assignees: number
    statefulness: number
    handoffs: number
    auditTrail: number
    permissions: number
    apiAccess: number
    dataQuality: number
    reversibility: number
    risk: number
  }
  recommendedAiRole: RecommendedAiRole
  notes?: string
}

export interface AgentReadinessAssessment {
  systems: AgentReadinessSystemAssessment[]
  contextReadinessScore: number
  workflowReadinessScore: number
  agentReadinessScore: number
  overallLevel: AgentReadinessLevel
  recommendationTier: 1 | 2 | 3 | 4 | 5
  clientSummary: string
  roadmapRecommendation: string
}

const SYSTEMS: Record<string, { name: string; category: AgentReadinessSystemCategory; base: AgentReadinessClassification }> = {
  salesforce: { name: 'Salesforce', category: 'crm', base: 'workflow_ready' },
  hubspot: { name: 'HubSpot', category: 'crm', base: 'workflow_ready' },
  jira: { name: 'Jira', category: 'ticketing', base: 'agent_ready' },
  linear: { name: 'Linear', category: 'project_management', base: 'agent_ready' },
  asana: { name: 'Asana', category: 'project_management', base: 'workflow_ready' },
  workday: { name: 'Workday / HRIS', category: 'hris', base: 'workflow_ready' },
  oracle: { name: 'Oracle ERP', category: 'erp', base: 'workflow_ready' },
  payroll: { name: 'Payroll system', category: 'payroll', base: 'workflow_ready' },
  service_now: { name: 'ServiceNow', category: 'ticketing', base: 'agent_ready' },
  google_drive: { name: 'Google Drive / Docs', category: 'documents', base: 'context_only' },
  sharepoint: { name: 'SharePoint / OneDrive', category: 'documents', base: 'context_only' },
  spreadsheets: { name: 'Spreadsheets', category: 'spreadsheet', base: 'structured_reference' },
  email: { name: 'Email inboxes', category: 'communication', base: 'context_only' },
  slack_teams: { name: 'Slack / Teams', category: 'communication', base: 'context_only' },
  database: { name: 'Custom database', category: 'database', base: 'structured_reference' },
  custom_app: { name: 'Custom internal app', category: 'custom', base: 'structured_reference' },
}

const scoreValue: Record<string, number> = {
  none: 1,
  unclear: 1,
  low: 2,
  scattered: 2,
  partial: 5,
  some: 5,
  medium: 5,
  documented: 7,
  mostly: 7,
  strong: 9,
  high: 9,
  mature: 10,
}

function normalizedScore(value: unknown, fallback: number): number {
  if (typeof value !== 'string') return fallback
  return scoreValue[value] ?? fallback
}

function riskScore(value: unknown): number {
  if (value === 'high') return 2
  if (value === 'medium') return 5
  if (value === 'low') return 9
  return 5
}

function average(values: number[]): number {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function downgradeForRisk(
  classification: AgentReadinessClassification,
  category: AgentReadinessSystemCategory,
  risk: number,
): AgentReadinessClassification {
  if (risk <= 3 && classification === 'agent_ready') return 'workflow_ready'
  if (risk <= 3 && category === 'payroll') return 'workflow_ready'
  return classification
}

function roleFor(classification: AgentReadinessClassification, risk: number): RecommendedAiRole {
  if (classification === 'context_only') return 'read'
  if (classification === 'structured_reference') return 'recommend'
  if (classification === 'workflow_ready') return 'draft_with_approval'
  return risk <= 6 ? 'draft_with_approval' : 'act_with_guardrails'
}

function levelFromScores(context: number, workflow: number, agent: number, highRiskCount: number): AgentReadinessLevel {
  if (context < 4 && workflow < 4) return 'organize_first'
  if (context >= 5 && workflow < 5) return 'context_layer_first'
  if (workflow >= 5 && agent < 6) return 'workflow_copilot'
  if (agent >= 7 && highRiskCount === 0) return 'bounded_autonomy'
  if (workflow >= 7 || agent >= 6) return 'approval_gated_agent'
  return 'context_layer_first'
}

function tierFor(level: AgentReadinessLevel): 1 | 2 | 3 | 4 | 5 {
  switch (level) {
    case 'organize_first': return 1
    case 'context_layer_first': return 2
    case 'workflow_copilot': return 3
    case 'approval_gated_agent': return 4
    case 'bounded_autonomy': return 5
  }
}

export function labelForAgentReadinessLevel(level: AgentReadinessLevel): string {
  switch (level) {
    case 'organize_first': return 'Organize first'
    case 'context_layer_first': return 'Context layer first'
    case 'workflow_copilot': return 'Workflow copilot'
    case 'approval_gated_agent': return 'Approval-gated agent'
    case 'bounded_autonomy': return 'Bounded autonomy'
  }
}

function summaryFor(level: AgentReadinessLevel): string {
  switch (level) {
    case 'organize_first':
      return 'Your information needs more structure before AI should do more than help organize and summarize it.'
    case 'context_layer_first':
      return 'Your data can support search, summarization, and knowledge retrieval before state-changing automation.'
    case 'workflow_copilot':
      return 'Your systems can support AI recommendations and drafts, with people approving the actual changes.'
    case 'approval_gated_agent':
      return 'Some systems are structured enough for agents to prepare and execute bounded actions after approval.'
    case 'bounded_autonomy':
      return 'Your strongest systems can support narrow autonomous actions when policy, monitoring, and rollback are in place.'
  }
}

function roadmapFor(level: AgentReadinessLevel): string {
  switch (level) {
    case 'organize_first':
      return 'Start with source inventory, ownership mapping, cleanup, and access controls before agent deployment.'
    case 'context_layer_first':
      return 'Prioritize a knowledge layer, document Q&A, meeting summaries, and source mapping.'
    case 'workflow_copilot':
      return 'Prioritize approval-gated copilots for follow-up drafts, task creation, reports, and workflow suggestions.'
    case 'approval_gated_agent':
      return 'Prioritize bounded agents with explicit approval gates for high-value workflow systems.'
    case 'bounded_autonomy':
      return 'Prioritize monitored agents for low-risk, reversible actions while keeping high-risk workflows approval-gated.'
  }
}

export function buildAgentReadinessAssessment(input: Record<string, unknown> | null | undefined): AgentReadinessAssessment {
  const systemKeys = Array.isArray(input?.systems) ? input?.systems as string[] : []
  const customSystems = typeof input?.other_systems === 'string'
    ? input.other_systems.split('\n').map((item) => item.trim()).filter(Boolean)
    : []

  const criteriaScores = {
    ownership: normalizedScore(input?.ownership_clarity, 4),
    assignees: normalizedScore(input?.assignee_clarity, 4),
    statefulness: normalizedScore(input?.status_tracking, 4),
    handoffs: normalizedScore(input?.handoff_clarity, 4),
    auditTrail: normalizedScore(input?.audit_trails, 4),
    permissions: normalizedScore(input?.permission_controls, 4),
    apiAccess: normalizedScore(input?.api_access, 4),
    dataQuality: normalizedScore(input?.data_quality, 4),
    reversibility: normalizedScore(input?.reversibility, 4),
    risk: riskScore(input?.business_risk),
  }

  const systems = [
    ...systemKeys.map((key) => SYSTEMS[key]).filter(Boolean),
    ...customSystems.map((name) => ({ name, category: 'other' as const, base: 'structured_reference' as const })),
  ]

  const assessedSystems = systems.map((system): AgentReadinessSystemAssessment => {
    const workflowScore = average([
      criteriaScores.ownership,
      criteriaScores.assignees,
      criteriaScores.statefulness,
      criteriaScores.handoffs,
      criteriaScores.auditTrail,
      criteriaScores.permissions,
    ])
    const agentScore = average([
      workflowScore,
      criteriaScores.apiAccess,
      criteriaScores.reversibility,
      criteriaScores.risk,
    ])
    const classification = downgradeForRisk(
      agentScore >= 8 ? 'agent_ready' : workflowScore >= 6 ? system.base : system.base === 'context_only' ? 'context_only' : 'structured_reference',
      system.category,
      criteriaScores.risk,
    )

    return {
      name: system.name,
      category: system.category,
      classification,
      confidence: systemKeys.length > 0 ? 'medium' : 'low',
      scores: criteriaScores,
      recommendedAiRole: roleFor(classification, criteriaScores.risk),
      notes: criteriaScores.risk <= 3 ? 'High-risk system. Keep human approval in the loop.' : undefined,
    }
  })

  const contextReadinessScore = assessedSystems.length
    ? average(assessedSystems.map((system) => average([system.scores.dataQuality, system.scores.permissions])))
    : average([criteriaScores.dataQuality, criteriaScores.permissions])
  const workflowReadinessScore = average([
    criteriaScores.ownership,
    criteriaScores.assignees,
    criteriaScores.statefulness,
    criteriaScores.handoffs,
    criteriaScores.auditTrail,
  ])
  const agentReadinessScore = average([
    workflowReadinessScore,
    criteriaScores.apiAccess,
    criteriaScores.reversibility,
    criteriaScores.risk,
  ])
  const highRiskCount = assessedSystems.filter((system) => system.scores.risk <= 3).length
  const overallLevel = levelFromScores(contextReadinessScore, workflowReadinessScore, agentReadinessScore, highRiskCount)

  return {
    systems: assessedSystems,
    contextReadinessScore,
    workflowReadinessScore,
    agentReadinessScore,
    overallLevel,
    recommendationTier: tierFor(overallLevel),
    clientSummary: summaryFor(overallLevel),
    roadmapRecommendation: roadmapFor(overallLevel),
  }
}
