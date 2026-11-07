import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { Pool, type PoolClient } from 'pg'
import { hashInvitationToken } from './app-activation'
import { isExactHttpsOrigin } from './app-activation-rollout.server'
import type { OperatorAction, OperatorRecord, OperatorSnapshot } from './app-activation-operator'

export class ActivationError extends Error {
  constructor(message: string, readonly status = 409) { super(message) }
}

export type IntakeInput = {
  appKey: string; adultEmail: string; consentVersion: string; consentGranted: true
  idempotencyKey: string; sourceType: string; sourceReceipt: string
}
export type RedeemInput = { appKey: string; token: string; authUserId: string; adultEmail: string }
export type OperatorInput = { appKey: string; recordId: string; action: OperatorAction; actor: string; reason: string; confirmation?: string }

export interface ActivationRepository {
  intake(input: IntakeInput): Promise<void>
  redeem(input: RedeemInput): Promise<boolean>
  hasGrant(appKey: string, authUserId: string): Promise<boolean>
  snapshot(): Promise<OperatorSnapshot>
  operator(input: OperatorInput): Promise<{ record: OperatorRecord; deliveryToken?: string }>
}

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
let pool: Pool | null = null

export function activationProviderConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return env.APP_ACTIVATION_PROVIDER === 'postgres' && env.APP_ACTIVATION_ENABLE_WRITES === 'true'
    && !!env.APP_ACTIVATION_DATABASE_URL && !!env.APP_ACTIVATION_APP_ORIGINS
    && !!env.APP_ACTIVATION_CONSENT_VERSION
}

export function configuredAppOrigins(env: Record<string, string | undefined> = process.env): Record<string, string[]> {
  if (!activationProviderConfigured(env)) return {}
  try {
    const value: unknown = JSON.parse(env.APP_ACTIVATION_APP_ORIGINS!)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const entries = Object.entries(value)
    if (!entries.length || entries.some(([key, origins]) =>
      !/^[a-z0-9][a-z0-9-]{1,62}$/.test(key) || !Array.isArray(origins)
      || origins.length === 0 || origins.some(origin => !isExactHttpsOrigin(origin))
      || new Set(origins).size !== origins.length)) return {}
    return Object.fromEntries(entries) as Record<string, string[]>
  } catch { return {} }
}

export function getActivationRepository(): ActivationRepository | null {
  if (!activationProviderConfigured() || Object.keys(configuredAppOrigins()).length === 0) return null
  if (!pool) pool = new Pool({ connectionString: process.env.APP_ACTIVATION_DATABASE_URL!, max: 4 })
  return new PostgresActivationRepository(pool)
}

async function transaction<T>(db: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect()
  try {
    await client.query('begin')
    await client.query('set local role service_role')
    const result = await work(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally { client.release() }
}

const event = async (db: PoolClient, appKey: string, interestId: string, type: string, actor: string | null, sourceType: string, sourceRef: string | null, invitationId: string | null = null, grantId: string | null = null) => {
  await db.query(`insert into public.activation_events(app_key,interest_id,invitation_id,grant_id,event_type,actor_user_id,source_type,source_ref)
    values($1,$2,$3,$4,$5,$6,$7,$8)`, [appKey, interestId, invitationId, grantId, type, actor, sourceType, sourceRef])
}

class PostgresActivationRepository implements ActivationRepository {
  constructor(private readonly db: Pool) {}

  async intake(input: IntakeInput): Promise<void> {
    const replay = hash(`${input.appKey}\0${input.idempotencyKey}`)
    await transaction(this.db, async db => {
      await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [replay])
      const existing = await db.query<{ id: string; adult_email: string; source_ref: string | null; document_version: string | null }>(
        `select i.id,i.adult_email,i.source_ref,c.document_version from public.activation_interests i
          left join lateral (select document_version from public.activation_consents where interest_id=i.id and consent_kind='interest_contact' order by recorded_at desc,id desc limit 1) c on true
          where i.app_key=$1 and i.intake_key_hash=$2 for update of i`, [input.appKey, replay])
      if (existing.rowCount) {
        if (existing.rows[0].adult_email !== input.adultEmail || existing.rows[0].source_ref !== input.sourceReceipt || existing.rows[0].document_version !== input.consentVersion)
          throw new ActivationError('Idempotency key was used for a different request.', 409)
        return
      }
      const app = await db.query('select 1 from public.activation_apps where app_key=$1', [input.appKey])
      if (!app.rowCount) throw new ActivationError('App is not registered.', 404)
      const inserted = await db.query<{ id: string }>(`insert into public.activation_interests(app_key,adult_email,source_type,source_ref,intake_key_hash)
        values($1,$2,$3,$4,$5) returning id`, [input.appKey, input.adultEmail, input.sourceType, input.sourceReceipt, replay])
      const interestId = inserted.rows[0].id
      await db.query(`insert into public.activation_consents(interest_id,app_key,consent_kind,document_version,decision,source_type,source_ref)
        values($1,$2,'interest_contact',$3,'granted',$4,$5)`, [interestId, input.appKey, input.consentVersion, input.sourceType, input.sourceReceipt])
      await event(db, input.appKey, interestId, 'interest_submitted', null, input.sourceType, input.sourceReceipt)
      await event(db, input.appKey, interestId, 'consent_recorded', null, input.sourceType, input.sourceReceipt)
    })
  }

  async redeem(input: RedeemInput): Promise<boolean> {
    return transaction(this.db, async db => {
      const result = await db.query<{ id: string }>(
        `select activation_private.redeem_invitation($1,$2,$3,$4) as id`,
        [input.appKey, hashInvitationToken(input.token), input.authUserId, new Date(Date.now() + 30 * 86400000)])
      return !!result.rows[0]?.id
    })
  }

  async hasGrant(appKey: string, authUserId: string): Promise<boolean> {
    return transaction(this.db, async db => {
      const result = await db.query(`select 1 from public.activation_grants where app_key=$1 and auth_user_id=$2
        and revoked_at is null and (expires_at is null or expires_at>now()) limit 1`, [appKey, authUserId])
      return !!result.rowCount
    })
  }

  async snapshot(): Promise<OperatorSnapshot> {
    return transaction(this.db, async db => {
    const apps = await db.query<{ app_key: string; display_name: string }>('select app_key,display_name from public.activation_apps order by display_name')
    const rows = await db.query<{
      id: string; app_key: string; adult_email: string; status: OperatorRecord['status']; source_type: string; source_ref: string | null; created_at: Date;
      consent_decision: 'granted' | 'withdrawn' | null; consent_version: string | null; consent_at: Date | null;
      invitation_id: string | null; invitation_status: 'issued' | 'redeemed' | 'expired' | 'revoked' | null; invitation_expires: Date | null; invitation_redeemed: Date | null; invitation_revoked: Date | null;
      grant_id: string | null; grant_expires: Date | null; grant_revoked: Date | null
    }>(`select i.id,i.app_key,i.adult_email,i.status,i.source_type,i.source_ref,i.created_at,
      c.decision consent_decision,c.document_version consent_version,c.recorded_at consent_at,
      v.id invitation_id,v.status invitation_status,v.expires_at invitation_expires,v.redeemed_at invitation_redeemed,v.revoked_at invitation_revoked,
      g.id grant_id,g.expires_at grant_expires,g.revoked_at grant_revoked
      from public.activation_interests i
      left join lateral (select * from public.activation_consents where interest_id=i.id and consent_kind='interest_contact' order by recorded_at desc,id desc limit 1) c on true
      left join lateral (select * from public.activation_invitations where interest_id=i.id order by issued_at desc,id desc limit 1) v on true
      left join public.activation_grants g on g.invitation_id=v.id order by i.created_at desc limit 200`)
    const records: OperatorRecord[] = rows.rows.map(row => ({
      id: row.id, appKey: row.app_key, adultEmail: row.adult_email, status: row.status,
      source: { type: row.source_type, receipt: row.source_ref || '', capturedAt: row.created_at.toISOString() },
      consent: row.consent_decision && row.consent_version && row.consent_at ? { decision: row.consent_decision, version: row.consent_version, recordedAt: row.consent_at.toISOString() } : null,
      release: { ready: false, reason: 'Provider release approval is not configured.' },
      invitation: row.invitation_id && row.invitation_expires && row.invitation_status ? { id: row.invitation_id, status: row.invitation_status, expiresAt: row.invitation_expires.toISOString(), redeemedAt: row.invitation_redeemed?.toISOString() || null, revokedAt: row.invitation_revoked?.toISOString() || null } : null,
      grant: row.grant_id ? { id: row.grant_id, expiresAt: row.grant_expires?.toISOString() || null, revokedAt: row.grant_revoked?.toISOString() || null } : null,
      events: [],
    }))
    if (records.length) {
      const events = await db.query<{ id: string; interest_id: string; event_type: string; occurred_at: Date; actor_user_id: string | null; source_type: string; source_ref: string | null }>(
        `select id,interest_id,event_type,occurred_at,actor_user_id,source_type,source_ref from public.activation_events
          where interest_id=any($1::uuid[]) order by occurred_at desc,id desc limit 1000`, [records.map(row => row.id)])
      const byId = new Map(records.map(row => [row.id, row]))
      for (const eventRow of events.rows) byId.get(eventRow.interest_id)?.events.push({
        id: eventRow.id, type: eventRow.event_type, at: eventRow.occurred_at.toISOString(),
        actor: eventRow.actor_user_id || eventRow.source_type, reason: eventRow.source_ref || '',
      })
    }
    return { mode: 'provider', apps: apps.rows.map(app => ({ key: app.app_key, name: app.display_name })), records, message: 'Provider data is available for review. Issuance remains release-gated.' }
    })
  }

  async operator(input: OperatorInput): Promise<{ record: OperatorRecord; deliveryToken?: string }> {
    const reason = input.reason.trim()
    if (reason.length < 8 || reason.length > 500) throw new ActivationError('Enter an audit reason of 8–500 characters.', 400)
    if (['reject','revoke_invitation','revoke_grant'].includes(input.action) && input.confirmation !== input.action) throw new ActivationError('Confirmation required.', 400)
    let deliveryToken: string | undefined
    await transaction(this.db, async db => {
      const found = await db.query<{ status: string; adult_email: string; source_ref: string | null }>(
        'select status,adult_email,source_ref from public.activation_interests where id=$1 and app_key=$2 for update', [input.recordId, input.appKey])
      if (!found.rowCount) throw new ActivationError('Interest not found for this app.', 404)
      const row = found.rows[0]
      const target: Partial<Record<OperatorAction, string>> = { start_review: 'in_review', approve: 'approved', waitlist: 'waitlisted', reject: 'rejected' }
      const allowed: Record<string, string[]> = { submitted: ['in_review'], in_review: ['approved','waitlisted','rejected'], approved: ['waitlisted','rejected'], waitlisted: ['in_review','rejected'], rejected: [] }
      if (target[input.action]) {
        const next = target[input.action]!
        if (!allowed[row.status]?.includes(next)) throw new ActivationError('Invalid interest transition.')
        if (row.status === 'approved') {
          const active = await db.query(`select 1 from public.activation_invitations where interest_id=$1 and status='issued' and expires_at>now()
            union all select 1 from public.activation_grants where interest_id=$1 and revoked_at is null and (expires_at is null or expires_at>now())`, [input.recordId])
          if (active.rowCount) throw new ActivationError('Revoke active invitation or grant before changing approval.')
        }
        await db.query('update public.activation_interests set status=$1,reviewed_at=now(),reviewed_by=$2,review_note=$3 where id=$4', [next,input.actor,reason,input.recordId])
        await event(db,input.appKey,input.recordId,({in_review:'review_started',approved:'interest_approved',waitlisted:'interest_waitlisted',rejected:'interest_rejected'} as Record<string,string>)[next],input.actor,'operator',reason)
      } else if (input.action === 'prepare_invitation') {
        if (process.env.APP_ACTIVATION_ISSUANCE_ENABLED !== 'true') throw new ActivationError('Invitation issuance is not enabled.', 503)
        if (row.status !== 'approved' || !row.source_ref) throw new ActivationError('Approved interest and source receipt required.')
        const consent = await db.query<{ decision: string }>(`select decision from public.activation_consents where interest_id=$1 and consent_kind='interest_contact' order by recorded_at desc,id desc limit 1`, [input.recordId])
        if (consent.rows[0]?.decision !== 'granted') throw new ActivationError('Current contact consent required.')
        const prior = await db.query('select 1 from public.activation_invitations where interest_id=$1', [input.recordId])
        if (prior.rowCount) throw new ActivationError('An invitation already exists. Review its state before reissue.')
        const raw = randomBytes(32).toString('base64url')
        const issued = await db.query<{ id: string }>(`insert into public.activation_invitations(app_key,interest_id,token_hash,expires_at)
          values($1,$2,$3,now()+interval '7 days') returning id`, [input.appKey,input.recordId,hashInvitationToken(raw)])
        await event(db,input.appKey,input.recordId,'invitation_issued',input.actor,'operator',reason,issued.rows[0].id)
        // Returned exactly once to the authorized operator route. No delivery adapter is wired.
        deliveryToken = raw
      } else if (input.action === 'revoke_invitation') {
        const revoked = await db.query<{ id: string }>(`update public.activation_invitations set status='revoked',revoked_at=now(),revoked_by=$1
          where interest_id=$2 and app_key=$3 and status='issued' and expires_at>now() returning id`, [input.actor,input.recordId,input.appKey])
        if (!revoked.rowCount) throw new ActivationError('Only a current unredeemed invitation can be revoked.')
        await event(db,input.appKey,input.recordId,'invitation_revoked',input.actor,'operator',reason,revoked.rows[0].id)
      } else if (input.action === 'revoke_grant') {
        const revoked = await db.query<{ id: string; invitation_id: string }>(`update public.activation_grants set revoked_at=now(),revoked_by=$1,revoke_reason=$2
          where interest_id=$3 and app_key=$4 and revoked_at is null and (expires_at is null or expires_at>now()) returning id,invitation_id`, [input.actor,reason,input.recordId,input.appKey])
        if (!revoked.rowCount) throw new ActivationError('Only an active grant can be revoked.')
        await event(db,input.appKey,input.recordId,'grant_revoked',input.actor,'operator',reason,revoked.rows[0].invitation_id,revoked.rows[0].id)
      } else throw new ActivationError('Unknown action.',400)
    })
    const snapshot = await this.snapshot()
    const record = snapshot.records.find(row => row.id === input.recordId && row.appKey === input.appKey)
    if (!record) throw new ActivationError('Updated record could not be read.',500)
    return { record, deliveryToken }
  }
}
