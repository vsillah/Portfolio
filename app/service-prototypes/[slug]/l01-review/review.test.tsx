import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { L01Review } from './review'
import Page from './page'

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
    expect(screen.getByRole('button', { name: /The map, with the book underneath/ })).toBeInTheDocument()
    expect(screen.queryByText(/Signals \/ Alignment \/ Momentum/)).not.toBeInTheDocument()
  })

  it('opens scene 3 from the native form target before client hydration', () => {
    render(<Page params={{ slug: 'accelerated-cohort' }} searchParams={{ rev: 'review-revision', t: '165' }} />)
    expect(document.querySelector('[data-scene]')).toHaveAttribute('data-scene', 'L01-03')
    expect(screen.getByRole('slider', { name: 'Seek animatic' })).toHaveValue('165')
    expect(screen.getByText(/02:45 \/ 09:00/)).toBeInTheDocument()
    expect(screen.getAllByText('Signals · Alignment · Momentum')).toHaveLength(2)
    expect(screen.getByText('Book parts: Systems · Align · Momentum')).toBeInTheDocument()
    const sceneForm = screen.getByRole('button', { name: /The map, with the book underneath/ }).closest('form')
    expect(sceneForm).toHaveAttribute('method', 'get')
    expect(sceneForm).toHaveAttribute('action', '/service-prototypes/accelerated-cohort/l01-review')
    expect(sceneForm?.querySelector('input[name="t"]')).toHaveValue('165')
    expect(sceneForm?.querySelector('input[name="rev"]')).toHaveValue('review-revision')
  })
})
