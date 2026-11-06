import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AcceleratedPage from './page'

vi.mock('next/image', () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ''} />
  ),
}))

describe('Accelerated public entry', () => {
  it('keeps the book, learning plan, Decision File, and AmaduTown paths together', () => {
    render(<AcceleratedPage />)
    expect(screen.getByRole('heading', { name: 'Accelerated' })).toBeInTheDocument()
    expect(screen.getByText('Building Smarter Products with AI')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Get the book on Amazon/ })).toHaveAttribute('href', 'https://www.amazon.com/Accelerated-Building-Smarter-Products-AI/dp/B0GQPK27TH')
    expect(screen.getByRole('link', { name: /Start the learning plan/ })).toHaveAttribute('href', '/accelerated/learningplan')
    expect(screen.getByRole('link', { name: /Open your Decision File/ })).toHaveAttribute('href', '/accelerated/decision-file')
    expect(screen.getByRole('link', { name: 'AmaduTown home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute('href', '/services')
  })
})
