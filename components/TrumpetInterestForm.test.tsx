import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TrumpetInterestForm from './TrumpetInterestForm'

describe('Trumpet Trainer interest entry', () => {
  it('sends adults to Portfolio consent without an external submission link', () => {
    render(<TrumpetInterestForm />)
    expect(screen.getByRole('link', { name: /Review adult interest and consent/ })).toHaveAttribute('href', '/activate/trumpet-trainer')
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull()
  })
})
