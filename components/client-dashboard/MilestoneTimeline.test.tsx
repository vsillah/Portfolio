import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MilestoneTimeline from './MilestoneTimeline'
import type { Milestone } from '@/lib/onboarding-templates'

describe('MilestoneTimeline', () => {
  it('renders milestone evidence and automation without exposing local paths', () => {
    const milestones: Milestone[] = [
      {
        id: 'm0',
        week: 0,
        title: 'Distribute the test app',
        description: 'Ship the test app to internal testers.',
        deliverables: ['Tester access'],
        phase: 1,
        status: 'in_progress',
        evidence: [
          {
            id: 'e1',
            source_type: 'github',
            source_label: 'GitHub repository evidence',
            summary:
              'Verified from /Users/example/private/ReversR logs and repository metrics.',
            confidence: 'high',
            status: 'verified',
            source_url: 'https://github.com/vsillah/ReversR-Rebuild',
            is_client_visible: true,
          },
          {
            id: 'e2',
            source_type: 'app_store_connect',
            source_label: 'Store-console records',
            summary: 'Apple and Google access are required.',
            confidence: 'medium',
            status: 'access_needed',
            is_client_visible: true,
          },
          {
            id: 'private',
            source_type: 'manual',
            source_label: 'Private note',
            summary: 'Do not render',
            confidence: 'low',
            status: 'manual_review',
            is_client_visible: false,
          },
        ],
        automation: {
          source: 'hybrid',
          status: 'access_needed',
          summary:
            'GitHub can support build evidence; /Users/example/private/store records require platform access.',
        },
      },
    ]

    render(<MilestoneTimeline milestones={milestones} />)

    expect(screen.getByText('Evidence Trace')).toBeInTheDocument()
    expect(screen.getByText('GitHub repository evidence')).toBeInTheDocument()
    expect(screen.getByText('Store-console records')).toBeInTheDocument()
    expect(screen.getByText('Access Needed')).toBeInTheDocument()
    expect(screen.getByText(/High confidence/i)).toBeInTheDocument()
    expect(screen.queryByText('Private note')).not.toBeInTheDocument()
    expect(screen.queryByText(/\/Users\/example/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/\[private path\]/)).toHaveLength(2)
  })
})
