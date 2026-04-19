import { describe, expect, it } from 'vitest'
import {
  collectQuickWinTitlesFromMeetingRows,
  countResolvableActionItems,
  normalizeActionItemsFromUnknownList,
  resolveActionItemsRawList,
} from './meeting-action-items-resolve'

describe('normalizeActionItemsFromUnknownList', () => {
  it('accepts text-only objects (Read.ai)', () => {
    expect(normalizeActionItemsFromUnknownList([{ text: 'Follow up' }])).toEqual([
      expect.objectContaining({ title: 'Follow up', owner: null }),
    ])
  })

  it('uses action and title fallbacks', () => {
    expect(normalizeActionItemsFromUnknownList([{ action: 'A' }, { title: 'B' }])).toEqual([
      expect.objectContaining({ title: 'A' }),
      expect.objectContaining({ title: 'B' }),
    ])
  })

  it('maps assignee to owner', () => {
    expect(
      normalizeActionItemsFromUnknownList([{ text: 'Do thing', assignee: 'Jane' }])
    ).toEqual([expect.objectContaining({ title: 'Do thing', owner: 'Jane' })])
  })

  it('prefers owner over assignee when both set', () => {
    expect(
      normalizeActionItemsFromUnknownList([{ text: 'X', owner: 'Primary', assignee: 'Secondary' }])
    ).toEqual([expect.objectContaining({ owner: 'Primary' })])
  })

  it('handles string elements', () => {
    expect(normalizeActionItemsFromUnknownList(['  a  ', 'b'])).toEqual([
      expect.objectContaining({ title: 'a' }),
      expect.objectContaining({ title: 'b' }),
    ])
  })
})

describe('resolveActionItemsRawList', () => {
  it('uses row action_items when present', () => {
    const raw = resolveActionItemsRawList({
      action_items: [{ text: 'From row' }],
      structured_notes: { action_items: [{ text: 'From notes' }] },
      key_decisions: ['KD'],
    })
    expect(normalizeActionItemsFromUnknownList(raw).map((x) => x.title)).toEqual(['From row'])
  })

  it('falls back to structured_notes.action_items when row empty', () => {
    const raw = resolveActionItemsRawList({
      action_items: [],
      structured_notes: { action_items: [{ text: 'From notes' }] },
      key_decisions: ['KD'],
    })
    expect(normalizeActionItemsFromUnknownList(raw).map((x) => x.title)).toEqual(['From notes'])
  })

  it('falls back to key_decisions when row and notes empty', () => {
    const raw = resolveActionItemsRawList({
      action_items: [],
      structured_notes: { action_items: [] },
      key_decisions: ['One', 'Two'],
    })
    expect(normalizeActionItemsFromUnknownList(raw).map((x) => x.title)).toEqual(['One', 'Two'])
  })

  it('parses structured_notes JSON string', () => {
    const raw = resolveActionItemsRawList({
      action_items: null,
      structured_notes: JSON.stringify({ action_items: [{ title: 'Parsed' }] }),
      key_decisions: [],
    })
    expect(normalizeActionItemsFromUnknownList(raw).map((x) => x.title)).toEqual(['Parsed'])
  })
})

describe('collectQuickWinTitlesFromMeetingRows', () => {
  it('dedupes across meetings and respects maxLines', () => {
    const titles = collectQuickWinTitlesFromMeetingRows(
      [
        { action_items: [{ text: 'Shared' }, { text: 'Only A' }] },
        { action_items: [{ text: 'Shared' }, { text: 'Only B' }] },
      ],
      { maxLines: 3 }
    )
    expect(titles).toEqual(['Shared', 'Only A', 'Only B'])
  })
})

describe('countResolvableActionItems', () => {
  it('counts resolved items', () => {
    expect(
      countResolvableActionItems({
        action_items: [{ text: 'A' }, { text: 'B' }],
      })
    ).toBe(2)
  })
})
