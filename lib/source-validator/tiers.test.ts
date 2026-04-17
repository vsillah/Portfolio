import { describe, it, expect } from 'vitest'
import {
  classifyTier,
  extractHostname,
  isFetchDenylisted,
  inferDomainType,
} from './tiers'

describe('extractHostname', () => {
  it('returns lowercase hostname for valid URL', () => {
    expect(extractHostname('https://WWW.BLS.GOV/data.html')).toBe('www.bls.gov')
  })

  it('returns null for invalid URL', () => {
    expect(extractHostname('not a url')).toBe(null)
  })

  it('returns null for null/empty input', () => {
    expect(extractHostname(null)).toBe(null)
    expect(extractHostname('')).toBe(null)
  })
})

describe('classifyTier', () => {
  it('classifies .gov URL as Tier 1', () => {
    const r = classifyTier('https://www.bls.gov/oes/current.htm', null)
    expect(r.tier).toBe(1)
    expect(r.matched_on).toBe('host')
  })

  it('classifies .edu URL as Tier 1', () => {
    const r = classifyTier('https://research.harvard.edu/study', null)
    expect(r.tier).toBe(1)
  })

  it('classifies Gartner URL as Tier 2', () => {
    const r = classifyTier('https://www.gartner.com/en/research/report', null)
    expect(r.tier).toBe(2)
    expect(r.label).toBe('Gartner')
  })

  it('classifies "BLS" free text as Tier 1 when no URL', () => {
    const r = classifyTier(null, 'BLS Manufacturing Wage Data')
    expect(r.tier).toBe(1)
    expect(r.matched_on).toBe('free_text')
  })

  it('classifies "Gartner" free text as Tier 2', () => {
    const r = classifyTier(null, 'Gartner Market Guide 2025')
    expect(r.tier).toBe(2)
  })

  it('classifies "Glassdoor" free text as Tier 3', () => {
    const r = classifyTier(null, 'Glassdoor Finance Salary Report')
    expect(r.tier).toBe(3)
  })

  it('classifies "Industry estimate" as Tier 5 (low trust)', () => {
    const r = classifyTier(null, 'Industry estimate')
    expect(r.tier).toBe(5)
    expect(r.label).toMatch(/low-trust/i)
  })

  it('falls back to Tier 5 for unknown sources', () => {
    const r = classifyTier(null, 'Some random consulting firm nobody has heard of')
    expect(r.tier).toBe(5)
    expect(r.matched_on).toBe('default')
  })

  it('prefers host match over free-text at same tier', () => {
    // Both match Tier 1; host wins.
    const r = classifyTier('https://www.bls.gov/x', 'BLS report')
    expect(r.matched_on).toBe('host')
  })

  it('picks lowest tier across multiple matches', () => {
    // "BLS" is T1, URL domain is T2 example - ensure T1 wins.
    const r = classifyTier('https://www.gartner.com/x', 'BLS national data')
    expect(r.tier).toBe(1)
  })
})

describe('isFetchDenylisted', () => {
  it('denylists social / paywalled hosts', () => {
    expect(isFetchDenylisted('facebook.com')).toBe(true)
    expect(isFetchDenylisted('www.linkedin.com')).toBe(true)
    expect(isFetchDenylisted('x.com')).toBe(true)
  })

  it('allows normal hosts', () => {
    expect(isFetchDenylisted('www.bls.gov')).toBe(false)
    expect(isFetchDenylisted('www.gartner.com')).toBe(false)
  })

  it('returns false for null host', () => {
    expect(isFetchDenylisted(null)).toBe(false)
  })
})

describe('inferDomainType', () => {
  it('maps T1 to government', () => {
    expect(inferDomainType('www.bls.gov', null)).toBe('government')
  })

  it('maps T2 to analyst', () => {
    expect(inferDomainType('www.gartner.com', null)).toBe('analyst')
  })

  it('maps T3 to trade', () => {
    expect(inferDomainType(null, 'Glassdoor')).toBe('trade')
  })

  it('maps T4 to press', () => {
    expect(inferDomainType('www.ft.com', null)).toBe('press')
  })

  it('maps unclassified to general', () => {
    expect(inferDomainType('unknown.example', null)).toBe('general')
  })
})
