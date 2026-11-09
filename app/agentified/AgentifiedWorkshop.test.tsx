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

  it.each([['L01', 540], ['L05', 237.687], ['L09', 272.84]] as const)('restores claimed member playback for %s without claiming guest progress', async (id, duration) => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { access_token: 'synthetic-token', user: { id: 'synthetic-member', email: 'member@example.invalid', user_metadata: {} } } }, error: null } as Awaited<ReturnType<typeof supabase.auth.getSession>>)
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => ({ ok: true, json: async () => init?.method === 'POST' ? { revision: 5 } : { enrollment: { revision: 4, current_lesson_id: id, updated_at: new Date().toISOString() }, worksheet: null, lessons: [{ lesson_id: id, video_seconds: 73, completed_at: null }] } })))
    const { container } = render(<AgentifiedWorkshop mode="plan" />)
    const video = await screen.findByLabelText(new RegExp(`^${id} .* guided video$`))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Claim guest progress for this account' })).toBeNull())
    Object.defineProperty(video, 'duration', { configurable: true, value: duration })
    fireEvent.loadedMetadata(video)
    expect((video as HTMLVideoElement).currentTime).toBe(73)
    Object.defineProperty(video, 'currentTime', { configurable: true, value: 95 })
    fireEvent.timeUpdate(video)
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'POST' && JSON.parse(String(init.body)).state.videoSeconds[id] === 95)).toBe(true), { timeout: 3000 })
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

  it.each([
    ['L05', '1cd79d31', 237.687, '03:57'],
    ['L06', '991cb8b6', 258.96, '04:18'],
    ['L07', '869a0ff4', 251.332, '04:11'],
    ['L08', '3c5b399f', 257.68, '04:17'],
  ])('opens %s continuous narration with captions, complete transcript, worksheet and resume', async (id, hash, duration, display) => {
    window.history.replaceState(null, '', `/agentified/learningplan?lesson=${id}`)
    const { container, unmount } = render(<AgentifiedWorkshop mode="plan" />)
    const video = await screen.findByLabelText(new RegExp(`^${id} .* guided video$`))
    expect(video.querySelector('source')).toHaveAttribute('src', `/agentified/lessons/${id.toLowerCase()}/continuous-${hash}/agentified-${id.toLowerCase()}-continuous-narration-composite.mp4`)
    expect(video.querySelector('track')).toHaveAttribute('src', `/agentified/lessons/${id.toLowerCase()}/continuous-${hash}/agentified-${id.toLowerCase()}-continuous-narration-captions.vtt`)
    expect(video.querySelector('track')).toHaveAttribute('default')
    expect(screen.getByText(`Ready · ${display}`)).toBeInTheDocument()
    fireEvent.click(screen.getByText(`Read along with ${id} transcript`))
    expect(screen.getByText('Spoken audio')).toBeInTheDocument()
    expect(container.querySelectorAll('details p').length).toBeGreaterThan(40)
    fireEvent.change(container.querySelector(`#answer-${id}`)!, { target: { value: `${id} map and boundary` } })
    Object.defineProperty(video, 'currentTime', { configurable: true, value: 75 })
    fireEvent.timeUpdate(video)
    await waitFor(() => expect(JSON.parse(localStorage.getItem(AGENTIFIED_GUEST_KEY)!).videoSeconds[id]).toBe(75))
    await waitFor(() => expect(JSON.parse(localStorage.getItem(AGENTIFIED_GUEST_KEY)!).worksheet.answers[id]).toBe(`${id} map and boundary`))
    expect(screen.getByRole('link', { name: /Open this page in the full file/ })).toHaveAttribute('href', `/agentified/operating-file#${id}`)
    unmount()
    const resumed = render(<AgentifiedWorkshop mode="plan" />)
    const resumedVideo = await screen.findByLabelText(new RegExp(`^${id} .* guided video$`))
    Object.defineProperty(resumedVideo, 'duration', { configurable: true, value: duration })
    fireEvent.loadedMetadata(resumedVideo)
    expect((resumedVideo as HTMLVideoElement).currentTime).toBe(75)
    expect(resumed.container.querySelector(`#answer-${id}`)).toHaveValue(`${id} map and boundary`)
    resumed.unmount()
  })

  it.each([
    ['L09', '277c85aa', 272.84, '04:32'],
    ['L10', 'a2dfdec5', 274.28, '04:34'],
    ['L11', '46973271', 252.92, '04:12'],
    ['L12', '0d58c706', 268.12, '04:28'],
  ])('opens %s approved native composite with captions, transcript, worksheet and resume', async (id, hash, duration, display) => {
    window.history.replaceState(null, '', `/agentified/learningplan?lesson=${id}`)
    const { container, unmount } = render(<AgentifiedWorkshop mode="plan" />)
    const video = await screen.findByLabelText(new RegExp(`^${id} .* guided video$`))
    expect(video.querySelector('source')).toHaveAttribute('src', `/agentified/lessons/${id.toLowerCase()}/approved-${hash}/agentified-${id.toLowerCase()}-native-composite.mp4`)
    expect(video.querySelector('track')).toHaveAttribute('src', `/agentified/lessons/${id.toLowerCase()}/approved-${hash}/agentified-${id.toLowerCase()}-native-captions.vtt`)
    expect(video.querySelector('track')).toHaveAttribute('default')
    expect(screen.getByText(`Ready · ${display}`)).toBeInTheDocument()
    fireEvent.click(screen.getByText(`Read along with ${id} transcript`))
    expect(screen.getByText('Spoken audio')).toBeInTheDocument()
    expect(container.querySelectorAll('details p').length).toBeGreaterThan(35)
    fireEvent.change(container.querySelector(`#answer-${id}`)!, { target: { value: `${id} decision and evidence` } })
    Object.defineProperty(video, 'currentTime', { configurable: true, value: 75 })
    fireEvent.timeUpdate(video)
    await waitFor(() => expect(JSON.parse(localStorage.getItem(AGENTIFIED_GUEST_KEY)!).videoSeconds[id]).toBe(75))
    await waitFor(() => expect(JSON.parse(localStorage.getItem(AGENTIFIED_GUEST_KEY)!).worksheet.answers[id]).toBe(`${id} decision and evidence`))
    expect(screen.getByRole('link', { name: /Open this page in the full file/ })).toHaveAttribute('href', `/agentified/operating-file#${id}`)
    unmount()
    const resumed = render(<AgentifiedWorkshop mode="plan" />)
    const resumedVideo = await screen.findByLabelText(new RegExp(`^${id} .* guided video$`))
    Object.defineProperty(resumedVideo, 'duration', { configurable: true, value: duration })
    fireEvent.loadedMetadata(resumedVideo)
    expect((resumedVideo as HTMLVideoElement).currentTime).toBe(75)
    expect(resumed.container.querySelector(`#answer-${id}`)).toHaveValue(`${id} decision and evidence`)
    resumed.unmount()
  })

  it('shows approved L01 video directly, keeps L13-L16 locked, and retains guest work', async () => {
    const { container } = render(<AgentifiedWorkshop mode="plan" />)
    const video = await screen.findByLabelText('L01 Give the agent a job and a receipt guided video')
    expect(video).toHaveAttribute('poster', '/agentified/posters/l01-poster.webp')
    expect(video.querySelector('source')).toHaveAttribute('src', '/agentified/lessons/l01/corrected-ae0c4d08/agentified-l01-continuous-narration-composite.mp4')
    expect(video.querySelector('track')).toHaveAttribute('src', '/agentified/lessons/l01/corrected-ae0c4d08/agentified-l01-continuous-narration-captions.vtt')
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
    fireEvent.click(screen.getByRole('button', { name: /Research with a gate/ }))
    expect(screen.getByRole('img', { name: /L13 .* lesson cover/ })).toHaveAttribute('src', '/agentified/posters/l13-poster.webp')
    expect(screen.getByText('Video locked')).toBeInTheDocument()
    expect(container.querySelector('video')).toBeNull()
    expect(screen.getByRole('link', { name: /Open this page in the full file/ })).toHaveAttribute('href', '/agentified/operating-file#L13')
    fireEvent.click(screen.getByRole('button', { name: /Give the agent a job and a receipt/ }))
    expect(container.querySelector('#answer-L01')).toHaveValue('A bounded job with a receipt.')
    expect(JSON.parse(localStorage.getItem(AGENTIFIED_GUEST_KEY)!).videoSeconds.L01).toBe(65)
    await waitFor(() => expect(JSON.parse(localStorage.getItem(AGENTIFIED_GUEST_KEY)!).worksheet.answers.L01).toBe('A bounded job with a receipt.'))
  })
})
