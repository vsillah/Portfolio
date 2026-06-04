import { describe, expect, it } from 'vitest'
import {
  buildOpenBrainRoadmapStatus,
  formatOpenBrainRoadmapStatusMarkdown,
} from './open-brain-roadmap-status'

describe('Open Brain roadmap status', () => {
  it('summarizes the current Open Brain phase statuses and gates', () => {
    const status = buildOpenBrainRoadmapStatus('2026-06-04T12:00:00.000Z')

    expect(status.phases.map((phase) => phase.id)).toEqual([
      'phase-1',
      'phase-2',
      'phase-3',
      'phase-4',
      'phase-5',
      'phase-6',
    ])
    expect(status.phases.find((phase) => phase.id === 'phase-2')).toEqual(expect.objectContaining({
      status: 'approval_gated',
      gates: expect.arrayContaining([
        'Do not edit agent runtime configs without explicit local-state approval.',
      ]),
    }))
    expect(status.phases.find((phase) => phase.id === 'phase-5')).toEqual(expect.objectContaining({
      status: 'in_progress',
      nextAction: expect.stringContaining('retrieval QA packet'),
    }))
    expect(status.phases.find((phase) => phase.id === 'phase-6')).toEqual(expect.objectContaining({
      status: 'complete',
      completed: expect.arrayContaining([
        expect.stringContaining('not-run result summary'),
      ]),
    }))
  })

  it('formats a reviewable markdown roadmap report', () => {
    const markdown = formatOpenBrainRoadmapStatusMarkdown(
      buildOpenBrainRoadmapStatus('2026-06-04T12:00:00.000Z'),
    )

    expect(markdown).toContain('# Open Brain Roadmap Status')
    expect(markdown).toContain('Status: `approval_gated`')
    expect(markdown).toContain('Status: `in_progress`')
    expect(markdown).toContain('Next action: Build a retrieval QA packet')
    expect(markdown).toContain('scripts/open-brain-autoresearch-producer.ts')
  })
})
