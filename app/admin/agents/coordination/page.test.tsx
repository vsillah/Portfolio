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
  {
    id: 'work-autoresearch-1',
    title: 'Build-profile attribution',
    objective: 'Measure whether deploy time is dominated by Next build or generated knowledge work.',
    status: 'proposed',
    priority: 'high',
    owner_agent_key: null,
    owner_runtime: 'codex',
    source_type: 'vercel_autoresearch_idea',
    source_id: 'build-profile-attribution',
    source_label: 'Vercel AutoResearch idea inbox',
    source_run_id: null,
    active_run_id: 'run-autoresearch-idea',
    parent_work_item_id: null,
    branch_name: null,
    worktree_path: null,
    pr_number: null,
    pr_url: null,
    expected_files: ['package.json'],
    touched_files: [],
    overlap_group: 'vercel-autoresearch-build-profile',
    dependency_ids: [],
    blocker_summary: null,
    validation_summary: null,
    approval_id: null,
    metadata: {
      autoresearch_idea: true,
      recommendation: 'Start here because it produces the baseline every later idea needs.',
      risk: 'low',
      definition_of_ready: [
        'Clear hypothesis tied to a deployment metric baseline.',
        'Rollback path is explicit and low-friction.',
      ],
    },
    idempotency_key: 'vercel-autoresearch-idea:build-profile-attribution',
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
    decisionFrame: {
      experiment: 'Local build-profile experiment before hosted deployment changes',
      objective: 'Identify whether slow deployments are caused by app compilation or generated knowledge.',
      successMetric: 'Build duration and named bottleneck',
      target: 'Keep build time under 8m or name the bottleneck.',
      currentRun: 'portfolio/preview built in 3m41s.',
      distanceFromGoal: '4m19s inside the build watch goal.',
      goalStatus: 'on_track',
      recommendedAction: 'run_another_test',
      recommendation: 'Run another timing sample or close unless build time crosses the watch threshold again.',
      decisionOptions: [
        { action: 'approve', label: 'Approve read-only profile', when: 'Use when build time crosses the target.' },
        { action: 'run_another_test', label: 'Collect another timing sample', when: 'Use when the latest run is inside target.' },
        { action: 'close', label: 'Close as healthy', when: 'Use when build timing is inside target.' },
      ],
    },
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

    if (url.includes('/api/admin/agents/work-items/work-autoresearch-1/priority') && init?.method === 'POST') {
      return { ok: true, json: async () => ({ ok: true }) }
    }

    if (url.includes('/api/admin/agents/work-items/work-autoresearch-1/ready') && init?.method === 'POST') {
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
    expect(screen.getByRole('heading', { name: 'Top controller decisions' })).toBeInTheDocument()
    expect(screen.getByText('Showing 3 of 3 open item(s)')).toBeInTheDocument()
    expect(screen.getAllByText('Action required').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Executive summary').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Recommendation').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Evidence home').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Controller recommendation').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Approve validation after checking the trace and PR evidence.').length).toBeGreaterThan(0)
    expect(screen.getByText('risk: medium')).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: /Illustrated avatar for Shaka/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('img', { name: /Illustrated avatar for Moremi/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Prioritize ideas before they enter the Kanban board.' })).toBeInTheDocument()
    expect(screen.getAllByText('Build-profile attribution').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Start here because it produces the baseline every later idea needs.').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Trace').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Owner').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Decision intake' })).toBeInTheDocument()
    expect(screen.getByText('Use this only when the queue needs a new decision packet. Pick the scenario, confirm the owner and evidence home, then create the item.')).toBeInTheDocument()
  })

  it('runs top controller decision actions with scoped Shaka context', async () => {
    render(<AgentCoordinationPage />)

    expect(await screen.findByRole('heading', { name: 'Top controller decisions' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Shaka about top decision Unblock Moremi drill handoff' }))

    expect(await screen.findByText('Shaka context answer')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/chief-of-staff/chat', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"context_ref":{"type":"work_item","id":"work-queue-2"}'),
    }))

    fireEvent.click(screen.getByRole('button', { name: 'Validate Approve agent run recovery request' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/agents/work-items/work-queue-1/validation', expect.objectContaining({ method: 'POST' })))
  })

  it('prioritizes AutoResearch ideas and marks them ready for the Kanban inbox', async () => {
    render(<AgentCoordinationPage />)

    expect(await screen.findByRole('heading', { name: 'Prioritize ideas before they enter the Kanban board.' })).toBeInTheDocument()
    const select = screen.getByLabelText('Prioritize Build-profile attribution')
    fireEvent.change(select, { target: { value: 'urgent' } })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/work-items/work-autoresearch-1/priority', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"priority":"urgent"'),
      }))
    })

    fireEvent.click(screen.getByRole('button', { name: 'Mark Build-profile attribution ready for Kanban' }))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/work-items/work-autoresearch-1/ready', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Clear hypothesis tied to a deployment metric baseline.'),
      }))
    })
  })

  it('shows pending Vercel AutoResearch approvals inline and approves from the card', async () => {
    render(<AgentCoordinationPage />)

    expect(await screen.findByText('Vercel AutoResearch approvals decision queue')).toBeInTheDocument()
    expect(screen.getAllByText('Profile the Next.js build path').length).toBeGreaterThan(0)
    expect(screen.getByText('Distance from goal')).toBeInTheDocument()
    expect(screen.getByText('4m19s inside the build watch goal.')).toBeInTheDocument()
    expect(screen.getByText('Collect another timing sample')).toBeInTheDocument()
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
    const approvalCardElement = screen.getByText('4m19s inside the build watch goal.').closest('article')
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
    const approvalCardElement = screen.getByText('4m19s inside the build watch goal.').closest('article')
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

  it('creates a structured decision packet with generated objective, expected surfaces, and owner runtime', async () => {
    render(<AgentCoordinationPage />)

    await screen.findByRole('heading', { name: 'Decision intake' })
    expect(screen.queryByPlaceholderText('expected files, one per line')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Use Ready for Kanban intake template' }))
    fireEvent.change(screen.getByLabelText('Decision title'), { target: { value: 'Prepare controller decision packet' } })
    fireEvent.change(screen.getByLabelText('What decision is needed?'), { target: { value: 'Confirm this can move into implementation lanes.' } })
    fireEvent.change(screen.getByLabelText('Recommended path'), { target: { value: 'Create a bounded Kanban handoff with one owner and a validation gate.' } })
    fireEvent.change(screen.getByLabelText('Acceptance criteria'), { target: { value: 'Owner, goal tag, evidence link, and validation path are visible.' } })
    fireEvent.change(screen.getByLabelText('Evidence home'), { target: { value: 'Decision Queue card and linked trace.' } })
    fireEvent.change(screen.getByLabelText('Owner agent'), { target: { value: 'integration-captain' } })
    fireEvent.change(screen.getByLabelText('owner runtime'), { target: { value: 'hermes' } })
    fireEvent.change(screen.getByLabelText('Branch name'), { target: { value: 'codex/controller-decision' } })
    fireEvent.click(screen.getByLabelText('Expected surface Standup Room'))

    fireEvent.click(screen.getByRole('button', { name: 'Create decision packet' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/work-items', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"owner_runtime":"hermes"'),
      }))
    })
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/work-items', expect.objectContaining({
      body: expect.stringContaining('Decision type: Ready for Kanban'),
    }))
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/work-items', expect.objectContaining({
      body: expect.stringContaining('Recommended path: Create a bounded Kanban handoff with one owner and a validation gate.'),
    }))
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/work-items', expect.objectContaining({
      body: expect.stringContaining('app/admin/agents/swarm-board/page.test.tsx'),
    }))
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/work-items', expect.objectContaining({
      body: expect.stringContaining('app/admin/agents/standup/page.test.tsx'),
    }))
  })

  it('filters by status without changing the route or API shape', async () => {
    render(<AgentCoordinationPage />)

    expect((await screen.findAllByText('Approve agent run recovery request')).length).toBeGreaterThan(0)
    const filters = screen.getByLabelText('Status filters')
    fireEvent.click(within(filters).getByRole('button', { name: 'blocked' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/work-items?status=blocked', expect.any(Object))
    })
    expect((await screen.findAllByText('Unblock Moremi drill handoff')).length).toBeGreaterThan(0)
  })

  it('runs quick actions for block, validation, and handoff from executable controls', async () => {
    render(<AgentCoordinationPage />)

    expect((await screen.findAllByText('Approve agent run recovery request')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Block Approve agent run recovery request' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/agents/work-items/work-queue-1/block', expect.objectContaining({ method: 'POST' })))

    fireEvent.click(screen.getByRole('button', { name: 'Record validation for Approve agent run recovery request' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/agents/work-items/work-queue-1/validation', expect.objectContaining({ method: 'POST' })))

    fireEvent.click(screen.getByRole('button', { name: 'Handoff Approve agent run recovery request' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/agents/work-items/work-queue-1/handoff', expect.objectContaining({ method: 'POST' })))
  })

  it('asks Shaka about a work item with scoped context', async () => {
    render(<AgentCoordinationPage />)

    expect((await screen.findAllByText('Approve agent run recovery request')).length).toBeGreaterThan(0)
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
