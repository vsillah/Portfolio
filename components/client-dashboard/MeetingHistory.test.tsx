import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MeetingHistory from './MeetingHistory'

function makeMeeting(index: number, durationMinutes: number | null = 45) {
  return {
    id: `meeting-${index}`,
    meeting_type: index % 2 === 0 ? 'progress_checkin' : 'discovery',
    meeting_date: `2026-04-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
    duration_minutes: durationMinutes,
    structured_notes: null,
    key_decisions: [`Decision ${index}`],
    action_items: null,
    open_questions: null,
    recording_url: null,
  }
}

function mockMeetings(meetings: ReturnType<typeof makeMeeting>[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ meetings }),
    })
  )
}

describe('MeetingHistory', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('paginates meeting history after four rows with compact controls', async () => {
    mockMeetings(Array.from({ length: 7 }, (_, index) => makeMeeting(index + 1)))

    render(<MeetingHistory token="dashboard-token" />)

    expect(await screen.findByText('Showing 1 to 4 of 7 meetings')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    expect(screen.getByText('Sun, Apr 5, 2026 · 45min')).toBeInTheDocument()
    expect(screen.queryByText('Mon, Apr 6, 2026 · 45min')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByText('Showing 5 to 7 of 7 meetings')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getByText('Mon, Apr 6, 2026 · 45min')).toBeInTheDocument()
    expect(screen.queryByText('Thu, Apr 2, 2026 · 45min')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))

    expect(screen.getByText('Showing 1 to 4 of 7 meetings')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
  })

  it('omits pagination and zero-minute duration artifacts for short meeting lists', async () => {
    mockMeetings([
      makeMeeting(6, 0),
      makeMeeting(7, null),
      makeMeeting(8, 30),
    ])

    render(<MeetingHistory token="dashboard-token" />)

    expect(await screen.findByText('Tue, Apr 7, 2026')).toBeInTheDocument()
    expect(screen.getByText('Wed, Apr 8, 2026')).toBeInTheDocument()
    expect(screen.getByText('Thu, Apr 9, 2026 · 30min')).toBeInTheDocument()
    expect(screen.queryByText(/20260/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Showing 1 to/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/client/dashboard/dashboard-token/meetings')
    })
  })
})
