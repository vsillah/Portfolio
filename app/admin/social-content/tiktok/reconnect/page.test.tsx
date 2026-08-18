import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TikTokReconnectPage from './page'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  startTikTokReconnect: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}))

vi.mock('@/lib/tiktok-reconnect-client', () => ({
  startTikTokReconnect: mocks.startTikTokReconnect,
}))

describe('TikTokReconnectPage', () => {
  it('renders the TikTok provider gates and starts the reconnect helper', async () => {
    mocks.startTikTokReconnect.mockResolvedValueOnce({ status: 'redirecting' })

    render(<TikTokReconnectPage />)

    expect(screen.getByRole('heading', { name: 'Reconnect TikTok' })).toBeInTheDocument()
    expect(screen.getByText('TikTok account @amadutown exists and the developer app is configured.')).toBeInTheDocument()
    expect(screen.getByText('Redirect URI is registered in TikTok Login Kit.')).toBeInTheDocument()
    expect(screen.getByText('Content Posting API Direct Post is enabled and video.publish scope is approved.')).toBeInTheDocument()
    expect(screen.getByText('Creator info is reviewed and confirmed after reconnect.')).toBeInTheDocument()
    expect(screen.getByText('PULL_FROM_URL source URL or domain ownership is approved.')).toBeInTheDocument()
    expect(screen.getByText('Final submission remains behind the Social Content approval gate.')).toBeInTheDocument()
    expect(screen.queryByText(/client secret/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/access token/i)).not.toBeInTheDocument()

    await waitFor(() => {
      expect(mocks.startTikTokReconnect).toHaveBeenCalledWith(expect.objectContaining({
        getSession: expect.any(Function),
        fetchAuthUrl: expect.any(Function),
        redirect: expect.any(Function),
      }))
    })
  })
})
