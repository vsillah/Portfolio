import { fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import type { ImgHTMLAttributes } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AgentifiedLessonHero } from './AgentifiedLessonHero'

vi.mock('next/image', () => ({ default: ({ alt, src, priority: _priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string; priority?: boolean }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img alt={alt} src={src} {...props} />
) }))

describe('Agentified lesson media gate', () => {
  it('shows the selected cover directly with no empty video control', () => {
    const { container, rerender } = render(<AgentifiedLessonHero lessonId="L01" title="Give the agent a job and a receipt" poster="/agentified/posters/l01-poster.webp" />)
    expect(screen.getByRole('img', { name: /L01 Give the agent a job and a receipt lesson cover/ })).toHaveAttribute('src', '/agentified/posters/l01-poster.webp')
    expect(container.querySelector('video')).toBeNull()
    rerender(<AgentifiedLessonHero lessonId="L16" title="Audit the operating file" poster="/agentified/posters/l16-poster.webp" />)
    expect(screen.getByRole('img', { name: /L16 Audit the operating file lesson cover/ })).toHaveAttribute('src', '/agentified/posters/l16-poster.webp')
  })

  it('uses that same cover as the native poster when an approved source is supplied later', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const { container, rerender } = render(<AgentifiedLessonHero lessonId="L01" title="Receipt" poster="/agentified/posters/l01-poster.webp" videoSrc="blob:unit-test-media" />)
    const video = container.querySelector('video')!
    expect(video).toHaveAttribute('poster', '/agentified/posters/l01-poster.webp')
    expect(video).toHaveAttribute('aria-label', 'L01 Receipt guided video')
    expect(video.className).toContain('lessonVideo')
    expect(video).toHaveAttribute('controls')
    expect(video).toHaveAttribute('playsinline')
    fireEvent.playing(video)
    expect(video.className).toContain('videoReveal')
    fireEvent.pause(video)
    expect(video.className).toContain('videoReveal')
    fireEvent.emptied(video)
    expect(video.className).not.toContain('videoReveal')
    rerender(<AgentifiedLessonHero lessonId="L02" title="Decision" poster="/agentified/posters/l02-poster.webp" />)
    expect(container.querySelector('video')).toBeNull()
    expect(screen.getByRole('img', { name: 'L02 Decision lesson cover' })).toBeInTheDocument()
  })

  it('records the selected lesson duration when playback ends', () => {
    const onProgress = vi.fn()
    const { container } = render(<AgentifiedLessonHero lessonId="L03" title="Sources" poster="/agentified/posters/l03-poster.webp" videoSrc="/approved-l03.mp4" durationSeconds={600} onProgress={onProgress} />)
    fireEvent.ended(container.querySelector('video')!)
    expect(onProgress).toHaveBeenCalledWith(600)
  })

  it('records an integer completion position for fractional approved media', () => {
    const onProgress = vi.fn()
    const { container } = render(<AgentifiedLessonHero lessonId="L05" title="Map" poster="/agentified/posters/l05-poster.webp" videoSrc="/approved-l05.mp4" durationSeconds={237.687} onProgress={onProgress} />)
    fireEvent.ended(container.querySelector('video')!)
    expect(onProgress).toHaveBeenCalledWith(237)
  })

  it('shows source-bound L05 wording without a second plate only during its teaching scene', () => {
    const { container } = render(<AgentifiedLessonHero lessonId="L05" title="Map" poster="/agentified/posters/l05-poster.webp" videoSrc="/approved-l05.mp4" />)
    const video = container.querySelector('video')!
    let currentTime = 78.581
    Object.defineProperty(video, 'currentTime', { configurable: true, get: () => currentTime })
    fireEvent.seeking(video)
    expect(screen.queryByRole('complementary', { name: /L05-04 Portfolio-first operating stack source wording/ })).toBeNull()
    currentTime = 90
    fireEvent.seeking(video)
    const diagram = screen.getByRole('complementary', { name: /L05-04 Portfolio-first operating stack source wording/ })
    expect(diagram.querySelector('img')).toBeNull()
    expect(screen.getByRole('link', { name: 'Open full plate' })).toHaveAttribute('href', '/agentified/workshop/figure-8-1-portfolio-first-stack-publication-plate.png')
    expect(diagram).toHaveTextContent('Open Brainsources, events, proposals, memoriesHarnessCodex, tools, browser, apps, worktrees')
    expect(video).toHaveAttribute('controls')
    currentTime = 105.56
    fireEvent.seeking(video)
    expect(screen.queryByRole('complementary', { name: /L05-04 Portfolio-first operating stack source wording/ })).toBeNull()
  })

  it('uses the approved L06 source and cue window without changing native controls', () => {
    const { container } = render(<AgentifiedLessonHero lessonId="L06" title="Permission" poster="/agentified/posters/l06-poster.webp" videoSrc="/approved-l06.mp4" captionsSrc="/approved-l06.vtt" />)
    const video = container.querySelector('video')!
    let currentTime = 65.531
    Object.defineProperty(video, 'currentTime', { configurable: true, get: () => currentTime })
    fireEvent.seeking(video)
    expect(screen.queryByRole('complementary', { name: /L06-03 Authority ladder source wording/ })).toBeNull()
    currentTime = 80
    fireEvent.seeking(video)
    const diagram = screen.getByRole('complementary', { name: /L06-03 Authority ladder source wording/ })
    expect(diagram.querySelector('img')).toBeNull()
    expect(screen.getByRole('link', { name: 'Open full plate' })).toHaveAttribute('href', '/agentified/workshop/figure-ii-1-authority-ladder-publication-plate.png')
    expect(diagram).toHaveTextContent('Recommendsuggest next action with evidence')
    expect(video).toHaveAttribute('controls')
    expect(video.querySelector('track')).toHaveAttribute('src', '/approved-l06.vtt')
    currentTime = 97.482
    fireEvent.seeking(video)
    expect(screen.queryByRole('complementary', { name: /L06-03 Authority ladder source wording/ })).toBeNull()
  })

  it('shows only the exact L07 countdown gate line during its protected window', () => {
    const { container } = render(<AgentifiedLessonHero lessonId="L07" title="PRD and pod" poster="/agentified/posters/l07-poster.webp" videoSrc="/approved-l07.mp4" captionsSrc="/approved-l07.vtt" />)
    const video = container.querySelector('video')!
    let currentTime = 188.514
    Object.defineProperty(video, 'currentTime', { configurable: true, get: () => currentTime })
    fireEvent.seeking(video)
    expect(screen.queryByRole('complementary', { name: /L07-07 Human review remains the gate/ })).toBeNull()
    currentTime = 188.515
    fireEvent.seeking(video)
    const reading = screen.getByRole('complementary', { name: 'L07-07 Human review remains the gate. source wording' })
    expect(reading).toHaveTextContent('Human review remains the gate.')
    expect(reading.querySelector('img')).toBeNull()
    expect(reading.querySelector('a')).toBeNull()
    expect(video).toHaveAttribute('controls')
    expect(video.querySelector('track')).toHaveAttribute('src', '/approved-l07.vtt')
    currentTime = 233.515
    fireEvent.seeking(video)
    expect(screen.queryByRole('complementary', { name: /L07-07 Human review remains the gate/ })).toBeNull()
  })

  it('positions only L07 opening cues on desktop and restores native placement at 620px', () => {
    const originalPause = HTMLMediaElement.prototype.pause
    HTMLMediaElement.prototype.pause = vi.fn()
    const opening = { startTime: 9.876, endTime: 15.124, text: 'Original caption', snapToLines: true, line: 'auto' as number | 'auto' }
    const later = { startTime: 27.99, endTime: 31.884, text: 'Later caption', snapToLines: true, line: 'auto' as number | 'auto' }
    const track = Object.assign(new EventTarget(), { cues: [opening, later] })
    const media = Object.assign(new EventTarget(), { matches: true })
    const setViewportWidth = (width: number) => { media.matches = width >= 621; media.dispatchEvent(new Event('change')) }
    const originalTrack = Object.getOwnPropertyDescriptor(HTMLTrackElement.prototype, 'track')
    Object.defineProperty(HTMLTrackElement.prototype, 'track', { configurable: true, get: () => track })
    vi.stubGlobal('matchMedia', vi.fn(() => media))
    try {
      const { container, unmount } = render(<AgentifiedLessonHero lessonId="L07" title="Team" poster="/agentified/posters/l07-poster.webp" videoSrc="/approved-l07.mp4" captionsSrc="/approved-l07.vtt" />)
      expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 621px)')
      expect(container.querySelector('video')).toHaveAttribute('controls')
      expect(opening).toMatchObject({ line: 4, snapToLines: false, text: 'Original caption', startTime: 9.876, endTime: 15.124 })
      expect(later).toMatchObject({ line: 'auto', snapToLines: true })

      setViewportWidth(620)
      expect(opening).toMatchObject({ line: 'auto', snapToLines: true })
      expect(later).toMatchObject({ line: 'auto', snapToLines: true })

      setViewportWidth(621)
      expect(opening).toMatchObject({ line: 4, snapToLines: false })
      unmount()
      setViewportWidth(620)
      expect(opening).toMatchObject({ line: 4, snapToLines: false })
    } finally {
      if (originalTrack) Object.defineProperty(HTMLTrackElement.prototype, 'track', originalTrack)
      else Reflect.deleteProperty(HTMLTrackElement.prototype, 'track')
      HTMLMediaElement.prototype.pause = originalPause
      vi.unstubAllGlobals()
    }
  })

  it('reveals the next lesson at the exact sentence-complete boundary and hides it after seeking back', () => {
    const { container } = render(<AgentifiedLessonHero lessonId="L02" title="Decision" poster="/agentified/posters/l02-poster.webp" videoSrc="/approved-l02.mp4" durationSeconds={510} endScreen={{ startSeconds: 504, progress: 2, nextLesson: { id: 'L03', title: 'Trace the work and grade the sources', poster: '/agentified/posters/l03-poster.webp' } }} />)
    const video = container.querySelector('video')!
    let currentTime = 503.999
    Object.defineProperty(video, 'currentTime', { configurable: true, get: () => currentTime, set: (value) => { currentTime = value } })
    fireEvent.timeUpdate(video)
    expect(screen.queryByRole('status')).toBeNull()
    currentTime = 504
    fireEvent.timeUpdate(video)
    expect(screen.getByRole('status', { name: 'L02 complete. Up next, L03: Trace the work and grade the sources.' })).toBeInTheDocument()
    expect(screen.getByText('UP NEXT · L03')).toBeInTheDocument()
    expect(container.querySelector(`img[src="/agentified/posters/l03-poster.webp"]`)).toBeInTheDocument()
    currentTime = 120
    fireEvent.seeking(video)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('keeps a course-complete state visible when L16 ends without extending the media', () => {
    const { container } = render(<AgentifiedLessonHero lessonId="L16" title="Audit" poster="/agentified/posters/l16-poster.webp" videoSrc="/approved-l16.mp4" durationSeconds={267.309} endScreen={{ startSeconds: 267.222, progress: 16 }} />)
    fireEvent.ended(container.querySelector('video')!)
    expect(screen.getByRole('status', { name: 'L16 complete. Agentified course complete.' })).toBeInTheDocument()
    expect(screen.getByText('COURSE COMPLETE')).toBeInTheDocument()
    expect(screen.getByText('Review your Operating File')).toBeInTheDocument()
  })

  it('keeps the established 340 ms fade and reduced-motion cut in CSS', () => {
    const css = readFileSync('app/agentified/workshop.module.css', 'utf8')
    expect(css).toMatch(/\.coverStage \.videoReveal\{animation:agentifiedPosterToVideo 340ms ease-out both\}/)
    expect(css).toMatch(/\.lessonVideo\{[^}]*width:100%;max-width:100%/)
    expect(css).toMatch(/\.coverStage\{--native-control-clearance:clamp\(64px,9\.5cqw,96px\)/)
    expect(css).toMatch(/\.endScreen\{[^}]*inset:0 0 var\(--native-control-clearance\)/)
    expect(css).toMatch(/container:lesson-cover\/inline-size/)
    expect(css).toMatch(/@container lesson-cover \(max-width:900px\)/)
    expect(css).toMatch(/@container lesson-cover \(max-width:400px\)/)
    expect(css).toContain('@keyframes agentifiedEndScreen')
    expect(css).toMatch(/prefers-reduced-motion:reduce[^}]*\}[^}]*\.coverStage \.videoReveal,\.endScreen\{animation:none\}/)
    expect(css).toContain('@media(max-width:1100px)')
    expect(css).toContain('@media(max-width:900px)')
    expect(css).toContain('@media(max-width:620px)')
  })
})
