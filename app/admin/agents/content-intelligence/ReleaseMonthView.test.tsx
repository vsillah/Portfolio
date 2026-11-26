import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReleaseMonthView, releaseDay, releaseTime, shiftMonth, type MonthRelease } from './ReleaseMonthView'

const row = (id: string, scheduled_for: string, patch: Partial<MonthRelease> = {}): MonthRelease => ({
  id, title: `Release ${id}`, scheduled_for, channel: 'linkedin', campaign_phase: 'teach',
  campaign_id: 'campaign-1', social_content_id: null, authorization_status: 'pending',
  due_status: 'planned', metadata: {}, ...patch,
})

describe('ReleaseMonthView', () => {
  it('uses New York calendar days across UTC month and daylight-saving boundaries', () => {
    expect(releaseDay('2026-04-01T02:00:00Z')).toBe('2026-03-31')
    expect(releaseDay('2026-03-08T06:30:00Z')).toBe('2026-03-08')
    expect(releaseTime('2026-03-08T06:30:00Z')).toBe('1:30 AM')
    expect(releaseTime('2026-03-08T07:30:00Z')).toBe('3:30 AM')
    expect(releaseDay('2026-03-15')).toBe('2026-03-15')
    expect(releaseTime('2026-03-15')).toBeNull()
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })

  it('shows all same-day records, overflow, history, mobile agenda, and exact record identity', () => {
    const onOpen = vi.fn()
    render(<ReleaseMonthView month="2026-03" onMonthChange={vi.fn()} onOpen={onOpen} onClearFilters={vi.fn()} items={[
      row('one', '2026-03-08T06:30:00Z'),
      row('two', '2026-03-08T07:30:00Z', { due_status: 'completed' }),
      row('three', '2026-03-08', { title: 'A long campaign title that must wrap without overlap', social_content_queue: { status: 'published' } }),
    ]} />)
    expect(screen.getByText('+1 more')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show 1 more releases on 2026-03-08' }))
    const grid = screen.getByRole('region', { name: 'Release month calendar' })
    expect(within(grid).getAllByRole('button', { name: /Open details/ }).length).toBe(6)
    fireEvent.click(screen.getAllByRole('button', { name: /Open details:.*Release two/ })[0])
    expect(onOpen).toHaveBeenCalledWith('two')
    expect(screen.getAllByText(/completed · pending/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/published · pending/).length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Day in March 2026')).toHaveValue('2026-03-08')
    fireEvent.change(screen.getByLabelText('Day in March 2026'), { target: { value: '2026-03-09' } })
    expect(screen.getByText('No releases on this day. Choose another day above.')).toBeInTheDocument()
  })

  it('navigates months and offers recovery when a month is empty', () => {
    const onMonthChange = vi.fn()
    const onClearFilters = vi.fn()
    render(<ReleaseMonthView month="2026-03" items={[]} onMonthChange={onMonthChange} onOpen={vi.fn()} onClearFilters={onClearFilters} />)
    expect(screen.getByText('No releases match this month and the current filters.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(onMonthChange).toHaveBeenCalledWith('2026-02')
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(onMonthChange).toHaveBeenCalledWith('2026-04')
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(onClearFilters).toHaveBeenCalledOnce()
  })
})
