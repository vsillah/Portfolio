import { describe, expect, it } from 'vitest'
import { buildCodexWorkspaceRootReport } from './codex-workspace-roots'

describe('buildCodexWorkspaceRootReport', () => {
  it('reports green when workspace roots and active threads are under Portfolio', () => {
    const report = buildCodexWorkspaceRootReport({
      expectedRoot: '/Users/vambahsillah/Projects/Portfolio',
      globalState: {
        'electron-saved-workspace-roots': ['/Users/vambahsillah/Projects/Portfolio'],
        'active-workspace-roots': ['/Users/vambahsillah/Projects/Portfolio'],
        'project-order': ['/Users/vambahsillah/Projects/Portfolio'],
      },
      threadRoots: [
        { cwd: '/Users/vambahsillah/Projects/Portfolio', activeCount: 12, portfolioRoot: true },
        { cwd: '/Users/vambahsillah/Projects/Portfolio/docs', activeCount: 1, portfolioRoot: true },
      ],
    }, '2026-05-09T00:00:00.000Z')

    expect(report.health).toBe('green')
    expect(report.overview).toEqual(expect.objectContaining({
      activeThreads: 13,
      portfolioThreads: 13,
      nonPortfolioThreads: 0,
      savedRootDrift: 0,
      activeRootDrift: 0,
      projectOrderDrift: 0,
    }))
    expect(report.warnings).toEqual([])
  })

  it('reports drift without mutating Codex state', () => {
    const report = buildCodexWorkspaceRootReport({
      expectedRoot: '/Users/vambahsillah/Projects/Portfolio',
      globalState: {
        'electron-saved-workspace-roots': ['/Users/vambahsillah/Projects'],
        'active-workspace-roots': ['/Users/vambahsillah/Projects/Work'],
        'project-order': ['/Users/vambahsillah/Projects/Portfolio', '/Users/vambahsillah/Projects/Personal'],
      },
      threadRoots: [
        { cwd: '/Users/vambahsillah/Projects/Portfolio', activeCount: 20, portfolioRoot: true },
        { cwd: '/Users/vambahsillah/Projects', activeCount: 17, portfolioRoot: false },
      ],
    }, '2026-05-09T00:00:00.000Z')

    expect(report.health).toBe('red')
    expect(report.overview.nonPortfolioThreads).toBe(17)
    expect(report.overview.savedRootDrift).toBe(1)
    expect(report.overview.activeRootDrift).toBe(1)
    expect(report.overview.projectOrderDrift).toBe(1)
    expect(report.warnings).toEqual(expect.arrayContaining([
      '1 saved workspace root(s) do not point at Portfolio.',
      '1 active workspace root(s) do not point at Portfolio.',
      '1 project-order root(s) do not point at Portfolio.',
      '17 active thread(s) are rooted outside Portfolio.',
    ]))
    expect(report.operationalBoundary).toContain('Read-only workspace visibility')
  })
})
