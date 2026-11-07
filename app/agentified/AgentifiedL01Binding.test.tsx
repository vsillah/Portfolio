import { createHash } from 'node:crypto'
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { agentifiedL01Media } from '@/lib/agentified-l01-media'
import { assertAgentifiedL01PublicMedia } from '@/lib/agentified-l01-media.server'
import { AGENTIFIED_GUEST_KEY, AGENTIFIED_VERSION, emptyAgentifiedDraft } from '@/lib/agentified-workshop'
import { AgentifiedWorkshop } from './AgentifiedWorkshop'

vi.mock('next/image', () => ({ default: ({ alt, src, priority: _priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string; priority?: boolean }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img alt={alt} src={src} {...props} />
) }))
vi.mock('next/link', () => ({ default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode; href: string }) => <a href={href} {...props}>{children}</a> }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: {
  getSession: vi.fn(async () => ({ data: { session: null } })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
} } }))

const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')

describe('approved Agentified L01 learner binding', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState(null, '', '/agentified/learningplan?lesson=L01')
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  })

  it('binds only the immutable composite, native source, captions, and 540-second receipt', () => {
    expect(() => assertAgentifiedL01PublicMedia()).not.toThrow()
    const source = 'agentified/workshop/l01-native-composite/'
    expect(digest(`${source}agentified-l01-native-composite.mp4`)).toBe(agentifiedL01Media.compositeSha256)
    expect(digest(`public${agentifiedL01Media.video}`)).toBe(agentifiedL01Media.compositeSha256)
    expect(digest(`${source}agentified-l01-native-captions.srt`)).toBe(agentifiedL01Media.captionsSrtSha256)
    expect(digest(`${source}agentified-l01-native-captions.vtt`)).toBe(agentifiedL01Media.captionsVttSha256)
    expect(digest(`public${agentifiedL01Media.captions}`)).toBe(agentifiedL01Media.captionsVttSha256)
    expect(digest('agentified/workshop/l01-native-source/agentified-l01-heygen-native-source.mp4')).toBe(agentifiedL01Media.nativeSourceSha256)
    const receipt = JSON.parse(readFileSync(`${source}validation-receipt.json`, 'utf8'))
    const timeline = JSON.parse(readFileSync(`${source}composite-timeline.json`, 'utf8'))
    expect(receipt.composite.duration_seconds).toBe(agentifiedL01Media.durationSeconds)
    expect(receipt.source.playback_speed).toBe(1)
    expect(receipt.checks.sentence_complete_handoff).toBe('pass')
    expect(timeline.approved_closing_card).toEqual({ start: 523, end: 540 })
    expect(timeline.placements[1].sequence_end).toBeLessThan(523)
    const cues = readFileSync(`public${agentifiedL01Media.captions}`, 'utf8').trim().split(/\n\n/).slice(1)
    expect(cues).toHaveLength(agentifiedL01Media.transcript.length)
    cues.forEach((cue, index) => expect(cue.split('\n').slice(1).join(' ')).toBe(agentifiedL01Media.transcript[index].text))
  })

  it('fails closed when a staged asset drifts or is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'agentified-l01-binding-'))
    const files = [
      'agentified/workshop/l01-native-composite/agentified-l01-native-composite.mp4',
      'agentified/workshop/l01-native-composite/agentified-l01-native-captions.srt',
      'agentified/workshop/l01-native-composite/agentified-l01-native-captions.vtt',
      'agentified/workshop/l01-native-source/agentified-l01-heygen-native-source.mp4',
      `public${agentifiedL01Media.video}`,
      `public${agentifiedL01Media.captions}`,
    ]
    try {
      for (const file of files) { mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); copyFileSync(file, path.join(root, file)) }
      expect(() => assertAgentifiedL01PublicMedia(root)).not.toThrow()
      writeFileSync(path.join(root, `public${agentifiedL01Media.captions}`), 'WEBVTT\n\nchanged')
      expect(() => assertAgentifiedL01PublicMedia(root)).toThrow('Agentified L01 media drift')
      rmSync(path.join(root, files[0]))
      expect(() => assertAgentifiedL01PublicMedia(root)).toThrow()
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  it('shows the player immediately, then keeps L02–L16 video and completion locked', async () => {
    const { container } = render(<AgentifiedWorkshop mode="plan" />)
    const video = await screen.findByLabelText('L01 Give the agent a job and a receipt guided video')
    expect(video).toHaveAttribute('controls')
    expect(video).toHaveAttribute('poster', '/agentified/posters/l01-poster.webp')
    expect(container.querySelector('video source')).toHaveAttribute('src', agentifiedL01Media.video)
    expect(container.querySelector('video track')).toHaveAttribute('src', agentifiedL01Media.captions)
    expect(container.querySelector('video track')).toHaveAttribute('srclang', 'en')
    fireEvent.click(screen.getByText('Read along with L01 transcript'))
    expect(screen.getByText(agentifiedL01Media.transcript[0].text)).toBeInTheDocument()
    expect(screen.getByText(agentifiedL01Media.transcript.at(-1)!.text)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Start with the decision/ }))
    expect(container.querySelector('video')).toBeNull()
    expect(screen.getAllByText('Video locked').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Mark lesson complete' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Open this page in the full file' })).toHaveAttribute('href', '/agentified/operating-file#L02')
    expect(container.querySelectorAll('em[data-status="Video locked"]')).toHaveLength(15)
  })

  it('restores video and Operating File progress without claiming a guest account', async () => {
    const saved = { version: AGENTIFIED_VERSION, worksheet: { ...emptyAgentifiedDraft('00000000-0000-4000-8000-000000000001'), answers: { L01: 'Owner: Morgan' } }, completed: ['L01'], videoSeconds: { L01: 125 }, currentLessonId: 'L01', updatedAt: new Date().toISOString() }
    localStorage.setItem(AGENTIFIED_GUEST_KEY, JSON.stringify(saved))
    const { container } = render(<AgentifiedWorkshop mode="plan" />)
    const video = await screen.findByLabelText('L01 Give the agent a job and a receipt guided video') as HTMLVideoElement
    fireEvent.loadedMetadata(video)
    expect(video.currentTime).toBe(125)
    expect(screen.getByText('1 / 16 lessons complete')).toBeInTheDocument()
    expect(container.querySelector('#answer-L01')).toHaveValue('Owner: Morgan')
    video.currentTime = 130
    fireEvent.timeUpdate(video)
    await waitFor(() => expect(JSON.parse(localStorage.getItem(AGENTIFIED_GUEST_KEY)!).videoSeconds.L01).toBe(130))
    expect(screen.getByText(/Guest work stays on this device/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Operating File' })).toHaveAttribute('href', '/agentified/operating-file')
  })
})
