import { describe, expect, it } from 'vitest'
import { AGENTIFIED_VERSION, agentifiedActs, agentifiedLessons, emptyAgentifiedDraft, validateAgentifiedDraft, validateAgentifiedState } from './agentified-workshop'

const worksheetId = '153d6a83-0bcc-47eb-b761-03a2f85c204d'
const state = () => ({ version: AGENTIFIED_VERSION, worksheet: emptyAgentifiedDraft(worksheetId), completed: ['L01'], videoSeconds: {}, currentLessonId: 'L02', updatedAt: new Date().toISOString() })

describe('Agentified workshop contract', () => {
  it('binds sixteen distinct lessons to the approved acts and five plates', () => {
    expect(agentifiedLessons.map((lesson) => lesson.id)).toEqual(Array.from({ length: 16 }, (_, i) => `L${String(i + 1).padStart(2, '0')}`))
    expect(agentifiedActs).toEqual(['The Harness', 'Authority', 'The Agentified Organization', 'Synthesis and capstone'])
    expect(new Set(agentifiedLessons.flatMap((lesson) => lesson.visuals.map((visual) => visual.src))).size).toBe(5)
    expect(agentifiedLessons.every((lesson) => lesson.outputs.length > 0 && lesson.exercise.length > 0)).toBe(true)
  })
  it('rejects stale versions, foreign lesson IDs, oversized responses, and stale claims', () => {
    expect(validateAgentifiedState(state()).ok).toBe(true)
    expect(validateAgentifiedState({ ...state(), version: 'accelerated-l01-l16-ed73dee7' }).ok).toBe(false)
    expect(validateAgentifiedState({ ...state(), completed: ['L17'] }).ok).toBe(false)
    expect(validateAgentifiedState({ ...state(), updatedAt: '2025-01-01T00:00:00Z' }).ok).toBe(false)
    expect(validateAgentifiedDraft({ ...emptyAgentifiedDraft(worksheetId), answers: { L01: 'a'.repeat(4001) } }).ok).toBe(false)
  })
})
