import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCaptionSizePreference, CAPTION_SIZE_STORAGE_KEY, parseCaptionSize } from '@/lib/caption-size-preference'
import { CaptionSizeControl } from './CaptionSizeControl'

function Harness() {
  const [size, setSize] = useCaptionSizePreference()
  return <CaptionSizeControl size={size} onChange={setSize} />
}

describe('shared caption size preference', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to Medium and falls back to Medium for an invalid stored value', () => {
    expect(parseCaptionSize(null)).toBe('M')
    expect(parseCaptionSize('XL')).toBe('M')
    localStorage.setItem(CAPTION_SIZE_STORAGE_KEY, 'XL')
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Medium captions' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('changes size by button and retains it after remount', () => {
    const view = render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Large captions' }))
    expect(screen.getByRole('button', { name: 'Large captions' })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem(CAPTION_SIZE_STORAGE_KEY)).toBe('L')
    view.unmount()
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Large captions' })).toHaveAttribute('aria-pressed', 'true')
  })
})
