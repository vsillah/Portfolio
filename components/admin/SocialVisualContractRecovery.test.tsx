import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SocialVisualContractRecovery from './SocialVisualContractRecovery'

describe('Social Content missing visual contract recovery', () => {
  it('names the blocker and preserves same-record Copy navigation', () => {
    render(<SocialVisualContractRecovery recordId="record-b" />)
    expect(screen.getByText(/Blocked:/)).toBeInTheDocument()
    expect(screen.getByText(/no current, version-bound visual contract/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review this record’s saved copy' })).toHaveAttribute('href', '/admin/social-content/record-b?step=copy#social-copy-gate')
    expect(screen.queryByText(/approval granted|publish now/i)).not.toBeInTheDocument()
  })
})
