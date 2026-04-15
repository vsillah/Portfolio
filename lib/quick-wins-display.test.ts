import { describe, expect, it } from 'vitest'
import {
  formatQuickWinsForDisplay,
  quickWinsToEditableString,
  quickWinsToLines,
  sanitizeQuickWinsString,
} from './quick-wins-display'

describe('sanitizeQuickWinsString', () => {
  it('drops bullet-undefined lines', () => {
    expect(
      sanitizeQuickWinsString('--- Meeting ---\n• undefined\n• Real win\n• undefined')
    ).toBe('--- Meeting ---\n• Real win')
  })
})

describe('formatQuickWinsForDisplay', () => {
  it('formats jsonb array of objects with action/title', () => {
    expect(
      formatQuickWinsForDisplay([{ action: 'Do A' }, { title: 'Do B' }])
    ).toBe('• Do A\n• Do B')
  })

  it('handles { items: [...] } wrapper', () => {
    expect(formatQuickWinsForDisplay({ items: ['One', 'Two'] })).toBe('• One\n• Two')
  })

  it('returns null for empty after sanitize', () => {
    expect(formatQuickWinsForDisplay('• undefined\n• undefined')).toBe(null)
  })
})

describe('quickWinsToEditableString', () => {
  it('stringifies array for editing', () => {
    expect(quickWinsToEditableString(['a', 'b'])).toBe('• a\n• b')
  })
})

describe('quickWinsToLines', () => {
  it('strips bullets and splits', () => {
    expect(quickWinsToLines('• First\n• Second')).toEqual(['First', 'Second'])
  })
})
