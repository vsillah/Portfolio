import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PrivacyPage from './page'

vi.mock('@/components/Navigation', () => ({ default: () => <nav aria-label="Primary">Navigation</nav> }))

describe('Privacy Policy', () => {
  it('preserves existing learning, SMS, social-provider, and deletion disclosures', () => {
    render(<PrivacyPage />)

    expect(screen.getByRole('heading', { name: 'Agentified learning' })).toBeInTheDocument()
    expect(screen.getByText(/Signing in does not automatically move guest work/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'SMS communications' })).toBeInTheDocument()
    expect(screen.getByText(/We do not sell or share mobile information/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'What we collect' })).toBeInTheDocument()
    expect(screen.getByText(/when you connect social publishing tools/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Retention and deletion' })).toBeInTheDocument()
    expect(screen.getByText(/You can request deletion of connected social-provider data/)).toBeInTheDocument()
  })

  it('states the bounded proposed YouTube contract and links to Google and deletion help', () => {
    render(<PrivacyPage />)

    expect(screen.getByRole('heading', { name: 'YouTube public metadata' })).toBeInTheDocument()
    expect(screen.getByText(/Portfolio uses YouTube API Services/)).toBeInTheDocument()
    expect(screen.getByText(/video and channel IDs and canonical URLs/)).toBeInTheDocument()
    expect(screen.getByText(/internal evidence review and comparison/)).toBeInTheDocument()
    expect(screen.getByText(/individual viewer, commenter, or subscriber identities/)).toBeInTheDocument()
    expect(screen.getByText(/Cross-creator scoring and new metrics are not enabled/)).toBeInTheDocument()
    expect(screen.getByText(/deleted or refreshed within 30 calendar days/)).toBeInTheDocument()
    expect(screen.getByText(/not a promise that a particular observation remains current/)).toBeInTheDocument()
    expect(screen.getByText(/Deleting data from Portfolio does not delete data held by YouTube/)).toBeInTheDocument()
    expect(screen.getByText(/does not grant permission to reuse video/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Google Privacy Policy' })).toHaveAttribute('href', 'https://policies.google.com/privacy')
    expect(screen.getByRole('link', { name: 'Data deletion request process' })).toHaveAttribute('href', '/legal/data-deletion')
    expect(screen.queryByRole('button', { name: /collect|publish|score/i })).not.toBeInTheDocument()
  })
})
