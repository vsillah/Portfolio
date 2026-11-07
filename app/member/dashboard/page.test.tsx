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
    expect(screen.getByText('Your guest workshop progress has not been linked to this account.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the Learning Plan to review and claim it' })).toHaveAttribute('href', '/agentified/learningplan')
    expect(screen.getByRole('status')).toHaveTextContent('Loading your dashboard')
  })

  it('provides a privacy-safe unclaimed Agentified state for local visual QA', async () => {
    window.history.replaceState({}, '', '/member/dashboard?qa=member')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    render(<MemberDashboardPage />)

    expect(await screen.findByRole('region', { name: 'Agentified progress' })).toBeInTheDocument()
    expect(screen.getByText('Your guest workshop progress has not been linked to this account.')).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
    const accelerated = screen.getByRole('region', { name: 'Accelerated course' })
    expect(within(accelerated).getByText('Accelerated certificate')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Agentified progress' })).queryByText('Accelerated certificate')).not.toBeInTheDocument()
  })
})
