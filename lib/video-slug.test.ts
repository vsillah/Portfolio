import { afterEach, describe, expect, it, vi } from 'vitest'
import { videoSlugFromFileName } from './video-slug'

describe('videoSlugFromFileName', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('strips extension and normalizes spaces/case', () => {
    expect(videoSlugFromFileName('Episode 1 script.txt')).toBe('episode-1-script')
  })

  it('sanitizes symbols and collapses repeated separators', () => {
    expect(videoSlugFromFileName('Quarterly Report (Q1)!!.pdf')).toBe(
      'quarterly-report-q1'
    )
  })

  it('returns deterministic fallback slug for invalid input', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)

    expect(videoSlugFromFileName('***.txt')).toBe('video-1700000000000')
    expect(videoSlugFromFileName('' as unknown as string)).toBe(
      'video-1700000000000'
    )
  })
})
