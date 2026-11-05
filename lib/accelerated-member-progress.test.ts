import { describe, expect, it } from 'vitest'
import { DECISION_FILE_VERSION, emptyDecisionFile } from './accelerated-decision-file'
import { validateLearningState } from './accelerated-member-progress'

const state = () => ({
  version: DECISION_FILE_VERSION,
  worksheet: emptyDecisionFile('6c51b755-86b4-4f11-a2f7-5e9f1430d0e0'),
  completed: ['L01'],
  videoSeconds: { L01: 120 },
  currentLessonId: 'L02',
  updatedAt: new Date().toISOString(),
})

describe('member progress validation', () => {
  it('accepts a version-bound guest snapshot', () => expect(validateLearningState(state()).ok).toBe(true))
  it('rejects stale and foreign course versions', () => {
    expect(validateLearningState({ ...state(), version: 'older' }).ok).toBe(false)
    expect(validateLearningState({ ...state(), updatedAt: '2020-01-01T00:00:00Z' }).ok).toBe(false)
  })
  it('rejects malformed lesson and video evidence', () => {
    expect(validateLearningState({ ...state(), completed: ['L01', 'L01'] }).ok).toBe(false)
    expect(validateLearningState({ ...state(), videoSeconds: { L17: 5 } }).ok).toBe(false)
    expect(validateLearningState({ ...state(), videoSeconds: { L01: -5 } }).ok).toBe(false)
  })
  it('rejects a worksheet with a mismatched version', () => {
    expect(validateLearningState({ ...state(), worksheet: { ...state().worksheet, version: 'older' } }).ok).toBe(false)
  })
})
