import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

const approvalCard = {
  approvalId: 'approval-1',
  runId: 'run-1',
  workItemId: 'work-1',
  status: 'pending',
  requestedAt: '2026-05-11T12:00:00.000Z',
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
    updated_at: '2026-05-11T12:00:00.000Z',
  },
}

describe('AgentCoordinationPage Vercel AutoResearch approvals', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith('/api/admin/agents/vercel-research/proposals')) {
        return { ok: true, json: async () => ({ ok: true, approvals: [approvalCard] }) }
      }
      if (url.startsWith('/api/admin/agents/work-items')) {
        return { ok: true, json: async () => ({ work_items: [] }) }
      }
      if (url === '/api/admin/agents/runs/run-1/approval' && init?.method === 'POST') {
        return { ok: true, json: async () => ({ ok: true, approval_id: 'approval-1' }) }
      }
      return { ok: false, status: 404, json: async () => ({ error: 'not found' }) }
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows pending Vercel AutoResearch approvals inline and approves from the card', async () => {
    render(<AgentCoordinationPage />)

    expect(await screen.findByText('Vercel AutoResearch approvals')).toBeInTheDocument()
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
})
