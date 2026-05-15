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
    agent_key: 'chief-of-staff',
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
        approval_question: 'Approve preparing a Vercel project-setting proposal packet without applying any hosted setting yet?',
        proposal: {
          title: 'Review Vercel queue pressure before changing project settings',
          hypothesis: 'Queue pressure may be reduced by adjusting preview deployment policy or build concurrency.',
          expectedImpact: 'Reduce integration-captain waiting time when queue findings repeat across sweeps.',
          touchedFiles: ['docs/vercel-deployment-runbook.md'],
          touchedSettings: ['Vercel project preview deployment setting'],
          riskLevel: 'high',
          approvalQuestion: 'Approve preparing a Vercel project-setting proposal packet without applying any hosted setting yet?',
          evidence: ['portfolio/production: queue above threshold'],
          decisionFrame: {
            experiment: 'Queue-pressure review for staging production deployments',
            objective: 'Decide whether repeated staging queue time is worth a deeper Vercel settings proposal.',
            successMetric: 'Deployment queue time',
            target: 'Stay under the 5m queue watch threshold.',
            currentRun: 'portfolio-staging/production queued for 9m13s.',
            distanceFromGoal: '4m13s over the watch goal and 47s under the blocked threshold.',
            goalStatus: 'watch',
            recommendedAction: 'approve',
            recommendation: 'Approve preparing a settings proposal packet only. Do not change Vercel settings yet.',
            decisionOptions: [
              { action: 'approve', label: 'Approve proposal packet', when: 'Use when the queue gap is real enough to justify a scoped settings proposal.' },
              { action: 'run_another_test', label: 'Run another deployment watch', when: 'Use when the signal may be one noisy deployment.' },
              { action: 'reject', label: 'Reject as not worth pursuing', when: 'Use when the settings lane is too risky.' },
            ],
          },
        },
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
  evaluations: [
    {
      id: 'eval-1',
      rubric_key: 'chief-of-staff-synthesis-quality',
      agent_key: 'chief-of-staff',
      judge_model: 'deterministic-agent-eval-v1',
      summary: 'Chief of Staff Synthesis Quality needs coaching at 68.00.',
      score: 68,
      passed: false,
      dimension_scores: {
        grounding: 68,
        synthesis: 68,
        next_actions: 68,
        approval_gates: 68,
      },
      failure_reasons: ['Score 68.00 is below threshold 82.00.'],
      created_at: '2026-05-13T12:30:00.000Z',
    },
  ],
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
    expect(screen.getAllByRole('img', { name: /Illustrated avatar for Shaka/i }).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Ask Shaka about this run' }))

    expect(await screen.findByText('Shaka context answer')).toBeInTheDocument()
    expect(screen.getByText('Shaka says review the approval payload and do not mutate production yet.')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/chief-of-staff/chat', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      body: expect.stringContaining('"context_ref":{"type":"run","id":"run-1"}'),
    }))
  })

  it('sends suggested Shaka actions as scoped follow-up prompts', async () => {
    render(<AgentRunDetailPage params={{ runId: 'run-1' }} />)

    expect(await screen.findByRole('heading', { name: 'Approval notification trace' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Shaka about this run' }))
    expect(await screen.findByRole('button', { name: 'Ask Shaka follow-up: Review payload' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ask Shaka follow-up: Review payload' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/chief-of-staff/chat', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"message":"Review payload"'),
      }))
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/chief-of-staff/chat', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"context_ref":{"type":"run","id":"run-1"}'),
      }))
    })
  })

  it('asks Shaka about a pending approval from the run detail approval card', async () => {
    render(<AgentRunDetailPage params={{ runId: 'run-1' }} />)

    expect(await screen.findByRole('heading', { name: 'Review Vercel queue pressure before changing project settings' })).toBeInTheDocument()
    expect(screen.getByText('Experiment')).toBeInTheDocument()
    expect(screen.getByText('Objective')).toBeInTheDocument()
    expect(screen.getByText('Goal')).toBeInTheDocument()
    expect(screen.getByText('Distance from goal')).toBeInTheDocument()
    expect(screen.getByText('4m13s over the watch goal and 47s under the blocked threshold.')).toBeInTheDocument()
    expect(screen.getByText('Drawbacks')).toBeInTheDocument()
    expect(screen.getByText('Recommended next action')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Shaka about approval approval-1' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/chief-of-staff/chat', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"context_ref":{"type":"approval","id":"approval-1"}'),
      }))
    })
  })

  it('asks Shaka to coach a failed evaluation', async () => {
    render(<AgentRunDetailPage params={{ runId: 'run-1' }} />)

    expect(await screen.findByText('Chief of Staff Synthesis Quality needs coaching at 68.00.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {
      name: 'Ask Shaka for coaching on evaluation chief-of-staff-synthesis-quality',
    }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/chief-of-staff/chat', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Coach this evaluation: chief-of-staff-synthesis-quality.'),
      }))
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/chief-of-staff/chat', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"context_ref":{"type":"run","id":"run-1"}'),
      }))
    })
  })
})
