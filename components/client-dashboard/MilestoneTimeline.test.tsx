import { fireEvent, render, screen } from '@testing-library/react'
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
              'Verified from /Users/example/private/ReversR logs with 149 all-branch commits, 36,775 tracked code/doc/config lines, and 38 passed release gates.',
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

    expect(screen.getByText('Phase 1')).toBeInTheDocument()
    expect(screen.getByText('Expand all')).toBeInTheDocument()
    expect(screen.queryByText('Evidence Trace')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Distribute the test app/i }))

    expect(screen.getByText('Evidence Trace')).toBeInTheDocument()
    expect(screen.getByText('GitHub repository evidence')).toBeInTheDocument()
    expect(screen.getByText('Store-console records')).toBeInTheDocument()
    expect(screen.getByText('Access Needed')).toBeInTheDocument()
    expect(screen.getByText('149')).toBeInTheDocument()
    expect(screen.getByText('all-branch commits')).toBeInTheDocument()
    expect(screen.getByText('36,775')).toBeInTheDocument()
    expect(screen.getByText('tracked code/doc/config lines')).toBeInTheDocument()
    expect(screen.getByText('38')).toBeInTheDocument()
    expect(screen.getByText('passed release gates')).toBeInTheDocument()
    expect(screen.getByText('Connection needed: App Store Connect + Google Play')).toBeInTheDocument()
    expect(screen.queryByText(/Automation:/)).not.toBeInTheDocument()
    expect(screen.queryByText('Private note')).not.toBeInTheDocument()
    expect(screen.queryByText(/\/Users\/example/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\[private path\]/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Verified from/)).not.toBeInTheDocument()
  })

  it('shows sanitized automation access hints when no visible evidence duplicates the same connection', () => {
    const milestones: Milestone[] = [
      {
        id: 'm1',
        week: 2,
        title: 'Confirm payment readiness',
        description: 'Validate payment collection access before launch.',
        deliverables: ['Stripe access'],
        phase: 2,
        status: 'pending',
        evidence: [
          {
            id: 'hidden-stripe',
            source_type: 'stripe',
            source_label: 'Stripe private note',
            summary: 'Private access detail',
            confidence: 'low',
            status: 'access_needed',
            is_client_visible: false,
          },
        ],
        automation: {
          source: 'stripe',
          status: 'access_needed',
          summary: 'Stripe evidence requires /Users/example/private/stripe-export.csv access.',
        },
      },
    ]

    render(<MilestoneTimeline milestones={milestones} />)

    fireEvent.click(screen.getByRole('button', { name: /Confirm payment readiness/i }))

    expect(screen.getByText(/Connection needed:/)).toBeInTheDocument()
    expect(screen.getByText(/Stripe$/)).toBeInTheDocument()
    expect(screen.queryByText('Stripe private note')).not.toBeInTheDocument()
    expect(screen.queryByText(/\/Users\/example/)).not.toBeInTheDocument()
  })

  it('falls back to a platform access label and extracts release-gate edge metrics', () => {
    const milestones: Milestone[] = [
      {
        id: 'm2',
        week: 3,
        title: 'Finalize store release',
        description: 'Verify remaining release gates.',
        deliverables: ['Release review'],
        phase: 3,
        status: 'in_progress',
        evidence: [
          {
            id: 'release-gates',
            source_type: 'release_gate',
            source_label: 'Store platform release gates',
            summary: '1 pending store-console gate remains before the 2-tester GO threshold is satisfied.',
            confidence: 'medium',
            status: 'access_needed',
            is_client_visible: true,
          },
        ],
      },
    ]

    render(<MilestoneTimeline milestones={milestones} />)

    fireEvent.click(screen.getByRole('button', { name: /Finalize store release/i }))

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('pending store-console gate')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('tester GO threshold')).toBeInTheDocument()
    expect(screen.getByText('Connection needed: Store platform access')).toBeInTheDocument()
  })
})
