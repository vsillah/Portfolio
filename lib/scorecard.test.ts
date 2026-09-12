import { describe, expect, it } from 'vitest'
import {
  SCORECARD_QUESTIONS,
  getScoreBand,
  getSelectedOption,
  rawScoreToTen,
} from './scorecard'

const MAX_RAW = SCORECARD_QUESTIONS.reduce(
  (sum, q) => sum + Math.max(...q.options.map((o) => o.points)),
  0,
)

describe('rawScoreToTen', () => {
  it('maps zero and a perfect raw score onto 0 and 10', () => {
    expect(rawScoreToTen(0)).toBe(0)
    expect(rawScoreToTen(MAX_RAW)).toBe(10)
  })

  it('clamps out-of-range raw scores onto the 0–10 display scale', () => {
    expect(rawScoreToTen(-20)).toBe(0)
    expect(rawScoreToTen(MAX_RAW * 4)).toBe(10)
  })

  it('rounds the normalized score to one decimal place', () => {
    expect(rawScoreToTen(MAX_RAW / 2)).toBe(5)
  })
})

describe('getScoreBand', () => {
  it('uses exclusive upper bounds for getting_started and building', () => {
    expect(getScoreBand(0)).toBe('getting_started')
    expect(getScoreBand(3.9)).toBe('getting_started')
    expect(getScoreBand(4)).toBe('building')
    expect(getScoreBand(6.9)).toBe('building')
    expect(getScoreBand(7)).toBe('ready')
    expect(getScoreBand(10)).toBe('ready')
  })
})

describe('getSelectedOption', () => {
  it('returns the option matching question id and points', () => {
    expect(getSelectedOption('data', 3)).toEqual({
      value: 'ready',
      label: 'Clean, structured, and accessible for automation',
    })
  })

  it('returns null for an unknown question or unmatched points', () => {
    expect(getSelectedOption('not-a-question', 1)).toBeNull()
    expect(getSelectedOption('data', 99)).toBeNull()
  })
})
