import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: null,
}))

import {
  formatMeetingActionItemsBlock,
  applyMeetingActionItemsPlaceholders,
  loadOpenOutreachTasksForContact,
  type MeetingActionItemContext,
} from './meeting-tasks-context'

const task = (over: Partial<MeetingActionItemContext> = {}): MeetingActionItemContext => ({
  id: 'task-1',
  title: 'Send updated proposal',
  status: 'pending',
  due_date: null,
  created_at: '2026-04-10T00:00:00Z',
  ...over,
})

describe('formatMeetingActionItemsBlock', () => {
  it('returns null for empty list (so callers can hide the section)', () => {
    expect(formatMeetingActionItemsBlock([])).toBeNull()
  })

  it('formats a single task without a due date', () => {
    expect(formatMeetingActionItemsBlock([task({ title: 'Share case study' })])).toBe(
      '- Share case study'
    )
  })

  it('formats a task with a due date', () => {
    const block = formatMeetingActionItemsBlock([
      task({ title: 'Send revised pricing', due_date: '2026-04-20T00:00:00Z' }),
    ])
    // Locale-formatted; verify it contains both the title and a recognizable date
    expect(block).toContain('Send revised pricing')
    expect(block).toMatch(/\(due .+\)/)
  })

  it('formats multiple tasks as bullet list in provided order', () => {
    const block = formatMeetingActionItemsBlock([
      task({ id: 'a', title: 'First' }),
      task({ id: 'b', title: 'Second' }),
    ])
    expect(block).toBe('- First\n- Second')
  })

  it('trims titles', () => {
    expect(formatMeetingActionItemsBlock([task({ title: '   Trimmed  ' })])).toBe(
      '- Trimmed'
    )
  })
})

describe('applyMeetingActionItemsPlaceholders', () => {
  const TEMPLATE = `Intro line.
{{#meeting_action_items}}

## Open Action Items
Reference one if useful.
{{meeting_action_items}}
{{/meeting_action_items}}

Outro line.`

  it('keeps the section and injects bullets when block is non-null', () => {
    const out = applyMeetingActionItemsPlaceholders(TEMPLATE, '- Task A\n- Task B')
    expect(out).toContain('## Open Action Items')
    expect(out).toContain('- Task A')
    expect(out).toContain('- Task B')
    expect(out).not.toContain('{{')
  })

  it('removes the entire sentinel block when block is null (no dangling header)', () => {
    const out = applyMeetingActionItemsPlaceholders(TEMPLATE, null)
    expect(out).not.toContain('## Open Action Items')
    expect(out).not.toContain('{{')
    expect(out).toContain('Intro line.')
    expect(out).toContain('Outro line.')
  })

  it('replaces bare {{meeting_action_items}} outside sentinels when block is provided', () => {
    const bare = 'Before {{meeting_action_items}} After'
    expect(applyMeetingActionItemsPlaceholders(bare, '- X')).toBe('Before - X After')
  })

  it('replaces bare {{meeting_action_items}} with empty string when block is null', () => {
    const bare = 'Before {{meeting_action_items}} After'
    expect(applyMeetingActionItemsPlaceholders(bare, null)).toBe('Before  After')
  })

  it('is a no-op on prompts with no placeholders', () => {
    const noPlaceholders = 'Hello world.'
    expect(applyMeetingActionItemsPlaceholders(noPlaceholders, '- A')).toBe('Hello world.')
    expect(applyMeetingActionItemsPlaceholders(noPlaceholders, null)).toBe('Hello world.')
  })

  it('handles multiple sentinel blocks (rare but should not break)', () => {
    const twice = '{{#meeting_action_items}}A{{/meeting_action_items}}-{{#meeting_action_items}}B{{/meeting_action_items}}'
    expect(applyMeetingActionItemsPlaceholders(twice, '- x')).toBe('A-B')
    expect(applyMeetingActionItemsPlaceholders(twice, null)).toBe('-')
  })
})

describe('loadOpenOutreachTasksForContact', () => {
  it('returns [] when supabaseAdmin is not configured (test env)', async () => {
    // supabaseAdmin is mocked to null above; the helper should short-circuit.
    const tasks = await loadOpenOutreachTasksForContact(123)
    expect(tasks).toEqual([])
  })

  it('returns [] for invalid contactId (defensive)', async () => {
    expect(await loadOpenOutreachTasksForContact(0)).toEqual([])
    expect(await loadOpenOutreachTasksForContact(-1)).toEqual([])
  })
})
