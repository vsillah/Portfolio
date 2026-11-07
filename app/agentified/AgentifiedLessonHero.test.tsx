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

  it('keeps the established 340 ms fade and reduced-motion cut in CSS', () => {
    const css = readFileSync('app/agentified/workshop.module.css', 'utf8')
    expect(css).toMatch(/\.coverStage \.videoReveal\{animation:agentifiedPosterToVideo 340ms ease-out both\}/)
    expect(css).toMatch(/prefers-reduced-motion:reduce[^}]*\}[^}]*\.coverStage \.videoReveal\{animation:none\}/)
    expect(css).toContain('@media(max-width:1100px)')
    expect(css).toContain('@media(max-width:900px)')
    expect(css).toContain('@media(max-width:620px)')
  })
})
