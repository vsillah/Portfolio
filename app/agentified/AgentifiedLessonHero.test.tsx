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
    expect(css).toMatch(/\.coverStage\{--native-control-clearance:clamp\(38px,9\.5cqw,96px\)/)
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
