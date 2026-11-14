import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AcceleratedLearningPlan } from './AcceleratedLearningPlan'
import bindings from '@/lib/accelerated-contextual-bindings.json'
import { GUEST_PROGRESS_KEY } from '@/lib/accelerated-member-progress'

vi.mock('@/lib/supabase', () => ({ supabase: { auth: {
  getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
  onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
} } }))

describe('Accelerated L09-L16 responsive learner source', () => {
  let portrait = false
  let notify: (() => void) | undefined
  beforeEach(() => {
    localStorage.clear()
    portrait = false
    notify = undefined
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({
      get matches() { return portrait },
      addEventListener: (_name: string, listener: () => void) => { notify = listener },
      removeEventListener: vi.fn(),
    })) })
  })

  it('switches the same lesson between desktop and portrait while preserving position and caption choice', () => {
    render(<AcceleratedLearningPlan />)
    fireEvent.click(screen.getByRole('button', { name: /L09: Map the decision theater/ }))
    const desktop = screen.getByLabelText('L09 Map the decision theater guided video') as HTMLVideoElement
    expect(document.querySelectorAll('video')).toHaveLength(1)
    expect(desktop.querySelector('source')).toHaveAttribute('src', bindings.lessons.L09.variants.desktop.path)
    fireEvent.click(screen.getByRole('button', { name: 'English captions on' }))
    Object.defineProperty(desktop, 'currentTime', { configurable: true, value: 120, writable: true })
    portrait = true
    act(() => notify?.())
    const mobile = screen.getByLabelText('L09 Map the decision theater guided video') as HTMLVideoElement
    expect(mobile).not.toBe(desktop)
    expect(document.querySelectorAll('video')).toHaveLength(1)
    expect(mobile.querySelector('source')).toHaveAttribute('src', bindings.lessons.L09.variants.portrait.path)
    expect(mobile.querySelector('track')).toHaveAttribute('src', bindings.lessons.L09.caption.path)
    const track = { mode: 'hidden' }
    Object.defineProperty(mobile, 'textTracks', { configurable: true, value: [track] })
    Object.defineProperty(mobile, 'duration', { configurable: true, value: 481.6 })
    fireEvent.loadedMetadata(mobile)
    expect(mobile.currentTime).toBe(120)
    expect(track.mode).toBe('disabled')
    expect(screen.getByRole('button', { name: 'English captions off' })).toHaveAttribute('aria-pressed', 'false')
    portrait = false
    act(() => notify?.())
    expect((screen.getByLabelText('L09 Map the decision theater guided video') as HTMLVideoElement).querySelector('source')).toHaveAttribute('src', bindings.lessons.L09.variants.desktop.path)
  })

  it('clamps stale playback and shows the end screen at the contextual endpoint', () => {
    render(<AcceleratedLearningPlan />)
    fireEvent.click(screen.getByRole('button', { name: /^L16:/ }))
    const video = screen.getByLabelText(/L16 .* guided video/) as HTMLVideoElement
    Object.defineProperty(video, 'duration', { configurable: true, value: 376.25 })
    Object.defineProperty(video, 'currentTime', { configurable: true, value: 900, writable: true })
    portrait = true
    act(() => notify?.())
    const resized = screen.getByLabelText(/L16 .* guided video/) as HTMLVideoElement
    Object.defineProperty(resized, 'duration', { configurable: true, value: 376.25 })
    fireEvent.loadedMetadata(resized)
    expect(resized.currentTime).toBeLessThan(bindings.lessons.L16.duration_seconds)
    fireEvent.ended(resized)
    expect(screen.getByRole('status', { name: 'L16 video finished' })).toBeInTheDocument()
    expect(localStorage.getItem(GUEST_PROGRESS_KEY)).toBeTruthy()
  })
})
