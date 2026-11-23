import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CourseCertificateShare from './CourseCertificateShare'
import { certificateShare, certificateSharePayload } from '@/lib/course-certificate-share'
import { flagshipWorkshops } from '@/components/FlagshipWorkshops'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const cases = ['accelerated', 'agentified'] as const

describe.each(cases)('%s certificate sharing', (course) => {
  const config = certificateShare[course]
  const payload = certificateSharePayload(config)

  it('uses a public course URL and excludes credential data', () => {
    expect(config.publicUrl).toMatch(/^https:\/\/amadutown\.com\//)
    expect(payload.message).toBe(`${config.achievementText} ${config.publicUrl}`)
    for (const value of [payload.message, ...Object.values(payload.links)]) {
      expect(value).not.toMatch(/Course Learner|AT-ACC|AT-AGT|verify\/|f{64}|Decision File answers|Operating File answers/i)
    }
    expect(new URL(payload.links.linkedin).searchParams.get('url')).toBe(config.publicUrl)
    expect(new URL(payload.links.facebook).searchParams.get('u')).toBe(config.publicUrl)
    expect(new URL(payload.links.x).searchParams.get('url')).toBe(config.publicUrl)
  })

  it('keeps default copy absent and opens each platform through one native link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<CourseCertificateShare course={course} />)
    expect(screen.queryByRole('button', { name: /copy message|retry copying/i })).not.toBeInTheDocument()
    for (const [platform, href] of [['LinkedIn', payload.links.linkedin], ['Facebook', payload.links.facebook], ['X', payload.links.x]] as const) {
      const link = screen.getByRole('link', { name: `Share on ${platform}` })
      expect(link).toHaveAttribute('href', href)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      fireEvent.click(link)
    }
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2))
    expect(writeText).toHaveBeenNthCalledWith(1, payload.message)
    expect(writeText).toHaveBeenNthCalledWith(2, payload.message)
    expect(screen.getByRole('status')).toHaveTextContent('X opens with a shorter message')
  })

  it('reveals one copy retry after failure and hides it after success', async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<CourseCertificateShare course={course} />)
    fireEvent.click(screen.getByRole('link', { name: 'Share on LinkedIn' }))
    const retry = await screen.findByRole('button', { name: 'Retry copying message' })
    expect(screen.getByRole('status')).toHaveTextContent('Message could not be copied')
    fireEvent.click(retry)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry copying message' })).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('Message copied')
    expect(writeText).toHaveBeenCalledTimes(2)
  })
})

it('requires certificate share registration for every flagship workshop', () => {
  expect(flagshipWorkshops.map((workshop) => workshop.slug).sort()).toEqual(Object.keys(certificateShare).sort())
  for (const workshop of flagshipWorkshops) expect(workshop.certificateShareId).toBe(workshop.slug)
})

it('describes Accelerated lessons without claiming the learner finished a Decision File', () => {
  expect(certificateShare.accelerated.achievementText).toContain('The lessons cover')
  expect(certificateShare.accelerated.achievementText).not.toMatch(/I (built|finished|submitted|used) a Decision File/)
})
