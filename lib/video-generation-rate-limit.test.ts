import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const supabaseState = vi.hoisted(() => ({
  from: vi.fn(),
  admin: null as { from: ReturnType<typeof vi.fn> } | null,
}))

vi.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return supabaseState.admin
  },
}))

import { isOverVideoGenerationLimit } from './video-generation-rate-limit'

const ORIGINAL_MAX_JOBS = process.env.VIDEO_GENERATION_MAX_JOBS_PER_DAY

function mockRateLimitQuery(response: { count: number | null; error: { message: string } | null }) {
  const select = vi.fn()
  const eq = vi.fn()
  const gte = vi.fn().mockResolvedValue(response)

  supabaseState.from.mockReturnValue({ select })
  select.mockReturnValue({ eq })
  eq.mockReturnValue({ gte })

  return { select, eq, gte }
}

describe('isOverVideoGenerationLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-16T15:45:10.000Z'))
    delete process.env.VIDEO_GENERATION_MAX_JOBS_PER_DAY
    supabaseState.from.mockReset()
    supabaseState.admin = { from: supabaseState.from }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    if (ORIGINAL_MAX_JOBS === undefined) {
      delete process.env.VIDEO_GENERATION_MAX_JOBS_PER_DAY
    } else {
      process.env.VIDEO_GENERATION_MAX_JOBS_PER_DAY = ORIGINAL_MAX_JOBS
    }
  })

  it('returns false when the user is below the configured daily max', async () => {
    process.env.VIDEO_GENERATION_MAX_JOBS_PER_DAY = '3'
    const { select, eq, gte } = mockRateLimitQuery({ count: 2, error: null })

    await expect(isOverVideoGenerationLimit('user-123')).resolves.toBe(false)

    expect(supabaseState.from).toHaveBeenCalledWith('video_generation_jobs')
    expect(select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(eq).toHaveBeenCalledWith('created_by', 'user-123')
    expect(gte).toHaveBeenCalledWith('created_at', '2026-03-16T00:00:00.000Z')
  })

  it('returns true when the user has reached the configured daily max', async () => {
    process.env.VIDEO_GENERATION_MAX_JOBS_PER_DAY = '3'
    mockRateLimitQuery({ count: 3, error: null })

    await expect(isOverVideoGenerationLimit('user-123')).resolves.toBe(true)
  })

  it('falls back to default max when env max is invalid', async () => {
    process.env.VIDEO_GENERATION_MAX_JOBS_PER_DAY = 'not-a-number'
    mockRateLimitQuery({ count: 20, error: null })

    await expect(isOverVideoGenerationLimit('user-123')).resolves.toBe(true)
  })

  it('uses default max of 20 when env var is missing', async () => {
    mockRateLimitQuery({ count: 19, error: null })
    await expect(isOverVideoGenerationLimit('user-456')).resolves.toBe(false)

    mockRateLimitQuery({ count: 20, error: null })
    await expect(isOverVideoGenerationLimit('user-789')).resolves.toBe(true)
  })

  it('skips querying when max jobs per day is zero', async () => {
    process.env.VIDEO_GENERATION_MAX_JOBS_PER_DAY = '0'

    await expect(isOverVideoGenerationLimit('user-123')).resolves.toBe(false)
    expect(supabaseState.from).not.toHaveBeenCalled()
  })

  it('returns false when supabase admin client is unavailable', async () => {
    supabaseState.admin = null

    await expect(isOverVideoGenerationLimit('user-123')).resolves.toBe(false)
    expect(supabaseState.from).not.toHaveBeenCalled()
  })

  it('returns false and warns when the count query fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockRateLimitQuery({ count: null, error: { message: 'db unavailable' } })

    await expect(isOverVideoGenerationLimit('user-123')).resolves.toBe(false)
    expect(warnSpy).toHaveBeenCalledWith(
      '[Video generation] Rate limit check failed:',
      'db unavailable'
    )
  })
})
