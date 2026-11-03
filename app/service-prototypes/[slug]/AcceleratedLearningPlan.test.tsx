import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AcceleratedLearningPlan, lessons } from './AcceleratedLearningPlan'

vi.mock('next/image', () => ({
  default: ({ unoptimized: _unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ''} />
  ),
}))

describe('Accelerated learning plan', () => {
  it('keeps all approved lesson identities, order, durations, and four acts', () => {
    expect(lessons.map(({ id }) => id)).toEqual(Array.from({ length: 16 }, (_, index) => `L${String(index + 1).padStart(2, '0')}`))
    expect(lessons.reduce((total, lesson) => total + lesson.minutes, 0)).toBe(161)
    expect([...new Set(lessons.map(({ act }) => act))]).toEqual(['Signals', 'Alignment', 'Momentum', 'Synthesis'])
  })

  it('shows a learner brief, locked media, storyboard, and truthful preview progress', () => {
    render(<AcceleratedLearningPlan />)
    expect(screen.getByRole('heading', { name: 'Sixteen lessons. One decision file.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /L01: Build smarter, stay human/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Watch L01 guided video/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /L05: From feedback to signal/ }))
    expect(screen.getByText('Code six synthetic comments, name one pattern, and flag what contradicts it.')).toBeInTheDocument()
    expect(screen.getByAltText('Representative storyboard frame for L05')).toBeInTheDocument()
    expect(screen.queryByText(/production packet|source hash|provider instruction/i)).not.toBeInTheDocument()
  })

  it('handles filtering, empty results, completion, reversal, and next navigation', () => {
    render(<AcceleratedLearningPlan />)
    fireEvent.click(screen.getByRole('button', { name: 'Synthesis' }))
    expect(within(screen.getByRole('region', { name: 'Synthesis lessons' })).getAllByRole('button')).toHaveLength(2)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a lesson' }), { target: { value: 'unlikely phrase' } })
    expect(screen.getByText('No lessons found.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show all lessons' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark lesson complete' }))
    expect(screen.getByRole('progressbar', { name: 'Lessons complete' })).toHaveAttribute('value', '1')
    expect(screen.getByRole('button', { name: /L01: Build smarter, stay human/ })).toHaveTextContent('Complete')
    fireEvent.click(screen.getByRole('button', { name: 'Mark as incomplete' }))
    expect(screen.getByRole('progressbar', { name: 'Lessons complete' })).toHaveAttribute('value', '0')
    fireEvent.click(screen.getByRole('button', { name: 'Next lesson · L02' }))
    expect(screen.getByRole('heading', { name: 'Prioritize before generating' })).toBeInTheDocument()
  })
})
