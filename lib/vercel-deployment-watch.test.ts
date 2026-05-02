import { describe, expect, it } from 'vitest'
import {
  formatDeploymentWatchSummary,
  parseDeploymentWatchArgs,
  summarizeDeploymentStatus,
} from './vercel-deployment-watch'

describe('summarizeDeploymentStatus', () => {
  it('marks the deployment successful when both Vercel contexts pass', () => {
    const summary = summarizeDeploymentStatus({
      state: 'success',
      statuses: [
        { context: 'Vercel – portfolio', state: 'success' },
        { context: 'Vercel – portfolio-staging', state: 'success' },
      ],
    })

    expect(summary.state).toBe('success')
    expect(summary.pendingContexts).toHaveLength(0)
    expect(summary.failedContexts).toHaveLength(0)
  })

  it('keeps the deployment pending when staging is still building', () => {
    const summary = summarizeDeploymentStatus({
      state: 'pending',
      statuses: [
        { context: 'Vercel – portfolio', state: 'success' },
        {
          context: 'Vercel – portfolio-staging',
          state: 'pending',
          description: 'Building',
        },
      ],
    })

    expect(summary.state).toBe('pending')
    expect(summary.pendingContexts.map((status) => status.context)).toEqual([
      'Vercel – portfolio-staging',
    ])
  })

  it('marks missing contexts as pending instead of successful', () => {
    const summary = summarizeDeploymentStatus({
      state: 'success',
      statuses: [{ context: 'Vercel – portfolio', state: 'success' }],
    })

    expect(summary.state).toBe('pending')
    expect(summary.missingContexts).toEqual(['Vercel – portfolio-staging'])
  })

  it('marks failure or error states as failed', () => {
    const summary = summarizeDeploymentStatus({
      state: 'failure',
      statuses: [
        { context: 'Vercel – portfolio', state: 'success' },
        { context: 'Vercel – portfolio-staging', state: 'error' },
      ],
    })

    expect(summary.state).toBe('failed')
    expect(summary.failedContexts.map((status) => status.context)).toEqual([
      'Vercel – portfolio-staging',
    ])
  })
})

describe('parseDeploymentWatchArgs', () => {
  it('uses Portfolio defaults', () => {
    const options = parseDeploymentWatchArgs([])

    expect(options.ref).toBe('main')
    expect(options.owner).toBe('vsillah')
    expect(options.repo).toBe('Portfolio')
    expect(options.contexts).toEqual(['Vercel – portfolio', 'Vercel – portfolio-staging'])
  })

  it('parses ref, timing, and custom contexts', () => {
    const options = parseDeploymentWatchArgs([
      '--ref',
      'abc123',
      '--timeout',
      '60',
      '--interval',
      '5',
      '--contexts',
      'A,B',
      '--once',
    ])

    expect(options.ref).toBe('abc123')
    expect(options.timeoutSeconds).toBe(60)
    expect(options.intervalSeconds).toBe(5)
    expect(options.contexts).toEqual(['A', 'B'])
    expect(options.once).toBe(true)
  })
})

describe('formatDeploymentWatchSummary', () => {
  it('formats a concise terminal report', () => {
    const summary = summarizeDeploymentStatus({
      state: 'pending',
      statuses: [
        {
          context: 'Vercel – portfolio',
          state: 'success',
          target_url: 'https://vercel.com/example',
          updated_at: '2026-05-02T10:00:00Z',
        },
      ],
    })

    expect(formatDeploymentWatchSummary(summary)).toContain('deployment_state=pending')
    expect(formatDeploymentWatchSummary(summary)).toContain('context="Vercel – portfolio"')
    expect(formatDeploymentWatchSummary(summary)).toContain('url=https://vercel.com/example')
  })
})
