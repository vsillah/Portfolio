import { v } from 'convex/values'
import { internalMutation, internalQuery } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

const action = v.union(v.literal('start_review'), v.literal('approve'), v.literal('waitlist'), v.literal('reject'), v.literal('prepare_invitation'), v.literal('revoke_invitation'), v.literal('revoke_grant'))
const kind = v.union(v.literal('interest'), v.literal('redeem'), v.literal('handoff_issue'), v.literal('handoff_exchange'), v.literal('grant'))
const event = async (ctx: MutationCtx, appKey: string, interestId: Id<'activationInterests'>, type: string, actorSubject: string | undefined, sourceType: string, sourceReceipt?: string, invitationId?: Id<'activationInvitations'>, grantId?: Id<'activationGrants'>) => {
  await ctx.db.insert('activationEvents', { appKey, interestId, type, actorSubject, sourceType, sourceReceipt, invitationId, grantId, occurredAt: Date.now() })
}
const activeGrant = (grant: { revokedAt?: number; expiresAt: number } | null, now: number) => !!grant && !grant.revokedAt && grant.expiresAt > now
const grantFor = async (ctx: MutationCtx | QueryCtx, appKey: string, externalSubject: string) => {
  const grants = await ctx.db.query('activationGrants').withIndex('by_app_and_external_subject', q => q.eq('appKey', appKey).eq('externalSubject', externalSubject)).order('desc').take(25)
  if (grants.length === 25) throw new Error('Grant history requires manual review.')
  return grants.find(grant => !grant.revokedAt) || null
}

// Provision only after a separate operator review. No public registration path exists.
export const registerApp = internalMutation({
  args: { key: v.string(), name: v.string(), enabled: v.boolean() }, returns: v.null(),
  handler: async (ctx, args) => {
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(args.key) || !args.name.trim() || args.name.length > 120) throw new Error('Invalid app registration.')
    const existing = await ctx.db.query('activationApps').withIndex('by_key', q => q.eq('key', args.key)).unique()
    if (existing) throw new Error('App is already registered.')
    await ctx.db.insert('activationApps', args)
    return null
  },
})

export const budget = internalMutation({
  args: { kind, keyHash: v.string() }, returns: v.boolean(),
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db.query('activationBudgets').withIndex('by_key_hash', q => q.eq('keyHash', args.keyHash)).unique()
    const hits = existing && existing.windowStart > now - 15 * 60_000 ? existing.hits + 1 : 1
    if (existing) await ctx.db.patch(existing._id, { hits, windowStart: hits === 1 ? now : existing.windowStart })
    else await ctx.db.insert('activationBudgets', { keyHash: args.keyHash, hits, windowStart: now })
    return hits <= { interest: 5, redeem: 8, handoff_issue: 12, handoff_exchange: 120, grant: 1200 }[args.kind]
  },
})

export const intake = internalMutation({
  args: { appKey: v.string(), adultEmail: v.string(), consentVersion: v.string(), sourceType: v.string(), sourceReceipt: v.string(), intakeHash: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('activationInterests').withIndex('by_app_and_intake_hash', q => q.eq('appKey', args.appKey).eq('intakeHash', args.intakeHash)).unique()
    if (existing) {
      const consent = await ctx.db.query('activationConsents').withIndex('by_interest_and_recorded_at', q => q.eq('interestId', existing._id)).order('desc').first()
      if (existing.adultEmail !== args.adultEmail || existing.sourceReceipt !== args.sourceReceipt || consent?.version !== args.consentVersion) throw new Error('Idempotency key was used for a different request.')
      return null
    }
    const app = await ctx.db.query('activationApps').withIndex('by_key', q => q.eq('key', args.appKey)).unique()
    if (!app?.enabled) throw new Error('App is not registered.')
    const now = Date.now()
    const interestId = await ctx.db.insert('activationInterests', { appKey: args.appKey, adultEmail: args.adultEmail, status: 'submitted', sourceType: args.sourceType, sourceReceipt: args.sourceReceipt, intakeHash: args.intakeHash, createdAt: now })
    await ctx.db.insert('activationConsents', { appKey: args.appKey, interestId, kind: 'interest_contact', version: args.consentVersion, decision: 'granted', sourceType: args.sourceType, sourceReceipt: args.sourceReceipt, recordedAt: now })
    await event(ctx, args.appKey, interestId, 'interest_submitted', undefined, args.sourceType, args.sourceReceipt)
    await event(ctx, args.appKey, interestId, 'consent_recorded', undefined, args.sourceType, args.sourceReceipt)
    return null
  },
})

export const redeem = internalMutation({
  args: { appKey: v.string(), tokenHash: v.string(), externalSubject: v.string(), verifiedEmail: v.string() }, returns: v.boolean(),
  handler: async (ctx, args) => {
    const now = Date.now()
    const invitation = await ctx.db.query('activationInvitations').withIndex('by_app_and_token_hash', q => q.eq('appKey', args.appKey).eq('tokenHash', args.tokenHash)).unique()
    if (!invitation || invitation.status !== 'issued' || invitation.expiresAt <= now) return false
    const interest = await ctx.db.get(invitation.interestId)
    if (!interest || interest.appKey !== args.appKey || interest.status !== 'approved' || interest.adultEmail !== args.verifiedEmail) return false
    const consent = await ctx.db.query('activationConsents').withIndex('by_interest_and_recorded_at', q => q.eq('interestId', interest._id)).order('desc').first()
    if (consent?.decision !== 'granted') return false
    const prior = await grantFor(ctx, args.appKey, args.externalSubject)
    if (prior && !prior.revokedAt) return false
    const invitationGrant = await ctx.db.query('activationGrants').withIndex('by_invitation', q => q.eq('invitationId', invitation._id)).first()
    if (invitationGrant) return false
    await ctx.db.patch(invitation._id, { status: 'redeemed', redeemedAt: now })
    const grantId = await ctx.db.insert('activationGrants', { appKey: args.appKey, interestId: interest._id, invitationId: invitation._id, externalSubject: args.externalSubject, emailAtRedemption: args.verifiedEmail, expiresAt: now + 30 * 86400000 })
    await event(ctx, args.appKey, interest._id, 'invitation_redeemed', args.externalSubject, 'redemption', undefined, invitation._id, grantId)
    await event(ctx, args.appKey, interest._id, 'grant_created', args.externalSubject, 'redemption', undefined, invitation._id, grantId)
    return true
  },
})

export const hasGrant = internalQuery({
  args: { appKey: v.string(), externalSubject: v.string(), now: v.number() }, returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const grant = await grantFor(ctx, args.appKey, args.externalSubject)
    return activeGrant(grant, args.now) && grant ? grant.emailAtRedemption : null
  },
})

export const issueHandoff = internalMutation({
  args: { appKey: v.string(), externalSubject: v.string(), verifiedEmail: v.string(), codeHash: v.string() }, returns: v.boolean(),
  handler: async (ctx, args) => {
    const grant = await grantFor(ctx, args.appKey, args.externalSubject)
    if (!activeGrant(grant, Date.now()) || grant?.emailAtRedemption !== args.verifiedEmail) return false
    await ctx.db.insert('activationHandoffCodes', { appKey: args.appKey, externalSubject: args.externalSubject, codeHash: args.codeHash, expiresAt: Date.now() + 120000 })
    return true
  },
})

export const resolveCode = internalQuery({
  args: { appKey: v.string(), codeHash: v.string(), now: v.number() }, returns: v.union(v.object({ externalSubject: v.string(), emailAtRedemption: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const code = await ctx.db.query('activationHandoffCodes').withIndex('by_app_and_code_hash', q => q.eq('appKey', args.appKey).eq('codeHash', args.codeHash)).unique()
    if (!code || code.consumedAt || code.expiresAt <= args.now) return null
    const grant = await grantFor(ctx, args.appKey, code.externalSubject)
    return activeGrant(grant, args.now) && grant ? { externalSubject: grant.externalSubject, emailAtRedemption: grant.emailAtRedemption } : null
  },
})

export const exchangeHandoff = internalMutation({
  args: { appKey: v.string(), codeHash: v.string(), handleHash: v.string(), externalSubject: v.string(), verifiedEmail: v.string() }, returns: v.boolean(),
  handler: async (ctx, args) => {
    const now = Date.now()
    const code = await ctx.db.query('activationHandoffCodes').withIndex('by_app_and_code_hash', q => q.eq('appKey', args.appKey).eq('codeHash', args.codeHash)).unique()
    if (!code || code.consumedAt || code.expiresAt <= now || code.externalSubject !== args.externalSubject) return false
    await ctx.db.patch(code._id, { consumedAt: now })
    const grant = await grantFor(ctx, args.appKey, code.externalSubject)
    if (!activeGrant(grant, now) || grant?.emailAtRedemption !== args.verifiedEmail) return false
    await ctx.db.insert('activationHandles', { appKey: args.appKey, externalSubject: code.externalSubject, handleHash: args.handleHash, expiresAt: now + 86400000 })
    return true
  },
})

export const resolveHandle = internalQuery({
  args: { appKey: v.string(), handleHash: v.string(), now: v.number() }, returns: v.union(v.object({ externalSubject: v.string(), emailAtRedemption: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const handle = await ctx.db.query('activationHandles').withIndex('by_app_and_handle_hash', q => q.eq('appKey', args.appKey).eq('handleHash', args.handleHash)).unique()
    if (!handle || handle.expiresAt <= args.now) return null
    const grant = await grantFor(ctx, args.appKey, handle.externalSubject)
    return activeGrant(grant, args.now) && grant ? { externalSubject: grant.externalSubject, emailAtRedemption: grant.emailAtRedemption } : null
  },
})

export const operator = internalMutation({
  args: { appKey: v.string(), recordId: v.string(), action, actor: v.string(), reason: v.string(), confirmation: v.optional(v.string()), tokenHash: v.optional(v.string()), issuanceEnabled: v.boolean() },
  returns: v.union(v.object({ invitationId: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const reason = args.reason.trim()
    if (reason.length < 8 || reason.length > 500) throw new Error('Enter an audit reason of 8–500 characters.')
    if (['reject', 'revoke_invitation', 'revoke_grant'].includes(args.action) && args.confirmation !== args.action) throw new Error('Confirmation required.')
    const id = ctx.db.normalizeId('activationInterests', args.recordId)
    const interest = id && await ctx.db.get(id)
    if (!interest || interest.appKey !== args.appKey) throw new Error('Interest not found for this app.')
    const now = Date.now()
    const invitations = await ctx.db.query('activationInvitations').withIndex('by_interest_and_issued_at', q => q.eq('interestId', interest._id)).order('desc').take(25)
    const grants = await ctx.db.query('activationGrants').withIndex('by_interest', q => q.eq('interestId', interest._id)).take(25)
    if (invitations.length === 25 || grants.length === 25) throw new Error('Interest requires manual lifecycle review.')
    const next = ({ start_review: 'in_review', approve: 'approved', waitlist: 'waitlisted', reject: 'rejected' } as Record<string, typeof interest.status>)[args.action]
    if (next) {
      const allowed: Record<string, string[]> = { submitted: ['in_review'], in_review: ['approved', 'waitlisted', 'rejected'], approved: ['waitlisted', 'rejected'], waitlisted: ['in_review', 'rejected'], rejected: [] }
      if (!allowed[interest.status].includes(next)) throw new Error('Invalid interest transition.')
      if (interest.status === 'approved' && (invitations.some(i => i.status === 'issued' && i.expiresAt > now) || grants.some(g => activeGrant(g, now)))) throw new Error('Revoke active invitation or grant before changing approval.')
      await ctx.db.patch(interest._id, { status: next, reviewedAt: now, reviewedBy: args.actor, reviewNote: reason })
      await event(ctx, args.appKey, interest._id, ({ in_review: 'review_started', approved: 'interest_approved', waitlisted: 'interest_waitlisted', rejected: 'interest_rejected' } as Record<string, string>)[next], args.actor, 'operator', reason)
    } else if (args.action === 'prepare_invitation') {
      if (!args.issuanceEnabled) throw new Error('Invitation issuance is not enabled.')
      if (interest.status !== 'approved' || !interest.sourceReceipt || !args.tokenHash) throw new Error('Approved interest and source receipt required.')
      const consent = await ctx.db.query('activationConsents').withIndex('by_interest_and_recorded_at', q => q.eq('interestId', interest._id)).order('desc').first()
      if (consent?.decision !== 'granted') throw new Error('Current contact consent required.')
      if (invitations.some(i => i.status === 'issued' || i.status === 'redeemed')) throw new Error('An invitation already exists. Review its state before reissue.')
      const invitationId = await ctx.db.insert('activationInvitations', { appKey: args.appKey, interestId: interest._id, tokenHash: args.tokenHash, status: 'issued', issuedAt: now, expiresAt: now + 7 * 86400000 })
      await event(ctx, args.appKey, interest._id, 'invitation_issued', args.actor, 'operator', reason, invitationId)
      return { invitationId }
    } else if (args.action === 'revoke_invitation') {
      const invitation = invitations.find(i => i.status === 'issued' && i.expiresAt > now)
      if (!invitation) throw new Error('Only a current unredeemed invitation can be revoked.')
      await ctx.db.patch(invitation._id, { status: 'revoked', revokedAt: now, revokedBy: args.actor })
      await event(ctx, args.appKey, interest._id, 'invitation_revoked', args.actor, 'operator', reason, invitation._id)
    } else if (args.action === 'revoke_grant') {
      const grant = grants.find(g => !g.revokedAt)
      if (!grant) throw new Error('Only an unrevoked grant can be revoked.')
      await ctx.db.patch(grant._id, { revokedAt: now, revokedBy: args.actor, revokeReason: reason })
      await event(ctx, args.appKey, interest._id, 'grant_revoked', args.actor, 'operator', reason, grant.invitationId, grant._id)
    }
    return null
  },
})

export const revokeUndelivered = internalMutation({
  args: { appKey: v.string(), interestId: v.string(), invitationId: v.string(), actor: v.string() }, returns: v.boolean(),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId('activationInvitations', args.invitationId)
    const interestId = ctx.db.normalizeId('activationInterests', args.interestId)
    const invitation = id && await ctx.db.get(id)
    if (!invitation || !interestId || invitation.appKey !== args.appKey || invitation.interestId !== interestId || invitation.status !== 'issued') return false
    await ctx.db.patch(invitation._id, { status: 'revoked', revokedAt: Date.now(), revokedBy: args.actor })
    await event(ctx, args.appKey, invitation.interestId, 'invitation_revoked', args.actor, 'delivery_failure', 'Delivery adapter failed; invitation invalidated.', invitation._id)
    return true
  },
})

const snapshotReturn = v.object({
  mode: v.literal('provider'),
  apps: v.array(v.object({ key: v.string(), name: v.string() })),
  records: v.array(v.object({
    id: v.id('activationInterests'), appKey: v.string(), adultEmail: v.string(),
    status: v.union(v.literal('submitted'), v.literal('in_review'), v.literal('approved'), v.literal('waitlisted'), v.literal('rejected')),
    source: v.object({ type: v.string(), receipt: v.string(), capturedAt: v.string() }),
    consent: v.union(v.object({ decision: v.union(v.literal('granted'), v.literal('withdrawn')), version: v.string(), recordedAt: v.string() }), v.null()),
    release: v.object({ ready: v.boolean(), reason: v.string() }),
    invitation: v.union(v.object({ id: v.id('activationInvitations'), status: v.union(v.literal('issued'), v.literal('redeemed'), v.literal('expired'), v.literal('revoked')), expiresAt: v.string(), redeemedAt: v.union(v.string(), v.null()), revokedAt: v.union(v.string(), v.null()) }), v.null()),
    grant: v.union(v.object({ id: v.id('activationGrants'), expiresAt: v.union(v.string(), v.null()), revokedAt: v.union(v.string(), v.null()) }), v.null()),
    events: v.array(v.object({ id: v.id('activationEvents'), type: v.string(), at: v.string(), actor: v.string(), reason: v.string() })),
  })),
  message: v.string(),
})

export const snapshot = internalQuery({
  args: { now: v.number() }, returns: snapshotReturn,
  handler: async (ctx, args) => {
    const apps = await ctx.db.query('activationApps').take(100)
    const interests = await ctx.db.query('activationInterests').withIndex('by_created_at').order('desc').take(200)
    const records = []
    for (const row of interests) {
      const consent = await ctx.db.query('activationConsents').withIndex('by_interest_and_recorded_at', q => q.eq('interestId', row._id)).order('desc').first()
      const invitation = await ctx.db.query('activationInvitations').withIndex('by_interest_and_issued_at', q => q.eq('interestId', row._id)).order('desc').first()
      const grant = invitation && await ctx.db.query('activationGrants').withIndex('by_invitation', q => q.eq('invitationId', invitation._id)).first()
      const events = await ctx.db.query('activationEvents').withIndex('by_interest_and_occurred_at', q => q.eq('interestId', row._id)).order('desc').take(20)
      records.push({ id: row._id, appKey: row.appKey, adultEmail: row.adultEmail, status: row.status,
        source: { type: row.sourceType, receipt: row.sourceReceipt, capturedAt: new Date(row.createdAt).toISOString() },
        consent: consent ? { decision: consent.decision, version: consent.version, recordedAt: new Date(consent.recordedAt).toISOString() } : null,
        release: { ready: false, reason: 'Provider release approval is not configured.' },
        invitation: invitation ? { id: invitation._id, status: invitation.status === 'issued' && invitation.expiresAt <= args.now ? 'expired' as const : invitation.status, expiresAt: new Date(invitation.expiresAt).toISOString(), redeemedAt: invitation.redeemedAt ? new Date(invitation.redeemedAt).toISOString() : null, revokedAt: invitation.revokedAt ? new Date(invitation.revokedAt).toISOString() : null } : null,
        grant: grant ? { id: grant._id, expiresAt: new Date(grant.expiresAt).toISOString(), revokedAt: grant.revokedAt ? new Date(grant.revokedAt).toISOString() : null } : null,
        events: events.map(e => ({ id: e._id, type: e.type, at: new Date(e.occurredAt).toISOString(), actor: e.actorSubject || e.sourceType, reason: e.sourceReceipt || '' })) })
    }
    return { mode: 'provider' as const, apps: apps.map(a => ({ key: a.key, name: a.name })), records, message: 'Provider data is available for review. Issuance remains release-gated.' }
  },
})
