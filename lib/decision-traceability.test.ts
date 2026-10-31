import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeAttribution, scoreTrace } from './decision-traceability'

const answers = { reason: 2, owner: 0, threshold: 1, evidence: 2 }

describe('decision traceability contract', () => {
  it('scores only complete bounded answers and names the weakest check', () => {
    expect(scoreTrace(answers)).toMatchObject({ total: 5, weakest: 'owner' })
    expect(scoreTrace({ ...answers, owner: 3 })).toBeNull()
    expect(scoreTrace({ reason: 1 })).toBeNull()
    expect(scoreTrace({ ...answers, secret: 'private' })).toBeNull()
  })

  it('accepts only bounded UTM values and does not accept arbitrary keys', () => {
    expect(normalizeAttribution({ utm_source: 'linkedin', utm_campaign: 'dark-castle' })).toMatchObject({ utm_source: 'linkedin', utm_campaign: 'dark-castle' })
    expect(normalizeAttribution({ utm_source: 'https://private.example/?token=abc' })).toBeNull()
    expect(normalizeAttribution({ email: 'private@example.com' })).toBeNull()
  })

  it('keeps the migration private and rejects duplicate campaign emails', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261031120000_decision_traceability_leads.sql'), 'utf8')
    expect(sql).toMatch(/unique \(campaign, email\)/)
    expect(sql).toMatch(/submission_key uuid not null unique/)
    expect(sql).toMatch(/enable row level security/)
    expect(sql).toMatch(/revoke all .* from public, anon, authenticated/)
    expect(sql).toMatch(/grant select, insert .* to service_role/)
    expect(sql).not.toMatch(/\b(full_report|ip_address|answers|phone)\b/)
  })
})
