import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  mockSupabaseAdmin,
  mockFrom,
  mockCategoriesSelect,
  mockCategoriesEq,
  mockEvidenceInsert,
  mockRefreshCategoryStats,
  mockLinkEvidenceToCalculations,
} = vi.hoisted(() => {
  const mockCategoriesEq = vi.fn()
  const mockCategoriesSelect = vi.fn(() => ({ eq: mockCategoriesEq }))
  const mockEvidenceInsert = vi.fn()
  const mockFrom = vi.fn((table: string) => {
    if (table === 'pain_point_categories') {
      return { select: mockCategoriesSelect }
    }
    if (table === 'pain_point_evidence') {
      return { insert: mockEvidenceInsert }
    }
    throw new Error(`Unexpected table in test mock: ${table}`)
  })

  const mockSupabaseAdmin = { from: mockFrom }
  const mockRefreshCategoryStats = vi.fn(() => Promise.resolve())
  const mockLinkEvidenceToCalculations = vi.fn(() => Promise.resolve())

  return {
    mockSupabaseAdmin,
    mockFrom,
    mockCategoriesSelect,
    mockCategoriesEq,
    mockEvidenceInsert,
    mockRefreshCategoryStats,
    mockLinkEvidenceToCalculations,
  }
})

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}))

vi.mock('@/lib/value-evidence-linker', () => ({
  refreshCategoryStats: mockRefreshCategoryStats,
  linkEvidenceToCalculations: mockLinkEvidenceToCalculations,
}))

import {
  splitIntoItems,
  classifyMeetingPainPoints,
  insertClassifiedEvidence,
} from './meeting-pain-classifier'

describe('meeting-pain-classifier', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    mockFrom.mockClear()
    mockCategoriesSelect.mockClear()
    mockCategoriesEq.mockClear()
    mockEvidenceInsert.mockClear()
    mockRefreshCategoryStats.mockClear()
    mockLinkEvidenceToCalculations.mockClear()
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  it('splitIntoItems parses bullets/numbered lines and ignores meeting headers', () => {
    const text = `
--- From meeting: Discovery call
- Manual data entry takes hours every week
Still typing into multiple systems.

2) Follow up messages are inconsistent across the team
Leads keep falling through the cracks.

short
* Need one source of truth for customer data
`

    const items = splitIntoItems(text)

    expect(items).toEqual([
      'Manual data entry takes hours every week Still typing into multiple systems.',
      'Follow up messages are inconsistent across the team Leads keep falling through the cracks.',
      'Need one source of truth for customer data',
    ])
  })

  it('classifies keyword matches and leaves unmatched items unclassified when AI is unavailable', async () => {
    delete process.env.OPENAI_API_KEY
    mockCategoriesEq.mockResolvedValueOnce({
      data: [
        {
          id: 'cat-manual',
          name: 'manual_processes',
          display_name: 'Manual Processes',
          description: 'Manual repetitive work',
        },
      ],
      error: null,
    })

    const result = await classifyMeetingPainPoints(
      '- We still do manual data entry and repetitive copy paste between systems',
      '- Team morale needs improvement and better office snacks'
    )

    expect(result.classified).toHaveLength(1)
    expect(result.classified[0]).toMatchObject({
      categoryId: 'cat-manual',
      categoryName: 'manual_processes',
      method: 'keyword',
    })
    expect(result.unclassified).toEqual([
      'Team morale needs improvement and better office snacks',
    ])
  })

  it('insertClassifiedEvidence truncates long excerpts and runs downstream updates once per category', async () => {
    mockEvidenceInsert.mockResolvedValue({ error: null })
    const longText = `A${'x'.repeat(600)}`

    const result = await insertClassifiedEvidence(
      [
        {
          text: longText,
          categoryId: 'cat-1',
          categoryName: 'manual_processes',
          categoryDisplayName: 'Manual Processes',
          confidence: 0.8,
          method: 'keyword',
        },
        {
          text: 'Second item in same category',
          categoryId: 'cat-1',
          categoryName: 'manual_processes',
          categoryDisplayName: 'Manual Processes',
          confidence: 0.7,
          method: 'ai',
        },
        {
          text: 'Different category item',
          categoryId: 'cat-2',
          categoryName: 'inconsistent_followup',
          categoryDisplayName: 'Inconsistent Follow Up',
          confidence: 0.9,
          method: 'keyword',
        },
      ],
      321
    )

    expect(result.inserted).toBe(3)
    expect(result.errors).toEqual([])
    expect(result.affectedCategoryIds.sort()).toEqual(['cat-1', 'cat-2'])

    const firstInsertPayload = mockEvidenceInsert.mock.calls[0][0]
    expect(firstInsertPayload.source_id).toBe('321')
    expect(firstInsertPayload.source_excerpt).toHaveLength(500)
    expect(firstInsertPayload.source_excerpt.endsWith('...')).toBe(true)

    expect(mockRefreshCategoryStats).toHaveBeenCalledTimes(2)
    expect(mockLinkEvidenceToCalculations).toHaveBeenCalledTimes(2)
  })
})
