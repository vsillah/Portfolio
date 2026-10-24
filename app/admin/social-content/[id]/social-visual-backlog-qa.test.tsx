import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SocialContentDetailRoute from './page'
import { socialVisualBacklogQaFixture } from '@/lib/social-visual-backlog-qa-fixture'
import { SOCIAL_VISUAL_BACKLOG_QA_ID } from '@/lib/social-visual-contract-recovery'
import { channelExperimentSocialContentQaFixture } from '@/lib/social-channel-experiment-qa-fixture'

const route = vi.hoisted(() => ({ id: 'f966123f-05eb-48ec-a7c2-970afce642ef', search: 'step=copy&qa_fixture=social_visual_backlog_recovery', replace: vi.fn() }))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: route.id }),
  useRouter: () => ({ push: vi.fn(), replace: route.replace }),
  useSearchParams: () => new URLSearchParams(route.search),
}))
vi.mock('@/components/ProtectedRoute', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/admin/Breadcrumbs', () => ({ default: () => null }))
vi.mock('@/lib/auth', () => ({ getCurrentSession: vi.fn(async () => ({ access_token: 'local-qa' })) }))

afterEach(() => {
  vi.unstubAllGlobals()
  route.id = SOCIAL_VISUAL_BACKLOG_QA_ID
  route.search = 'step=copy&qa_fixture=social_visual_backlog_recovery'
  route.replace.mockReset()
})

describe('read-only backlog visual recovery route', () => {
  it('shows persisted Copy approval and a truthful YouTube preview while keeping visual actions blocked', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true, json: async () => ({ item: socialVisualBacklogQaFixture() }) } as Response))
    vi.stubGlobal('fetch', fetchMock)
    const { unmount } = render(<SocialContentDetailRoute />)

    const copyGate = await screen.findByLabelText('Copy review decision gate')
    const reviewSurface = screen.getByTestId('social-content-detail').querySelector('fieldset')
    expect(reviewSurface).not.toBeDisabled()
    const stickyHeader = screen.getByTestId('social-content-detail').querySelector('[data-social-detail-header]')
    expect(stickyHeader).toHaveClass('bg-background', 'shadow-md')
    expect(stickyHeader).not.toHaveClass('bg-card/95', 'backdrop-blur')
    expect(within(copyGate).getByRole('heading', { name: 'Copy approved' })).toBeVisible()
    expect(within(copyGate).getByRole('button', { name: 'Approve Copy' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Approval step 2: Copy' })).toHaveTextContent('Approved')
    expect(screen.getByRole('heading', { name: 'YouTube review preview' })).toBeVisible()
    expect(screen.queryByText('LinkedIn Preview')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('LinkedIn post preview')).not.toBeInTheDocument()
    expect(screen.getByText(/No video or thumbnail is bound here/)).toBeVisible()
    expect(screen.getByLabelText('Saved YouTube copy (withheld)')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Approval step 2: Copy' })).toBeEnabled()
    expect(fetchMock.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true)

    unmount()
    route.search = 'step=visuals&qa_fixture=social_visual_backlog_recovery'
    const visuals = render(<SocialContentDetailRoute />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Render unavailable' })).toBeDisabled())
    const carousel = screen.getByRole('button', { name: /App screenshot carousel/ })
    expect(carousel).toHaveAttribute('aria-pressed', 'false')
    expect(carousel).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(carousel)
    expect(carousel).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Approval step 2: Copy' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Approval step 2: Copy' }))
    expect(route.replace).toHaveBeenCalledWith(expect.stringContaining('step=copy'), { scroll: false })
    expect(fetchMock.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true)
    visuals.unmount()
  })

  it('uses the same opaque sticky header for the channel review variant', async () => {
    route.id = '1f3cec8c-afcb-4551-90fa-b8d4f9dabe2f'
    route.search = 'step=copy&qa_fixture=channel_experiment_social_detail_v1'
    const item = channelExperimentSocialContentQaFixture(route.id)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ item }) } as Response)))

    render(<SocialContentDetailRoute />)
    expect(await screen.findByRole('region', { name: `YouTube experiment review: ${item.youtube_title}` })).toBeVisible()
    const stickyHeader = screen.getByTestId('social-content-detail').querySelector('[data-social-detail-header]')
    expect(stickyHeader).toHaveClass('bg-background', 'shadow-md')
    expect(stickyHeader).not.toHaveClass('bg-card/95', 'backdrop-blur')
  })
})
