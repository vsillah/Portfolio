import { describe, it, expect } from 'vitest'
import { buildMeetingRecordDetail } from './admin-meeting-record-detail'

describe('buildMeetingRecordDetail', () => {
  it('prefers notes summary and maps action item text variants', () => {
    const meeting = buildMeetingRecordDetail(
      {
        id: 'm-1',
        meeting_type: 'discovery_call',
        meeting_date: '2026-04-10T10:00:00.000Z',
        transcript: 'Transcript fallback should not be used',
        structured_notes: JSON.stringify({ summary: 'Structured summary' }),
        action_items: JSON.stringify([
          ' Follow up with client ',
          { action: 'Send proposal' },
          { title: 'Book next meeting' },
          { text: 'Confirm timeline' },
        ]),
        key_decisions: null,
      },
      123
    )

    expect(meeting.summary).toBe('Structured summary')
    expect(meeting.title).toBe('discovery call')
    expect(meeting.start_time_ms).toBe(Date.parse('2026-04-10T10:00:00.000Z'))
    expect(meeting.action_items).toEqual([
      { text: 'Follow up with client' },
      { text: 'Send proposal' },
      { text: 'Book next meeting' },
      { text: 'Confirm timeline' },
    ])
  })

  it('falls back to transcript summary and key_decisions when needed', () => {
    const meeting = buildMeetingRecordDetail(
      {
        id: 'm-2',
        meeting_type: '  ',
        meeting_date: 'not-a-date',
        transcript: 'x'.repeat(4500),
        structured_notes: '{"not":"usable"}',
        action_items: '[]',
        key_decisions: JSON.stringify([{ title: 'Decide budget owner' }]),
      },
      999
    )

    expect(meeting.title).toBe('Meeting')
    expect(meeting.start_time_ms).toBe(999)
    expect(meeting.summary).toBe('x'.repeat(4000))
    expect(meeting.action_items).toEqual([{ text: 'Decide budget owner' }])
  })

  it('falls back to notes action_items before key_decisions', () => {
    const meeting = buildMeetingRecordDetail({
      id: 'm-3',
      meeting_type: 'sync',
      meeting_date: '2026-04-11T10:00:00.000Z',
      transcript: null,
      structured_notes: {
        highlights: 'Notes highlight',
        action_items: [{ text: 'Prepare recap' }],
      },
      action_items: null,
      key_decisions: ['Should not be used'],
    })

    expect(meeting.summary).toBe('Notes highlight')
    expect(meeting.action_items).toEqual([{ text: 'Prepare recap' }])
  })
})
