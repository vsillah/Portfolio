import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgentRunDetailPage from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

const runDetail = {
  run: {
    id: 'run-1',
    title: 'Approval notification trace',
    kind: 'chief_of_staff_chat',
    runtime: 'codex',
    status: 'waiting_for_approval',
  },
  steps: [
    {
      id: 'step-1',
      name: 'Collected context',
      output_summary: 'One pending approval',
      status: 'completed',
      started_at: '2026-05-13T12:00:00.000Z',
    },
  ],
  events: [],
  artifacts: [],
  approvals: [
    {
      id: 'approval-1',
      approval_type: 'production_config_change',
      status: 'pending',
      metadata: {
        action_payload: {
          action: 'production_config_change',
          approval_type: 'production_config_change',
          risk_level: 'high',
          executes_action: false,
          side_effect_boundary: 'Checkpoint only.',
        },
      },
    },
  ],
  handoffs: [],
  costs: [],
  evaluations: [],
  cost_total: 0,
}

function setupFetch() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/api/admin/agents/runs/run-1' && !init?.method) {
      return { ok: true, json: async () => runDetail }
    }
    if (url === '/api/admin/agents/chief-of-staff/chat' && init?.method === 'POST') {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          run_id: 'shaka-run-1',
          reply: 'Shaka says review the approval payload and do not mutate production yet.',
          suggested_actions: ['Review payload', 'Open evidence'],
        }),
      }
    }
    if (url === '/api/admin/agents/runs/run-1/approval' && init?.method === 'POST') {
      return { ok: true, json: async () => ({ ok: true }) }
    }
    return { ok: false, status: 404, json: async () => ({ error: 'not found' }) }
  }))
}

describe('AgentRunDetailPage scoped Shaka context', () => {
  beforeEach(() => {
    setupFetch()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks Shaka about the current run trace', async () => {
    render(<AgentRunDetailPage params={{ runId: 'run-1' }} />)

    expect(await screen.findByRole('heading', { name: 'Approval notification trace' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Shaka about this run' }))

    expect(await screen.findByText('Shaka context answer')).toBeInTheDocument()
    expect(screen.getByText('Shaka says review the approval payload and do not mutate production yet.')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/chief-of-staff/chat', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      body: expect.stringContaining('"context_ref":{"type":"run","id":"run-1"}'),
    }))
  })

  it('asks Shaka about a pending approval from the run detail approval card', async () => {
    render(<AgentRunDetailPage params={{ runId: 'run-1' }} />)

    expect(await screen.findByText('production_config_change')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Shaka about approval approval-1' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/chief-of-staff/chat', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"context_ref":{"type":"approval","id":"approval-1"}'),
      }))
    })
  })
})
