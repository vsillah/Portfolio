import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import YouTubeServiceDisclosure from './YouTubeServiceDisclosure'

describe('YouTube service disclosure', () => {
  it('keeps the current channel use, inactive proposal, and privacy routes together', () => {
    render(<YouTubeServiceDisclosure />)

    const footer = screen.getByRole('contentinfo', { name: 'YouTube API Services' })
    expect(within(footer).getByText(/connected AmaduTown channel workflows/)).toHaveTextContent(
      'under review and inactive',
    )
    const links = within(footer).getByRole('navigation', { name: 'YouTube and privacy information' })
    expect(within(links).getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/legal/privacy')
    expect(within(links).getByRole('link', { name: 'Data deletion' })).toHaveAttribute('href', '/legal/data-deletion')
  })
})
