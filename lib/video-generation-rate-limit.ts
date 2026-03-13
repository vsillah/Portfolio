/**
 * Rate/cost guardrail for video generation — limit jobs per user per day.
 * Used by generate, companion-from-report, and report+video entry points.
 */

import { supabaseAdmin } from '@/lib/supabase'

const DEFAULT_MAX_JOBS_PER_DAY = 20

function getMaxJobsPerDay(): number {
  const env = process.env.VIDEO_GENERATION_MAX_JOBS_PER_DAY
  if (env == null || env === '') return DEFAULT_MAX_JOBS_PER_DAY
  const n = parseInt(env, 10)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MAX_JOBS_PER_DAY
}

/**
 * Returns true if the user is over the daily job limit (should not start another job).
 */
export async function isOverVideoGenerationLimit(userId: string): Promise<boolean> {
  if (!supabaseAdmin) return false
  const max = getMaxJobsPerDay()
  if (max <= 0) return false

  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  const { count, error } = await supabaseAdmin
    .from('video_generation_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', userId)
    .gte('created_at', startOfDay.toISOString())

  if (error) {
    console.warn('[Video generation] Rate limit check failed:', error.message)
    return false
  }
  return (count ?? 0) >= max
}
