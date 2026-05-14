import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgentCoordinationPage from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

const now = '2026-05-11T12:00:00.000Z'

const workItems = [
  {
    id: 'work-queue-1',
    title: 'Approve agent run recovery request',
    objective: 'Decide whether Shaka can move the recovery packet into validation.',
    status: 'ready_for_review',
    priority: 'high',
    owner_agent_key: 'chief-of-staff',
    owner_runtime: 'codex',
    source_type: 'agent_run',
    source_id: 'run-queue-1',
    source_label: 'Agent run trace',
    source_run_id: 'run-queue-1',
    active_run_id: 'run-queue-1',
    parent_work_item_id: null,
    branch_name: 'codex/agent-run-recovery',
    worktree_path: '/Users/vambahsillah/Projects/Portfolio.worktrees/recovery',
    pr_number: 231,
    pr_url: 'https://github.com/example/portfolio/pull/231',
    expected_files: ['app/admin/agents/coordination/page.tsx'],
    touched_files: [],
    overlap_group: 'agent-ops',
    dependency_ids: [],
    blocker_summary: null,
    validation_summary: 'Focused tests pass; awaiting executive decision.',
    approval_id: 'approval-1',
    metadata: { recommendation: 'Approve validation after checking the trace and PR evidence.', risk: 'medium' },
    idempotency_key: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
  },
  {
    id: 'work-queue-2',
    title: 'Unblock Moremi drill handoff',
    objective: 'Resolve the synthetic risk signal owner handoff before any remediation.',
    status: 'blocked',
    priority: 'urgent',
    owner_agent_key: 'risk-compliance-intelligence',
    owner_runtime: 'manual',
    source_type: 'ai_risk_signal',
    source_id: 'moremi-operational-drill',
    source_label: 'Synthetic Agent Ops drill',
    source_run_id: null,
    active_run_id: 'run-moremi-drill',
    parent_work_item_id: null,
    branch_name: null,
    worktree_path: null,
    pr_number: null,
    pr_url: null,
    expected_files: [],
    touched_files: [],
    overlap_group: 'ai-risk-compliance',
    dependency_ids: [],
    blocker_summary: 'Needs Integration Captain owner decision.',
    validation_summary: null,
    approval_id: null,
    metadata: {},
    idempotency_key: 'ai-risk-drill:moremi-operational-drill:v1',
    created_at: now,
    updated_at: now,
    completed_at: null,
  },
]

const approvalCard = {
  approvalId: 'approval-1',
  runId: 'run-1',
  workItemId: 'work-1',
  status: 'pending',
  requestedAt: now,
  proposal: {
    id: 'next-build-profile',
    title: 'Profile the Next.js build path',
    hypothesis: 'Find the slow build step.',
    expectedImpact: 'Reduce deployment research time.',
    scorecardBaseline: {
      project: 'portfolio',
      target: 'preview',
      queueSeconds: 1,
      buildSeconds: 221,
      totalSeconds: 223,
    },
    touchedFiles: ['package.json'],
    touchedSettings: [],
    riskLevel: 'low',
    approvalState: 'not_required',
    approvalQuestion: 'Approve a read-only/local build-profile experiment?',
    rollbackPath: 'Discard the branch.',
    evidence: ['build=3m41s'],
  },
  notification: {
    slackSentAt: '2026-05-11T12:01:00.000Z',
    slackSkippedAt: null,
  },
  workItem: {
    id: 'work-1',
    title: 'Profile the Next.js build path',
    status: 'ready_for_review',
    active_run_id: 'run-1',
    approval_id: 'approval-1',
    updated_at: now,
  },
}

function moremiDrillResponse() {
  return {
    ok: true,
    work_item: {
      ...workItems[1],
      id: 'work-moremi-drill',
      title: 'Review AI risk signal: Synthetic Moremi drill: prompt injection risk in browser automation',
      status: 'proposed',
    },
    assessment: {
      classification: 'approval_required',
      severity: 'high',
      recommendedNextAction: 'Create an approval-routed risk packet before any remediation work begins.',
    },
    verification: {
      admin_path: '/admin/agents/coordination',
      slack_command: '/agent work',
      expected_status: 'proposed',
    },
  }
}

function setupFetch({ failWorkItems = false } = {}) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)

    if (url === '/api/admin/agents/work-items' && init?.method === 'POST') {
      return { ok: true, json: async () => ({ ok: true, work_item: workItems[0] }) }
    }

    if (url.includes('/api/admin/agents/work-items/work-queue-1/block') && init?.method === 'POST') {
      return { ok: true, json: async () => ({ ok: true }) }
    }

    if (url.includes('/api/admin/agents/work-items/work-queue-1/validation') && init?.method === 'POST') {
      return { ok: true, json: async () => ({ ok: true }) }
    }

    if (url.includes('/api/admin/agents/work-items/work-queue-1/handoff') && init?.method === 'POST') {
      return { ok: true, json: async () => ({ ok: true }) }
    }

    if (url.startsWith('/api/admin/agents/work-items')) {
      if (failWorkItems) return { ok: false, status: 503, json: async () => ({ error: 'work item service unavailable' }) }
      const status = new URL(`http://localhost${url}`).searchParams.get('status')
      const filtered = status ? workItems.filter((item) => item.status === status) : workItems
      return { ok: true, json: async () => ({ work_items: filtered }) }
    }

    if (url.startsWith('/api/admin/agents/vercel-research/proposals')) {
      return { ok: true, json: async () => ({ ok: true, approvals: [approvalCard] }) }
    }

    if (url === '/api/admin/agents/risk-compliance/drill' && init?.method === 'POST') {
      return { ok: true, json: async () => moremiDrillResponse() }
    }

    if (url === '/api/admin/agents/runs/run-1/approval' && init?.method === 'POST') {
      return { ok: true, json: async () => ({ ok: true, approval_id: 'approval-1' }) }
    }

    if (url === '/api/admin/agents/chief-of-staff/chat' && init?.method === 'POST') {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          run_id: 'shaka-context-run',
          reply: 'Shaka says this needs a trace review before approval.',
          suggested_actions: ['Open evidence', 'Review risk'],
        }),
      }
    }

    return { ok: false, status: 404, json: async () => ({ error: 'not found' }) }
  }))
}

describe('AgentCoordinationPage decision queue controller', () => {
  beforeEach(() => {
    setupFetch()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the Decision Queue hierarchy with action-required cards and trace language', async () => {
    render(<AgentCoordinationPage />)

    expect(await screen.findByRole('heading', { name: 'Decision Queue Controller' })).toBeInTheDocument()
    expect(screen.getByText('Start with the decision, then inspect the trace.')).toBeInTheDocument()
    expect(screen.getAllByText('Action required').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Executive summary').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Controller recommendation').length).toBeGreaterThan(0)
    expect(screen.getByText('Approve validation after checking the trace and PR evidence.')).toBeInTheDocument()
    expect(screen.getByText('risk: medium')).toBeInTheDocument()
    expect(screen.getAllByText('Trace').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Owner').length).toBeGreaterThan(0)
  })

  it('shows pending Vercel AutoResearch approvals inline and approves from the card', async () => {
    render(<AgentCoordinationPage />)

    expect(await screen.findByText('Vercel AutoResearch approvals decision queue')).toBeInTheDocument()
    expect(screen.getAllByText('Profile the Next.js build path').length).toBeGreaterThan(0)
    expect(screen.getByText('Approve a read-only/local build-profile experiment?')).toBeInTheDocument()
    expect(screen.getByText('Slack notified')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/runs/run-1/approval', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
        body: expect.stringContaining('"status":"approved"'),
      }))
    })
  })

  it('asks Shaka about a pending approval with scoped context', async () => {
    render(<AgentCoordinationPage />)

    expect(await screen.findByText('Vercel AutoResearch approvals decision queue')).toBeInTheDocument()
    const approvalCardElement = screen.getByText('Approve a read-only/local build-profile experiment?').closest('article')
    expect(approvalCardElement).not.toBeNull()

    fireEvent.click(within(approvalCardElement as HTMLElement).getByRole('button', { name: 'Ask Shaka' }))

    expect(await screen.findByText('Shaka context answer')).toBeInTheDocument()
    expect(screen.getByText('Shaka says this needs a trace review before approval.')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/chief-of-staff/chat', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"context_ref":{"type":"approval","id":"approval-1"}'),
    }))
  })

  it('sends suggested Shaka actions as approval-scoped follow-up prompts', async () => {
    render(<AgentCoordinationPage />)

    expect(await screen.findByText('Vercel AutoResearch approvals decision queue')).toBeInTheDocument()
    const approvalCardElement = screen.getByText('Approve a read-only/local build-profile experiment?').closest('article')
    expect(approvalCardElement).not.toBeNull()

    fireEvent.click(within(approvalCardElement as HTMLElement).getByRole('button', { name: 'Ask Shaka' }))
    expect(await screen.findByRole('button', { name: 'Ask Shaka follow-up: Open evidence' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ask Shaka follow-up: Open evidence' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/chief-of-staff/chat', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"message":"Open evidence"'),
      }))
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/chief-of-staff/chat', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"context_ref":{"type":"approval","id":"approval-1"}'),
      }))
    })
  })

  it('runs the Moremi operational drill and shows the Slack verification command', async () => {
    render(<AgentCoordinationPage />)

    expect(await screen.findByText('Moremi operational drill')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Run drill' }))

    expect(await screen.findByText('Drill created or reused')).toBeInTheDocument()
    expect(screen.getByText('/agent work')).toBeInTheDocument()
    expect(screen.getByText('Create an approval-routed risk packet before any remediation work begins.')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/risk-compliance/drill', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      body: expect.stringContaining('run_moremi_operational_drill'),
    }))
  })

  it('creates a controller work item with expected files and owner runtime', async () => {
    render(<AgentCoordinationPage />)

    await screen.findByText('Create controller work item')
    fireEvent.change(screen.getByPlaceholderText('Work item title'), { target: { value: 'Prepare controller decision packet' } })
    fireEvent.change(screen.getByPlaceholderText('owner agent key'), { target: { value: 'integration-captain' } })
    fireEvent.change(screen.getByLabelText('owner runtime'), { target: { value: 'hermes' } })
    fireEvent.change(screen.getByPlaceholderText('branch name'), { target: { value: 'codex/controller-decision' } })
    fireEvent.change(screen.getByPlaceholderText('Objective and acceptance criteria'), { target: { value: 'Route one decision through the controller.' } })
    fireEvent.change(screen.getByPlaceholderText('worktree path'), { target: { value: '/tmp/controller' } })
    fireEvent.change(screen.getByPlaceholderText('expected files, one per line'), { target: { value: 'app/admin/agents/coordination/page.tsx\napp/admin/agents/coordination/page.test.tsx' } })

    fireEvent.click(screen.getByRole('button', { name: 'Create work item' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/work-items', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"owner_runtime":"hermes"'),
      }))
    })
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/work-items', expect.objectContaining({
      body: expect.stringContaining('app/admin/agents/coordination/page.test.tsx'),
    }))
  })

  it('filters by status without changing the route or API shape', async () => {
    render(<AgentCoordinationPage />)

    expect(await screen.findByText('Approve agent run recovery request')).toBeInTheDocument()
    const filters = screen.getByLabelText('Status filters')
    fireEvent.click(within(filters).getByRole('button', { name: 'blocked' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/work-items?status=blocked', expect.any(Object))
    })
    expect(await screen.findByText('Unblock Moremi drill handoff')).toBeInTheDocument()
  })

  it('runs quick actions for block, validation, and handoff from executable controls', async () => {
    render(<AgentCoordinationPage />)

    await screen.findByText('Approve agent run recovery request')
    fireEvent.click(screen.getByRole('button', { name: 'Block Approve agent run recovery request' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/agents/work-items/work-queue-1/block', expect.objectContaining({ method: 'POST' })))

    fireEvent.click(screen.getByRole('button', { name: 'Record validation for Approve agent run recovery request' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/agents/work-items/work-queue-1/validation', expect.objectContaining({ method: 'POST' })))

    fireEvent.click(screen.getByRole('button', { name: 'Handoff Approve agent run recovery request' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/agents/work-items/work-queue-1/handoff', expect.objectContaining({ method: 'POST' })))
  })

  it('asks Shaka about a work item with scoped context', async () => {
    render(<AgentCoordinationPage />)

    await screen.findByText('Approve agent run recovery request')
    fireEvent.click(screen.getByRole('button', { name: 'Ask Shaka about Approve agent run recovery request' }))

    expect(await screen.findByText('Shaka context answer')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/chief-of-staff/chat', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"context_ref":{"type":"work_item","id":"work-queue-1"}'),
    }))
  })

  it('shows the failed fetch state when the work-item queue is unavailable', async () => {
    vi.unstubAllGlobals()
    setupFetch({ failWorkItems: true })

    render(<AgentCoordinationPage />)

    expect(await screen.findByText('Coordination layer unavailable')).toBeInTheDocument()
    expect(screen.getByText('work item service unavailable')).toBeInTheDocument()
    expect(screen.getByText('No agent coordination work items match the current filter.')).toBeInTheDocument()
  })
})
