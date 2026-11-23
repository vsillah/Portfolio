import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PrivacyPage from './privacy/page'
import TermsPage from './terms/page'

vi.mock('@/components/Navigation', () => ({ default: () => <nav aria-label="Primary">Navigation</nav> }))

describe('Agentified legal disclosures', () => {
  it('explains guest storage, account claim, review-copy deletion boundary, and credentials', () => {
    render(<PrivacyPage />)
    expect(screen.getByRole('heading', { name: 'Agentified learning' })).toBeInTheDocument()
    expect(screen.getByText(/saved in this browser on this device/)).toBeInTheDocument()
    expect(screen.getByText(/Signing in does not automatically move guest work/)).toBeInTheDocument()
    expect(screen.getByText(/it does not delete a review copy/)).toBeInTheDocument()
    expect(screen.getByText(/responses, name, and account email/)).toBeInTheDocument()
    expect(screen.getByText(/Anyone with an active link can see/)).toBeInTheDocument()
    expect(screen.getByText(/request deletion of a submitted review copy/)).toBeInTheDocument()
  })

  it('sets expectations for review and course completion without implying accreditation', () => {
    render(<TermsPage />)
    expect(screen.getByRole('heading', { name: 'Agentified workshop' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Review and completion' })).toBeInTheDocument()
    expect(screen.getByText(/does not create a purchase or client project/)).toBeInTheDocument()
    expect(screen.getByText(/not a professional accreditation or certification/)).toBeInTheDocument()
  })
})
