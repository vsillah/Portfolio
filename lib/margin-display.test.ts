import { describe, expect, it } from 'vitest'
import {
  formatMarginDollar,
  formatMarginPercent,
  formatRatio,
  getRatioBadgeVariant,
  getRatioColor,
} from './margin-display'

describe('formatMarginPercent', () => {
  it('returns N/A when price is zero or negative', () => {
    expect(formatMarginPercent(0, 100)).toBe('N/A')
    expect(formatMarginPercent(-1, 100)).toBe('N/A')
  })

  it('formats rounded margin percent for valid price/cost', () => {
    expect(formatMarginPercent(100, 39)).toBe('61%')
  })
})

describe('formatMarginDollar', () => {
  it('formats positive and negative margin dollar values', () => {
    expect(formatMarginDollar(100, 40)).toBe('$60.00')
    expect(formatMarginDollar(100, 120)).toBe('-$20.00')
  })
})

describe('formatRatio', () => {
  it('returns N/A for invalid denominator or negative gross profit', () => {
    expect(formatRatio(100, 0)).toBe('N/A')
    expect(formatRatio(-1, 10)).toBe('N/A')
  })

  it('formats to one decimal place when ratio is valid', () => {
    expect(formatRatio(10, 3)).toBe('3.3:1')
    expect(formatRatio(8, 2)).toBe('4:1')
  })
})

describe('getRatioColor', () => {
  it('maps ratio thresholds to the expected color classes', () => {
    expect(getRatioColor(null)).toBe('text-platinum-white/70')
    expect(getRatioColor(5)).toBe('text-radiant-gold')
    expect(getRatioColor(3)).toBe('text-amber-400')
    expect(getRatioColor(2.9)).toBe('text-red-400')
  })
})

describe('getRatioBadgeVariant', () => {
  it('maps ratio thresholds to badge variants', () => {
    expect(getRatioBadgeVariant(null)).toBe('secondary')
    expect(getRatioBadgeVariant(5)).toBe('default')
    expect(getRatioBadgeVariant(3)).toBe('secondary')
    expect(getRatioBadgeVariant(2.9)).toBe('destructive')
  })
})
