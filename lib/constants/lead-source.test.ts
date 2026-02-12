import { describe, it, expect } from 'vitest'
import {
  LEAD_SOURCE_VALUES,
  isWarmLeadSource,
  isColdLeadSource,
  leadSourceFromInputType,
  INPUT_TYPE_TO_LEAD_SOURCE,
  isAllowedLeadSourceForIngest,
  getRelationshipStrength,
} from './lead-source'

describe('lead-source constants', () => {
  it('LEAD_SOURCE_VALUES includes expected warm and cold and other', () => {
    expect(LEAD_SOURCE_VALUES).toContain('warm_facebook_friends')
    expect(LEAD_SOURCE_VALUES).toContain('cold_referral')
    expect(LEAD_SOURCE_VALUES).toContain('website_form')
    expect(LEAD_SOURCE_VALUES).toContain('other')
  })

  it('isWarmLeadSource returns true only for warm_*', () => {
    expect(isWarmLeadSource('warm_facebook_friends')).toBe(true)
    expect(isWarmLeadSource('warm_linkedin')).toBe(true)
    expect(isWarmLeadSource('cold_referral')).toBe(false)
    expect(isWarmLeadSource('other')).toBe(false)
    expect(isWarmLeadSource('')).toBe(false)
    expect(isWarmLeadSource(null)).toBe(false)
    expect(isWarmLeadSource(undefined)).toBe(false)
  })

  it('isColdLeadSource returns true only for cold_*', () => {
    expect(isColdLeadSource('cold_referral')).toBe(true)
    expect(isColdLeadSource('cold_linkedin')).toBe(true)
    expect(isColdLeadSource('warm_facebook_friends')).toBe(false)
    expect(isColdLeadSource('other')).toBe(false)
    expect(isColdLeadSource('website_form')).toBe(false)
    expect(isColdLeadSource(null)).toBe(false)
  })

  it('leadSourceFromInputType maps known input types', () => {
    expect(leadSourceFromInputType('linkedin')).toBe('cold_linkedin')
    expect(leadSourceFromInputType('referral')).toBe('cold_referral')
    expect(leadSourceFromInputType('business_card')).toBe('cold_business_card')
    expect(leadSourceFromInputType('event')).toBe('cold_event')
    expect(leadSourceFromInputType('other')).toBe('other')
  })

  it('leadSourceFromInputType defaults to cold_referral for unknown', () => {
    expect(leadSourceFromInputType(undefined)).toBe('cold_referral')
    expect(leadSourceFromInputType('unknown')).toBe('cold_referral')
  })

  it('INPUT_TYPE_TO_LEAD_SOURCE values are in LEAD_SOURCE_VALUES', () => {
    for (const value of Object.values(INPUT_TYPE_TO_LEAD_SOURCE)) {
      expect(LEAD_SOURCE_VALUES).toContain(value)
    }
  })

  it('isAllowedLeadSourceForIngest includes warm and cold prefixes only', () => {
    expect(isAllowedLeadSourceForIngest('warm_linkedin')).toBe(true)
    expect(isAllowedLeadSourceForIngest('cold_referral')).toBe(true)
    expect(isAllowedLeadSourceForIngest('other')).toBe(false)
    expect(isAllowedLeadSourceForIngest('website_form')).toBe(false)
  })

  it('getRelationshipStrength returns strong for warm_facebook_friends, warm_google_contacts, warm_linkedin', () => {
    expect(getRelationshipStrength('warm_facebook_friends')).toBe('strong')
    expect(getRelationshipStrength('warm_google_contacts')).toBe('strong')
    expect(getRelationshipStrength('warm_linkedin')).toBe('strong')
  })

  it('getRelationshipStrength returns moderate for warm_referral', () => {
    expect(getRelationshipStrength('warm_referral')).toBe('moderate')
  })

  it('getRelationshipStrength returns weak for cold and other', () => {
    expect(getRelationshipStrength('cold_referral')).toBe('weak')
    expect(getRelationshipStrength('other')).toBe('weak')
    expect(getRelationshipStrength('website_form')).toBe('weak')
  })
})
