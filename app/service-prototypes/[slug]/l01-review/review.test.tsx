import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { L01Review } from './review'

vi.mock('next/image', () => ({
  default: ({ unoptimized: _unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ''} />
  ),
}))

describe('L01 review navigation and display copy', () => {
  it('returns to the learner plan and keeps the workshop labels readable', () => {
    render(<L01Review />)
    expect(screen.getByRole('link', { name: '← Learning plan' })).toHaveAttribute('href', '/service-prototypes/accelerated-cohort?view=3')
    expect(screen.getByText('ACCELERATED · L01')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /The map, with the book underneath/ }))
    expect(screen.getAllByText('Signals · Alignment · Momentum')).toHaveLength(2)
    expect(screen.getByText('Book parts: Systems · Align · Momentum')).toBeInTheDocument()
    expect(screen.queryByText(/Signals \/ Alignment \/ Momentum/)).not.toBeInTheDocument()
  })
})
