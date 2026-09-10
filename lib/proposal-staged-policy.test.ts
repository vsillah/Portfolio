import { describe, expect, it } from 'vitest'
import { canonicalStagedContent, paymentEligibility, validateReceipt, validateStagedPolicy, type StagedEvidence } from './proposal-staged-policy'
const policy = { version: 1 as const, currency: 'usd' as const, totalCents: 99700, depositCents: 49850, balanceCents: 49850, acceptanceCriteria: ['Reviewer can update fictional cases.'] }
const ready: StagedEvidence = { proposalSigned: true, agreementSigned: true, depositPaid: true, delivered: true, deliveryAccepted: true, balancePaid: false }
describe('staged proposal payment boundaries', () => {
  it('preserves the full contract while collecting only the stage amount', () => {
    expect(validateStagedPolicy(policy).totalCents).toBe(99700)
    expect(() => validateReceipt(policy, 'deposit', { mode: 'payment', payment_status: 'paid', currency: 'usd', amount_total: 49850 })).not.toThrow()
    expect(() => validateReceipt(policy, 'deposit', { mode: 'payment', payment_status: 'paid', currency: 'usd', amount_total: 99700 })).toThrow()
  })
  it.each(['proposalSigned', 'agreementSigned', 'depositPaid', 'delivered', 'deliveryAccepted'] as const)('locks balance without %s', field => {
    expect(paymentEligibility('balance', { ...ready, [field]: false })).toBeTruthy()
  })
  it('prevents repeat collection and allows only an eligible voluntary balance', () => {
    expect(paymentEligibility('deposit', ready)).toBeTruthy()
    expect(paymentEligibility('balance', ready)).toBeNull()
    expect(paymentEligibility('balance', { ...ready, balancePaid: true })).toBeTruthy()
  })
  it.each([{ mode: 'subscription' }, { payment_status: 'unpaid' }, { currency: 'eur' }, { amount_total: 49849 }])('rejects mismatched receipts %j', override => {
    expect(() => validateReceipt(policy, 'balance', { mode: 'payment', payment_status: 'paid', currency: 'usd', amount_total: 49850, ...override })).toThrow()
  })
  it.each([{ balanceCents: 1 }, { depositCents: 49850.1 }, { acceptanceCriteria: [] }, { currency: 'eur' }])('rejects invalid policies %j', override => {
    expect(() => validateStagedPolicy({ ...policy, ...override })).toThrow()
  })
})

it('keeps retry digest input stable across JSONB key ordering', () => { expect(canonicalStagedContent({ policy: { total: 997, deposit: 498.5 }, title: 'Test' })).toBe(canonicalStagedContent({ title: 'Test', policy: { deposit: 498.5, total: 997 } })) })
