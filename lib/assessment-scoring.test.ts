import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({
  supabaseAdmin: null,
}))

import {
  buildProjectedTrajectory,
  TRAJECTORY_TARGET_SCORE,
} from './assessment-scoring'

describe('buildProjectedTrajectory', () => {
  it('returns no trajectory when there are no score snapshots', () => {
    expect(
      buildProjectedTrajectory({
        projectStartDate: new Date('2026-07-01T00:00:00.000Z'),
        now: new Date('2026-07-18T16:00:00.000Z'),
        snapshots: [],
      })
    ).toEqual([])
  })

  it('uses the latest same-day snapshot as the single current point', () => {
    const trajectory = buildProjectedTrajectory({
      projectStartDate: new Date('2026-07-01T00:00:00.000Z'),
      now: new Date('2026-07-18T16:00:00.000Z'),
      snapshots: [
        {
          snapshot_date: '2026-07-01T00:00:00.000Z',
          overall_score: 40,
        },
        {
          snapshot_date: '2026-07-18T08:00:00.000Z',
          overall_score: 48,
        },
        {
          snapshot_date: '2026-07-18T14:00:00.000Z',
          overall_score: 52,
        },
      ],
      milestones: [{ target_date: '2026-08-01T00:00:00.000Z' }],
      remainingTasks: [],
    })

    const currentPoints = trajectory.filter((point) => point.isCurrent)
    const todayActuals = trajectory.filter(
      (point) => !point.isProjected && point.date.startsWith('2026-07-18')
    )

    expect(currentPoints).toHaveLength(1)
    expect(todayActuals).toHaveLength(1)
    expect(currentPoints[0]).toMatchObject({
      date: '2026-07-18T14:00:00.000Z',
      overallScore: 52,
      isProjected: false,
      label: 'Current status check',
    })
  })

  it('uses the milestone-count fallback when the planned completion date is stale', () => {
    const trajectory = buildProjectedTrajectory({
      projectStartDate: new Date('2026-04-01T00:00:00.000Z'),
      now: new Date('2026-07-11T16:00:00.000Z'),
      snapshots: [
        {
          snapshot_date: '2026-04-01T00:00:00.000Z',
          overall_score: 45,
        },
        {
          snapshot_date: '2026-07-10T12:00:00.000Z',
          overall_score: 60,
        },
      ],
      milestones: [{ week: 'Week 1' }, { week: 2 }],
      remainingTasks: [],
    })

    expect(trajectory.find((point) => point.isCurrent)).toMatchObject({
      date: '2026-07-11T00:00:00.000Z',
      overallScore: 60,
    })
    expect(trajectory.at(-1)).toEqual({
      date: '2026-07-25T00:00:00.000Z',
      overallScore: 66,
      isProjected: true,
      label: 'Projected completion',
    })
  })

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
        { week: 1 },
        { week: 2 },
        { week: 3 },
        { week: 4 },
        { week: 5 },
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
