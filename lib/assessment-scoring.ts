/**
 * Assessment Scoring Engine
 *
 * Derives numeric scores (0-100) from diagnostic audit JSONB category data,
 * recalculates scores after task completion, and projects trajectory.
 */

import { supabaseAdmin } from './supabase'

// ============================================================================
// Types
// ============================================================================

export const ASSESSMENT_CATEGORIES = [
  'business_challenges',
  'tech_stack',
  'automation_needs',
  'ai_readiness',
  'budget_timeline',
  'decision_making',
] as const

export type AssessmentCategory = (typeof ASSESSMENT_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<AssessmentCategory, string> = {
  business_challenges: 'Business Description',
  tech_stack: 'Tech Stack',
  automation_needs: 'Automation',
  ai_readiness: 'AI Readiness',
  budget_timeline: 'Budget & Timeline',
  decision_making: 'Decision Making',
}

export const CATEGORY_WEIGHTS: Record<AssessmentCategory, number> = {
  business_challenges: 0.20,
  tech_stack: 0.15,
  automation_needs: 0.20,
  ai_readiness: 0.20,
  budget_timeline: 0.10,
  decision_making: 0.15,
}

export interface CategoryScores {
  business_challenges: number
  tech_stack: number
  automation_needs: number
  ai_readiness: number
  budget_timeline: number
  decision_making: number
}

export interface GapAnalysis {
  category: AssessmentCategory
  label: string
  currentScore: number
  dreamScore: number
  gap: number
  gapPercentage: number
}

export interface TrajectoryPoint {
  date: string
  overallScore: number
  isProjected: boolean
}

export interface ScoreSnapshot {
  id: string
  client_project_id: string
  snapshot_date: string
  category_scores: CategoryScores
  overall_score: number
  dream_outcome_gap: number | null
  trigger: 'initial' | 'task_completed' | 'milestone_achieved' | 'manual'
  trigger_ref: string | null
}

// ============================================================================
// Score Extraction
// ============================================================================

/**
 * Derive numeric scores (0-100) from diagnostic audit JSONB category fields.
 *
 * Scoring heuristic:
 * - Each category JSONB is inspected for response richness, question coverage,
 *   and any explicit scores embedded by the diagnostic AI.
 * - If the JSONB contains a `score` or `readiness_score` field, use it directly.
 * - Otherwise, compute a coverage-based score from how many questions were answered.
 */
export function extractCategoryScores(
  audit: Record<string, unknown>
): CategoryScores {
  const scores: Partial<CategoryScores> = {}

  for (const category of ASSESSMENT_CATEGORIES) {
    const data = audit[category] as Record<string, unknown> | null
    scores[category] = scoreCategoryData(data)
  }

  return scores as CategoryScores
}

function scoreCategoryData(data: Record<string, unknown> | null): number {
  if (!data || typeof data !== 'object') return 0

  // Check for explicit score fields set by the diagnostic AI
  if (typeof data.score === 'number') {
    return Math.min(100, Math.max(0, data.score))
  }
  if (typeof data.readiness_score === 'number') {
    return Math.min(100, Math.max(0, data.readiness_score * 10))
  }

  // Coverage-based scoring: count non-empty fields
  const keys = Object.keys(data)
  if (keys.length === 0) return 0

  let filledCount = 0
  for (const key of keys) {
    const val = data[key]
    if (val !== null && val !== undefined && val !== '' && val !== false) {
      if (Array.isArray(val) && val.length === 0) continue
      filledCount++
    }
  }

  // Scale to 0-100 based on coverage, capping at a reasonable max
  const coverageRatio = filledCount / Math.max(keys.length, 1)
  return Math.round(coverageRatio * 85) // Max 85 from coverage alone; explicit scores can reach 100
}

/**
 * Derive per-category confidence (0-100) from audit JSONB for the lead dashboard.
 * - Explicit score/readiness_score in category → high (90)
 * - Coverage-based (has data but no explicit score) → medium (55)
 * - Empty/minimal → low (15)
 */
export function extractCategoryConfidence(
  audit: Record<string, unknown>
): CategoryScores {
  const confidence: Partial<CategoryScores> = {}
  for (const category of ASSESSMENT_CATEGORIES) {
    const data = audit[category] as Record<string, unknown> | null
    if (!data || typeof data !== 'object') {
      confidence[category] = 15
      continue
    }
    if (typeof data.score === 'number' || typeof data.readiness_score === 'number') {
      confidence[category] = 90
      continue
    }
    const keys = Object.keys(data)
    if (keys.length === 0) {
      confidence[category] = 15
      continue
    }
    let filledCount = 0
    for (const key of keys) {
      const val = data[key]
      if (val !== null && val !== undefined && val !== '' && val !== false) {
        if (Array.isArray(val) && val.length === 0) continue
        filledCount++
      }
    }
    confidence[category] = filledCount > 0 ? 55 : 15
  }
  return confidence as CategoryScores
}

// ============================================================================
// Overall Score Calculation
// ============================================================================

/**
 * Weighted average of category scores
 */
export function calculateOverallScore(scores: CategoryScores): number {
  let total = 0
  let weightSum = 0

  for (const category of ASSESSMENT_CATEGORIES) {
    const weight = CATEGORY_WEIGHTS[category]
    total += scores[category] * weight
    weightSum += weight
  }

  return Math.round(total / weightSum)
}

// ============================================================================
// Gap Analysis
// ============================================================================

/**
 * Compute gap between current scores and dream outcome target per category.
 * Dream scores default to 90 if not provided (aspirational but achievable).
 */
export function calculateGapAnalysis(
  currentScores: CategoryScores,
  dreamScores?: Partial<CategoryScores>
): GapAnalysis[] {
  const defaultDream = 90

  return ASSESSMENT_CATEGORIES.map((category) => {
    const current = currentScores[category]
    const dream = dreamScores?.[category] ?? defaultDream
    const gap = Math.max(0, dream - current)
    const gapPercentage = dream > 0 ? Math.round((gap / dream) * 100) : 0

    return {
      category,
      label: CATEGORY_LABELS[category],
      currentScore: current,
      dreamScore: dream,
      gap,
      gapPercentage,
    }
  })
}

/**
 * Compute overall dream outcome gap as a single number (0 = achieved, 100 = max gap)
 */
export function calculateDreamOutcomeGap(
  currentScores: CategoryScores,
  dreamScores?: Partial<CategoryScores>
): number {
  const gaps = calculateGapAnalysis(currentScores, dreamScores)
  const totalGap = gaps.reduce((sum, g) => sum + g.gap, 0)
  const maxPossibleGap = gaps.length * 100
  return Math.round((totalGap / maxPossibleGap) * 100)
}

// ============================================================================
// Score Recalculation After Task Completion
// ============================================================================

/**
 * Recalculate category scores after a task is completed.
 * Each task has a `category` and `impact_score` that gets added to that category.
 */
export async function recalculateScores(
  clientProjectId: string,
  completedTaskId?: string
): Promise<{
  categoryScores: CategoryScores
  overallScore: number
  dreamOutcomeGap: number
  snapshotId: string | null
}> {
  // Get the initial snapshot (baseline)
  const { data: initialSnapshot } = await supabaseAdmin
    .from('score_snapshots')
    .select('*')
    .eq('client_project_id', clientProjectId)
    .eq('trigger', 'initial')
    .order('snapshot_date', { ascending: true })
    .limit(1)
    .single()

  if (!initialSnapshot) {
    return {
      categoryScores: {} as CategoryScores,
      overallScore: 0,
      dreamOutcomeGap: 100,
      snapshotId: null,
    }
  }

  const baseScores = initialSnapshot.category_scores as CategoryScores

  // Get all completed tasks for this project
  const { data: completedTasks } = await supabaseAdmin
    .from('dashboard_tasks')
    .select('category, impact_score')
    .eq('client_project_id', clientProjectId)
    .eq('status', 'complete')

  // Apply task impacts to base scores
  const adjustedScores = { ...baseScores }
  if (completedTasks) {
    for (const task of completedTasks) {
      const cat = task.category as AssessmentCategory
      if (cat in adjustedScores) {
        adjustedScores[cat] = Math.min(100, adjustedScores[cat] + (task.impact_score || 0))
      }
    }
  }

  const overallScore = calculateOverallScore(adjustedScores)
  const dreamOutcomeGap = calculateDreamOutcomeGap(adjustedScores)

  // Create new snapshot
  const trigger = completedTaskId ? 'task_completed' : 'manual'
  const { data: snapshot } = await supabaseAdmin
    .from('score_snapshots')
    .insert({
      client_project_id: clientProjectId,
      category_scores: adjustedScores,
      overall_score: overallScore,
      dream_outcome_gap: dreamOutcomeGap,
      trigger,
      trigger_ref: completedTaskId || null,
    })
    .select('id')
    .single()

  return {
    categoryScores: adjustedScores,
    overallScore,
    dreamOutcomeGap,
    snapshotId: snapshot?.id || null,
  }
}

// ============================================================================
// Trajectory Projection
// ============================================================================

/**
 * Compute projected trajectory based on historical snapshots and remaining tasks.
 *
 * Returns actual data points + projected future points based on
 * average task completion rate and remaining task impact scores.
 */
export async function projectTrajectory(
  clientProjectId: string
): Promise<TrajectoryPoint[]> {
  // Fetch actual snapshots
  const { data: snapshots } = await supabaseAdmin
    .from('score_snapshots')
    .select('snapshot_date, overall_score')
    .eq('client_project_id', clientProjectId)
    .order('snapshot_date', { ascending: true })

  if (!snapshots || snapshots.length === 0) return []

  // Actual data points
  const actual: TrajectoryPoint[] = snapshots.map((s: { snapshot_date: string; overall_score: number }) => ({
    date: s.snapshot_date,
    overallScore: s.overall_score,
    isProjected: false,
  }))

  // Fetch remaining tasks for projection
  const { data: remainingTasks } = await supabaseAdmin
    .from('dashboard_tasks')
    .select('impact_score, created_at')
    .eq('client_project_id', clientProjectId)
    .in('status', ['pending', 'in_progress'])
    .order('display_order', { ascending: true })

  if (!remainingTasks || remainingTasks.length === 0) return actual

  // Calculate average completion cadence from completed tasks
  const { data: completedTasks } = await supabaseAdmin
    .from('dashboard_tasks')
    .select('completed_at')
    .eq('client_project_id', clientProjectId)
    .eq('status', 'complete')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: true })

  // Default: assume 1 task per week if no history
  let avgDaysBetweenCompletions = 7
  if (completedTasks && completedTasks.length >= 2) {
    const first = new Date(completedTasks[0].completed_at!).getTime()
    const last = new Date(completedTasks[completedTasks.length - 1].completed_at!).getTime()
    const totalDays = (last - first) / (1000 * 60 * 60 * 24)
    avgDaysBetweenCompletions = Math.max(1, totalDays / (completedTasks.length - 1))
  }

  // Project future scores
  const latestScore = actual[actual.length - 1].overallScore
  const latestDate = new Date(actual[actual.length - 1].date)
  let runningScore = latestScore

  for (let i = 0; i < remainingTasks.length; i++) {
    const projectedDate = new Date(latestDate)
    projectedDate.setDate(projectedDate.getDate() + avgDaysBetweenCompletions * (i + 1))
    runningScore = Math.min(100, runningScore + (remainingTasks[i].impact_score || 0))

    actual.push({
      date: projectedDate.toISOString(),
      overallScore: runningScore,
      isProjected: true,
    })
  }

  return actual
}

// ============================================================================
// Score Delta Helpers
// ============================================================================

/**
 * Calculate the score change since the first snapshot
 */
export function calculateScoreDelta(
  snapshots: ScoreSnapshot[]
): { absolute: number; percentage: number } {
  if (snapshots.length < 2) return { absolute: 0, percentage: 0 }

  const first = snapshots[0].overall_score
  const latest = snapshots[snapshots.length - 1].overall_score
  const absolute = latest - first
  const percentage = first > 0 ? Math.round((absolute / first) * 100) : 0

  return { absolute, percentage }
}
