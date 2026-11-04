import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { L01Review } from './review'
import Page from './page'

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

vi.mock('next/image', () => ({
  default: ({ unoptimized: _unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ''} />
  ),
}))

function mountAt(seconds: number) {
  cleanup()
  return render(<L01Review initialSeconds={seconds} />)
}

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

  it('clamps the review clock and keeps other prototypes off this packet', () => {
    render(<Page params={{ slug: 'accelerated-cohort' }} searchParams={{ t: '900' }} />)
    expect(screen.getByRole('slider', { name: 'Seek animatic' })).toHaveValue('540')
    expect(screen.getByText('End of L01.')).toBeInTheDocument()
    expect(document.querySelector('[data-scene]')).toHaveAttribute('data-scene', 'L01-06')
    expect(document.querySelector('input[name="rev"]')).toBeNull()

    cleanup()
    render(<Page params={{ slug: 'accelerated-cohort' }} searchParams={{ t: '-4', rev: 'kept' }} />)
    expect(screen.getByRole('slider', { name: 'Seek animatic' })).toHaveValue('0')
    expect(screen.getByText('00:00 / 09:00')).toBeInTheDocument()
    expect(document.querySelector('input[name="rev"]')).toHaveValue('kept')

    for (const requested of ['nope', '', 'Infinity']) {
      cleanup()
      render(<Page params={{ slug: 'accelerated-cohort' }} searchParams={{ t: requested }} />)
      expect(screen.getByRole('slider', { name: 'Seek animatic' })).toHaveValue('0')
    }

    cleanup()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Page params={{ slug: 'self-paced-course' }} searchParams={{ t: '10' }} />)).toThrow('NEXT_NOT_FOUND')
    consoleError.mockRestore()
  })

  it('keeps scene and avatar windows exclusive at their ends', () => {
    mountAt(0)
    expect(document.querySelector('[data-scene]')).toHaveAttribute('data-scene', 'L01-01')
    expect(screen.getByLabelText('A01 avatar window reserved; no avatar media generated')).toBeInTheDocument()
    expect(screen.getByText('The document is open. At the top it says, Q3 Innovation Plan.')).toBeInTheDocument()

    mountAt(35)
    expect(document.querySelector('[data-scene]')).toHaveAttribute('data-scene', 'L01-01')
    expect(screen.queryByLabelText(/avatar window reserved/)).not.toBeInTheDocument()

    mountAt(75)
    expect(document.querySelector('[data-scene]')).toHaveAttribute('data-scene', 'L01-02')

    mountAt(255)
    expect(document.querySelector('[data-scene]')).toHaveAttribute('data-scene', 'L01-04')
    expect(screen.queryByLabelText(/avatar window reserved/)).not.toBeInTheDocument()

    mountAt(345)
    expect(document.querySelector('[data-scene]')).toHaveAttribute('data-scene', 'L01-05')
    expect(screen.getByLabelText('A03 avatar window reserved; no avatar media generated')).toBeInTheDocument()
    expect(screen.getByText('Make the first page of your decision file.')).toBeInTheDocument()
    expect(screen.queryByText('DECISION FILE · PAGE 01')).not.toBeInTheDocument()

    mountAt(365)
    expect(document.querySelector('[data-scene]')).toHaveAttribute('data-scene', 'L01-05')
    expect(screen.queryByLabelText(/avatar window reserved/)).not.toBeInTheDocument()
    expect(screen.getByText('DECISION FILE · PAGE 01')).toBeInTheDocument()

    mountAt(515)
    expect(document.querySelector('[data-scene]')).toHaveAttribute('data-scene', 'L01-06')
    expect(screen.getByLabelText('A04 avatar window reserved; no avatar media generated')).toBeInTheDocument()

    mountAt(540)
    expect(document.querySelector('[data-scene]')).toHaveAttribute('data-scene', 'L01-06')
    expect(screen.queryByLabelText(/avatar window reserved/)).not.toBeInTheDocument()
    expect(screen.getByText('End of L01.')).toBeInTheDocument()
  })

  it('stops at the approved runtime, pauses on seek, and can hide captions', () => {
    vi.useFakeTimers()
    try {
      render(<L01Review initialSeconds={539.95} />)
      fireEvent.click(screen.getByRole('button', { name: 'Play animatic' }))
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(screen.getByText('09:00 / 09:00')).toBeInTheDocument()
      expect(screen.getByText('End of L01.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Play animatic' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Play animatic' }))
      expect(screen.getByText('00:00 / 09:00')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Pause animatic' })).toBeInTheDocument()

      fireEvent.change(screen.getByRole('slider', { name: 'Seek animatic' }), { target: { value: '80' } })
      expect(screen.getByText('01:20 / 09:00')).toBeInTheDocument()
      expect(document.querySelector('[data-scene]')).toHaveAttribute('data-scene', 'L01-02')
      expect(screen.getByRole('button', { name: 'Play animatic' })).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(screen.getByText('01:20 / 09:00')).toBeInTheDocument()

      expect(document.querySelector('[aria-live="off"]')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'CC on' }))
      expect(screen.getByRole('button', { name: 'CC off' })).toHaveAttribute('aria-pressed', 'false')
      expect(document.querySelector('[aria-live="off"]')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'CC off' }))
      expect(screen.getByRole('button', { name: 'CC on' })).toHaveAttribute('aria-pressed', 'true')
      expect(document.querySelector('[aria-live="off"]')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
