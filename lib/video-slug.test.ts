import { describe, expect, it, vi, afterEach } from 'vitest'
import { videoSlugFromFileName } from './video-slug'

describe('videoSlugFromFileName', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('removes extension and slugifies common file names', () => {
    expect(videoSlugFromFileName('Episode 1 script.txt')).toBe('episode-1-script')
    expect(videoSlugFromFileName('ATAS-EP3-draft.md')).toBe('atas-ep3-draft')
  })

  it('normalizes punctuation and trims leading/trailing separators', () => {
    expect(videoSlugFromFileName('  $$$ Big Deal!!!  .docx')).toBe('big-deal')
  })

  it('keeps underscores and collapses repeated separators', () => {
    expect(videoSlugFromFileName('Client__Update---FINAL!!.txt')).toBe('client__update-final')
  })

  it('uses timestamp fallback when input is empty or normalizes to blank', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
    expect(videoSlugFromFileName('')).toBe('video-1700000000000')
    expect(videoSlugFromFileName('!!!')).toBe('video-1700000000000')
  })
})
