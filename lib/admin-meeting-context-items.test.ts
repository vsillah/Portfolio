import { describe, it, expect } from 'vitest'
import {
  mapDbMeetingRowsToContextItems,
  mergeDbFirstWithReadAi,
  isMeetingRecordContextId,
  meetingRecordUuidFromContextId,
  MEETING_RECORD_ID_PREFIX,
} from './admin-meeting-context-items'

describe('admin-meeting-context-items', () => {
  it('prefixes meeting_record ids and maps rows', () => {
    const rows = [
      {
        id: 'abc-123',
        meeting_type: 'discovery_call',
        meeting_date: '2026-04-01T12:00:00.000Z',
        summary: 'Hello',
      },
    ]
    const [m] = mapDbMeetingRowsToContextItems(rows)
    expect(m.id).toBe(`${MEETING_RECORD_ID_PREFIX}abc-123`)
    expect(m.title).toBe('discovery call')
    expect(m.platform).toBe('record')
    expect(m.summary).toBe('Hello')
    expect(isMeetingRecordContextId(m.id)).toBe(true)
    expect(meetingRecordUuidFromContextId(m.id)).toBe('abc-123')
  })

  it('merges db first then read-ai', () => {
    const db = mapDbMeetingRowsToContextItems([
      {
        id: 'u1',
        meeting_type: 'a',
        meeting_date: '2026-01-01T00:00:00.000Z',
        summary: null,
      },
    ])
    const read = [
      {
        id: 'r1',
        title: 'Read',
        start_time_ms: 1,
        end_time_ms: null,
        participants: [],
        platform: 'zoom',
        report_url: '',
        summary: null,
        action_items: null,
      },
    ]
    const merged = mergeDbFirstWithReadAi(db, read)
    expect(merged[0].id.startsWith(MEETING_RECORD_ID_PREFIX)).toBe(true)
    expect(merged[1].id).toBe('r1')
  })
})
