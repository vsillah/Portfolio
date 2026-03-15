import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isOverVideoGenerationLimit } from './video-generation-rate-limit'

const { mockGte, mockEq, mockSelect, mockFrom } = vi.hoisted(() => ({
  mockGte: vi.fn(),
  mockEq: vi.fn(),
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}))

const ORIGINAL_MAX_JOBS_ENV = process.env.VIDEO_GENERATION_MAX_JOBS_PER_DAY

describe('isOverVideoGenerationLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.VIDEO_GENERATION_MAX_JOBS_PER_DAY

    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ gte: mockGte })
  })

  afterEach(() => {
    if (ORIGINAL_MAX_JOBS_ENV === undefined) {
      delete process.env.VIDEO_GENERATION_MAX_JOBS_PER_DAY
      return
    }
    process.env.VIDEO_GENERATION_MAX_JOBS_PER_DAY = ORIGINAL_MAX_JOBS_ENV
  })

  it('skips querying when configured max jobs is 0', async () => {
    process.env.VIDEO_GENERATION_MAX_JOBS_PER_DAY = '0'

    const result = await isOverVideoGenerationLimit('user-1')

    expect(result).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('uses the default max of 20 when env var is missing', async () => {
    mockGte.mockResolvedValue({ count: 20, error: null })

    const result = await isOverVideoGenerationLimit('user-2')

    expect(result).toBe(true)
    expect(mockFrom).toHaveBeenCalledWith('video_generation_jobs')
    expect(mockSelect).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(mockEq).toHaveBeenCalledWith('created_by', 'user-2')
    expect(mockGte).toHaveBeenCalledTimes(1)

    const [column, startOfDayIso] = mockGte.mock.calls[0]
    expect(column).toBe('created_at')

    const startOfDay = new Date(startOfDayIso)
    expect(startOfDay.getUTCHours()).toBe(0)
    expect(startOfDay.getUTCMinutes()).toBe(0)
    expect(startOfDay.getUTCSeconds()).toBe(0)
    expect(startOfDay.getUTCMilliseconds()).toBe(0)
  })

  it('falls back to default max when env var is invalid', async () => {
    process.env.VIDEO_GENERATION_MAX_JOBS_PER_DAY = 'not-a-number'
    mockGte.mockResolvedValue({ count: 20, error: null })

    const result = await isOverVideoGenerationLimit('user-3')

    expect(result).toBe(true)
  })

  it('respects a custom max jobs value from env', async () => {
    process.env.VIDEO_GENERATION_MAX_JOBS_PER_DAY = '3'
    mockGte.mockResolvedValue({ count: 2, error: null })

    const result = await isOverVideoGenerationLimit('user-4')

    expect(result).toBe(false)
  })

  it('fails open when the count query errors', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockGte.mockResolvedValue({ count: null, error: { message: 'db unavailable' } })

    const result = await isOverVideoGenerationLimit('user-5')

    expect(result).toBe(false)
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
