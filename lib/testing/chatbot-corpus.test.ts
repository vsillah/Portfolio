import { describe, expect, it } from 'vitest'
import { CHATBOT_TEST_QUESTIONS, QUESTION_CATEGORIES, TOTAL_QUESTION_COUNT } from './chatbot-questions'

describe('chatbot evaluation corpus integrity', () => {
  it('keeps questions attributable to a unique id and declared category', () => {
    const ids = CHATBOT_TEST_QUESTIONS.map(q => q.id)
    const categories = new Set(QUESTION_CATEGORIES.map(c => c.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(TOTAL_QUESTION_COUNT).toBe(ids.length)
    expect(CHATBOT_TEST_QUESTIONS.every(q => q.question.trim() && categories.has(q.category))).toBe(true)
    expect(QUESTION_CATEGORIES.every(c => CHATBOT_TEST_QUESTIONS.some(q => q.category === c.id))).toBe(true)
  })

  it('keeps flagged boundary and diagnostic prompts distinct and reviewable', () => {
    expect(CHATBOT_TEST_QUESTIONS.filter(q => q.expectsBoundary).every(q => q.tags.length > 0)).toBe(true)
    expect(CHATBOT_TEST_QUESTIONS.filter(q => q.triggersDiagnostic).every(q => q.tags.length > 0)).toBe(true)
  })
})
