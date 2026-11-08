import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AGENTIFIED_GUEST_KEY } from '@/lib/agentified-workshop'
import { supabase } from '@/lib/supabase'
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

describe('Agentified Learning Plan cover and Operating File continuity', () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null })
    localStorage.clear()
    window.history.replaceState(null, '', '/agentified/learningplan')
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
  })

  it('restores claimed member playback without claiming guest progress', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { access_token: 'synthetic-token', user: { id: 'synthetic-member', email: 'member@example.invalid', user_metadata: {} } } }, error: null } as Awaited<ReturnType<typeof supabase.auth.getSession>>)
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => ({ ok: true, json: async () => init?.method === 'POST' ? { revision: 5 } : { enrollment: { revision: 4, current_lesson_id: 'L01', updated_at: new Date().toISOString() }, worksheet: null, lessons: [{ lesson_id: 'L01', video_seconds: 73, completed_at: null }] } })))
    const { container } = render(<AgentifiedWorkshop mode="plan" />)
    const video = await screen.findByLabelText('L01 Give the agent a job and a receipt guided video')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Claim guest progress for this account' })).toBeNull())
    Object.defineProperty(video, 'duration', { configurable: true, value: 540 })
    fireEvent.loadedMetadata(video)
    expect((video as HTMLVideoElement).currentTime).toBe(73)
    Object.defineProperty(video, 'currentTime', { configurable: true, value: 95 })
    fireEvent.timeUpdate(video)
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'POST' && JSON.parse(String(init.body)).state.videoSeconds.L01 === 95)).toBe(true), { timeout: 3000 })
    expect(container.querySelector('video')).toBe(video)
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/agentified/member', expect.objectContaining({ cache: 'no-store' }))
    vi.unstubAllGlobals()
  })


  it.each([
    ['L02', 'e2b5ecbc', 510, '08:30'],
    ['L03', '8749ae9a', 600, '10:00'],
    ['L04', '8d0245ff', 600, '10:00'],
  ])('opens %s directly with captions, transcript, worksheet and guest resume', async (id, hash, duration, display) => {
    window.history.replaceState(null, '', `/agentified/learningplan?lesson=${id}`)
    const { container, unmount } = render(<AgentifiedWorkshop mode="plan" />)
    const video = await screen.findByLabelText(new RegExp(`^${id} .* guided video$`))
    expect(video.querySelector('source')).toHaveAttribute('src', expect.stringContaining(`corrected-${hash}/agentified-${id.toLowerCase()}-native-composite.mp4`))
    expect(video.querySelector('track')).toHaveAttribute('src', expect.stringContaining(`corrected-${hash}/agentified-${id.toLowerCase()}-native-captions.vtt`))
    expect(video.querySelector('track')).toHaveAttribute('default')
    expect(screen.getByText(`Ready · ${display}`)).toBeInTheDocument()
    fireEvent.click(screen.getByText(`Read along with ${id} transcript`))
    expect(screen.getByText('Spoken audio')).toBeInTheDocument()
    const answer = container.querySelector(`#answer-${id}`)!
    fireEvent.change(answer, { target: { value: `${id} decision evidence` } })
    Object.defineProperty(video, 'currentTime', { configurable: true, value: 75 })
    fireEvent.timeUpdate(video)
    await waitFor(() => expect(JSON.parse(localStorage.getItem(AGENTIFIED_GUEST_KEY)!).videoSeconds[id]).toBe(75))
    await waitFor(() => expect(JSON.parse(localStorage.getItem(AGENTIFIED_GUEST_KEY)!).worksheet.answers[id]).toBe(`${id} decision evidence`))
    expect(screen.getByRole('link', { name: /Open this page in the full file/ })).toHaveAttribute('href', `/agentified/operating-file#${id}`)
    unmount()
    const resumed = render(<AgentifiedWorkshop mode="plan" />)
    const resumedVideo = await screen.findByLabelText(new RegExp(`^${id} .* guided video$`))
    Object.defineProperty(resumedVideo, 'duration', { configurable: true, value: duration })
    fireEvent.loadedMetadata(resumedVideo)
    expect((resumedVideo as HTMLVideoElement).currentTime).toBe(75)
    expect(resumed.container.querySelector(`#answer-${id}`)).toHaveValue(`${id} decision evidence`)
    resumed.unmount()
  })

  it('shows approved L01 video directly, keeps L05-L16 locked, and retains guest work', async () => {
    const { container } = render(<AgentifiedWorkshop mode="plan" />)
    const video = await screen.findByLabelText('L01 Give the agent a job and a receipt guided video')
    expect(video).toHaveAttribute('poster', '/agentified/posters/l01-poster.webp')
    expect(video.querySelector('source')).toHaveAttribute('src', '/agentified/lessons/l01/corrected-bec9f291/agentified-l01-gray-sweater-composite.mp4')
    expect(video.querySelector('track')).toHaveAttribute('src', '/agentified/lessons/l01/corrected-bec9f291/agentified-l01-gray-sweater-captions.vtt')
    expect(video.querySelector('track')).toHaveAttribute('default')
    expect(screen.getByText('Ready · 09:00')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Read along with L01 transcript'))
    expect(screen.getByText('Friday afternoon.')).toBeInTheDocument()
    expect(screen.queryByText('9–12 min')).not.toBeInTheDocument()
    expect(screen.getByText('Explore lesson diagram')).toBeInTheDocument()
    Object.defineProperty(video, 'currentTime', { configurable: true, value: 65 })
    fireEvent.timeUpdate(video)
    await waitFor(() => expect(JSON.parse(localStorage.getItem(AGENTIFIED_GUEST_KEY)!).videoSeconds.L01).toBe(65))
    fireEvent.change(container.querySelector('#answer-L01')!, { target: { value: 'A bounded job with a receipt.' } })
    fireEvent.click(screen.getByRole('button', { name: /Write the permission slip/ }))
    expect(screen.getByRole('img', { name: /L06 Write the permission slip lesson cover/ })).toHaveAttribute('src', '/agentified/posters/l06-poster.webp')
    expect(screen.getByText('Video locked')).toBeInTheDocument()
    expect(container.querySelector('video')).toBeNull()
    expect(screen.getByRole('link', { name: /Open this page in the full file/ })).toHaveAttribute('href', '/agentified/operating-file#L06')
    fireEvent.click(screen.getByRole('button', { name: /Give the agent a job and a receipt/ }))
    expect(container.querySelector('#answer-L01')).toHaveValue('A bounded job with a receipt.')
    expect(JSON.parse(localStorage.getItem(AGENTIFIED_GUEST_KEY)!).videoSeconds.L01).toBe(65)
    await waitFor(() => expect(JSON.parse(localStorage.getItem(AGENTIFIED_GUEST_KEY)!).worksheet.answers.L01).toBe('A bounded job with a receipt.'))
  })
})
