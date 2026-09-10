/** Server-owned rules for the opt-in, non-recurring two-stage proposal flow. */
export interface StagedPolicy {
  version: 1
  currency: 'usd'
  totalCents: number
  depositCents: number
  balanceCents: number
  acceptanceCriteria: string[]
}
export type PaymentStage = 'deposit' | 'balance'
export interface StagedEvidence {
  proposalSigned: boolean
  agreementSigned: boolean
  depositPaid: boolean
  delivered: boolean
  deliveryAccepted: boolean
  balancePaid: boolean
}
export function validateStagedPolicy(value: unknown): StagedPolicy {
  const p = value as StagedPolicy
  if (!p || p.version !== 1 || p.currency !== 'usd' ||
    ![p.totalCents, p.depositCents, p.balanceCents].every(n => Number.isSafeInteger(n) && n > 0) ||
    p.depositCents + p.balanceCents !== p.totalCents ||
    !Array.isArray(p.acceptanceCriteria) || p.acceptanceCriteria.length === 0 ||
    p.acceptanceCriteria.some(c => typeof c !== 'string' || !c.trim())) {
    throw new Error('Invalid fixed staged-payment policy')
  }
  return p
}
export function paymentEligibility(stage: PaymentStage, e: StagedEvidence): string | null {
  if (!e.proposalSigned || !e.agreementSigned) return 'Sign the proposal and agreement first.'
  if (stage === 'deposit') return e.depositPaid ? 'Deposit already paid.' : null
  if (!e.depositPaid) return 'Deposit payment has not been confirmed.'
  if (!e.delivered) return 'Delivery has not been submitted for review.'
  if (!e.deliveryAccepted) return 'Review and accept the delivered work before paying the balance.'
  return e.balancePaid ? 'Balance already paid.' : null
}
export function validateReceipt(
  policy: StagedPolicy, stage: PaymentStage,
  receipt: { mode: string | null; payment_status: string; currency: string | null; amount_total: number | null },
): void {
  const amount = stage === 'deposit' ? policy.depositCents : policy.balanceCents
  if (receipt.mode !== 'payment' || receipt.payment_status !== 'paid' ||
    receipt.currency !== policy.currency || receipt.amount_total !== amount) {
    throw new Error('Checkout receipt does not match the approved payment stage')
  }
}
