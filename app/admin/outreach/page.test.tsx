import { render, screen, waitFor, within } from '@testing-library/react'
import type { HTMLAttributes, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OutreachAdminPage from './page'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/components/admin/outreach/ReviewEnrichModal', () => ({ default: () => null }))
vi.mock('@/components/admin/outreach/TechStackModal', () => ({ default: () => null }))
vi.mock('@/components/admin/outreach/SocialIntelModal', () => ({ default: () => null }))
vi.mock('@/components/admin/outreach/EvidenceDrawer', () => ({ default: () => null }))
vi.mock('@/components/admin/outreach/AddLeadModal', () => ({ default: () => null }))
vi.mock('@/components/admin/OutreachEmailGenerateRow', () => ({
  OutreachEmailGenerateRow: () => <div>Email draft row</div>,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

vi.mock('@/lib/hooks/useRealtimeOutreach', () => ({
  useRealtimeOutreach: () => undefined,
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn((url: string) => window.history.replaceState({}, '', url)),
  }),
}))

const lead = {
  id: 42,
  name: 'Ada Operator',
  email: 'ada@example.com',
  company: 'Ops Lab',
  company_domain: 'opslab.test',
  job_title: 'Founder',
  industry: 'Services',
  phone_number: null,
  lead_source: 'warm_referral',
  lead_score: 82,
  outreach_status: 'draft',
  qualification_status: 'qualified',
  created_at: '2026-08-01T12:00:00.000Z',
  linkedin_url: null,
  ai_readiness_score: null,
  competitive_pressure_score: null,
  quick_wins: null,
  messages_count: 1,
  messages_sent: 0,
  has_reply: false,
  has_sales_conversation: false,
  latest_session_id: null,
  session_count: 0,
  evidence_count: 0,
  last_vep_triggered_at: null,
  last_vep_status: null,
  last_n8n_outreach_triggered_at: null,
  last_n8n_outreach_status: null,
  last_n8n_outreach_template_key: null,
  has_extractable_text: false,
  recent_email_drafts: [],
}

describe('OutreachAdminPage deep links', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/admin/outreach?tab=leads&id=42')
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.startsWith('/api/admin/outreach/leads')) {
        return Response.json({ leads: [lead], total: 1, page: 1 })
      }
      if (url.startsWith('/api/admin/value-evidence/workflow-status')) {
        return Response.json({})
      }
      if (url.startsWith('/api/admin/chat-escalations')) {
        return Response.json({ escalations: [], total: 0 })
      }
      if (url.startsWith('/api/admin/sales/contact-meetings')) {
        return Response.json({ meetings: [] })
      }
      if (url.startsWith('/api/meeting-action-tasks')) {
        return Response.json({ tasks: [] })
      }
      return Response.json({})
    }))
  })

  it('hydrates the selected lead from the canonical id query parameter', async () => {
    render(<OutreachAdminPage />)

    const summary = await screen.findByLabelText('Lead: Ada Operator mobile workflow summary')
    expect(summary).toBeInTheDocument()
    expect(within(summary).getByText('Warm 1:1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open selected lead' })).toHaveAttribute('href', '/admin/outreach?tab=leads&id=42')
    await waitFor(() => {
      expect(screen.getByText('Ops Lab')).toBeInTheDocument()
    })
  })

  it('wraps the hero action group for selected-lead mobile widths', async () => {
    render(<OutreachAdminPage />)

    await screen.findByLabelText('Lead: Ada Operator mobile workflow summary')
    const actions = screen.getByLabelText('Outreach workroom actions')
    expect(actions).toHaveClass('flex-wrap')
    expect(within(actions).getByRole('button', { name: /Refresh/i })).toBeInTheDocument()
  })
})
