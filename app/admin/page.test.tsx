import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminDashboard from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/components/admin/AdminPieChart', () => ({
  default: () => <div data-testid="pie-chart" />,
}))

vi.mock('@/components/admin/AdminBarChart', () => ({
  default: () => <div data-testid="bar-chart" />,
}))

vi.mock('@/components/admin/AdminFunnelChart', () => ({
  default: () => <div data-testid="funnel-chart" />,
}))

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
    waiting_for_approval: 0,
    blocked: 0,
    stale: 0,
    failed: 0,
  },
  agents: [{
    key: 'chief-of-staff',
    name: 'Shaka (Zulu) - Chief of Staff',
    pod_key: 'chief_of_staff',
    pod_name: 'Chief of Staff',
    runtime: 'mixed',
    organization_status: 'partial',
    live_state: 'active',
    idle_reason: null,
    current_work_item: {
      id: 'work-admin-radar',
      title: 'Main dashboard radar check',
      status: 'in_progress',
      priority: 'high',
      href: '/admin/agents/swarm-board?work_item=work-admin-radar',
    },
    active_run: {
      id: 'run-admin-radar',
      title: 'Admin radar run',
      status: 'running',
      href: '/admin/agents/runs/run-admin-radar',
    },
    current_step: 'Rendering compact dashboard radar',
    latest_event: null,
    linked_goal: null,
    backlog_lane: null,
    age_seconds: 90,
    trace_href: '/admin/agents/runs/run-admin-radar',
    steer_actions: [
      { kind: 'open_trace', label: 'Open trace', href: '/admin/agents/runs/run-admin-radar' },
    ],
  }],
  attention: [],
}

describe('AdminDashboard Agent Activity Radar', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/admin/agents/activity-radar') {
        return { ok: true, json: async () => radarSnapshot }
      }
      if (url === '/api/admin/outreach/dashboard') {
        return {
          ok: true,
          json: async () => ({
            funnel: { total: 0, contacted: 0, replied: 0, booked: 0 },
            funnelByTemperature: {},
            queueStats: { total: 0, draft: 0, sent: 0, replied: 0 },
            recentActivity: [],
          }),
        }
      }
      if (url === '/api/admin/value-evidence/dashboard') {
        return { ok: true, json: async () => ({ overview: { totalEvidence: 0 } }) }
      }
      if (url.startsWith('/api/admin/value-evidence/reports')) {
        return { ok: true, json: async () => ({ reports: [] }) }
      }
      if (url === '/api/admin/sales') {
        return { ok: true, json: async () => ({ stats: { total_audits: 0, pending_follow_up: 0, converted: 0, high_urgency: 0 } }) }
      }
      if (url.startsWith('/api/admin/campaigns')) {
        return { ok: true, json: async () => ({ data: [] }) }
      }
      if (url.startsWith('/api/admin/client-projects')) {
        return { ok: true, json: async () => ({ projects: [] }) }
      }
      if (url === '/api/meeting-action-tasks') {
        return { ok: true, json: async () => ({ tasks: [] }) }
      }
      if (url.startsWith('/api/admin/guarantees')) {
        return { ok: true, json: async () => ({ data: [] }) }
      }
      if (url.startsWith('/api/admin/chat-eval/stats')) {
        return { ok: true, json: async () => ({ overview: { total_sessions: 0, evaluated_sessions: 0, success_rate: 0 } }) }
      }
      if (url.startsWith('/api/admin/chat-eval')) {
        return { ok: true, json: async () => ({ sessions: [] }) }
      }
      if (url.startsWith('/api/analytics/stats')) {
        return { ok: true, json: async () => ({ totalSessions: 0, totalPageViews: 0, totalClicks: 0, totalFormSubmits: 0, eventsByType: {} }) }
      }
      if (url === '/api/admin/subscriptions/status') {
        return { ok: true, json: async () => ({ buckets: {}, summary: { headline: 'No subscription signals' } }) }
      }
      if (url === '/api/admin/configuration/counts') {
        return { ok: true, json: async () => ({ users: 0, prompts: 0, contentItems: 0 }) }
      }
      return { ok: false, status: 404, json: async () => ({ error: 'not found' }) }
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the compact Agent Activity Radar near the top of the admin dashboard', async () => {
    render(<AdminDashboard />)

    expect(await screen.findByLabelText('Agent Activity Radar')).toBeInTheDocument()
    expect(screen.getByText('Live agent work map')).toBeInTheDocument()
    expect(screen.getByLabelText('Client engagement lifecycle')).toBeInTheDocument()
    expect(screen.queryByLabelText('Selected agent detail')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open full Mission Control radar/i })).toHaveAttribute('href', '/admin/agents')
  })
})
