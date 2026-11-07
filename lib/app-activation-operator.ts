import 'server-only'

import { assertInterestTransition, grantStatus, invitationStatus, type InterestStatus } from './app-activation'

export type OperatorAction = 'start_review' | 'approve' | 'waitlist' | 'reject' | 'prepare_invitation' | 'revoke_invitation' | 'revoke_grant'
export type OperatorEvent = { id: string; type: string; at: string; actor: string; reason: string }
export type OperatorRecord = {
  id: string
  appKey: string
  adultEmail: string
  status: InterestStatus
  source: { type: string; receipt: string; capturedAt: string }
  consent: { decision: 'granted' | 'withdrawn'; version: string; recordedAt: string } | null
  release: { ready: boolean; reason: string }
  invitation: { id: string; status: 'issued' | 'redeemed' | 'expired' | 'revoked'; expiresAt: string; redeemedAt: string | null; revokedAt: string | null } | null
  grant: { id: string; expiresAt: string | null; revokedAt: string | null } | null
  events: OperatorEvent[]
}
export type OperatorApp = { key: string; name: string }
export type OperatorSnapshot = { mode: 'synthetic' | 'unconfigured' | 'provider'; apps: OperatorApp[]; records: OperatorRecord[]; message: string }

const apps: OperatorApp[] = [
  { key: 'trumpet-trainer', name: 'Trumpet Trainer' },
  { key: 'future-app', name: 'Future app fixture' },
]
const at = '2026-11-06T12:00:00.000Z'
const event = (id: string, type: string): OperatorEvent => ({ id, type, at, actor: 'fixture', reason: 'Synthetic lifecycle example' })
const initial: OperatorRecord[] = [
  { id: 'interest-001', appKey: 'trumpet-trainer', adultEmail: 'adult.one@example.test', status: 'submitted', source: { type: 'synthetic_form', receipt: 'fixture:tt-001', capturedAt: at }, consent: { decision: 'granted', version: 'interest-v1', recordedAt: at }, release: { ready: false, reason: 'Release review has not been recorded.' }, invitation: null, grant: null, events: [event('event-001', 'interest_submitted'), event('event-002', 'consent_recorded')] },
  { id: 'interest-002', appKey: 'trumpet-trainer', adultEmail: 'adult.two@example.test', status: 'in_review', source: { type: 'synthetic_form', receipt: 'fixture:tt-002', capturedAt: at }, consent: { decision: 'granted', version: 'interest-v1', recordedAt: at }, release: { ready: true, reason: 'Synthetic release checklist complete.' }, invitation: null, grant: null, events: [event('event-003', 'interest_submitted'), event('event-004', 'review_started')] },
  { id: 'interest-003', appKey: 'trumpet-trainer', adultEmail: 'adult.three@example.test', status: 'approved', source: { type: 'synthetic_form', receipt: 'fixture:tt-003', capturedAt: at }, consent: { decision: 'granted', version: 'interest-v1', recordedAt: at }, release: { ready: true, reason: 'Synthetic release checklist complete.' }, invitation: null, grant: null, events: [event('event-005', 'interest_approved')] },
  { id: 'interest-004', appKey: 'trumpet-trainer', adultEmail: 'adult.four@example.test', status: 'approved', source: { type: 'synthetic_form', receipt: 'fixture:tt-004', capturedAt: at }, consent: { decision: 'granted', version: 'interest-v1', recordedAt: at }, release: { ready: true, reason: 'Synthetic release checklist complete.' }, invitation: { id: 'inv-004', status: 'issued', expiresAt: '2027-01-01T00:00:00.000Z', redeemedAt: null, revokedAt: null }, grant: null, events: [event('event-006', 'interest_approved'), event('event-007', 'invitation_issued')] },
  { id: 'interest-005', appKey: 'trumpet-trainer', adultEmail: 'adult.five@example.test', status: 'approved', source: { type: 'synthetic_form', receipt: 'fixture:tt-005', capturedAt: at }, consent: { decision: 'granted', version: 'interest-v1', recordedAt: at }, release: { ready: true, reason: 'Synthetic release checklist complete.' }, invitation: { id: 'inv-005', status: 'redeemed', expiresAt: '2027-01-01T00:00:00.000Z', redeemedAt: at, revokedAt: null }, grant: { id: 'grant-005', expiresAt: '2027-02-01T00:00:00.000Z', revokedAt: null }, events: [event('event-008', 'invitation_redeemed'), event('event-009', 'grant_created')] },
  { id: 'interest-006', appKey: 'future-app', adultEmail: 'adult.six@example.test', status: 'waitlisted', source: { type: 'synthetic_referral', receipt: 'fixture:future-006', capturedAt: at }, consent: { decision: 'withdrawn', version: 'interest-v1', recordedAt: at }, release: { ready: false, reason: 'No release receipt for this app.' }, invitation: null, grant: null, events: [event('event-010', 'interest_waitlisted'), event('event-011', 'consent_recorded')] },
  { id: 'interest-007', appKey: 'future-app', adultEmail: 'adult.seven@example.test', status: 'rejected', source: { type: 'synthetic_form', receipt: 'fixture:future-007', capturedAt: at }, consent: null, release: { ready: false, reason: 'No release receipt for this app.' }, invitation: null, grant: null, events: [event('event-012', 'interest_rejected')] },
  { id: 'interest-008', appKey: 'trumpet-trainer', adultEmail: 'adult.eight@example.test', status: 'approved', source: { type: 'synthetic_form', receipt: 'fixture:tt-008', capturedAt: at }, consent: { decision: 'granted', version: 'interest-v1', recordedAt: at }, release: { ready: true, reason: 'Synthetic release checklist complete.' }, invitation: { id: 'inv-008', status: 'expired', expiresAt: '2026-11-05T00:00:00.000Z', redeemedAt: null, revokedAt: null }, grant: null, events: [event('event-013', 'invitation_expired')] },
  { id: 'interest-009', appKey: 'future-app', adultEmail: 'adult.nine@example.test', status: 'approved', source: { type: 'synthetic_referral', receipt: 'fixture:future-009', capturedAt: '2026-11-01T12:00:00.000Z' }, consent: { decision: 'granted', version: 'interest-v1', recordedAt: '2026-11-01T12:00:00.000Z' }, release: { ready: true, reason: 'Synthetic release checklist complete.' }, invitation: { id: 'inv-009', status: 'redeemed', expiresAt: '2026-11-05T00:00:00.000Z', redeemedAt: '2026-11-04T00:00:00.000Z', revokedAt: null }, grant: { id: 'grant-009', expiresAt: '2026-11-05T00:00:00.000Z', revokedAt: null }, events: [event('event-014', 'grant_expired')] },
  { id: 'interest-010', appKey: 'future-app', adultEmail: 'adult.ten@example.test', status: 'approved', source: { type: 'synthetic_form', receipt: 'fixture:future-010', capturedAt: at }, consent: { decision: 'granted', version: 'interest-v1', recordedAt: at }, release: { ready: true, reason: 'Synthetic release checklist complete.' }, invitation: { id: 'inv-010', status: 'redeemed', expiresAt: '2027-01-01T00:00:00.000Z', redeemedAt: at, revokedAt: null }, grant: { id: 'grant-010', expiresAt: '2027-02-01T00:00:00.000Z', revokedAt: at }, events: [event('event-015', 'grant_revoked')] },
]

const copy = <T>(value: T): T => structuredClone(value)
let records = copy(initial)
let sequence = 100

export function syntheticReviewEnabled(env = process.env): boolean {
  return env.NODE_ENV === 'development' && env.APP_ACTIVATION_REVIEW_MODE === 'synthetic'
}

export function getOperatorSnapshot(enabled = syntheticReviewEnabled()): OperatorSnapshot {
  if (!enabled) return { mode: 'unconfigured', apps: [], records: [], message: 'Activation provider is unconfigured. No hosted interest, invitation, or grant operations are available.' }
  return { mode: 'synthetic', apps: copy(apps), records: copy(records), message: 'Local synthetic review only. Changes reset when the development server restarts. No invitation, email, or database write occurs.' }
}

export function filterOperatorRecords(rows: OperatorRecord[], appKey = '', status = '', search = ''): OperatorRecord[] {
  const term = search.trim().toLowerCase()
  return rows.filter(row => (!appKey || row.appKey === appKey) && (!status || row.status === status) && (!term || row.adultEmail.toLowerCase().includes(term) || row.id.toLowerCase().includes(term) || row.source.receipt.toLowerCase().includes(term)))
}

export class OperatorActionError extends Error {
  constructor(message: string, readonly status = 409) { super(message) }
}

const transitions: Partial<Record<OperatorAction, InterestStatus>> = { start_review: 'in_review', approve: 'approved', waitlist: 'waitlisted', reject: 'rejected' }
const eventTypes: Record<OperatorAction, string> = { start_review: 'review_started', approve: 'interest_approved', waitlist: 'interest_waitlisted', reject: 'interest_rejected', prepare_invitation: 'invitation_issued', revoke_invitation: 'invitation_revoked', revoke_grant: 'grant_revoked' }
const destructive: OperatorAction[] = ['reject', 'revoke_invitation', 'revoke_grant']

export function applySyntheticOperatorAction(input: { appKey: string; recordId: string; action: OperatorAction; actor: string; reason: string; confirmation?: string }, now = new Date()): OperatorRecord {
  if (!syntheticReviewEnabled()) throw new OperatorActionError('Synthetic review mode is disabled. Configure a local development review session.', 503)
  if (!apps.some(app => app.key === input.appKey)) throw new OperatorActionError('Unknown app. Select a registered app.', 404)
  const index = records.findIndex(row => row.id === input.recordId && row.appKey === input.appKey)
  if (index < 0) throw new OperatorActionError('Interest not found for this app.', 404)
  if (!Object.hasOwn(eventTypes, input.action)) throw new OperatorActionError('Unknown action.', 400)
  const reason = input.reason.trim()
  if (reason.length < 8 || reason.length > 500) throw new OperatorActionError('Enter an audit reason of 8–500 characters.', 400)
  if (destructive.includes(input.action) && input.confirmation !== input.action) throw new OperatorActionError(`Type ${input.action} to confirm this action.`, 400)
  const row = copy(records[index])
  const target = transitions[input.action]
  if (target) {
    try { assertInterestTransition(row.status, target) } catch { throw new OperatorActionError(`Cannot move ${row.status} interest to ${target}. Start or resume review first.`) }
    if (row.status === 'approved' && target !== 'approved') {
      if (row.invitation && invitationStatus({ ...row.invitation, appKey: row.appKey, interestId: row.id, tokenHash: '' }, now) === 'issued') throw new OperatorActionError('Revoke the issued invitation before changing an approved interest.')
      if (row.grant && grantStatus({ ...row.grant, appKey: row.appKey, interestId: row.id, invitationId: row.invitation?.id || '', authUserId: '' }, now) === 'active') throw new OperatorActionError('Revoke the active grant before changing an approved interest.')
    }
    row.status = target
  } else if (input.action === 'prepare_invitation') {
    if (row.status !== 'approved') throw new OperatorActionError('Approve the interest before preparing an invitation.')
    if (row.consent?.decision !== 'granted') throw new OperatorActionError('Current adult contact consent is required. Record consent through a future approved intake path.')
    if (!row.source.receipt) throw new OperatorActionError('A source receipt is required before invitation preparation.')
    if (!row.release.ready) throw new OperatorActionError(`Release is not ready: ${row.release.reason}`)
    if (row.invitation) throw new OperatorActionError('An invitation already exists. Review its state before another preparation.')
    row.invitation = { id: `synthetic-inv-${++sequence}`, status: 'issued', expiresAt: new Date(now.getTime() + 7 * 86400000).toISOString(), redeemedAt: null, revokedAt: null }
  } else if (input.action === 'revoke_invitation') {
    if (!row.invitation || invitationStatus({ ...row.invitation, appKey: row.appKey, interestId: row.id, tokenHash: '' }, now) !== 'issued') throw new OperatorActionError('Only an unredeemed, unexpired invitation can be revoked.')
    row.invitation.status = 'revoked'
    row.invitation.revokedAt = now.toISOString()
  } else if (input.action === 'revoke_grant') {
    if (!row.grant || grantStatus({ ...row.grant, appKey: row.appKey, interestId: row.id, invitationId: row.invitation?.id || '', authUserId: '' }, now) !== 'active') throw new OperatorActionError('Only an active grant can be revoked.')
    row.grant.revokedAt = now.toISOString()
  }
  row.events.unshift({ id: `synthetic-event-${++sequence}`, type: eventTypes[input.action], at: now.toISOString(), actor: input.actor, reason })
  records[index] = row
  return copy(row)
}

export function resetSyntheticOperatorReviewForTests() { records = copy(initial); sequence = 100 }
