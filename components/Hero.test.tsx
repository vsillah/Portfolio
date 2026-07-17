import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Hero from './Hero'

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

describe('Hero', () => {
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

  it('scrubs the hero video from scroll progress and never seeks to the exact video end', () => {
    const { container } = render(<Hero />)
    const section = container.querySelector('[data-section="hero"]') as HTMLElement
    const lightVideo = container.querySelector('video[data-theme-video="light"]') as HTMLVideoElement
    const darkVideo = container.querySelector('video[data-theme-video="dark"]') as HTMLVideoElement
    const lightSource = lightVideo.querySelector('source') as HTMLSourceElement
    const darkSource = darkVideo.querySelector('source') as HTMLSourceElement
    const lightPause = vi.fn()
    const darkPause = vi.fn()

    setElementLayout(section, 2000, -1000)
    Object.defineProperty(lightVideo, 'duration', {
      configurable: true,
      value: 12,
    })
    Object.defineProperty(darkVideo, 'duration', {
      configurable: true,
      value: 12,
    })
    Object.defineProperty(lightVideo, 'paused', {
      configurable: true,
      value: false,
    })
    Object.defineProperty(darkVideo, 'paused', {
      configurable: true,
      value: false,
    })
    lightVideo.pause = lightPause
    darkVideo.pause = darkPause

    flushAnimationFrame()

    expect(screen.getByRole('heading', {
      name: /turn disconnected work into one operating system/i,
    })).toBeInTheDocument()
    expect(lightVideo).toHaveAttribute(
      'poster',
      '/prototypes/portfolio-pipeline-hero/higgsfield-light-mode-hero-still-20260628.png',
    )
    expect(darkVideo).toHaveAttribute(
      'poster',
      '/prototypes/portfolio-pipeline-hero/amadutown-storefront-pipeline-hero-approved-20260617.png',
    )
    expect(lightSource).toHaveAttribute(
      'src',
      '/prototypes/portfolio-pipeline-hero/higgsfield-light-mode-hero-loop-web-20260628.mp4',
    )
    expect(darkSource).toHaveAttribute(
      'src',
      '/prototypes/portfolio-pipeline-hero/higgsfield-gold-pipeline-loop-desktop-only-360-starburst-web-20260617.mp4',
    )
    expect(lightVideo.currentTime).toBeCloseTo(11.95, 2)
    expect(darkVideo.currentTime).toBeCloseTo(11.95, 2)
    expect(lightPause).toHaveBeenCalled()
    expect(darkPause).toHaveBeenCalled()
  })

  it('keeps the video at the beginning when the hero has no scroll distance', () => {
    const { container } = render(<Hero />)
    const section = container.querySelector('[data-section="hero"]') as HTMLElement
    const lightVideo = container.querySelector('video[data-theme-video="light"]') as HTMLVideoElement
    const darkVideo = container.querySelector('video[data-theme-video="dark"]') as HTMLVideoElement

    setElementLayout(section, 900, -500)
    Object.defineProperty(lightVideo, 'duration', {
      configurable: true,
      value: 10,
    })
    Object.defineProperty(darkVideo, 'duration', {
      configurable: true,
      value: 10,
    })

    flushAnimationFrame()

    expect(lightVideo.currentTime).toBe(0)
    expect(darkVideo.currentTime).toBe(0)
  })
})
