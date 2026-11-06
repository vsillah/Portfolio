import { createHash, timingSafeEqual } from 'node:crypto'

export type InterestStatus = 'submitted' | 'in_review' | 'approved' | 'waitlisted' | 'rejected'
export type InvitationStatus = 'issued' | 'redeemed' | 'expired' | 'revoked'
export type GrantStatus = 'active' | 'expired' | 'revoked'

export interface ActivationInterest {
  id: string
  appKey: string
  adultEmail: string
  status: InterestStatus
}

export interface ActivationConsent {
  interestId: string
  appKey: string
  kind: 'interest_contact' | 'tester_terms' | 'privacy_notice'
  documentVersion: string
  decision: 'granted' | 'withdrawn'
  recordedAt: string
}

export interface ActivationInvitation {
  id: string
  appKey: string
  interestId: string
  status: InvitationStatus
  tokenHash: string
  expiresAt: string
  redeemedAt: string | null
  revokedAt: string | null
}

export interface ActivationGrant {
  id: string
  appKey: string
  interestId: string
  invitationId: string
  authUserId: string
  expiresAt: string | null
  revokedAt: string | null
}

const interestTransitions: Record<InterestStatus, readonly InterestStatus[]> = {
  submitted: ['in_review'],
  in_review: ['approved', 'waitlisted', 'rejected'],
  approved: ['waitlisted', 'rejected'],
  waitlisted: ['in_review', 'rejected'],
  rejected: [],
}

export function canTransitionInterest(from: InterestStatus, to: InterestStatus): boolean {
  return interestTransitions[from]?.includes(to) ?? false
}

export function assertInterestTransition(from: InterestStatus, to: InterestStatus): void {
  if (!canTransitionInterest(from, to)) throw new Error(`Invalid interest transition: ${from} -> ${to}`)
}

export function invitationStatus(invitation: ActivationInvitation, now: Date): InvitationStatus {
  if (invitation.revokedAt || invitation.status === 'revoked') return 'revoked'
  if (invitation.redeemedAt || invitation.status === 'redeemed') return 'redeemed'
  if (invitation.status === 'expired' || Date.parse(invitation.expiresAt) <= now.getTime()) return 'expired'
  return 'issued'
}

export function canRedeemInvitation(
  invitation: ActivationInvitation,
  interest: ActivationInterest,
  currentContactConsent: ActivationConsent | null,
  appKey: string,
  adultEmail: string,
  rawToken: string,
  now: Date,
): boolean {
  if (invitation.appKey !== appKey || interest.appKey !== appKey || invitation.interestId !== interest.id) return false
  if (!currentContactConsent || currentContactConsent.interestId !== interest.id || currentContactConsent.appKey !== appKey || currentContactConsent.kind !== 'interest_contact' || currentContactConsent.decision !== 'granted') return false
  if (interest.status !== 'approved' || interest.adultEmail.trim().toLowerCase() !== adultEmail.trim().toLowerCase()) return false
  if (invitationStatus(invitation, now) !== 'issued') return false
  if (!/^[a-f0-9]{64}$/.test(invitation.tokenHash) || !rawToken) return false
  const actual = Buffer.from(hashInvitationToken(rawToken), 'hex')
  return timingSafeEqual(Buffer.from(invitation.tokenHash, 'hex'), actual)
}

export function hashInvitationToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex')
}

export function grantStatus(grant: ActivationGrant, now: Date): GrantStatus {
  if (grant.revokedAt) return 'revoked'
  if (grant.expiresAt && Date.parse(grant.expiresAt) <= now.getTime()) return 'expired'
  return 'active'
}

// Operator and app read models never include token hashes or bearer links.
export function publicInvitation(invitation: ActivationInvitation) {
  const { tokenHash: _tokenHash, ...safe } = invitation
  return safe
}

export function hasAppGrant(grant: ActivationGrant, appKey: string, authUserId: string, now: Date): boolean {
  return grant.appKey === appKey && grant.authUserId === authUserId && grantStatus(grant, now) === 'active'
}
