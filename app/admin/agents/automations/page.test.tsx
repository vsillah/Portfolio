import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgentAutomationsPage from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

const automationProfile = {
  id: 'morning-review',
  name: 'Morning review',
  kind: 'cron',
  status: 'ACTIVE',
  schedule: 'weekdays',
  model: 'gpt-5.2',
  reasoningEffort: 'medium',
  executionEnvironment: 'local',
  cwds: ['/Users/vambahsillah/Projects/Portfolio'],
  createdAt: null,
  updatedAt: null,
  category: 'Operations',
  riskLevel: 'medium',
  portfolioRelated: true,
  sourceFile: '/Users/vambahsillah/.codex/automations/morning-review/automation.toml',
  controlDocs: [],
  promptExcerpt: 'Review Agent Ops status.',
  duplicateCandidate: false,
  managementBoundary: 'read_only',
  contextHealth: 'yellow',
  contextGaps: ['missing governing docs'],
  contextQuestions: [
    {
      id: 'purpose',
      question: 'What is the purpose?',
      answered: false,
      answer: null,
      recommendation: 'Add a purpose to the automation prompt.',
    },
  ],
  contextProfile: {
    purpose: null,
    operatingRhythm: 'Morning',
    recurringDecisions: null,
    inputs: ['Agent Ops'],
    dependencies: ['Portfolio'],
    frictionPoints: ['Missing docs'],
    authorityBoundary: 'read_only',
    expectedOutputs: ['Brief'],
    escalationTrigger: null,
    governingDocs: [],
  },
}

const inventoryResponse = {
  available: true,
  sourceDirectory: '/Users/vambahsillah/.codex/automations',
  generatedAt: '2026-05-15T12:00:00.000Z',
  automations: [automationProfile],
  hiddenCount: 0,
  overview: {
    total: 1,
    active: 1,
    paused: 0,
    duplicateCandidates: 0,
    highRisk: 0,
    missingContext: 1,
  },
  progress: {
    label: 'Memory organization',
    percent: 50,
    completedTasks: 1,
    totalTasks: 2,
    tasks: [{
      id: 'docs',
      label: 'Docs',
      description: 'Add governing docs.',
      status: 'in_progress',
      progress: 50,
    }],
  },
  repairPackets: [{
    automationId: 'morning-review',
    automationName: 'Morning review',
    priority: 'medium',
    summary: 'Add governing docs.',
    missingQuestions: ['purpose'],
    recommendedActions: ['Reference the runbook.'],
    governingDocCandidates: ['docs/agents/integration-captain.md'],
    sourceFile: '/Users/vambahsillah/.codex/automations/morning-review/automation.toml',
    operationalBoundary: 'Read-only packet.',
  }],
  workspaceRoots: {
    available: true,
    generatedAt: '2026-05-15T12:00:00.000Z',
    expectedRoot: '/Users/vambahsillah/Projects/Portfolio',
    stateDatabase: '/tmp/state.db',
    globalStateFile: '/tmp/state.json',
    savedWorkspaceRoots: ['/Users/vambahsillah/Projects/Portfolio'],
    activeWorkspaceRoots: ['/Users/vambahsillah/Projects/Portfolio'],
    projectOrderRoots: ['/Users/vambahsillah/Projects/Portfolio'],
    threadRoots: [{
      cwd: '/Users/vambahsillah/Projects/Portfolio',
      activeCount: 1,
      portfolioRoot: true,
    }],
    overview: {
      activeThreads: 1,
      portfolioThreads: 1,
      nonPortfolioThreads: 0,
      savedRootDrift: 0,
      activeRootDrift: 0,
      projectOrderDrift: 0,
    },
    health: 'green',
    warnings: [],
    operationalBoundary: 'Read-only root report.',
  },
}

const actionsResponse = {
  available: true,
  generatedAt: '2026-05-15T12:00:00.000Z',
  sourceDirectory: '/Users/vambahsillah/.codex/automation-notifications',
  stateFile: '/tmp/action-tracker.json',
  actions: [{
    id: 'action-1',
    automationId: 'morning-review',
    automationName: 'Morning review',
    statusColor: 'yellow',
    headline: 'Review context',
    summary: 'Morning review needs a governing doc.',
    kind: 'blocker_or_approval',
    text: 'Add governing context before next run',
    priority: 'high',
    actionStatus: 'open',
    owner: null,
    note: null,
    linkedWorkItemId: null,
    firstSeenAt: '2026-05-15T10:00:00.000Z',
    lastSeenAt: '2026-05-15T11:00:00.000Z',
    occurrenceCount: 2,
    sourceFiles: ['/tmp/report.md'],
    latestSourceFile: '/tmp/report.md',
    codexThreadHint: null,
  }],
  recentNotifications: [],
  summary: {
    total: 1,
    open: 1,
    inProgress: 0,
    blocked: 0,
    done: 0,
    dismissed: 0,
    urgent: 0,
    high: 1,
  },
}

describe('AgentAutomationsPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/admin/agents/automation-actions')) {
        return { ok: true, json: async () => actionsResponse }
      }
      return { ok: true, json: async () => inventoryResponse }
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders action-first automation controls and navigates to the relevant view', async () => {
    render(<AgentAutomationsPage />)

    expect(await screen.findByRole('region', { name: 'Automation next actions' })).toBeInTheDocument()
    expect(screen.getByText('Automation actions need review')).toBeInTheDocument()
    expect(screen.getByText('Action tracker')).toBeInTheDocument()
    expect(screen.getByText('Context gaps')).toBeInTheDocument()
    expect(screen.getByText('Repair packets')).toBeInTheDocument()
    expect(screen.getByText('Workspace drift')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Review gaps/i }))

    expect(screen.getByText('Context Gaps Workflow')).toBeInTheDocument()
    expect(screen.getByText('What is the purpose?')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/automations', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
    }))
  })
})
