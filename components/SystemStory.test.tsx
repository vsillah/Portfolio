import { act, render, screen, waitFor } from '@testing-library/react'
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

const themeState = vi.hoisted(() => ({
  resolvedTheme: 'light' as 'light' | 'dark' | undefined,
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme: themeState.resolvedTheme,
  }),
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
    themeState.resolvedTheme = 'light'
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

  it('renders the navigation target, operating functions, and conversion links', () => {
    render(<SystemStory />)

    expect(screen.getByText('System Story')).toBeInTheDocument()
    expect(document.querySelector('section#system')).toHaveAttribute('data-section', 'system-story')
    expect(screen.getByRole('heading', { name: /the work is already there/i })).toBeInTheDocument()

    for (const label of ['Intake', 'Scheduling', 'Communications', 'Delivery', 'Billing', 'Reporting', 'Knowledge']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }

    expect(screen.getByRole('link', { name: /map my system/i })).toHaveAttribute('href', '#contact')
    expect(screen.getByRole('link', { name: /see services/i })).toHaveAttribute('href', '#services')
  })

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

  it('uses the light hero image for the system story in light mode', async () => {
    const { container } = render(<SystemStory />)

    await waitFor(() => {
      expect(container.querySelectorAll('img[data-system-story-theme="light"]')).toHaveLength(3)
    })

    const images = Array.from(container.querySelectorAll('img[data-system-story-theme="light"]'))

    expect(images.every((image) => image.getAttribute('src') === '/prototypes/portfolio-pipeline-hero/higgsfield-light-mode-hero-poster-20260628.webp')).toBe(true)
    expect(container.querySelector('img[src*="system-story-fragmented-rooms"]')).not.toBeInTheDocument()
  })

  it('keeps the dark system story images in dark mode', async () => {
    themeState.resolvedTheme = 'dark'
    const { container } = render(<SystemStory />)

    await waitFor(() => {
      expect(container.querySelectorAll('img[data-system-story-theme="dark"]')).toHaveLength(3)
    })

    expect(container.querySelector('img[src="/prototypes/portfolio-pipeline-hero/system-story-fragmented-rooms-20260617.webp"]')).toBeInTheDocument()
    expect(container.querySelector('img[src="/prototypes/portfolio-pipeline-hero/system-story-blueprint-map-20260617.webp"]')).toBeInTheDocument()
    expect(container.querySelector('img[src="/prototypes/portfolio-pipeline-hero/system-story-connected-pipeline-20260617.webp"]')).toBeInTheDocument()
    expect(container.querySelector('img[src*="higgsfield-light-mode-hero-poster"]')).not.toBeInTheDocument()
  })
})
