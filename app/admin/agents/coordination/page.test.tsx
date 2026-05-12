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
      if (url === '/api/admin/agents/risk-compliance/drill' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            work_item: {
              id: 'work-moremi-drill',
              title: 'Review AI risk signal: Synthetic Moremi drill: prompt injection risk in browser automation',
              objective: 'Assess synthetic prompt injection risk.',
              status: 'proposed',
              priority: 'urgent',
              owner_agent_key: 'risk-compliance-intelligence',
              owner_runtime: 'manual',
              source_type: 'ai_risk_signal',
              source_id: 'moremi-operational-drill-prompt-injection-browser-automation',
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
              blocker_summary: null,
              validation_summary: null,
              approval_id: null,
              metadata: {},
              idempotency_key: 'ai-risk-drill:moremi-operational-drill:v1',
              created_at: '2026-05-11T12:02:00.000Z',
              updated_at: '2026-05-11T12:02:00.000Z',
              completed_at: null,
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
          }),
        }
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

  it('runs the Moremi operational drill and shows the Slack verification command', async () => {
    render(<AgentCoordinationPage />)

    expect(await screen.findByText('Moremi operational drill')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Run drill' }))

    expect(await screen.findByText('Drill created or reused')).toBeInTheDocument()
    expect(screen.getByText('/agent work')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/risk-compliance/drill', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      body: expect.stringContaining('run_moremi_operational_drill'),
    }))
  })
})
