import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({
  supabaseAdmin: null,
}))

import {
  buildProjectedTrajectory,
  TRAJECTORY_TARGET_SCORE,
} from './assessment-scoring'

describe('buildProjectedTrajectory', () => {
  it('carries the latest score forward to today and caps projections at the target score', () => {
    const trajectory = buildProjectedTrajectory({
      projectStartDate: new Date('2026-04-07T00:00:00.000Z'),
      now: new Date('2026-07-18T16:00:00.000Z'),
      snapshots: [
        {
          snapshot_date: '2026-04-07T00:00:00.000Z',
          overall_score: 57,
        },
        {
          snapshot_date: '2026-07-17T14:58:44.567Z',
          overall_score: 57,
        },
      ],
      milestones: [
        { week: 1, target_date: '2026-07-22T00:00:00.000Z' },
        { week: 2, target_date: '2026-07-28T00:00:00.000Z' },
        { week: 3, target_date: '2026-08-03T00:00:00.000Z' },
        { week: 4, target_date: '2026-08-09T00:00:00.000Z' },
        { week: 5, target_date: '2026-08-21T00:00:00.000Z' },
      ],
      remainingTasks: [
        { impact_score: 18 },
        { impact_score: 18 },
        { impact_score: 18 },
      ],
      completedTasks: [],
    })

    const currentPoint = trajectory.find((point) => point.isCurrent)
    expect(currentPoint).toMatchObject({
      date: '2026-07-18T00:00:00.000Z',
      overallScore: 57,
      isProjected: false,
      label: 'Current status check',
    })

    const projectedPoints = trajectory.filter((point) => point.isProjected)
    expect(projectedPoints.length).toBeGreaterThan(0)
    expect(projectedPoints.every((point) => point.overallScore <= TRAJECTORY_TARGET_SCORE)).toBe(
      true
    )
    expect(projectedPoints[0].date > currentPoint!.date).toBe(true)
    expect(projectedPoints.at(-1)).toMatchObject({
      overallScore: TRAJECTORY_TARGET_SCORE,
      label: 'Projected completion',
    })
  })
})
