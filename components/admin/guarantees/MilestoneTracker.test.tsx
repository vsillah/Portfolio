import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MilestoneTracker from './MilestoneTracker'
import type { GuaranteeMilestone } from '@/lib/guarantees'

const makeMilestone = (overrides: Partial<GuaranteeMilestone> = {}): GuaranteeMilestone => ({
  id: 'ms-1',
  guarantee_instance_id: 'gi-1',
  condition_id: 'c1',
  condition_label: 'Attend all sessions',
  status: 'pending',
  verified_by: null,
  verified_at: null,
  admin_notes: null,
  client_evidence: null,
  client_submitted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('MilestoneTracker', () => {
  it('renders the correct progress count', () => {
    const milestones = [
      makeMilestone({ id: 'ms-1', condition_id: 'c1', status: 'met' }),
      makeMilestone({ id: 'ms-2', condition_id: 'c2', condition_label: 'Do homework', status: 'pending' }),
      makeMilestone({ id: 'ms-3', condition_id: 'c3', condition_label: 'Implement strategy', status: 'waived' }),
    ]

    render(<MilestoneTracker milestones={milestones} instanceId="gi-1" />)

    expect(screen.getByText('2 of 3 conditions met')).toBeInTheDocument()
    expect(screen.getByText('67%')).toBeInTheDocument()
  })

  it('renders all milestone labels', () => {
    const milestones = [
      makeMilestone({ condition_label: 'Attend all sessions' }),
      makeMilestone({ id: 'ms-2', condition_id: 'c2', condition_label: 'Complete assignments' }),
    ]

    render(<MilestoneTracker milestones={milestones} instanceId="gi-1" />)

    expect(screen.getByText('Attend all sessions')).toBeInTheDocument()
    expect(screen.getByText('Complete assignments')).toBeInTheDocument()
  })

  it('shows 100% when all milestones are met', () => {
    const milestones = [
      makeMilestone({ status: 'met' }),
      makeMilestone({ id: 'ms-2', condition_id: 'c2', condition_label: 'Task 2', status: 'met' }),
    ]

    render(<MilestoneTracker milestones={milestones} instanceId="gi-1" />)

    expect(screen.getByText('2 of 2 conditions met')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('shows 0% when no milestones are met', () => {
    const milestones = [
      makeMilestone({ status: 'pending' }),
      makeMilestone({ id: 'ms-2', condition_id: 'c2', condition_label: 'Task 2', status: 'not_met' }),
    ]

    render(<MilestoneTracker milestones={milestones} instanceId="gi-1" />)

    expect(screen.getByText('0 of 2 conditions met')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('expands milestone detail on click', () => {
    const milestones = [
      makeMilestone({ client_evidence: 'Here is my proof' }),
    ]

    render(<MilestoneTracker milestones={milestones} instanceId="gi-1" />)

    // Click to expand
    fireEvent.click(screen.getByText('Attend all sessions'))

    // Client evidence should now be visible
    expect(screen.getByText('Here is my proof')).toBeInTheDocument()
  })

  it('shows admin verify buttons when isAdmin and onVerify provided', () => {
    const onVerify = vi.fn()
    const milestones = [makeMilestone({ status: 'pending' })]

    render(
      <MilestoneTracker
        milestones={milestones}
        instanceId="gi-1"
        isAdmin={true}
        onVerify={onVerify}
      />
    )

    // Expand the milestone
    fireEvent.click(screen.getByText('Attend all sessions'))

    expect(screen.getByText('Mark Met')).toBeInTheDocument()
    expect(screen.getByText('Mark Not Met')).toBeInTheDocument()
    expect(screen.getByText('Waive')).toBeInTheDocument()
  })

  it('does not show admin buttons when isAdmin is false', () => {
    const milestones = [makeMilestone({ status: 'pending' })]

    render(
      <MilestoneTracker milestones={milestones} instanceId="gi-1" isAdmin={false} />
    )

    fireEvent.click(screen.getByText('Attend all sessions'))

    expect(screen.queryByText('Mark Met')).not.toBeInTheDocument()
  })

  it('shows client submit button when not admin and onClientSubmit provided', () => {
    const onClientSubmit = vi.fn()
    const milestones = [makeMilestone({ status: 'pending' })]

    render(
      <MilestoneTracker
        milestones={milestones}
        instanceId="gi-1"
        isAdmin={false}
        onClientSubmit={onClientSubmit}
      />
    )

    fireEvent.click(screen.getByText('Attend all sessions'))

    expect(screen.getByText('Submit Evidence')).toBeInTheDocument()
  })

  it('handles empty milestones array', () => {
    render(<MilestoneTracker milestones={[]} instanceId="gi-1" />)

    expect(screen.getByText('0 of 0 conditions met')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})
