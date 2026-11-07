import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { applySyntheticOperatorAction, filterOperatorRecords, getOperatorSnapshot, resetSyntheticOperatorReviewForTests, syntheticReviewEnabled } from './app-activation-operator'

const now = new Date('2026-11-06T15:00:00.000Z')
const input = (recordId: string, action: Parameters<typeof applySyntheticOperatorAction>[0]['action'], appKey = 'trumpet-trainer') => ({ appKey, recordId, action, actor: 'synthetic-admin', reason: 'Reviewed fixture source and consent.' })

beforeEach(() => { vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('APP_ACTIVATION_REVIEW_MODE', 'synthetic'); resetSyntheticOperatorReviewForTests() })

describe('activation operator synthetic boundary', () => {
  it('fails closed unless local development explicitly enables review', () => {
    expect(syntheticReviewEnabled({ NODE_ENV: 'production', APP_ACTIVATION_REVIEW_MODE: 'synthetic' })).toBe(false)
    expect(syntheticReviewEnabled({ NODE_ENV: 'development', APP_ACTIVATION_REVIEW_MODE: 'synthetic' })).toBe(true)
    vi.stubEnv('NODE_ENV', 'production')
    expect(getOperatorSnapshot()).toMatchObject({ mode: 'unconfigured', records: [] })
    expect(() => applySyntheticOperatorAction(input('interest-001', 'start_review'), now)).toThrow('disabled')
  })

  it('keeps apps scoped and never returns tokens or child identity', () => {
    const rows = getOperatorSnapshot().records
    expect(filterOperatorRecords(rows, 'future-app').every(row => row.appKey === 'future-app')).toBe(true)
    expect(filterOperatorRecords(rows, '', 'approved').every(row => row.status === 'approved')).toBe(true)
    expect(filterOperatorRecords(rows, '', '', 'fixture:tt-001')).toHaveLength(1)
    expect(filterOperatorRecords(rows, '', '', 'nothing-matches')).toHaveLength(0)
    expect(JSON.stringify(rows)).not.toMatch(/tokenHash|token_hash|bearer|childName|child_age/)
    expect(() => applySyntheticOperatorAction(input('interest-001', 'start_review', 'future-app'), now)).toThrow('not found for this app')
  })

  it('requires review before approval and records each transition', () => {
    expect(() => applySyntheticOperatorAction(input('interest-001', 'approve'), now)).toThrow('Start or resume review first')
    expect(applySyntheticOperatorAction(input('interest-001', 'start_review'), now).status).toBe('in_review')
    const approved = applySyntheticOperatorAction(input('interest-001', 'approve'), now)
    expect(approved.status).toBe('approved')
    expect(approved.events[0]).toMatchObject({ type: 'interest_approved', actor: 'synthetic-admin' })
    expect(() => applySyntheticOperatorAction(input('interest-007', 'start_review', 'future-app'), now)).toThrow('Start or resume review first')
  })

  it('requires source, consent, release readiness, and a single expiring invitation', () => {
    expect(() => applySyntheticOperatorAction(input('interest-001', 'prepare_invitation'), now)).toThrow('Approve')
    applySyntheticOperatorAction(input('interest-001', 'start_review'), now)
    applySyntheticOperatorAction(input('interest-001', 'approve'), now)
    expect(() => applySyntheticOperatorAction(input('interest-001', 'prepare_invitation'), now)).toThrow('Release is not ready')
    const prepared = applySyntheticOperatorAction(input('interest-003', 'prepare_invitation'), now)
    expect(prepared.invitation?.expiresAt).toBe('2026-11-13T15:00:00.000Z')
    expect(JSON.stringify(prepared)).not.toMatch(/tokenHash|token_hash|bearer/)
    expect(() => applySyntheticOperatorAction(input('interest-003', 'prepare_invitation'), now)).toThrow('already exists')
  })

  it('requires destructive confirmation and revocation before changing approved interest', () => {
    expect(() => applySyntheticOperatorAction(input('interest-004', 'waitlist'), now)).toThrow('Revoke the issued invitation')
    expect(() => applySyntheticOperatorAction(input('interest-005', 'waitlist'), now)).toThrow('Revoke the active grant')
    expect(() => applySyntheticOperatorAction(input('interest-004', 'revoke_invitation'), now)).toThrow('confirm')
    const revoked = applySyntheticOperatorAction({ ...input('interest-004', 'revoke_invitation'), confirmation: 'revoke_invitation' }, now)
    expect(revoked.invitation?.status).toBe('revoked')
    expect(applySyntheticOperatorAction(input('interest-004', 'waitlist'), now).status).toBe('waitlisted')
    expect(() => applySyntheticOperatorAction(input('interest-005', 'revoke_grant'), now)).toThrow('confirm')
    const grant = applySyntheticOperatorAction({ ...input('interest-005', 'revoke_grant'), confirmation: 'revoke_grant' }, now)
    expect(grant.grant?.revokedAt).toBe(now.toISOString())
    expect(applySyntheticOperatorAction({ ...input('interest-005', 'reject'), confirmation: 'reject' }, now).status).toBe('rejected')
  })

  it('blocks expired invitation and grant revocation', () => {
    const expired = new Date('2027-03-01T00:00:00.000Z')
    expect(() => applySyntheticOperatorAction({ ...input('interest-004', 'revoke_invitation'), confirmation: 'revoke_invitation' }, expired)).toThrow('unredeemed, unexpired')
    expect(() => applySyntheticOperatorAction({ ...input('interest-005', 'revoke_grant'), confirmation: 'revoke_grant' }, expired)).toThrow('active grant')
    const rows = getOperatorSnapshot().records
    expect(rows.find(row => row.id === 'interest-008')?.invitation?.status).toBe('expired')
    expect(rows.find(row => row.id === 'interest-009')?.grant?.expiresAt).toBe('2026-11-05T00:00:00.000Z')
    expect(rows.find(row => row.id === 'interest-010')?.grant?.revokedAt).toBeTruthy()
  })
})
