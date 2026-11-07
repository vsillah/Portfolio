import { describe, expect, it } from 'vitest'
import {
  assertInterestTransition, canRedeemInvitation, canTransitionInterest, grantStatus,
  hasAppGrant, hashInvitationToken, invitationStatus, publicInvitation,
  type ActivationConsent, type ActivationGrant, type ActivationInterest, type ActivationInvitation,
} from './app-activation'

const now = new Date('2026-11-06T12:00:00Z')
const interest: ActivationInterest = {
  id: 'interest-1', appKey: 'trumpet-trainer', adultEmail: 'adult@example.test',
  status: 'approved',
}
const consent: ActivationConsent = {
  interestId: interest.id, appKey: interest.appKey, kind: 'interest_contact',
  documentVersion: 'v1', decision: 'granted', recordedAt: '2026-11-01T12:00:00Z',
}
const invitation: ActivationInvitation = {
  id: 'inv-1', appKey: interest.appKey, interestId: interest.id, status: 'issued',
  tokenHash: hashInvitationToken('one-time-secret'), expiresAt: '2026-11-07T12:00:00Z',
  redeemedAt: null, revokedAt: null,
}
const grant: ActivationGrant = {
  id: 'grant-1', appKey: interest.appKey, interestId: interest.id, invitationId: invitation.id,
  authUserId: 'adult-user', expiresAt: null, revokedAt: null,
}

describe('app activation lifecycle', () => {
  it('allows reviewed approval and waitlist return, and rejects skips', () => {
    expect(canTransitionInterest('submitted', 'in_review')).toBe(true)
    expect(canTransitionInterest('in_review', 'approved')).toBe(true)
    expect(canTransitionInterest('in_review', 'waitlisted')).toBe(true)
    expect(canTransitionInterest('in_review', 'rejected')).toBe(true)
    expect(canTransitionInterest('waitlisted', 'in_review')).toBe(true)
    expect(() => assertInterestTransition('submitted', 'approved')).toThrow('Invalid interest transition')
    expect(canTransitionInterest('rejected', 'approved')).toBe(false)
  })

  it('requires the exact app, adult email, approval and token', () => {
    expect(canRedeemInvitation(invitation, interest, consent, interest.appKey, interest.adultEmail, 'one-time-secret', now)).toBe(true)
    expect(canRedeemInvitation(invitation, interest, consent, 'other-app', interest.adultEmail, 'one-time-secret', now)).toBe(false)
    expect(canRedeemInvitation(invitation, interest, consent, interest.appKey, 'other@example.test', 'one-time-secret', now)).toBe(false)
    expect(canRedeemInvitation(invitation, { ...interest, status: 'waitlisted' }, consent, interest.appKey, interest.adultEmail, 'one-time-secret', now)).toBe(false)
    expect(canRedeemInvitation(invitation, interest, consent, interest.appKey, interest.adultEmail, 'wrong', now)).toBe(false)
    expect(canRedeemInvitation(invitation, interest, { ...consent, decision: 'withdrawn' }, interest.appKey, interest.adultEmail, 'one-time-secret', now)).toBe(false)
    expect(canRedeemInvitation(invitation, interest, null, interest.appKey, interest.adultEmail, 'one-time-secret', now)).toBe(false)
  })

  it('rejects a second redemption and expired or revoked invitations', () => {
    const redeemed = { ...invitation, status: 'redeemed' as const, redeemedAt: now.toISOString() }
    expect(canRedeemInvitation(redeemed, interest, consent, interest.appKey, interest.adultEmail, 'one-time-secret', now)).toBe(false)
    expect(invitationStatus(invitation, new Date('2026-11-07T12:00:00Z'))).toBe('expired')
    expect(canRedeemInvitation(invitation, interest, consent, interest.appKey, interest.adultEmail, 'one-time-secret', new Date('2026-11-07T12:00:00Z'))).toBe(false)
    expect(invitationStatus({ ...invitation, status: 'revoked', revokedAt: now.toISOString() }, now)).toBe('revoked')
  })

  it('redacts token hashes and isolates active grants by app and account', () => {
    expect(JSON.stringify(publicInvitation(invitation))).not.toContain(invitation.tokenHash)
    expect(hasAppGrant(grant, 'trumpet-trainer', 'adult-user', now)).toBe(true)
    expect(hasAppGrant(grant, 'other-app', 'adult-user', now)).toBe(false)
    expect(hasAppGrant(grant, 'trumpet-trainer', 'other-user', now)).toBe(false)
    expect(grantStatus({ ...grant, revokedAt: now.toISOString() }, now)).toBe('revoked')
    expect(grantStatus({ ...grant, expiresAt: now.toISOString() }, now)).toBe('expired')
  })
})
