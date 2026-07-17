import { act, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Hero from './Hero'

const themeState = vi.hoisted(() => ({
  resolvedTheme: 'light' as 'light' | 'dark' | undefined,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
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

describe('Hero', () => {
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
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
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

  async function findHeroVideo(container: HTMLElement, theme: 'light' | 'dark') {
    await waitFor(() => {
      expect(container.querySelector(`video[data-theme-video="${theme}"]`)).toBeInTheDocument()
    })

    return container.querySelector(`video[data-theme-video="${theme}"]`) as HTMLVideoElement
  }

  it('scrubs only the active light hero video from scroll progress', async () => {
    const { container } = render(<Hero />)
    const section = container.querySelector('[data-section="hero"]') as HTMLElement
    const lightVideo = await findHeroVideo(container, 'light')
    const lightSource = lightVideo.querySelector('source') as HTMLSourceElement
    const lightPause = vi.fn()

    setElementLayout(section, 2000, -1000)
    Object.defineProperty(lightVideo, 'duration', {
      configurable: true,
      value: 12,
    })
    Object.defineProperty(lightVideo, 'paused', {
      configurable: true,
      value: false,
    })
    lightVideo.pause = lightPause

    flushAnimationFrame()

    expect(screen.getByRole('heading', {
      name: /turn disconnected work into one operating system/i,
    })).toBeInTheDocument()
    expect(lightVideo).toHaveAttribute(
      'poster',
      '/prototypes/portfolio-pipeline-hero/higgsfield-light-mode-hero-poster-20260628.webp',
    )
    expect(lightSource).toHaveAttribute(
      'src',
      '/prototypes/portfolio-pipeline-hero/higgsfield-light-mode-hero-loop-web-20260628.mp4',
    )
    expect(container.querySelector('video[data-theme-video="dark"]')).not.toBeInTheDocument()
    expect(lightVideo.currentTime).toBeCloseTo(11.95, 2)
    expect(lightPause).toHaveBeenCalled()
  })

  it('renders only the active dark hero media when the class-based theme resolves dark', async () => {
    themeState.resolvedTheme = 'dark'

    const { container } = render(<Hero />)
    const darkVideo = await findHeroVideo(container, 'dark')
    const darkSource = darkVideo.querySelector('source') as HTMLSourceElement

    expect(darkVideo).toHaveAttribute(
      'poster',
      '/prototypes/portfolio-pipeline-hero/amadutown-storefront-pipeline-hero-approved-20260617.png',
    )
    expect(darkSource).toHaveAttribute(
      'src',
      '/prototypes/portfolio-pipeline-hero/higgsfield-gold-pipeline-loop-desktop-only-360-starburst-web-20260617.mp4',
    )
    expect(container.querySelector('video[data-theme-video="light"]')).not.toBeInTheDocument()
  })

  it('keeps the active video at the beginning when the hero has no scroll distance', async () => {
    const { container } = render(<Hero />)
    const section = container.querySelector('[data-section="hero"]') as HTMLElement
    const lightVideo = await findHeroVideo(container, 'light')

    setElementLayout(section, 900, -500)
    Object.defineProperty(lightVideo, 'duration', {
      configurable: true,
      value: 10,
    })

    flushAnimationFrame()

    expect(lightVideo.currentTime).toBe(0)
  })
})
