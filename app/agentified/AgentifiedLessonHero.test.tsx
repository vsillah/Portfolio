import { act, fireEvent, render, screen } from '@testing-library/react'
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

  it('positions only L07-01 and L07-06 desktop cues and restores native placement at 620px', () => {
    const originalPause = HTMLMediaElement.prototype.pause
    HTMLMediaElement.prototype.pause = vi.fn()
    const cue = (startTime: number, endTime: number, text: string) => ({ startTime, endTime, text, snapToLines: true, line: 'auto' as number | 'auto' })
    const opening = cue(9.876, 15.124, 'Original caption')
    const afterOpening = cue(27.99, 31.884, 'Next scene caption')
    const beforeReceiver = cue(150.962, 153.202, 'Before receiver scene')
    const receiverStart = cue(153.479, 153.948, 'Pause.')
    const receiverMid = cue(154.162, 157.895, 'Who would receive the brief?')
    const receiverEnd = cue(158.215, 159.808, 'Name the role and the human.')
    const afterReceiver = cue(160.078, 162.83, 'Next scene caption')
    const receiverCues = [receiverStart, receiverMid, receiverEnd]
    const unaffectedCues = [afterOpening, beforeReceiver, afterReceiver]
    const track = Object.assign(new EventTarget(), { cues: [opening, ...unaffectedCues, ...receiverCues] })
    const desktopMedia = Object.assign(new EventTarget(), { matches: true })
    const mobileMedia = Object.assign(new EventTarget(), { matches: false })
    const setViewportWidth = (width: number) => { desktopMedia.matches = width >= 621; mobileMedia.matches = width <= 620; desktopMedia.dispatchEvent(new Event('change')); mobileMedia.dispatchEvent(new Event('change')) }
    const originalTrack = Object.getOwnPropertyDescriptor(HTMLTrackElement.prototype, 'track')
    Object.defineProperty(HTMLTrackElement.prototype, 'track', { configurable: true, get: () => track })
    vi.stubGlobal('matchMedia', vi.fn((query: string) => query.includes('min-width') ? desktopMedia : mobileMedia))
    try {
      const { container, unmount } = render(<AgentifiedLessonHero lessonId="L07" title="Team" poster="/agentified/posters/l07-poster.webp" videoSrc="/approved-l07.mp4" captionsSrc="/approved-l07.vtt" />)
      expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 621px)')
      expect(container.querySelector('video')).toHaveAttribute('controls')
      expect(opening).toMatchObject({ line: 4, snapToLines: false, text: 'Original caption', startTime: 9.876, endTime: 15.124 })
      for (const receiver of receiverCues) expect(receiver).toMatchObject({ line: 52, snapToLines: false })
      for (const unaffected of unaffectedCues) expect(unaffected).toMatchObject({ line: 'auto', snapToLines: true })

      act(() => setViewportWidth(620))
      expect(opening).toMatchObject({ line: 'auto', snapToLines: true })
      for (const receiver of receiverCues) expect(receiver).toMatchObject({ line: 'auto', snapToLines: true })
      for (const unaffected of unaffectedCues) expect(unaffected).toMatchObject({ line: 'auto', snapToLines: true })

      act(() => setViewportWidth(621))
      expect(opening).toMatchObject({ line: 4, snapToLines: false })
      for (const receiver of receiverCues) expect(receiver).toMatchObject({ line: 52, snapToLines: false })
      unmount()
      act(() => setViewportWidth(620))
      expect(opening).toMatchObject({ line: 4, snapToLines: false })
      for (const receiver of receiverCues) expect(receiver).toMatchObject({ line: 52, snapToLines: false })
    } finally {
      if (originalTrack) Object.defineProperty(HTMLTrackElement.prototype, 'track', originalTrack)
      else Reflect.deleteProperty(HTMLTrackElement.prototype, 'track')
      HTMLMediaElement.prototype.pause = originalPause
      vi.unstubAllGlobals()
    }
  })

  it('routes all L06 teaching cues below the video and clears the protected ending', () => {
    const originalPause = HTMLMediaElement.prototype.pause
    const originalTracks = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'textTracks')
    const originalTrack = Object.getOwnPropertyDescriptor(HTMLTrackElement.prototype, 'track')
    const before = { startTime: 62.762, endTime: 65.531, text: 'Expiry sends the proposed slip back for review' }
    const protectedCue = { startTime: 75.572, endTime: 83.679, text: 'Its proposed slip also names permitted source IDs' }
    const after = { startTime: 97.482, endTime: 100.31, text: 'Now test the value of the work itself.' }
    const track = Object.assign(new EventTarget(), { mode: 'disabled', cues: [before, protectedCue, after] })
    const tracks = Object.assign(new EventTarget(), { 0: track, length: 1 })
    const mobileMedia = Object.assign(new EventTarget(), { matches: false })
    HTMLMediaElement.prototype.pause = vi.fn()
    Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', { configurable: true, get: () => tracks })
    Object.defineProperty(HTMLTrackElement.prototype, 'track', { configurable: true, get: () => track })
    vi.stubGlobal('matchMedia', vi.fn(() => mobileMedia))
    const props = { lessonId: 'L06', title: 'Permission', poster: '/agentified/posters/l06-poster.webp', videoSrc: '/approved-l06.mp4', captionsSrc: '/approved-l06.vtt', endScreen: { startSeconds: 255.493, progress: 6 } }
    try {
      const { container, rerender, unmount } = render(<AgentifiedLessonHero {...props} captionSize="M" captionsOn />)
      const video = container.querySelector('video')!
      let currentTime = 64.5
      Object.defineProperty(video, 'currentTime', { configurable: true, get: () => currentTime })
      fireEvent.loadedMetadata(video)
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L06 caption' })).toHaveTextContent(before.text)

      currentTime = 77
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L06 caption' })).toHaveTextContent(protectedCue.text)
      for (const size of ['S', 'L', 'M'] as const) {
        rerender(<AgentifiedLessonHero {...props} captionSize={size} captionsOn />)
        expect(screen.getByRole('status', { name: 'L06 caption' })).toHaveAttribute('data-caption-size', size)
      }
      rerender(<AgentifiedLessonHero {...props} captionSize="M" captionsOn={false} />)
      expect(track.mode).toBe('disabled')
      expect(screen.queryByRole('status', { name: 'L06 caption' })).toBeNull()
      rerender(<AgentifiedLessonHero {...props} captionSize="M" captionsOn />)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L06 caption' })).toHaveTextContent(protectedCue.text)

      currentTime = 97.481
      fireEvent.seeking(video)
      expect(screen.queryByRole('status', { name: 'L06 caption' })).toBeNull()
      currentTime = 98.5
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L06 caption' })).toHaveTextContent(after.text)
      act(() => { mobileMedia.matches = true; mobileMedia.dispatchEvent(new Event('change')) })
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L06 caption' })).toHaveTextContent(after.text)
      act(() => { mobileMedia.matches = false; mobileMedia.dispatchEvent(new Event('change')) })
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L06 caption' })).toHaveTextContent(after.text)
      currentTime = 255.493
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.queryByRole('status', { name: 'L06 caption' })).toBeNull()
      expect([before, protectedCue, after]).toEqual([
        { startTime: 62.762, endTime: 65.531, text: before.text },
        { startTime: 75.572, endTime: 83.679, text: protectedCue.text },
        { startTime: 97.482, endTime: 100.31, text: after.text },
      ])
      expect(video).toHaveAttribute('controls')
      unmount()
    } finally {
      if (originalTracks) Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', originalTracks)
      else Reflect.deleteProperty(HTMLMediaElement.prototype, 'textTracks')
      if (originalTrack) Object.defineProperty(HTMLTrackElement.prototype, 'track', originalTrack)
      else Reflect.deleteProperty(HTMLTrackElement.prototype, 'track')
      HTMLMediaElement.prototype.pause = originalPause
      vi.unstubAllGlobals()
    }
  })

  it('routes only L01-02 desktop cues below the video and restores adjacent native captions', () => {
    const originalPause = HTMLMediaElement.prototype.pause
    const originalTracks = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'textTracks')
    const originalTrack = Object.getOwnPropertyDescriptor(HTMLTrackElement.prototype, 'track')
    const before = { startTime: 30, endTime: 34.584, text: 'Before the scoped job' }
    const protectedCue = { startTime: 49.894, endTime: 55.569, text: 'If we give the system a loose command like ‘run the workshop program,’ we have no useful boundary.' }
    const after = { startTime: 74.197, endTime: 83.794, text: 'Write the job in one sentence' }
    const track = Object.assign(new EventTarget(), { mode: 'disabled', cues: [before, protectedCue, after] })
    const tracks = Object.assign(new EventTarget(), { 0: track, length: 1 })
    const mobileMedia = Object.assign(new EventTarget(), { matches: false })
    HTMLMediaElement.prototype.pause = vi.fn()
    Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', { configurable: true, get: () => tracks })
    Object.defineProperty(HTMLTrackElement.prototype, 'track', { configurable: true, get: () => track })
    vi.stubGlobal('matchMedia', vi.fn(() => mobileMedia))
    const props = { lessonId: 'L01', title: 'Scoped job', poster: '/agentified/posters/l01-poster.webp', videoSrc: '/approved-l01.mp4', captionsSrc: '/approved-l01.vtt' }
    try {
      const { container, rerender, unmount } = render(<AgentifiedLessonHero {...props} captionSize="M" captionsOn />)
      const video = container.querySelector('video')!
      let currentTime = 34.584
      Object.defineProperty(video, 'currentTime', { configurable: true, get: () => currentTime })
      fireEvent.loadedMetadata(video)
      fireEvent.seeking(video)
      expect(track.mode).toBe('showing')
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()

      currentTime = 52
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L01 caption' })).toHaveTextContent(protectedCue.text)
      for (const size of ['S', 'L', 'M'] as const) {
        rerender(<AgentifiedLessonHero {...props} captionSize={size} captionsOn />)
        expect(screen.getByRole('status', { name: 'L01 caption' })).toHaveAttribute('data-caption-size', size)
      }
      rerender(<AgentifiedLessonHero {...props} captionSize="M" captionsOn={false} />)
      expect(track.mode).toBe('disabled')
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()
      rerender(<AgentifiedLessonHero {...props} captionSize="M" captionsOn />)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L01 caption' })).toHaveTextContent(protectedCue.text)

      currentTime = 55.8
      fireEvent.seeking(video)
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()
      currentTime = 74.197
      fireEvent.seeking(video)
      expect(track.mode).toBe('showing')
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()
      act(() => { mobileMedia.matches = true; mobileMedia.dispatchEvent(new Event('change')) })
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L01 caption' })).toHaveTextContent(after.text)
      act(() => { mobileMedia.matches = false; mobileMedia.dispatchEvent(new Event('change')) })
      expect(track.mode).toBe('showing')
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()
      expect([before, protectedCue, after]).toEqual([
        { startTime: 30, endTime: 34.584, text: before.text },
        { startTime: 49.894, endTime: 55.569, text: protectedCue.text },
        { startTime: 74.197, endTime: 83.794, text: after.text },
      ])
      expect(video).toHaveAttribute('controls')
      unmount()
    } finally {
      if (originalTracks) Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', originalTracks)
      else Reflect.deleteProperty(HTMLMediaElement.prototype, 'textTracks')
      if (originalTrack) Object.defineProperty(HTMLTrackElement.prototype, 'track', originalTrack)
      else Reflect.deleteProperty(HTMLTrackElement.prototype, 'track')
      HTMLMediaElement.prototype.pause = originalPause
      vi.unstubAllGlobals()
    }
  })

  it('routes L01-04 cues below the video only within its audited scene', () => {
    const originalPause = HTMLMediaElement.prototype.pause
    const originalTracks = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'textTracks')
    const originalTrack = Object.getOwnPropertyDescriptor(HTMLTrackElement.prototype, 'track')
    const before = { startTime: 110, endTime: 114.358, text: 'Adjacent L01-03 cue' }
    const protectedCue = { startTime: 130.258, endTime: 135.976, text: 'The receipt also records cost or resource use, outcome, and how to pull the draft back.' }
    const after = { startTime: 150.501, endTime: 153.756, text: 'Adjacent L01-05 cue' }
    const track = Object.assign(new EventTarget(), { mode: 'disabled', cues: [before, protectedCue, after] })
    const tracks = Object.assign(new EventTarget(), { 0: track, length: 1 })
    const mobileMedia = Object.assign(new EventTarget(), { matches: false })
    HTMLMediaElement.prototype.pause = vi.fn()
    Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', { configurable: true, get: () => tracks })
    Object.defineProperty(HTMLTrackElement.prototype, 'track', { configurable: true, get: () => track })
    vi.stubGlobal('matchMedia', vi.fn(() => mobileMedia))
    const props = { lessonId: 'L01', title: 'Scoped job', poster: '/agentified/posters/l01-poster.webp', videoSrc: '/approved-l01.mp4', captionsSrc: '/approved-l01.vtt' }
    try {
      const { container, rerender, unmount } = render(<AgentifiedLessonHero {...props} captionSize="M" captionsOn />)
      const video = container.querySelector('video')!
      let currentTime = 114.357
      Object.defineProperty(video, 'currentTime', { configurable: true, get: () => currentTime })
      fireEvent.loadedMetadata(video)
      fireEvent.seeking(video)
      expect(track.mode).toBe('showing')
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()
      currentTime = 132
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L01 caption' })).toHaveTextContent(protectedCue.text)
      for (const size of ['S', 'L', 'M'] as const) {
        rerender(<AgentifiedLessonHero {...props} captionSize={size} captionsOn />)
        expect(screen.getByRole('status', { name: 'L01 caption' })).toHaveAttribute('data-caption-size', size)
      }
      rerender(<AgentifiedLessonHero {...props} captionSize="M" captionsOn={false} />)
      expect(track.mode).toBe('disabled')
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()
      rerender(<AgentifiedLessonHero {...props} captionSize="M" captionsOn />)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L01 caption' })).toHaveTextContent(protectedCue.text)
      currentTime = 136.3
      fireEvent.seeking(video)
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()
      currentTime = 150.501
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L01 caption' })).toHaveTextContent(after.text)
      act(() => { mobileMedia.matches = true; mobileMedia.dispatchEvent(new Event('change')) })
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L01 caption' })).toHaveTextContent(after.text)
      act(() => { mobileMedia.matches = false; mobileMedia.dispatchEvent(new Event('change')) })
      expect(track.mode).toBe('hidden')
      currentTime = 183.059
      fireEvent.seeking(video)
      expect(track.mode).toBe('showing')
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()
      expect([before, protectedCue, after]).toEqual([
        { startTime: 110, endTime: 114.358, text: before.text },
        { startTime: 130.258, endTime: 135.976, text: protectedCue.text },
        { startTime: 150.501, endTime: 153.756, text: after.text },
      ])
      expect(video).toHaveAttribute('controls')
      unmount()
    } finally {
      if (originalTracks) Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', originalTracks)
      else Reflect.deleteProperty(HTMLMediaElement.prototype, 'textTracks')
      if (originalTrack) Object.defineProperty(HTMLTrackElement.prototype, 'track', originalTrack)
      else Reflect.deleteProperty(HTMLTrackElement.prototype, 'track')
      HTMLMediaElement.prototype.pause = originalPause
      vi.unstubAllGlobals()
    }
  })

  it('routes L01-05 cues below the video only within its audited scene', () => {
    const originalPause = HTMLMediaElement.prototype.pause
    const originalTracks = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'textTracks')
    const originalTrack = Object.getOwnPropertyDescriptor(HTMLTrackElement.prototype, 'track')
    const before = { startTime: 144.099, endTime: 149.701, text: 'Adjacent L01-04 cue' }
    const protectedCue = { startTime: 157.75, endTime: 164.589, text: 'The rollback is ‘withdraw the draft from the review folder and mark it superseded.’' }
    const after = { startTime: 183.059, endTime: 184.076, text: 'Take a moment.' }
    const track = Object.assign(new EventTarget(), { mode: 'disabled', cues: [before, protectedCue, after] })
    const tracks = Object.assign(new EventTarget(), { 0: track, length: 1 })
    const mobileMedia = Object.assign(new EventTarget(), { matches: false })
    HTMLMediaElement.prototype.pause = vi.fn()
    Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', { configurable: true, get: () => tracks })
    Object.defineProperty(HTMLTrackElement.prototype, 'track', { configurable: true, get: () => track })
    vi.stubGlobal('matchMedia', vi.fn(() => mobileMedia))
    const props = { lessonId: 'L01', title: 'Scoped job', poster: '/agentified/posters/l01-poster.webp', videoSrc: '/approved-l01.mp4', captionsSrc: '/approved-l01.vtt' }
    try {
      const { container, rerender, unmount } = render(<AgentifiedLessonHero {...props} captionSize="M" captionsOn />)
      const video = container.querySelector('video')!
      let currentTime = 150.5
      Object.defineProperty(video, 'currentTime', { configurable: true, get: () => currentTime })
      fireEvent.loadedMetadata(video)
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()
      currentTime = 162.78
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L01 caption' })).toHaveTextContent(protectedCue.text)
      for (const size of ['S', 'L', 'M'] as const) {
        rerender(<AgentifiedLessonHero {...props} captionSize={size} captionsOn />)
        expect(screen.getByRole('status', { name: 'L01 caption' })).toHaveAttribute('data-caption-size', size)
      }
      rerender(<AgentifiedLessonHero {...props} captionSize="M" captionsOn={false} />)
      expect(track.mode).toBe('disabled')
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()
      rerender(<AgentifiedLessonHero {...props} captionSize="M" captionsOn />)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L01 caption' })).toHaveTextContent(protectedCue.text)
      currentTime = 164.8
      fireEvent.seeking(video)
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()
      currentTime = 183.059
      fireEvent.seeking(video)
      expect(track.mode).toBe('showing')
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()
      act(() => { mobileMedia.matches = true; mobileMedia.dispatchEvent(new Event('change')) })
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L01 caption' })).toHaveTextContent(after.text)
      act(() => { mobileMedia.matches = false; mobileMedia.dispatchEvent(new Event('change')) })
      expect(track.mode).toBe('showing')
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()
      expect([before, protectedCue, after]).toEqual([
        { startTime: 144.099, endTime: 149.701, text: before.text },
        { startTime: 157.75, endTime: 164.589, text: protectedCue.text },
        { startTime: 183.059, endTime: 184.076, text: after.text },
      ])
      expect(video).toHaveAttribute('controls')
      unmount()
    } finally {
      if (originalTracks) Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', originalTracks)
      else Reflect.deleteProperty(HTMLMediaElement.prototype, 'textTracks')
      if (originalTrack) Object.defineProperty(HTMLTrackElement.prototype, 'track', originalTrack)
      else Reflect.deleteProperty(HTMLTrackElement.prototype, 'track')
      HTMLMediaElement.prototype.pause = originalPause
      vi.unstubAllGlobals()
    }
  })

  it('positions only L05 protected-opening native cues above the panel on desktop', () => {
    const originalPause = HTMLMediaElement.prototype.pause
    HTMLMediaElement.prototype.pause = vi.fn()
    const cue = (startTime: number, endTime: number, text: string) => ({ startTime, endTime, text, snapToLines: true, line: 'auto' as number | 'auto' })
    const opening = [cue(0, 1.6, 'Friday arrives at Harbor Learning'), cue(6.26, 8.01, 'But imagine Morgan is out for an hour.'), cue(11.13, 11.64, 'role read?')]
    const teaching = cue(12.331, 15.616, 'Who can answer a question about the unconfirmed facilitator?')
    const track = Object.assign(new EventTarget(), { cues: [...opening, teaching] })
    const desktopMedia = Object.assign(new EventTarget(), { matches: true })
    const mobileMedia = Object.assign(new EventTarget(), { matches: false })
    const setWidth = (width: number) => { desktopMedia.matches = width >= 621; mobileMedia.matches = width <= 620; desktopMedia.dispatchEvent(new Event('change')); mobileMedia.dispatchEvent(new Event('change')) }
    const originalTrack = Object.getOwnPropertyDescriptor(HTMLTrackElement.prototype, 'track')
    Object.defineProperty(HTMLTrackElement.prototype, 'track', { configurable: true, get: () => track })
    vi.stubGlobal('matchMedia', vi.fn((query: string) => query.includes('min-width') ? desktopMedia : mobileMedia))
    try {
      const { container, unmount } = render(<AgentifiedLessonHero lessonId="L05" title="Visible path" poster="/agentified/posters/l05-poster.webp" videoSrc="/approved-l05.mp4" captionsSrc="/approved-l05.vtt" />)
      expect(container.querySelector('video')).toHaveAttribute('controls')
      for (const item of opening) expect(item).toMatchObject({ line: 10, snapToLines: false })
      expect(teaching).toMatchObject({ line: 'auto', snapToLines: true })
      act(() => setWidth(620))
      for (const item of opening) expect(item).toMatchObject({ line: 'auto', snapToLines: true })
      act(() => setWidth(621))
      for (const item of opening) expect(item).toMatchObject({ line: 10, snapToLines: false })
      expect(opening.map(({ startTime, endTime, text }) => ({ startTime, endTime, text }))).toEqual([
        { startTime: 0, endTime: 1.6, text: 'Friday arrives at Harbor Learning' },
        { startTime: 6.26, endTime: 8.01, text: 'But imagine Morgan is out for an hour.' },
        { startTime: 11.13, endTime: 11.64, text: 'role read?' },
      ])
      unmount()
    } finally {
      if (originalTrack) Object.defineProperty(HTMLTrackElement.prototype, 'track', originalTrack)
      else Reflect.deleteProperty(HTMLTrackElement.prototype, 'track')
      HTMLMediaElement.prototype.pause = originalPause
      vi.unstubAllGlobals()
    }
  })

  it('keeps L05-01 captions clear after the native presenter and restores L05-02', () => {
    const originalPause = HTMLMediaElement.prototype.pause
    const originalTracks = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'textTracks')
    const originalTrack = Object.getOwnPropertyDescriptor(HTMLTrackElement.prototype, 'track')
    const presenterCue = { startTime: 11.13, endTime: 11.64, text: 'role read?' }
    const panelCue = { startTime: 15.872, endTime: 21.568, text: "If the answer lives only in Morgan's head, our\ncarefully designed pieces still do not make an\noperating system." }
    const adjacentCue = { startTime: 24.779, endTime: 26.614, text: 'Start with the real sequence on paper.' }
    const afterCue = { startTime: 52.822, endTime: 55.766, text: 'Chapter Eight gives the operating map five columns.' }
    const remainingCues = [
      { startTime: 78.582, endTime: 81, text: 'Put the earlier lessons onto those rows.' },
      { startTime: 105.56, endTime: 109, text: 'The workbook also asks where approval, spend checks, public-safe proof, and rollback sit.' },
      { startTime: 136.581, endTime: 137.5, text: 'Pause.' },
      { startTime: 144.329, endTime: 146.676, text: 'Build the Operating Map in your Operating File.' },
      { startTime: 219.992, endTime: 221.971, text: 'Save revision five as a draft.' },
      { startTime: 234.038, endTime: 234.398, text: 'system.' },
    ]
    const track = Object.assign(new EventTarget(), { mode: 'disabled', cues: [presenterCue, panelCue, adjacentCue, afterCue, ...remainingCues] })
    const tracks = Object.assign(new EventTarget(), { 0: track, length: 1 })
    const mobileMedia = Object.assign(new EventTarget(), { matches: false })
    HTMLMediaElement.prototype.pause = vi.fn()
    Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', { configurable: true, get: () => tracks })
    Object.defineProperty(HTMLTrackElement.prototype, 'track', { configurable: true, get: () => track })
    vi.stubGlobal('matchMedia', vi.fn(() => mobileMedia))
    const props = { lessonId: 'L05', title: 'Visible path', poster: '/agentified/posters/l05-poster.webp', videoSrc: '/approved-l05.mp4', captionsSrc: '/approved-l05.vtt', endScreen: { startSeconds: 234.398, progress: 5 } }
    try {
      const { container, rerender, unmount } = render(<AgentifiedLessonHero {...props} captionSize="M" captionsOn />)
      const video = container.querySelector('video')!
      let currentTime = 11.91
      Object.defineProperty(video, 'currentTime', { configurable: true, get: () => currentTime })
      fireEvent.loadedMetadata(video)
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.queryByRole('status', { name: 'L05 caption' })).toBeNull()
      currentTime = 11.909
      fireEvent.seeking(video)
      expect(track.mode).toBe('showing')
      currentTime = 19.314
      fireEvent.seeking(video)
      fireEvent.pause(video)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L05 caption' })).toHaveTextContent(panelCue.text.replace(/\s+/g, ' '))
      for (const size of ['S', 'L', 'M'] as const) {
        rerender(<AgentifiedLessonHero {...props} captionSize={size} captionsOn />)
        expect(screen.getByRole('status', { name: 'L05 caption' })).toHaveAttribute('data-caption-size', size)
      }
      rerender(<AgentifiedLessonHero {...props} captionSize="M" captionsOn={false} />)
      expect(track.mode).toBe('disabled')
      expect(screen.queryByRole('status', { name: 'L05 caption' })).toBeNull()
      rerender(<AgentifiedLessonHero {...props} captionSize="M" captionsOn />)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L05 caption' })).toHaveTextContent(panelCue.text.replace(/\s+/g, ' '))
      currentTime = 21.7
      fireEvent.seeking(video)
      expect(screen.queryByRole('status', { name: 'L05 caption' })).toBeNull()
      currentTime = 24.779
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L05 caption' })).toHaveTextContent(adjacentCue.text)
      currentTime = 38.8
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      currentTime = 52.822
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L05 caption' })).toHaveTextContent(afterCue.text)
      for (const [time, text] of [[78.582, remainingCues[0].text], [105.56, remainingCues[1].text], [136.581, remainingCues[2].text], [144.329, remainingCues[3].text], [219.992, remainingCues[4].text]] as const) {
        currentTime = time
        fireEvent.seeking(video)
        expect(track.mode).toBe('hidden')
        expect(screen.getByRole('status', { name: 'L05 caption' })).toHaveTextContent(text)
      }
      currentTime = 234.397
      fireEvent.seeking(video)
      expect(screen.getByRole('status', { name: 'L05 caption' })).toHaveTextContent('system.')
      currentTime = 234.398
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.queryByRole('status', { name: 'L05 caption' })).toBeNull()
      expect(screen.getByRole('status', { name: 'L05 complete. Agentified course complete.' })).toBeInTheDocument()
      act(() => { mobileMedia.matches = true; mobileMedia.dispatchEvent(new Event('change')) })
      expect(track.mode).toBe('hidden')
      expect(screen.queryByRole('status', { name: 'L05 caption' })).toBeNull()
      expect([presenterCue, panelCue, adjacentCue, afterCue, ...remainingCues]).toEqual([
        { startTime: 11.13, endTime: 11.64, text: 'role read?' },
        { startTime: 15.872, endTime: 21.568, text: panelCue.text },
        { startTime: 24.779, endTime: 26.614, text: adjacentCue.text },
        { startTime: 52.822, endTime: 55.766, text: afterCue.text },
        ...remainingCues,
      ])
      expect(video).not.toHaveAttribute('controls')
      expect(screen.getByRole('group', { name: 'L05 video controls' })).toBeInTheDocument()
      unmount()
    } finally {
      if (originalTracks) Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', originalTracks)
      else Reflect.deleteProperty(HTMLMediaElement.prototype, 'textTracks')
      if (originalTrack) Object.defineProperty(HTMLTrackElement.prototype, 'track', originalTrack)
      else Reflect.deleteProperty(HTMLTrackElement.prototype, 'track')
      HTMLMediaElement.prototype.pause = originalPause
      vi.unstubAllGlobals()
    }
  })

  it('clears L01-08 captions before the protected completion boundary', () => {
    const originalPause = HTMLMediaElement.prototype.pause
    const originalTracks = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'textTracks')
    const originalTrack = Object.getOwnPropertyDescriptor(HTMLTrackElement.prototype, 'track')
    const cue = { startTime: 348.879, endTime: 355.004, text: 'Your stop condition is simple: if the owner, source, or review gate is missing, the draft stays on paper.' }
    const lastCue = { startTime: 356.899, endTime: 359.645, text: 'Next we will name the decision Morgan actually owns.' }
    const track = Object.assign(new EventTarget(), { mode: 'disabled', cues: [cue, lastCue] })
    const tracks = Object.assign(new EventTarget(), { 0: track, length: 1 })
    const mobileMedia = Object.assign(new EventTarget(), { matches: false })
    HTMLMediaElement.prototype.pause = vi.fn()
    Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', { configurable: true, get: () => tracks })
    Object.defineProperty(HTMLTrackElement.prototype, 'track', { configurable: true, get: () => track })
    vi.stubGlobal('matchMedia', vi.fn(() => mobileMedia))
    const props = { lessonId: 'L01', title: 'Scoped job', poster: '/agentified/posters/l01-poster.webp', videoSrc: '/approved-l01.mp4', captionsSrc: '/approved-l01.vtt', endScreen: { startSeconds: 359.645, progress: 1 } }
    try {
      const { container, rerender, unmount } = render(<AgentifiedLessonHero {...props} captionSize="M" captionsOn />)
      const video = container.querySelector('video')!
      let currentTime = 343.058
      Object.defineProperty(video, 'currentTime', { configurable: true, get: () => currentTime })
      fireEvent.loadedMetadata(video)
      fireEvent.seeking(video)
      expect(track.mode).toBe('showing')
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()
      currentTime = 350
      fireEvent.seeking(video)
      fireEvent.pause(video)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L01 caption' })).toHaveTextContent(cue.text)
      for (const size of ['S', 'L', 'M'] as const) {
        rerender(<AgentifiedLessonHero {...props} captionSize={size} captionsOn />)
        expect(screen.getByRole('status', { name: 'L01 caption' })).toHaveAttribute('data-caption-size', size)
      }
      rerender(<AgentifiedLessonHero {...props} captionSize="M" captionsOn={false} />)
      expect(track.mode).toBe('disabled')
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()
      rerender(<AgentifiedLessonHero {...props} captionSize="M" captionsOn />)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L01 caption' })).toHaveTextContent(cue.text)
      currentTime = 356.5
      fireEvent.seeking(video)
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()
      currentTime = 359.644
      fireEvent.seeking(video)
      expect(screen.getByRole('status', { name: 'L01 caption' })).toHaveTextContent(lastCue.text)
      currentTime = 359.645
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()
      expect(screen.getByRole('status', { name: 'L01 complete. Agentified course complete.' })).toBeInTheDocument()
      currentTime = 350
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L01 caption' })).toHaveTextContent(cue.text)
      currentTime = 359.645
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()
      act(() => { mobileMedia.matches = true; mobileMedia.dispatchEvent(new Event('change')) })
      expect(track.mode).toBe('hidden')
      expect(screen.queryByRole('status', { name: 'L01 caption' })).toBeNull()
      expect([cue, lastCue]).toEqual([
        { startTime: 348.879, endTime: 355.004, text: cue.text },
        { startTime: 356.899, endTime: 359.645, text: lastCue.text },
      ])
      expect(video).not.toHaveAttribute('controls')
      expect(screen.getByRole('group', { name: 'L01 video controls' })).toBeInTheDocument()
      unmount()
    } finally {
      if (originalTracks) Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', originalTracks)
      else Reflect.deleteProperty(HTMLMediaElement.prototype, 'textTracks')
      if (originalTrack) Object.defineProperty(HTMLTrackElement.prototype, 'track', originalTrack)
      else Reflect.deleteProperty(HTMLTrackElement.prototype, 'track')
      HTMLMediaElement.prototype.pause = originalPause
      vi.unstubAllGlobals()
    }
  })

  it('shows the exact mobile cue outside the player and restores it while paused', () => {
    const originalPause = HTMLMediaElement.prototype.pause
    HTMLMediaElement.prototype.pause = vi.fn()
    const cue = { startTime: 242.252, endTime: 243.832, text: 'A team becomes useful when a blocked' }
    const track = Object.assign(new EventTarget(), { mode: 'disabled', cues: [cue] })
    const tracks = Object.assign(new EventTarget(), { 0: track, length: 1 })
    const originalTracks = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'textTracks')
    const originalTrack = Object.getOwnPropertyDescriptor(HTMLTrackElement.prototype, 'track')
    Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', { configurable: true, get: () => tracks })
    Object.defineProperty(HTMLTrackElement.prototype, 'track', { configurable: true, get: () => track })
    const mobileMedia = Object.assign(new EventTarget(), { matches: true })
    vi.stubGlobal('matchMedia', vi.fn((query: string) => query.includes('max-width') ? mobileMedia : Object.assign(new EventTarget(), { matches: false })))
    const props = { lessonId: 'L08', title: 'Team', poster: '/agentified/posters/l08-poster.webp', videoSrc: '/approved-l08.mp4', captionsSrc: '/approved-l08.vtt' }
    try {
      const { container, rerender, unmount } = render(<AgentifiedLessonHero {...props} captionsOn />)
      const video = container.querySelector('video')!
      let currentTime = 242.7
      Object.defineProperty(video, 'currentTime', { configurable: true, get: () => currentTime })
      fireEvent.loadedMetadata(video)
      fireEvent.timeUpdate(video)
      expect(track.mode).toBe('hidden')
      expect(video).not.toHaveAttribute('controls')
      expect(screen.getByRole('group', { name: 'L08 video controls' })).toBeInTheDocument()
      expect(screen.getByRole('status', { name: 'L08 caption' })).toHaveTextContent(cue.text)

      rerender(<AgentifiedLessonHero {...props} captionsOn={false} />)
      expect(track.mode).toBe('disabled')
      expect(screen.queryByRole('status', { name: 'L08 caption' })).toBeNull()
      expect(video).not.toHaveAttribute('controls')

      rerender(<AgentifiedLessonHero {...props} captionsOn />)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L08 caption' })).toHaveTextContent(cue.text)
      currentTime = 250
      fireEvent.timeUpdate(video)
      expect(screen.queryByRole('status', { name: 'L08 caption' })).toBeNull()
      expect(cue).toMatchObject({ startTime: 242.252, endTime: 243.832, text: 'A team becomes useful when a blocked' })
      unmount()
    } finally {
      if (originalTracks) Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', originalTracks)
      else Reflect.deleteProperty(HTMLMediaElement.prototype, 'textTracks')
      if (originalTrack) Object.defineProperty(HTMLTrackElement.prototype, 'track', originalTrack)
      else Reflect.deleteProperty(HTMLTrackElement.prototype, 'track')
      HTMLMediaElement.prototype.pause = originalPause
      vi.unstubAllGlobals()
    }
  })

  it('keeps every L08 desktop cue below the video without changing its source text or timing', () => {
    const originalPause = HTMLMediaElement.prototype.pause
    HTMLMediaElement.prototype.pause = vi.fn()
    const opening = { startTime: 11.16, endTime: 13.04, text: 'What does ‘maybe’ permit the drafter to' }
    const next = { startTime: 25.414, endTime: 35.056, text: 'Chapter Thirteen\'s Handoff Contract Card has six fields' }
    const rejected = { startTime: 65.848, endTime: 67.843, text: 'Try a broken payload on purpose.' }
    const afterRejection = { startTime: 91.608, endTime: 93.848, text: 'Now evaluate the designed workflow.' }
    const track = Object.assign(new EventTarget(), { mode: 'disabled', cues: [opening, next, rejected, afterRejection] })
    const tracks = Object.assign(new EventTarget(), { 0: track, length: 1 })
    const originalTracks = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'textTracks')
    const originalTrack = Object.getOwnPropertyDescriptor(HTMLTrackElement.prototype, 'track')
    Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', { configurable: true, get: () => tracks })
    Object.defineProperty(HTMLTrackElement.prototype, 'track', { configurable: true, get: () => track })
    vi.stubGlobal('matchMedia', vi.fn(() => Object.assign(new EventTarget(), { matches: false })))
    const props = { lessonId: 'L08', title: 'Team', poster: '/agentified/posters/l08-poster.webp', videoSrc: '/approved-l08.mp4', captionsSrc: '/approved-l08.vtt' }
    try {
      const { container, rerender, unmount } = render(<AgentifiedLessonHero {...props} captionSize="S" captionsOn />)
      const video = container.querySelector('video')!
      let currentTime = 12.717
      Object.defineProperty(video, 'currentTime', { configurable: true, get: () => currentTime })
      fireEvent.loadedMetadata(video)
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L08 caption' })).toHaveTextContent(opening.text)
      for (const size of ['M', 'L'] as const) {
        rerender(<AgentifiedLessonHero {...props} captionSize={size} captionsOn />)
        expect(track.mode).toBe('hidden')
        expect(screen.getByRole('status', { name: 'L08 caption' })).toHaveAttribute('data-caption-size', size)
      }
      rerender(<AgentifiedLessonHero {...props} captionSize="M" captionsOn={false} />)
      expect(track.mode).toBe('disabled')
      expect(screen.queryByRole('status', { name: 'L08 caption' })).toBeNull()
      rerender(<AgentifiedLessonHero {...props} captionSize="M" captionsOn />)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L08 caption' })).toHaveTextContent(opening.text)
      currentTime = 26.914
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L08 caption' })).toHaveTextContent(next.text)
      currentTime = 67.348
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L08 caption' })).toHaveTextContent(rejected.text)
      rerender(<AgentifiedLessonHero {...props} captionSize="M" captionsOn={false} />)
      expect(track.mode).toBe('disabled')
      expect(screen.queryByRole('status', { name: 'L08 caption' })).toBeNull()
      rerender(<AgentifiedLessonHero {...props} captionSize="M" captionsOn />)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L08 caption' })).toHaveTextContent(rejected.text)
      currentTime = 93.108
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L08 caption' })).toHaveTextContent(afterRejection.text)
      currentTime = 12.717
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: 'L08 caption' })).toHaveTextContent(opening.text)
      expect(opening).toMatchObject({ startTime: 11.16, endTime: 13.04, text: 'What does ‘maybe’ permit the drafter to' })
      expect(next).toMatchObject({ startTime: 25.414, endTime: 35.056 })
      expect(rejected).toMatchObject({ startTime: 65.848, endTime: 67.843, text: 'Try a broken payload on purpose.' })
      expect(afterRejection).toMatchObject({ startTime: 91.608, endTime: 93.848, text: 'Now evaluate the designed workflow.' })
      expect(video).toHaveAttribute('controls')
      unmount()
    } finally {
      if (originalTracks) Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', originalTracks)
      else Reflect.deleteProperty(HTMLMediaElement.prototype, 'textTracks')
      if (originalTrack) Object.defineProperty(HTMLTrackElement.prototype, 'track', originalTrack)
      else Reflect.deleteProperty(HTMLTrackElement.prototype, 'track')
      HTMLMediaElement.prototype.pause = originalPause
      vi.unstubAllGlobals()
    }
  })

  it.each(['L09', 'L10', 'L11', 'L12', 'L13', 'L14', 'L15', 'L16'])('keeps %s desktop cues below the teaching image', (lessonId) => {
    const originalPause = HTMLMediaElement.prototype.pause
    const originalTracks = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'textTracks')
    const originalTrack = Object.getOwnPropertyDescriptor(HTMLTrackElement.prototype, 'track')
    const cue = { startTime: 1, endTime: 3, text: `${lessonId} source cue` }
    const track = Object.assign(new EventTarget(), { mode: 'disabled', cues: [cue] })
    const tracks = Object.assign(new EventTarget(), { 0: track, length: 1 })
    HTMLMediaElement.prototype.pause = vi.fn()
    Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', { configurable: true, get: () => tracks })
    Object.defineProperty(HTMLTrackElement.prototype, 'track', { configurable: true, get: () => track })
    vi.stubGlobal('matchMedia', vi.fn(() => Object.assign(new EventTarget(), { matches: false })))
    try {
      const props = { lessonId, title: 'Team', poster: '/agentified/posters/l08-poster.webp', videoSrc: '/approved.mp4', captionsSrc: '/approved.vtt' }
      const { container, rerender, unmount } = render(<AgentifiedLessonHero {...props} captionSize="M" captionsOn />)
      const video = container.querySelector('video')!
      Object.defineProperty(video, 'currentTime', { configurable: true, get: () => 1.5 })
      fireEvent.loadedMetadata(video)
      fireEvent.seeking(video)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: `${lessonId} caption` })).toHaveTextContent(cue.text)
      rerender(<AgentifiedLessonHero {...props} captionSize="M" captionsOn={false} />)
      expect(track.mode).toBe('disabled')
      expect(screen.queryByRole('status', { name: `${lessonId} caption` })).toBeNull()
      rerender(<AgentifiedLessonHero {...props} captionSize="M" captionsOn />)
      expect(track.mode).toBe('hidden')
      expect(screen.getByRole('status', { name: `${lessonId} caption` })).toHaveTextContent(cue.text)
      unmount()
    } finally {
      if (originalTracks) Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', originalTracks)
      else Reflect.deleteProperty(HTMLMediaElement.prototype, 'textTracks')
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

  it('keeps mobile playback controls outside the video and restores native desktop controls', async () => {
    const media = Object.assign(new EventTarget(), { matches: true })
    vi.stubGlobal('matchMedia', vi.fn(() => media))
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    try {
      const { container, unmount } = render(<AgentifiedLessonHero lessonId="L06" title="Map" poster="/l06.webp" videoSrc="/l06.mp4" durationSeconds={120} />)
      const video = container.querySelector('video')!
      let currentTime = 0
      Object.defineProperty(video, 'currentTime', { configurable: true, get: () => currentTime, set: (value) => { currentTime = value } })
      expect(video).not.toHaveAttribute('controls')
      expect(screen.getByRole('group', { name: 'L06 video controls' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Play video' }))
      expect(play).toHaveBeenCalled()
      fireEvent.playing(video)
      expect(screen.getByRole('button', { name: 'Pause video' })).toBeInTheDocument()
      fireEvent.change(screen.getByRole('slider', { name: 'Seek video' }), { target: { value: '42' } })
      expect(currentTime).toBe(42)
      expect(screen.getByRole('slider', { name: 'Seek video' })).toHaveAttribute('aria-valuetext', '0:42 of 2:00')
      const waves = screen.getByRole('slider', { name: 'Video volume level' })
      expect(waves).toHaveAttribute('aria-valuetext', 'Full volume')
      fireEvent.keyDown(waves, { key: 'Home' })
      expect(video.volume).toBe(0.25)
      expect(waves).toHaveAttribute('aria-valuetext', 'Low volume')
      fireEvent.keyDown(waves, { key: 'ArrowRight' })
      expect(video.volume).toBe(0.6)
      expect(waves).toHaveAttribute('aria-valuetext', 'Medium volume')
      fireEvent.click(screen.getByRole('button', { name: 'Mute video' }))
      expect(video.muted).toBe(true)
      expect(screen.getByRole('button', { name: 'Unmute video' })).toHaveAttribute('aria-pressed', 'true')
      expect(waves).toHaveAttribute('aria-valuetext', 'Medium volume, muted')
      fireEvent.click(screen.getByRole('button', { name: 'Unmute video' }))
      expect(video.volume).toBe(0.6)
      expect(video.muted).toBe(false)
      fireEvent.keyDown(waves, { key: 'End' })
      expect(video.volume).toBe(1)
      expect(waves).toHaveAttribute('aria-valuenow', '3')
      expect(screen.queryByRole('slider', { name: 'Video volume' })).toBeNull()
      expect(screen.queryByText('Mute')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Pause video' }))
      expect(pause).toHaveBeenCalled()
      act(() => { media.matches = false; media.dispatchEvent(new Event('change')) })
      expect(video).toHaveAttribute('controls')
      expect(screen.queryByRole('group', { name: 'L06 video controls' })).toBeNull()
      unmount()
    } finally {
      play.mockRestore()
      pause.mockRestore()
      vi.unstubAllGlobals()
    }
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
