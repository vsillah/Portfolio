import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: null,
}))

vi.mock('@/lib/client-update-drafts', () => ({
  createDraftDirect: vi.fn(),
}))

vi.mock('@/lib/email-messages', () => ({
  insertEmailMessageFromCommunication: vi.fn(),
}))

vi.mock('@/lib/meeting-action-tasks', () => ({
  promoteActionItems: vi.fn(),
}))

vi.mock('@/lib/read-ai', () => ({
  getMeetingDetail: vi.fn(),
}))

import {
  buildReadAiMeetingRecordPayload,
  normalizeReadAiActionItems,
  normalizeReadAiTranscript,
} from './read-ai-follow-up-import'

describe('read-ai follow-up import helpers', () => {
  it('normalizes transcript text from the direct Read.ai shape', () => {
    const text = normalizeReadAiTranscript({
      transcript: { text: 'Neil: Can we adjust the template?\nVambah: Yes.' },
    })

    expect(text).toBe('Neil: Can we adjust the template?\nVambah: Yes.')
  })

  it('normalizes transcript speaker blocks when Read.ai returns segmented transcript data', () => {
    const text = normalizeReadAiTranscript({
      transcript: {
        speaker_blocks: [
          { speaker_name: 'Neil', text: 'The homepage images feel too boxed in.' },
          { speaker_name: 'Vambah', words: [{ text: 'We' }, { text: 'can' }, { text: 'soften' }, { text: 'that.' }] },
        ],
      },
    })

    expect(text).toBe('Neil: The homepage images feel too boxed in.\nVambah: We can soften that.')
  })

  it('normalizes mixed Read.ai action item shapes', () => {
    expect(normalizeReadAiActionItems([
      'Send FireSpring the first revision packet.',
      { action: 'Replace placeholder yoga image.', owner: 'Neil' },
      { title: 'Confirm donation link targets.', assignee: 'Vambah' },
      { text: 'Review logo options with the board.' },
      { ignored: true },
    ])).toEqual([
      { text: 'Send FireSpring the first revision packet.' },
      { text: 'Replace placeholder yoga image.', assignee: 'Neil' },
      { text: 'Confirm donation link targets.', assignee: 'Vambah' },
      { text: 'Review logo options with the board.' },
    ])
  })

  it('builds a meeting_records payload with Portfolio follow-up provenance', () => {
    const payload = buildReadAiMeetingRecordPayload(
      {
        id: 'read-ai-1',
        title: 'Neil Rhein and Vambah Sillah',
        start_time_ms: Date.parse('2026-06-18T14:00:00.000Z'),
        end_time_ms: Date.parse('2026-06-18T14:45:00.000Z'),
        participants: [
          { name: 'Neil Rhein', email: 'neil@keepmassbeautiful.org', attended: true },
        ],
        owner: { name: 'Vambah Sillah', email: 'vambah@example.com' },
        report_url: 'https://app.read.ai/analytics/meetings/01KVDTBWZYQ48J06DD303PAVGD',
        platform: 'google_meet',
        summary: 'Discussed FireSpring proof-site revision requests.',
        action_items: [{ text: 'Send consolidated feedback to FireSpring.', assignee: 'Vambah' }],
        transcript: { text: 'Transcript text' },
      },
      {
        readAiMeetingId: '01KVDTBWZYQ48J06DD303PAVGD',
        contactName: 'Neil Rhein',
        contactEmail: 'neil@keepmassbeautiful.org',
        company: 'Keep Massachusetts Beautiful',
        projectName: 'KMB FireSpring web migration',
        draft: {
          subject: 'KMB Balance Proof Site - Round 1 Revision Requests',
          body: 'Draft body',
          gmailDraftId: 'gmail-draft-1',
          gmailThreadId: 'gmail-thread-1',
        },
      },
    )

    expect(payload).toMatchObject({
      read_ai_meeting_id: '01KVDTBWZYQ48J06DD303PAVGD',
      meeting_type: 'client_follow_up',
      meeting_date: '2026-06-18T14:00:00.000Z',
      duration_minutes: 45,
      transcript: 'Transcript text',
      action_items: [{ text: 'Send consolidated feedback to FireSpring.', assignee: 'Vambah' }],
      structured_notes: {
        title: 'Neil Rhein and Vambah Sillah',
        summary: 'Discussed FireSpring proof-site revision requests.',
        project_name: 'KMB FireSpring web migration',
        source: 'read_ai_follow_up_import',
      },
      meeting_data: {
        read_ai_meeting_id: '01KVDTBWZYQ48J06DD303PAVGD',
        gmail_draft_id: 'gmail-draft-1',
        gmail_thread_id: 'gmail-thread-1',
        source: 'read_ai_follow_up_import',
      },
    })
  })
})
