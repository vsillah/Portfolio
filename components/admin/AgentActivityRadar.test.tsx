import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgentActivityRadar from './AgentActivityRadar'

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

const radarSnapshot = {
  ok: true,
  generated_at: '2026-06-11T14:00:00.000Z',
  refresh_interval_seconds: 15,
  summary: {
    active: 1,
    idle: 1,
    queued: 0,
    waiting_for_approval: 1,
    blocked: 1,
    stale: 0,
    failed: 0,
  },
  agents: [
    {
      key: 'chief-of-staff',
      name: 'Shaka (Zulu) - Chief of Staff',
      pod_key: 'chief_of_staff',
      pod_name: 'Chief of Staff',
      runtime: 'mixed',
      organization_status: 'partial',
      live_state: 'active',
      idle_reason: null,
      current_work_item: {
        id: 'work-active',
        title: 'Review live work',
        status: 'in_progress',
        priority: 'high',
        href: '/admin/agents/swarm-board?work_item=work-active',
      },
      active_run: {
        id: 'run-active',
        title: 'Morning review',
        status: 'running',
        href: '/admin/agents/runs/run-active',
      },
      current_step: 'Checking traces',
      latest_event: null,
      linked_goal: {
        id: 'AGENT-OPS-LIVE-RADAR-001',
        title: 'Agent Activity Radar',
        href: '/admin/agents/standup?goal=AGENT-OPS-LIVE-RADAR-001',
      },
      backlog_lane: {
        key: 'in_progress',
        label: 'In Progress',
        href: '/admin/agents/swarm-board?work_item=work-active',
      },
      age_seconds: 60,
      trace_href: '/admin/agents/runs/run-active',
      steer_actions: [
        { kind: 'open_trace', label: 'Open trace', href: '/admin/agents/runs/run-active' },
        { kind: 'open_kanban', label: 'Open Kanban', href: '/admin/agents/swarm-board?work_item=work-active' },
        {
          kind: 'ask_shaka',
          label: 'Ask Shaka',
          method: 'POST',
          endpoint: '/api/admin/agents/chief-of-staff/chat',
          payload: { message: 'Review Shaka.' },
        },
      ],
    },
    {
      key: 'automation-systems',
      name: 'Yaa Asantewaa (Ashanti) - Automation Systems',
      pod_key: 'product_automation',
      pod_name: 'Product & Automation Pod',
      runtime: 'n8n',
      organization_status: 'partial',
      live_state: 'blocked',
      idle_reason: null,
      current_work_item: {
        id: 'work-blocked',
        title: 'Resolve workflow blocker',
        status: 'blocked',
        priority: 'urgent',
        href: '/admin/agents/swarm-board?work_item=work-blocked',
      },
      active_run: null,
      current_step: 'Needs environment decision',
      latest_event: null,
      linked_goal: null,
      backlog_lane: {
        key: 'blocked',
        label: 'Blocked',
        href: '/admin/agents/swarm-board?work_item=work-blocked',
      },
      age_seconds: 600,
      trace_href: null,
      steer_actions: [
        { kind: 'open_kanban', label: 'Open Kanban', href: '/admin/agents/swarm-board?work_item=work-blocked' },
        {
          kind: 'engage_agent',
          label: 'Queue engagement',
          method: 'POST',
          endpoint: '/api/admin/agents/engage',
          payload: { agent_key: 'automation-systems', note: 'Activity Radar steering request.' },
        },
      ],
    },
    ...Array.from({ length: 6 }, (_, index) => ({
      key: `content-agent-${index + 1}`,
      name: `Content Agent ${index + 1}`,
      pod_key: 'content_production',
      pod_name: 'Content Production Pod',
      runtime: 'portfolio',
      organization_status: 'partial',
      live_state: 'queued',
      idle_reason: null,
      current_work_item: {
        id: `content-work-${index + 1}`,
        title: `Create content asset ${index + 1}`,
        status: 'queued',
        priority: 'medium',
        href: `/admin/agents/swarm-board?work_item=content-work-${index + 1}`,
      },
      active_run: null,
      current_step: 'Queued for content drafting',
      latest_event: null,
      linked_goal: null,
      backlog_lane: {
        key: 'queued',
        label: 'Queued',
        href: `/admin/agents/swarm-board?work_item=content-work-${index + 1}`,
      },
      age_seconds: 120 + index,
      trace_href: null,
      steer_actions: [],
    })),
  ],
  attention: [
    {
      id: 'automation-systems:blocked:work-blocked',
      severity: 'warning',
      title: 'Resolve workflow blocker',
      detail: 'Needs environment decision',
      agent_key: 'automation-systems',
      agent_name: 'Yaa Asantewaa (Ashanti) - Automation Systems',
      state: 'blocked',
      href: '/admin/agents/swarm-board?work_item=work-blocked',
      age_seconds: 600,
    },
  ],
}

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

describe('AgentActivityRadar', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/admin/agents/activity-radar') {
        return { ok: true, json: async () => radarSnapshot }
      }
      if (url === '/api/admin/agents/chief-of-staff/chat' && init?.method === 'POST') {
        return { ok: true, json: async () => ({ run_id: 'shaka-run' }) }
      }
      if (url === '/api/admin/agents/engage' && init?.method === 'POST') {
        return { ok: true, json: async () => ({ run_id: 'engage-run' }) }
      }
      return { ok: false, status: 404, json: async () => ({ error: 'not found' }) }
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('renders the radar summary, agent cards, and attention queue', async () => {
    render(<AgentActivityRadar variant="full" />)

    expect(await screen.findByRole('heading', { name: 'Live agent work map' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Agent office map' })).toBeInTheDocument()
    const lifecycle = screen.getByLabelText('Client engagement lifecycle')
    expect(within(lifecycle).getByText('Attract')).toBeInTheDocument()
    expect(within(lifecycle).getByText('Deliver')).toBeInTheDocument()
    const shakaLifecycleButton = within(lifecycle).getByRole('button', { name: 'Open Shaka (Zulu) - Chief of Staff lifecycle detail' })
    fireEvent.mouseEnter(shakaLifecycleButton)
    expect(screen.getByRole('dialog', { name: 'Shaka (Zulu) - Chief of Staff lifecycle detail' })).toBeInTheDocument()
    expect(screen.getByLabelText('Shaka (Zulu) - Chief of Staff progress 64%')).toBeInTheDocument()
    expect(screen.queryByLabelText('Selected agent detail')).not.toBeInTheDocument()
    fireEvent.mouseLeave(shakaLifecycleButton)
    expect(screen.queryByRole('dialog', { name: 'Shaka (Zulu) - Chief of Staff lifecycle detail' })).not.toBeInTheDocument()
    expect(within(lifecycle).getByText('1-4/6')).toBeInTheDocument()
    fireEvent.click(within(lifecycle).getByRole('button', { name: 'Next Attract agents' }))
    expect(within(lifecycle).getByText('5-6/6')).toBeInTheDocument()
    fireEvent.click(within(lifecycle).getByRole('button', { name: 'Previous Attract agents' }))
    expect(within(lifecycle).getByText('1-4/6')).toBeInTheDocument()
    fireEvent.click(shakaLifecycleButton)
    expect(screen.getByLabelText('Selected agent detail')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear Shaka (Zulu) - Chief of Staff lifecycle detail' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Clear Shaka (Zulu) - Chief of Staff lifecycle detail' }))
    expect(screen.queryByLabelText('Selected agent detail')).not.toBeInTheDocument()
    const summary = screen.getByLabelText('Agent Activity Radar summary')
    expect(within(summary).getByText('Active')).toBeInTheDocument()
    expect(within(summary).getByText('Blocked')).toBeInTheDocument()
    expect(screen.queryByText('Review live work')).not.toBeInTheDocument()
    expect(screen.getAllByText('Resolve workflow blocker').length).toBeGreaterThan(0)
    expect(screen.getByText('Needs operator eyes')).toBeInTheDocument()
    fireEvent.click(shakaLifecycleButton)
    const selectedPanel = screen.getByLabelText('Selected agent detail')
    expect(within(selectedPanel).getByRole('link', { name: 'Open trace' })).toHaveAttribute('href', '/admin/agents/runs/run-active')
  })

  it('polls every 15 seconds while visible', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    render(<AgentActivityRadar variant="compact" />)

    await screen.findByRole('heading', { name: 'Agent office map' })
    expect(screen.queryByLabelText('Selected agent detail')).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch).toHaveBeenLastCalledWith('/api/admin/agents/activity-radar', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
    }))
  })

  it('executes soft steering actions through existing governed endpoints', async () => {
    render(<AgentActivityRadar variant="full" />)

    await screen.findByRole('heading', { name: 'Agent office map' })
    fireEvent.click(screen.getByRole('button', { name: 'Open Shaka (Zulu) - Chief of Staff lifecycle detail' }))
    const selectedPanel = screen.getByLabelText('Selected agent detail')
    fireEvent.click(within(selectedPanel).getByRole('button', { name: 'Ask Shaka' }))

    expect(await screen.findByText('Ask Shaka queued. Trace: shaka-run')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/chief-of-staff/chat', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      body: JSON.stringify({ message: 'Review Shaka.' }),
    }))
  })

  it('keeps stale data visible when refresh fails', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementationOnce(async () => ({ ok: true, json: async () => radarSnapshot }))
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 500, json: async () => ({ error: 'Database not available' }) }))

    render(<AgentActivityRadar variant="compact" />)

    await screen.findByRole('heading', { name: 'Agent office map' })
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(await screen.findByText(/Database not available/i)).toBeInTheDocument()
    expect(screen.getByText(/Showing the last loaded radar/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Selected agent detail')).not.toBeInTheDocument()
  })
})
