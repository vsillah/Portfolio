import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { HTMLAttributes, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OutreachDashboardPage from './page'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}))

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/components/admin/MobileWorkflowSummary', () => ({
  default: ({ title }: { title: string }) => <div aria-label={`${title} mobile workflow summary`} />,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

const dashboardData = {
  funnel: { total: 10, enriched: 7, contacted: 4, replied: 2, booked: 1, reply_rate: 50, booking_rate: 25 },
  coldFunnel: { total: 4, enriched: 2, contacted: 1, replied: 0, booked: 0, reply_rate: 0, booking_rate: 0 },
  warmFunnel: { total: 6, enriched: 5, contacted: 3, replied: 2, booked: 1, reply_rate: 67, booking_rate: 33 },
  funnelBySource: {
    warm_referral: { total: 6, enriched: 5, contacted: 3, replied: 2, booked: 1, opted_out: 0, no_response: 1 },
    cold_apollo: { total: 4, enriched: 2, contacted: 1, replied: 0, booked: 0, opted_out: 0, no_response: 1 },
  },
  funnelByTemperature: {
    warm: { total: 6, enriched: 5, contacted: 3, replied: 2, booked: 1, reply_rate: 67, booking_rate: 33 },
    cold: { total: 4, enriched: 2, contacted: 1, replied: 0, booked: 0, reply_rate: 0, booking_rate: 0 },
  },
  warmSourceBreakdown: {
    warm_referral: { total: 6, enriched: 5, contacted: 3, replied: 2, booked: 1, opted_out: 0, no_response: 1 },
  },
  queueStats: { draft: 2 },
  channelStats: {
    email: { total: 4, sent: 4, replied: 2, reply_rate: 50 },
    linkedin: { total: 1, sent: 1, replied: 0, reply_rate: 0 },
  },
  stepStats: {
    '1': { sent: 4, replied: 2 },
  },
  recentActivity: [{
    id: 'activity-1',
    channel: 'email',
    subject: 'Warm follow-up',
    status: 'replied',
    sequence_step: 1,
    sent_at: '2026-09-01T12:00:00.000Z',
    replied_at: '2026-09-01T13:00:00.000Z',
    contact_submissions: {
      id: 42,
      name: 'Ada Operator',
      company: 'Ops Lab',
      lead_score: 82,
    },
  }],
  leadSources: [],
}

describe('OutreachDashboardPage metric parity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('/api/admin/outreach/dashboard')) {
        return Response.json(dashboardData)
      }
      if (url.startsWith('/api/admin/outreach/trigger')) {
        return Response.json({ history: [] })
      }
      return Response.json({})
    }))
  })

  it('only renders funnel metrics as links when they perform a real drilldown', async () => {
    render(<OutreachDashboardPage />)

    expect(await screen.findByRole('heading', { name: 'Lead Pipeline' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open sourced leads' })).toHaveAttribute(
      'href',
      '/admin/outreach?tab=leads',
    )
    expect(screen.getByRole('link', { name: 'Open contacted leads' })).toHaveAttribute(
      'href',
      '/admin/outreach?tab=leads&status=sequence_active',
    )
    expect(screen.getByRole('link', { name: 'Open replied leads' })).toHaveAttribute(
      'href',
      '/admin/outreach?tab=leads&status=replied',
    )
    expect(screen.queryByRole('link', { name: /enriched leads/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Enriched leads metric')).toBeInTheDocument()
    expect(screen.getByLabelText('Enriched leads metric').querySelector('.admin-console-interactive')).toBeNull()
  })

  it('preserves the selected temperature filter in actionable funnel drilldowns', async () => {
    render(<OutreachDashboardPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Warm Leads/i }))

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Open contacted leads' })).toHaveAttribute(
        'href',
        '/admin/outreach?tab=leads&filter=warm&status=sequence_active',
      )
    })
    expect(screen.getByRole('link', { name: 'Open sourced leads' })).toHaveAttribute(
      'href',
      '/admin/outreach?tab=leads&filter=warm',
    )
  })
})
