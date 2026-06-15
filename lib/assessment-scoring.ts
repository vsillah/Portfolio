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
  label?: string
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

interface TimelineMilestone {
  week?: number | string
  target_date?: string
  status?: string
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function validDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function dateKey(value: string): string {
  return validDate(value)?.toISOString().slice(0, 10) || value.slice(0, 10)
}

function milestoneWeekToNumber(week: number | string | undefined): number | null {
  if (typeof week === 'number' && Number.isFinite(week)) return week
  if (typeof week !== 'string') return null
  const match = week.match(/-?\d+(\.\d+)?/)
  if (!match) return null
  const value = Number(match[0])
  return Number.isFinite(value) ? value : null
}

function getProjectedCompletionDate(
  projectStartDate: Date,
  milestones: TimelineMilestone[]
): Date | null {
  const targetDates = milestones
    .map((milestone) => validDate(milestone.target_date))
    .filter((date): date is Date => Boolean(date))

  if (targetDates.length > 0) {
    return new Date(Math.max(...targetDates.map((date) => date.getTime())))
  }

  const maxWeek = milestones.reduce((latest, milestone) => {
    const week = milestoneWeekToNumber(milestone.week)
    return week === null ? latest : Math.max(latest, week)
  }, -Infinity)

  if (!Number.isFinite(maxWeek)) return null

  // Week numbers in onboarding plans are milestone markers, so include the final week.
  return addDays(projectStartDate, Math.max(1, maxWeek + 1) * 7)
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
  const { data: project } = await supabaseAdmin
    .from('client_projects')
    .select('project_start_date, created_at, onboarding_plan_id')
    .eq('id', clientProjectId)
    .single()

  // Fetch actual snapshots
  const { data: snapshots } = await supabaseAdmin
    .from('score_snapshots')
    .select('snapshot_date, overall_score')
    .eq('client_project_id', clientProjectId)
    .order('snapshot_date', { ascending: true })

  if (!snapshots || snapshots.length === 0) return []

  const snapshotsByDay = new Map<string, { snapshot_date: string; overall_score: number }>()
  snapshots.forEach((snapshot: { snapshot_date: string; overall_score: number }) => {
    snapshotsByDay.set(dateKey(snapshot.snapshot_date), snapshot)
  })
  const normalizedSnapshots = Array.from(snapshotsByDay.values())

  const projectStartDate =
    validDate(project?.project_start_date) ||
    validDate(project?.created_at) ||
    validDate(normalizedSnapshots[0].snapshot_date) ||
    new Date()

  let milestones: TimelineMilestone[] = []
  if (project?.onboarding_plan_id) {
    const { data: onboardingPlan } = await supabaseAdmin
      .from('onboarding_plans')
      .select('milestones')
      .eq('id', project.onboarding_plan_id)
      .single()
    milestones = Array.isArray(onboardingPlan?.milestones)
      ? (onboardingPlan.milestones as TimelineMilestone[])
      : []
  }

  const projectedCompletionDate =
    getProjectedCompletionDate(projectStartDate, milestones) ||
    validDate(normalizedSnapshots[normalizedSnapshots.length - 1].snapshot_date) ||
    addDays(projectStartDate, 42)

  const firstSnapshot = normalizedSnapshots[0] as { snapshot_date: string; overall_score: number }
  const firstSnapshotDate = validDate(firstSnapshot.snapshot_date) || projectStartDate

  // Actual data points, anchored at project inception even if the first score
  // snapshot was recorded later.
  const actual: TrajectoryPoint[] = []
  actual.push({
    date: startOfDay(projectStartDate).toISOString(),
    overallScore: firstSnapshot.overall_score,
    isProjected: false,
    label: 'Project start',
  })

  normalizedSnapshots.forEach((s: { snapshot_date: string; overall_score: number }, index: number) => {
    const snapshotDate = validDate(s.snapshot_date)
    if (
      index === 0 &&
      snapshotDate &&
      Math.abs(snapshotDate.getTime() - firstSnapshotDate.getTime()) < MS_PER_DAY &&
      Math.abs(snapshotDate.getTime() - projectStartDate.getTime()) < MS_PER_DAY
    ) {
      return
    }

    actual.push({
      date: s.snapshot_date,
      overallScore: s.overall_score,
      isProjected: false,
      label: index === normalizedSnapshots.length - 1 ? 'Current score' : undefined,
    })
  })

  // Fetch remaining tasks for projection
  const { data: remainingTasks } = await supabaseAdmin
    .from('dashboard_tasks')
    .select('impact_score, created_at')
    .eq('client_project_id', clientProjectId)
    .in('status', ['pending', 'in_progress'])
    .order('display_order', { ascending: true })

  const latestActual = actual[actual.length - 1]
  const latestActualDate = validDate(latestActual.date) || projectStartDate
  const completionDate =
    projectedCompletionDate.getTime() > latestActualDate.getTime()
      ? projectedCompletionDate
      : addDays(latestActualDate, Math.max(7, milestones.length * 7))

  if (!remainingTasks || remainingTasks.length === 0) {
    const latestMilestoneScore = milestones.length > 0
      ? Math.min(100, latestActual.overallScore + Math.max(5, milestones.length * 3))
      : latestActual.overallScore

    if (completionDate.getTime() > latestActualDate.getTime()) {
      actual.push({
        date: completionDate.toISOString(),
        overallScore: latestMilestoneScore,
        isProjected: true,
        label: 'Projected completion',
      })
    }

    return actual
  }

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

  const latestScore = latestActual.overallScore
  let runningScore = latestScore
  const projectionSpanDays = Math.max(
    1,
    (completionDate.getTime() - latestActualDate.getTime()) / MS_PER_DAY
  )

  for (let i = 0; i < remainingTasks.length; i++) {
    const cadenceDate = addDays(latestActualDate, avgDaysBetweenCompletions * (i + 1))
    const milestoneDate = addDays(
      latestActualDate,
      (projectionSpanDays / remainingTasks.length) * (i + 1)
    )
    const projectedDate =
      completedTasks && completedTasks.length >= 2
        ? new Date(Math.min(cadenceDate.getTime(), completionDate.getTime()))
        : milestoneDate
    runningScore = Math.min(100, runningScore + (remainingTasks[i].impact_score || 0))

    actual.push({
      date: projectedDate.toISOString(),
      overallScore: runningScore,
      isProjected: true,
      label: i === remainingTasks.length - 1 ? 'Projected completion' : undefined,
    })
  }

  const finalPoint = actual[actual.length - 1]
  const finalDate = validDate(finalPoint.date)
  if (finalDate && Math.abs(finalDate.getTime() - completionDate.getTime()) > MS_PER_DAY) {
    actual.push({
      date: completionDate.toISOString(),
      overallScore: runningScore,
      isProjected: true,
      label: 'Projected completion',
    })
  } else {
    finalPoint.label = finalPoint.label || 'Projected completion'
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
