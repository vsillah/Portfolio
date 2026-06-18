import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Hero from './Hero'
import SystemStory from './SystemStory'

type MockImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean
  priority?: boolean
  sizes?: string
  src: string
}

type MockLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
}

vi.mock('next/image', () => ({
  default: ({ fill: _fill, priority: _priority, sizes: _sizes, ...props }: MockImageProps) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ''} />
  ),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: MockLinkProps) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

type SectionGeometry = {
  height: number
  top: number
}

const sectionGeometry = new Map<string, SectionGeometry>()
let animationFrames = new Map<number, FrameRequestCallback>()
let nextAnimationFrameId = 1
let restoreProperties: Array<() => void> = []
const originalConsoleError = console.error

function defineRestorableProperty(target: object, property: PropertyKey, descriptor: PropertyDescriptor) {
  const original = Object.getOwnPropertyDescriptor(target, property)

  Object.defineProperty(target, property, {
    configurable: true,
    ...descriptor,
  })

  restoreProperties.push(() => {
    if (original) {
      Object.defineProperty(target, property, original)
      return
    }

    delete (target as Record<PropertyKey, unknown>)[property]
  })
}

function mockSectionGeometry() {
  defineRestorableProperty(window, 'innerHeight', { value: 1000, writable: true })
  defineRestorableProperty(HTMLElement.prototype, 'offsetHeight', {
    get(this: HTMLElement) {
      return sectionGeometry.get(this.dataset.section ?? '')?.height ?? 0
    },
  })

  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const geometry = sectionGeometry.get(this.dataset.section ?? '') ?? { height: 0, top: 0 }

    return {
      x: 0,
      y: geometry.top,
      top: geometry.top,
      bottom: geometry.top + geometry.height,
      left: 0,
      right: 0,
      width: 0,
      height: geometry.height,
      toJSON: () => ({}),
    } as DOMRect
  })
}

function mockAnimationFrames() {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextAnimationFrameId
    nextAnimationFrameId += 1
    animationFrames.set(id, callback)
    return id
  })

  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    animationFrames.delete(id)
  })
}

function flushAnimationFrames() {
  act(() => {
    const callbacks = [...animationFrames.values()]
    animationFrames.clear()

    for (const callback of callbacks) {
      callback(0)
    }
  })
}

describe('homepage scroll sections', () => {
  beforeEach(() => {
    sectionGeometry.clear()
    animationFrames = new Map()
    nextAnimationFrameId = 1
    restoreProperties = []
    mockSectionGeometry()
    mockAnimationFrames()
    vi.spyOn(console, 'error').mockImplementation((...args: Parameters<typeof console.error>) => {
      const [message] = args

      if (
        typeof message === 'string' &&
        message.includes('Received `%s` for a non-boolean attribute `%s`') &&
        args.includes('jsx')
      ) {
        return
      }

      originalConsoleError(...args)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()

    for (const restore of restoreProperties.reverse()) {
      restore()
    }
  })

  it('scrubs the hero video by scroll progress and keeps it paused', () => {
    let currentTime = 4
    let paused = false
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {
      paused = true
    })

    defineRestorableProperty(HTMLMediaElement.prototype, 'duration', {
      get() {
        return 10
      },
    })
    defineRestorableProperty(HTMLMediaElement.prototype, 'currentTime', {
      get() {
        return currentTime
      },
      set(value: number) {
        currentTime = value
      },
    })
    defineRestorableProperty(HTMLMediaElement.prototype, 'paused', {
      get() {
        return paused
      },
    })

    sectionGeometry.set('hero', { height: 2400, top: 0 })

    render(<Hero />)
    flushAnimationFrames()

    expect(currentTime).toBe(0)
    expect(pause).toHaveBeenCalled()

    paused = false
    sectionGeometry.set('hero', { height: 2400, top: -1400 })

    fireEvent.scroll(window)
    flushAnimationFrames()

    expect(currentTime).toBeCloseTo(9.95, 2)
    expect(paused).toBe(true)
  })

  it('advances and clamps the system story frames from section scroll progress', () => {
    sectionGeometry.set('system-story', { height: 3200, top: 0 })

    render(<SystemStory />)
    flushAnimationFrames()

    expect(
      screen.getByRole('heading', {
        name: "The work is already there. It just isn't connected.",
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('01 / 03')).toBeInTheDocument()

    sectionGeometry.set('system-story', { height: 3200, top: -1100 })
    fireEvent.scroll(window)
    flushAnimationFrames()

    expect(screen.getByRole('heading', { name: 'We map the operating system.' })).toBeInTheDocument()
    expect(screen.getByText('02 / 03')).toBeInTheDocument()

    sectionGeometry.set('system-story', { height: 3200, top: -5000 })
    fireEvent.scroll(window)
    flushAnimationFrames()

    expect(screen.getByRole('heading', { name: 'Then we connect the work.' })).toBeInTheDocument()
    expect(screen.getByText('03 / 03')).toBeInTheDocument()
  })
})
