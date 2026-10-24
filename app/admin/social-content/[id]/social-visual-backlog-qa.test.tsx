import { render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SocialContentDetailRoute from './page'
import { socialVisualBacklogQaFixture } from '@/lib/social-visual-backlog-qa-fixture'
import { SOCIAL_VISUAL_BACKLOG_QA_ID } from '@/lib/social-visual-contract-recovery'

const route = vi.hoisted(() => ({ search: 'step=copy&qa_fixture=social_visual_backlog_recovery' }))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: SOCIAL_VISUAL_BACKLOG_QA_ID }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(route.search),
}))
vi.mock('@/components/ProtectedRoute', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/admin/Breadcrumbs', () => ({ default: () => null }))
vi.mock('@/lib/auth', () => ({ getCurrentSession: vi.fn(async () => ({ access_token: 'local-qa' })) }))

afterEach(() => vi.unstubAllGlobals())

describe('read-only backlog visual recovery route', () => {
  it('shows persisted Copy approval and a truthful YouTube preview while keeping visual actions blocked', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true, json: async () => ({ item: socialVisualBacklogQaFixture() }) } as Response))
    vi.stubGlobal('fetch', fetchMock)
    const { unmount } = render(<SocialContentDetailRoute />)

    const copyGate = await screen.findByLabelText('Copy review decision gate')
    expect(within(copyGate).getByRole('heading', { name: 'Copy approved' })).toBeVisible()
    expect(within(copyGate).getByRole('button', { name: 'Approve Copy' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Approval step 2: Copy' })).toHaveTextContent('Approved')
    expect(screen.getByRole('heading', { name: 'YouTube review preview' })).toBeVisible()
    expect(screen.queryByText('LinkedIn Preview')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('LinkedIn post preview')).not.toBeInTheDocument()
    expect(screen.getByText(/No video or thumbnail is bound here/)).toBeVisible()
    expect(screen.getByLabelText('Saved YouTube copy (withheld)')).toBeDisabled()
    expect(fetchMock.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true)

    unmount()
    route.search = 'step=visuals&qa_fixture=social_visual_backlog_recovery'
    const visuals = render(<SocialContentDetailRoute />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Render unavailable' })).toBeDisabled())
    visuals.unmount()
    route.search = 'step=copy&qa_fixture=social_visual_backlog_recovery'
  })
})
