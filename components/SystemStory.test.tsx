import { act, render, screen } from '@testing-library/react'
import type { ImgHTMLAttributes, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SystemStory from './SystemStory'

type MockImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean
  priority?: boolean
  src: string
}

vi.mock('next/image', () => ({
  default: ({ alt = '', fill: _fill, priority: _priority, src, ...props }: MockImageProps) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} {...props} />
  ),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

type RafCallback = FrameRequestCallback

function setElementLayout(element: HTMLElement, offsetHeight: number, top: number) {
  Object.defineProperty(element, 'offsetHeight', {
    configurable: true,
    value: offsetHeight,
  })
  element.getBoundingClientRect = vi.fn(() => ({
    bottom: top + offsetHeight,
    height: offsetHeight,
    left: 0,
    right: 0,
    top,
    width: 1200,
    x: 0,
    y: top,
    toJSON: () => ({}),
  }))
}

describe('SystemStory', () => {
  let rafCallbacks: RafCallback[]

  beforeEach(() => {
    rafCallbacks = []
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1000,
    })
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      rafCallbacks.push(callback)
      return rafCallbacks.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function flushAnimationFrame() {
    const callback = rafCallbacks.shift()
    if (!callback) throw new Error('Expected a queued animation frame')

    act(() => {
      callback(0)
    })
  }

  it('advances the active story frame from clamped scroll progress', () => {
    const { container } = render(<SystemStory />)
    const section = container.querySelector('[data-section="system-story"]') as HTMLElement

    setElementLayout(section, 4000, -1600)
    flushAnimationFrame()

    expect(screen.getByText('02 / 03')).toBeInTheDocument()
    expect(screen.getByRole('heading', {
      name: /we map the operating system/i,
    })).toBeInTheDocument()
    expect(screen.getByText('Handoffs Under Review')).toBeInTheDocument()

    setElementLayout(section, 4000, -6000)
    window.dispatchEvent(new Event('scroll'))
    flushAnimationFrame()

    expect(screen.getByText('03 / 03')).toBeInTheDocument()
    expect(screen.getByRole('heading', {
      name: /then we connect the work/i,
    })).toBeInTheDocument()
    expect(screen.getByText('Operating Layer Engaged')).toBeInTheDocument()
  })

  it('stays on the first story frame when there is no scrollable distance', () => {
    const { container } = render(<SystemStory />)
    const section = container.querySelector('[data-section="system-story"]') as HTMLElement

    setElementLayout(section, 900, -600)
    flushAnimationFrame()

    expect(screen.getByText('01 / 03')).toBeInTheDocument()
    expect(screen.getByRole('heading', {
      name: /the work is already there/i,
    })).toBeInTheDocument()
    expect(screen.getByText('Intake Drift Detected')).toBeInTheDocument()
  })
})
