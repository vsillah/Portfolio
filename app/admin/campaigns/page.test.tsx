import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { HTMLAttributes } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignsAdminPage from './page'
import { campaignAdminRequest, CampaignAdminRequestError } from '@/lib/campaign-admin-request'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({ default: () => null }))
vi.mock('@/lib/campaign-admin-request', () => {
  class MockCampaignAdminRequestError extends Error {
    constructor(message: string, public readonly status: number) {
      super(message)
      this.name = 'CampaignAdminRequestError'
    }
  }
  return {
    campaignAdminRequest: vi.fn(),
    CampaignAdminRequestError: MockCampaignAdminRequestError,
  }
})

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('CampaignsAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(campaignAdminRequest).mockImplementation(async () => jsonResponse({ data: [] }))
  })

  it('shows an actionable sign-in recovery instead of an empty campaign list', async () => {
    vi.mocked(campaignAdminRequest).mockRejectedValueOnce(
      new CampaignAdminRequestError('Sign in again to manage campaigns.', 401),
    )

    render(<CampaignsAdminPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Sign in again to manage campaigns.')
    expect(screen.getByRole('link', { name: 'Sign in again' })).toHaveAttribute(
      'href',
      '/auth/login?redirect=%2Fadmin%2Fcampaigns',
    )
    expect(screen.queryByText('No campaigns yet. Create your first attraction campaign.')).not.toBeInTheDocument()
  })

  it('creates a campaign through the authenticated transport and refreshes the list', async () => {
    render(<CampaignsAdminPage />)
    await screen.findByText('No campaigns yet. Create your first attraction campaign.')

    fireEvent.click(screen.getByRole('button', { name: 'New Campaign' }))
    fireEvent.change(screen.getByPlaceholderText('Win Your Money Back Challenge'), { target: { value: 'Agentic Readiness Challenge' } })
    fireEvent.change(screen.getByLabelText('Campaign start'), { target: { value: '2026-10-05T09:00' } })
    fireEvent.change(screen.getByLabelText('Campaign end'), { target: { value: '2026-10-19T17:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }))

    await waitFor(() => {
      expect(vi.mocked(campaignAdminRequest)).toHaveBeenCalledWith(
        '/api/admin/campaigns',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('agentic-readiness-challenge'),
        }),
      )
    })
    expect(vi.mocked(campaignAdminRequest).mock.calls.filter(([path]) => path.startsWith('/api/admin/campaigns?'))).toHaveLength(2)
  })

  it('keeps the form open and surfaces a validation failure', async () => {
    vi.mocked(campaignAdminRequest)
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      .mockRejectedValueOnce(new CampaignAdminRequestError('Campaign slug already exists.', 409))

    render(<CampaignsAdminPage />)
    await screen.findByText('No campaigns yet. Create your first attraction campaign.')

    fireEvent.click(screen.getByRole('button', { name: 'New Campaign' }))
    fireEvent.change(screen.getByPlaceholderText('Win Your Money Back Challenge'), { target: { value: 'Existing Campaign' } })
    fireEvent.change(screen.getByLabelText('Campaign start'), { target: { value: '2026-10-05T09:00' } })
    fireEvent.change(screen.getByLabelText('Campaign end'), { target: { value: '2026-10-19T17:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Campaign slug already exists.')
    expect(screen.getByRole('heading', { name: 'Create Campaign' })).toBeInTheDocument()
  })
})
