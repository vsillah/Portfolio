import { describe, expect, it } from 'vitest'
import { isLikelyOrganization } from './lead-filters'

describe('isLikelyOrganization', () => {
  it.each([
    ['Acme LLC'],
    ['Riverbend Technologies'],
    ['Neighborhood Official Page'],
    ['ACME'],
  ])('classifies organization-style names as non-person leads: %s', (name) => {
    expect(isLikelyOrganization(name)).toBe(true)
  })

  it('treats a blank name as non-person lead input', () => {
    expect(isLikelyOrganization('   ')).toBe(true)
  })

  it.each([
    ['Jane Smith'],
    ['Robert Acme'],
    ['Mary Page'],
  ])('allows ordinary person-style names through ingest: %s', (name) => {
    expect(isLikelyOrganization(name)).toBe(false)
  })

  it('classifies name-company exact matches as organizations only when the value looks like an organization', () => {
    expect(isLikelyOrganization('Acme LLC', 'acme llc')).toBe(true)
    expect(isLikelyOrganization('Jane Smith', ' Jane Smith ')).toBe(false)
  })
})
