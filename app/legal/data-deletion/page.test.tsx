import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DataDeletionPage from './page'

vi.mock('@/components/Navigation', () => ({ default: () => <nav aria-label="Primary">Navigation</nav> }))

describe('Data Deletion', () => {
  it('keeps connected-provider instructions and offers a conditional public YouTube metadata request path', () => {
    render(<DataDeletionPage />)

    expect(screen.getByRole('link', { name: 'vambah@amadutown.com' })).toHaveAttribute('href', 'mailto:vambah@amadutown.com')
    expect(screen.getByText(/connected channel, provider, and the account or page name/)).toBeInTheDocument()
    expect(screen.getByText(/If Portfolio holds public YouTube metadata under the proposed use/)).toBeInTheDocument()
    expect(screen.getByText(/video or channel URL or ID/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/legal/privacy')
    expect(screen.getByText(/If that use is approved, non-authorized YouTube API data would be deleted or refreshed within 30 calendar days/)).toBeInTheDocument()
    expect(screen.getByText(/not a promise that an observation remains current for 30 days/)).toBeInTheDocument()
    expect(screen.getByText(/Deleting data from Portfolio does not delete data held by YouTube/)).toBeInTheDocument()
    expect(screen.getByText(/Manage YouTube-held data through YouTube or an authorized service/)).toBeInTheDocument()
    expect(screen.getByText(/Some audit records may be retained/)).toBeInTheDocument()
    expect(screen.getByText(/Published content must also be managed through the provider account/)).toBeInTheDocument()
  })
})
