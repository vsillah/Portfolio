import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/llm-dispatch', () => ({
  generateJsonCompletion: vi.fn(),
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: vi.fn(),
  recordAgentStep: vi.fn(),
  recordAgentEvent: vi.fn(),
  endAgentRun: vi.fn(),
  markAgentRunFailed: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: null,
}))

import {
  buildChiefOfStaffPrompt,
  evaluateChiefOfStaffBudget,
  getChiefOfStaffAgentRoutingCatalog,
  normalizeChiefOfStaffHistory,
  parseChiefOfStaffJson,
  summarizeAutomationContext,
  type ChiefOfStaffContext,
} from './chief-of-staff-chat'
import type { CodexAutomationInventory } from './codex-automation-inventory'

const context: ChiefOfStaffContext = {
  generatedAt: '2026-05-02T12:00:00.000Z',
  agentRoutingCatalog: getChiefOfStaffAgentRoutingCatalog(),
  activeRuns: [
    {
      id: 'run-1',
      agent_key: 'chief-of-staff',
      runtime: 'n8n',
      title: 'Morning review',
      status: 'running',
      current_step: 'Checking stale runs',
      error_message: null,
      started_at: '2026-05-02T11:55:00.000Z',
    },
  ],
  recentFailures: [],
  pendingApprovals: [],
  costEvents24h: {
    count: 2,
    totalUsd: 0.0123,
    providers: ['openai'],
    models: ['gpt-4o-mini'],
  },
  automationContext: {
    available: true,
    reason: null,
    sourceDirectory: '/Users/vambahsillah/.codex/automations',
    generatedAt: '2026-05-02T12:00:00.000Z',
    overview: {
      total: 2,
      active: 2,
      paused: 0,
      duplicateCandidates: 0,
      highRisk: 1,
      missingContext: 1,
    },
    hiddenCount: 0,
    highRiskAutomations: [
      {
        id: 'portfolio-credential-rotation-due-report',
        name: 'Portfolio Credential Rotation Due Report',
        category: 'Credentials',
        boundary: 'approval-required',
        contextHealth: 'yellow',
        missingQuestions: ['governance'],
      },
    ],
    contextGapAutomations: [
      {
        id: 'portfolio-credential-rotation-due-report',
        name: 'Portfolio Credential Rotation Due Report',
        category: 'Credentials',
        riskLevel: 'high',
        contextHealth: 'yellow',
        missingQuestions: ['governance'],
        recommendations: ['Reference the governing doc, skill, source register, or runbook path in the automation prompt.'],
      },
    ],
    duplicateCandidates: [],
  },
}

describe('Chief of Staff chat helpers', () => {
  it('normalizes chat history to the last valid messages', () => {
    const history = normalizeChiefOfStaffHistory([
      { role: 'user', content: '  first  ' },
      { role: 'assistant', content: '' },
      { role: 'assistant', content: 'second' },
      { role: 'user', content: 'third' },
    ])

    expect(history).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'second' },
      { role: 'user', content: 'third' },
    ])
  })

  it('parses the model JSON contract', () => {
    const result = parseChiefOfStaffJson(JSON.stringify({
      reply: 'Focus on the pending deployment and the approval queue.',
      suggested_actions: ['Check failed runs', 'Run morning review'],
      action_proposals: [
        {
          label: 'Approve outbound update',
          description: 'Prepare a checkpoint before sending a client-facing status email.',
          action: 'send_email',
          risk_level: 'high',
        },
      ],
      agent_engagements: [
        {
          agent_key: 'research-source-register',
          label: 'Run research agent',
          rationale: 'Gather source-backed context for this decision.',
        },
        {
          agent_key: 'unknown-agent',
          label: 'Ignore unknown',
          rationale: 'This should be dropped.',
        },
      ],
    }))

    expect(result.reply).toContain('pending deployment')
    expect(result.suggestedActions).toEqual(['Check failed runs', 'Run morning review'])
    expect(result.actionProposals).toEqual([
      {
        label: 'Approve outbound update',
        description: 'Prepare a checkpoint before sending a client-facing status email.',
        action: 'send_email',
        approvalType: 'send_email',
        requiresApproval: true,
        riskLevel: 'high',
      },
    ])
    expect(result.agentEngagements).toEqual([
      {
        agentKey: 'research-source-register',
        agentName: 'Askia Muhammad (Songhai) - Research Source Register',
        label: 'Run research agent',
        rationale: 'Gather source-backed context for this decision.',
        status: 'partial',
        executionMode: 'read_only',
      },
    ])
  })

  it('builds a read-only operational prompt', () => {
    const prompt = buildChiefOfStaffPrompt(context, [{ role: 'user', content: 'What needs attention?' }])

    expect(prompt.systemPrompt).toContain('production mutations')
    expect(prompt.systemPrompt).toContain('Automation context')
    expect(prompt.systemPrompt).toContain('front-door router')
    expect(prompt.systemPrompt).toContain('Return JSON only')
    expect(prompt.systemPrompt).toContain('action_proposals')
    expect(prompt.systemPrompt).toContain('agent_engagements')
    expect(prompt.systemPrompt).toContain('strategic-narrative')
    expect(prompt.systemPrompt).toContain('course-curriculum-builder')
    expect(prompt.userPrompt).toContain('Morning review')
    expect(prompt.userPrompt).toContain('agentRoutingCatalog')
    expect(prompt.userPrompt).toContain('Strategy & Narrative Pod')
    expect(prompt.userPrompt).toContain('Portfolio Credential Rotation Due Report')
    expect(prompt.userPrompt).toContain('What needs attention?')
  })

  it('evaluates the Chief of Staff LLM budget before dispatch', () => {
    const decision = evaluateChiefOfStaffBudget({
      model: 'gpt-4o-mini',
      systemPrompt: 'You are the Shaka (Zulu) - Chief of Staff.',
      userPrompt: 'Summarize the current operating state.',
      maxTokens: 900,
    })

    expect(decision.status).toBe('allowed')
    expect(decision.rule.key).toBe('llm_codex_per_call')
  })

  it('blocks oversized Chief of Staff prompts before dispatch', () => {
    const decision = evaluateChiefOfStaffBudget({
      model: 'gpt-4o',
      systemPrompt: 'x'.repeat(2_000_000),
      userPrompt: 'y'.repeat(2_000_000),
      maxTokens: 100_000,
    })

    expect(decision.status).toBe('blocked')
    expect(decision.reason).toContain('exceeds Codex LLM call cap')
  })

  it('keeps the Chief of Staff router aligned to the agent organization map', () => {
    const catalog = getChiefOfStaffAgentRoutingCatalog()

    expect(catalog.length).toBeGreaterThan(10)
    expect(catalog.map((agent) => agent.key)).toEqual(expect.arrayContaining([
      'chief-of-staff',
      'strategic-narrative',
      'research-source-register',
      'voice-content-architect',
      'automation-systems',
      'inbox-follow-up',
      'warm-lead-capture',
      'meeting-intake-follow-up',
    ]))
    expect(catalog.find((agent) => agent.key === 'automation-systems')).toMatchObject({
      pod: 'Product & Automation Pod',
      status: 'active',
      primaryRuntime: 'n8n',
    })
  })

  it('summarizes automation context without raw prompt excerpts', () => {
    const inventory: CodexAutomationInventory = {
      available: true,
      sourceDirectory: '/Users/vambahsillah/.codex/automations',
      generatedAt: '2026-05-02T12:00:00.000Z',
      hiddenCount: 1,
      overview: {
        total: 2,
        active: 2,
        paused: 0,
        duplicateCandidates: 1,
        highRisk: 1,
        missingContext: 1,
      },
      progress: {
        label: 'Memory and automation context readiness',
        percent: 86,
        completedTasks: 6,
        totalTasks: 7,
        tasks: [
          {
            id: 'governing-docs',
            label: 'Governing docs and runbooks',
            description: 'Map each automation to at least one governing doc, skill, source path, or runbook.',
            status: 'in_progress',
            progress: 50,
          },
        ],
      },
      repairPackets: [
        {
          automationId: 'portfolio-credential-rotation-due-report',
          automationName: 'Portfolio Credential Rotation Due Report',
          priority: 'high',
          summary: 'Portfolio Credential Rotation Due Report needs context repair for missing governance.',
          missingQuestions: ['governance'],
          recommendedActions: ['Reference the governing doc, skill, source register, or runbook path in the automation prompt.'],
          governingDocCandidates: ['docs/memory-context-organization-workflow.md'],
          sourceFile: '/Users/vambahsillah/.codex/automations/portfolio-credential-rotation-due-report/automation.toml',
          operationalBoundary: 'Read-only packet. Do not edit ~/.codex/automations or ~/.codex/memories without an explicit operational-state step.',
        },
      ],
      automations: [
        {
          id: 'portfolio-credential-rotation-due-report',
          name: 'Portfolio Credential Rotation Due Report',
          kind: 'cron',
          status: 'ACTIVE',
          schedule: 'FREQ=WEEKLY',
          model: 'gpt-5.5',
          reasoningEffort: 'high',
          executionEnvironment: 'local',
          cwds: ['/Users/vambahsillah/Projects/Portfolio'],
          createdAt: 1,
          updatedAt: 2,
          category: 'Credentials',
          riskLevel: 'high',
          portfolioRelated: true,
          sourceFile: '/Users/vambahsillah/.codex/automations/portfolio-credential-rotation-due-report/automation.toml',
          controlDocs: [],
          promptExcerpt: 'Run with API_KEY=[redacted].',
          duplicateCandidate: true,
          managementBoundary: 'approval-required',
          contextHealth: 'yellow',
          contextGaps: ['missing control docs'],
          contextQuestions: [
            {
              id: 'governance',
              question: 'What doc, skill, or runbook governs it?',
              answered: false,
              answer: null,
              recommendation: 'Reference the governing doc, skill, source register, or runbook path in the automation prompt.',
            },
          ],
          contextProfile: {
            purpose: 'Check credential rotation posture.',
            operatingRhythm: 'weekly',
            recurringDecisions: 'Reviews evidence and recommends status, next action, or approval path.',
            inputs: ['/Users/vambahsillah/Projects/Portfolio'],
            dependencies: ['Codex', 'Portfolio'],
            frictionPoints: [],
            authorityBoundary: 'approval-required',
            expectedOutputs: ['approval packet'],
            escalationTrigger: 'Escalate when an approval-required action or packet is needed.',
            governingDocs: [],
          },
        },
      ],
    }

    const summary = summarizeAutomationContext(inventory)

    expect(summary.available).toBe(true)
    expect(summary.hiddenCount).toBe(1)
    expect(summary.highRiskAutomations).toEqual([
      {
        id: 'portfolio-credential-rotation-due-report',
        name: 'Portfolio Credential Rotation Due Report',
        category: 'Credentials',
        boundary: 'approval-required',
        contextHealth: 'yellow',
        missingQuestions: ['governance'],
      },
    ])
    expect(JSON.stringify(summary)).not.toContain('API_KEY')
    expect(summary.contextGapAutomations[0].recommendations).toContain('Reference the governing doc, skill, source register, or runbook path in the automation prompt.')
  })
})
