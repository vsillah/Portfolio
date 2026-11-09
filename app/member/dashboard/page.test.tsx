import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MemberDashboardPage from './page'

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession } },
}))

vi.mock('@/components/client-dashboard/AssessmentScoreBreakdown', () => ({ default: () => null }))
vi.mock('@/components/client-dashboard/AccountSummarySection', () => ({ default: () => null }))
vi.mock('@/components/client-dashboard/TaskChecklist', () => ({ default: () => null }))
vi.mock('@/components/client-dashboard/MilestoneTimeline', () => ({ default: () => null }))
vi.mock('@/components/client-dashboard/DocumentsSection', () => ({ default: () => null }))
vi.mock('@/components/client-dashboard/ReportsSection', () => ({ default: () => null }))
vi.mock('@/components/client-dashboard/MeetingHistory', () => ({ default: () => null }))
vi.mock('@/components/member/RecommendationAction', () => ({ default: () => null }))
vi.mock('@/components/member/CompletionCredential', () => ({ default: () => <div>Accelerated certificate</div> }))
vi.mock('@/components/member/AgentifiedCompletionCredential', () => ({ default: () => <div>Agentified credential</div> }))

describe('Member dashboard course loading', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/member/dashboard')
    getSession.mockReset()
    getSession.mockResolvedValue({ data: { session: { access_token: 'synthetic-token' } } })
    vi.restoreAllMocks()
  })

  it('renders Agentified independently while the legacy dashboard request is still pending', async () => {
    const pending = new Promise<Response>(() => {})
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input) === '/api/accelerated/member') return pending
      return Promise.resolve(new Response(JSON.stringify({ enrollment: null, lessons: [], worksheet: null }), { status: 200 }))
    })

    render(<MemberDashboardPage />)

    expect(await screen.findByRole('region', { name: 'Agentified progress' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review and claim guest progress' })).toHaveAttribute('href', '/agentified/learningplan')
    expect(screen.getByRole('status')).toHaveTextContent('Loading your dashboard')
  })

  it('provides a privacy-safe unclaimed Agentified state for local visual QA', async () => {
    window.history.replaceState({}, '', '/member/dashboard?qa=member')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    render(<MemberDashboardPage />)

    expect(await screen.findByRole('region', { name: 'Agentified progress' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review and claim guest progress' })).toHaveAttribute('href', '/agentified/learningplan')
    expect(fetchSpy).not.toHaveBeenCalled()
    const accelerated = screen.getByRole('region', { name: 'Accelerated course' })
    expect(within(accelerated).getByText('Accelerated certificate')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Agentified progress' })).queryByText('Accelerated certificate')).not.toBeInTheDocument()
  })

  it('keeps the reviewed Agentified assessment and offers in its own workshop section', async () => {
    window.history.replaceState({}, '', '/member/dashboard?qa=agentified-assessed')
    render(<MemberDashboardPage />)
    const agentified = await screen.findByRole('region', { name: 'Agentified workshop journey' })
    expect(within(agentified).getByText('The agent roles are clear; the handoff needs a stronger review gate.')).toBeInTheDocument()
    expect(within(agentified).getByText('Agent workflow review')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Accelerated course' })).queryByText('Agent workflow review')).not.toBeInTheDocument()
  })

  it('attributes same-account workshop orders from intake identity and preserves each quote route', async () => {
    window.history.replaceState({}, '', '/member/dashboard?qa=orders')
    render(<MemberDashboardPage />)
    const orders = await screen.findByRole('region', { name: 'Orders' })
    const accelerated = within(orders).getByText('Order #1203').closest('li')!
    const agentified = within(orders).getByText('Order #2203').closest('li')!
    expect(accelerated).toHaveTextContent('accelerated')
    expect(agentified).toHaveTextContent('agentified')
    expect(within(accelerated).getByRole('link', { name: 'Continue quote request' })).toHaveAttribute('href', '/member/quote?qa=quote')
    expect(within(agentified).getByRole('link', { name: 'Continue quote request' })).toHaveAttribute('href', '/member/quote?qa=quote-agentified')
  })
})
