import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgentRunsPage from './page'

let currentSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useSearchParams: () => currentSearchParams,
}))

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

const runRows = [
  {
    id: 'failed-run',
    agent_key: 'chief-of-staff',
    runtime: 'codex',
    kind: 'agent_work_item',
    title: 'Production smoke failed',
    status: 'failed',
    subject_type: 'smoke',
    subject_id: 'smoke-1',
    subject_label: 'Smoke validation',
    current_step: 'database check',
    trigger_source: 'operator',
    started_at: '2026-05-13T12:00:00.000Z',
    completed_at: '2026-05-13T12:30:00.000Z',
    stale_after: null,
    error_message: 'Database write failed.',
    stale: false,
    cost_total: 0.0123,
    approvals: { pending: 0, approved: 0, rejected: 0 },
  },
  {
    id: 'running-stale-run',
    agent_key: 'automation-systems',
    runtime: 'n8n',
    kind: 'runtime_evaluation',
    title: 'Runtime probe timed out',
    status: 'running',
    subject_type: null,
    subject_id: null,
    subject_label: null,
    current_step: 'waiting for heartbeat',
    trigger_source: 'operator',
    started_at: '2026-05-13T11:00:00.000Z',
    completed_at: null,
    stale_after: '2026-05-13T11:30:00.000Z',
    error_message: null,
    stale: true,
    cost_total: 0,
    approvals: { pending: 0, approved: 0, rejected: 0 },
  },
  {
    id: 'approval-run',
    agent_key: 'chief-of-staff',
    runtime: 'codex',
    kind: 'agent_work_item',
    title: 'Approval packet waiting',
    status: 'waiting_for_approval',
    subject_type: 'approval',
    subject_id: 'approval-1',
    subject_label: 'Vercel proposal',
    current_step: 'approval gate',
    trigger_source: 'chief-of-staff',
    started_at: '2026-05-13T13:00:00.000Z',
    completed_at: null,
    stale_after: null,
    error_message: null,
    stale: false,
    cost_total: 0.0045,
    approvals: { pending: 1, approved: 0, rejected: 0 },
  },
  {
    id: 'completed-run',
    agent_key: 'research-source-register',
    runtime: 'codex',
    kind: 'agent_work_item',
    title: 'Research completed',
    status: 'completed',
    subject_type: 'research',
    subject_id: 'research-1',
    subject_label: 'Research packet',
    current_step: 'done',
    trigger_source: 'agent',
    started_at: '2026-05-13T14:00:00.000Z',
    completed_at: '2026-05-13T14:05:00.000Z',
    stale_after: null,
    error_message: null,
    stale: false,
    cost_total: 0.001,
    approvals: { pending: 0, approved: 0, rejected: 0 },
  },
]

function setupFetch(rows = runRows) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.startsWith('/api/admin/agents/runs?') && !init?.method) {
      return { ok: true, json: async () => ({ runs: rows }) }
    }
    if (url === '/api/admin/agents/runs/stale-sweep' && init?.method === 'POST') {
      return { ok: true, json: async () => ({ checked: 2, marked: 1 }) }
    }
    if (url === '/api/admin/agents/runs/failed-run/retry' && init?.method === 'POST') {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          run_id: 'recovery-run',
          source_run_id: 'failed-run',
          retry_attempt: 1,
        }),
      }
    }
    return { ok: false, status: 404, json: async () => ({ error: 'not found' }) }
  }))
}

describe('AgentRunsPage action-first console', () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams()
    setupFetch()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders action-first run cards and creates a read-only recovery request', async () => {
    currentSearchParams = new URLSearchParams('status=needs_review')
    render(<AgentRunsPage />)

    expect(await screen.findByRole('heading', { name: 'Run Console' })).toBeInTheDocument()
    expect(screen.getByText('Production smoke failed')).toBeInTheDocument()
    expect(screen.getAllByText('Status context').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Next action').length).toBeGreaterThan(0)
    expect(screen.getByText('Database write failed.')).toBeInTheDocument()
    expect(screen.getByText('Sweep stale first')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Review approval/i })).toHaveAttribute('href', '/admin/agents/runs/approval-run')
    expect(screen.getByRole('link', { name: /^View trace/i })).toHaveAttribute('href', '/admin/agents/runs/completed-run')

    fireEvent.click(screen.getByRole('button', { name: 'Request recovery' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/runs/failed-run/retry', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
        body: expect.stringContaining('Run Console action list'),
      }))
    })
    expect(await screen.findByText('Recovery request recovery-run is queued for Production smoke failed.')).toBeInTheDocument()
  })

  it('initializes active, needs-review, and operator-check filters from Mission Control links', async () => {
    currentSearchParams = new URLSearchParams('active=true')
    const { unmount } = render(<AgentRunsPage />)
    await screen.findByRole('heading', { name: 'Run Console' })
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/runs?limit=75&active=true', expect.anything())
    unmount()
    vi.unstubAllGlobals()

    setupFetch()
    currentSearchParams = new URLSearchParams('status=needs_review')
    const secondRender = render(<AgentRunsPage />)
    await screen.findByRole('heading', { name: 'Run Console' })
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/runs?limit=75&status=needs_review', expect.anything())
    secondRender.unmount()
    vi.unstubAllGlobals()

    setupFetch()
    currentSearchParams = new URLSearchParams('kind=operator_checks')
    render(<AgentRunsPage />)
    await screen.findByRole('heading', { name: 'Run Console' })
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/runs?limit=75&kind=operator_checks', expect.anything())
  })

  it('runs stale sweep from computed-stale rows and refreshes the list', async () => {
    render(<AgentRunsPage />)

    expect(await screen.findByText('Runtime probe timed out')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sweep stale first' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/runs/stale-sweep', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      }))
    })
    expect(await screen.findByText('Checked 2 active run(s); marked 1 stale.')).toBeInTheDocument()
  })
})
