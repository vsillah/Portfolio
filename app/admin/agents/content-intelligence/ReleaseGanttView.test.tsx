import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReleaseGanttView, groupCampaignLanes } from './ReleaseGanttView'
import type { MonthRelease } from './ReleaseMonthView'

const row = (id: string, scheduled_for: string, patch: Partial<MonthRelease> = {}): MonthRelease => ({
  id, title: `Release ${id}`, scheduled_for, channel: 'linkedin', campaign_phase: 'teach',
  campaign_id: 'campaign-one', social_content_id: null, authorization_status: 'pending',
  due_status: 'planned', metadata: {}, attraction_campaigns: { name: 'A very long campaign name that should wrap in its own lane' }, ...patch,
})

describe('ReleaseGanttView', () => {
  const items = [
    row('one', '2026-11-29T15:00:00Z'),
    row('two', '2026-11-29T15:00:00Z', { due_status: 'completed' }),
    row('three', '2026-12-01', { campaign_id: null, title: 'Unassigned all-day release', attraction_campaigns: null }),
    row('four', '2026-10-20T15:00:00Z', { campaign_id: 'campaign-two', attraction_campaigns: { name: 'Single item' }, metadata: { superseded_at: '2026-11-01T10:00:00Z' } }),
    row('five', '2026-11-30T15:00:00Z', { social_content_queue: { status: 'published' } }),
  ]

  it('groups all records by campaign, keeps unassigned, and derives spans from New York release days', () => {
    const lanes = groupCampaignLanes(items)
    expect(lanes.map(lane => [lane.name, lane.rows.length])).toEqual([
      ['A very long campaign name that should wrap in its own lane', 3],
      ['Single item', 1],
      ['Unassigned', 1],
    ])
    expect(lanes[0]).toMatchObject({ first: '2026-11-29', last: '2026-11-30' })
    expect(lanes[1]).toMatchObject({ first: '2026-10-20', last: '2026-10-20' })
    expect(lanes.flatMap(lane => lane.rows.map(item => item.id)).sort()).toEqual(items.map(item => item.id).sort())
  })

  it('exposes each same-day milestone, history state, navigation and exact Details identity', () => {
    const onOpen = vi.fn()
    const onMonthChange = vi.fn()
    render(<ReleaseGanttView items={items} month="2026-11" onMonthChange={onMonthChange} onOpen={onOpen} onClearFilters={vi.fn()} />)
    expect(screen.getByText('5 of 5 filtered releases in this three-month window · America/New_York.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Open details:.*Release two/ })).toHaveLength(2)
    expect(screen.getAllByText(/completed/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/published/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/superseded/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByRole('button', { name: /Open details:.*Unassigned all-day release/ })[0])
    expect(onOpen).toHaveBeenCalledWith('three')
    fireEvent.click(screen.getByRole('button', { name: 'Previous window' }))
    expect(onMonthChange).toHaveBeenCalledWith('2026-10')
    fireEvent.click(screen.getByRole('button', { name: 'Next window' }))
    expect(onMonthChange).toHaveBeenCalledWith('2026-12')
  })

  it('offers a useful action for an empty window while preserving campaign lanes', () => {
    const onClearFilters = vi.fn()
    render(<ReleaseGanttView items={items} month="2027-06" onMonthChange={vi.fn()} onOpen={vi.fn()} onClearFilters={onClearFilters} />)
    expect(screen.getByText('No releases match this window and the current filters.')).toBeInTheDocument()
    expect(screen.getAllByText('No milestones in this window. Use timeline navigation to find this campaign’s dates.').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(onClearFilters).toHaveBeenCalledOnce()
  })
})
