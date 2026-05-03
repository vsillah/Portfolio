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
  normalizeChiefOfStaffHistory,
  parseChiefOfStaffJson,
  summarizeAutomationContext,
  type ChiefOfStaffContext,
} from './chief-of-staff-chat'
import type { CodexAutomationInventory } from './codex-automation-inventory'

const context: ChiefOfStaffContext = {
  generatedAt: '2026-05-02T12:00:00.000Z',
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
        agentName: 'Research & Source Register Agent',
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
    expect(prompt.systemPrompt).toContain('Return JSON only')
    expect(prompt.systemPrompt).toContain('action_proposals')
    expect(prompt.systemPrompt).toContain('agent_engagements')
    expect(prompt.userPrompt).toContain('Morning review')
    expect(prompt.userPrompt).toContain('Portfolio Credential Rotation Due Report')
    expect(prompt.userPrompt).toContain('What needs attention?')
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
