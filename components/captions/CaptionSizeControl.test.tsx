import { fireEvent, render, screen, within } from '@testing-library/react'
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
    const group = screen.getByRole('group', { name: 'Caption size' })
    expect(group).not.toHaveTextContent('Size')
    const sampleStyles: CSSStyleDeclaration[] = []
    for (const [name, px] of [['Small', 14], ['Medium', 18], ['Large', 24]] as const) {
      const button = within(group).getByRole('button', { name: `${name} captions` })
      expect(button).toHaveAttribute('type', 'button')
      expect(button).toHaveTextContent('Aa')
      expect(button.querySelector('span')).toHaveAttribute('aria-hidden', 'true')
      expect(button.querySelector('span')).toHaveStyle(`font-size: ${px}px`)
      sampleStyles.push(getComputedStyle(button.querySelector('span')!))
    }
    for (const property of ['fontFamily', 'fontWeight', 'fontStyle', 'color', 'lineHeight'] as const) {
      expect(new Set(sampleStyles.map((style) => style[property])).size).toBe(1)
    }
    const fontSizes = sampleStyles.map((style) => Number.parseFloat(style.fontSize))
    expect(fontSizes[1] - fontSizes[0]).toBeGreaterThanOrEqual(4)
    expect(fontSizes[2] - fontSizes[1]).toBeGreaterThanOrEqual(6)
    expect(within(group).getByRole('button', { name: 'Medium captions' })).toHaveAttribute('aria-pressed', 'true')
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
