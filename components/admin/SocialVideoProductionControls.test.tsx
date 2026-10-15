import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import packet from '@/artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev-social-video-review-package-v1.json'
import SocialVideoProductionControls from './SocialVideoProductionControls'
import type { SocialVideoReviewPackage } from '@/lib/social-video-review-package'

const props = {
  reviewPackage: packet as SocialVideoReviewPackage,
  approvedSourceReceiptIds: ['source:jev:approved-composite-20261014', 'source:music:the-stream-v2:20261014'],
  approvedRightsReceiptIds: ['rights:jev:owned-public-assets-20261014', 'rights:music:the-stream-v2:20261014'],
}

describe('SocialVideoProductionControls', () => {
  it('renders version-bound music, motion, A/B, and closed decision actions', () => {
    render(<SocialVideoProductionControls {...props} />)
    expect(screen.getByText('The Stream 2.0 beat stem')).toBeInTheDocument()
    expect(screen.getByText('Restrained editorial focus')).toBeInTheDocument()
    expect(screen.getByLabelText('enhanced original Jev video preview')).toHaveAttribute('src', '/review-assets/social-content/jev-youtube-motion-review.mp4')
    expect(screen.getByRole('button', { name: 'Render current' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decision pending' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'A · No music' })).toBeInTheDocument()
    expect(screen.getByText(/6 restored native teaching scenes/i)).toBeInTheDocument()
  })

  it('offers a local naturalized voice reference and invalidates the bound render', async () => {
    const user = userEvent.setup()
    render(<SocialVideoProductionControls {...props} />)
    await user.click(screen.getByRole('radio', { name: 'Naturalized · review only' }))
    expect(screen.getByLabelText('enhanced naturalized Jev video preview')).toHaveAttribute('src', '/review-assets/social-content/jev-youtube-naturalized-voice-review.mp4')
    expect(screen.getByText('Unrendered changes')).toBeInTheDocument()
  })

  it('marks changed controls dirty, blocks render, and restores the approved binding', async () => {
    const user = userEvent.setup()
    render(<SocialVideoProductionControls {...props} />)
    await user.click(screen.getByRole('radio', { name: 'No music' }))
    expect(screen.getByText('Unrendered changes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Render blocked' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Reset approved' }))
    expect(screen.getByText('Render validated')).toBeInTheDocument()
  })

  it('shows the fail-closed blocker when rights are not approved', () => {
    render(<SocialVideoProductionControls {...props} approvedRightsReceiptIds={[]} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/rights receipt is missing or unapproved/i)
  })
})
