import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'
import { hashInvitationToken } from './app-activation'

const base = readFileSync('supabase/migrations/20261106234206_app_activation_control_plane.sql', 'utf8')
const direct = readFileSync('supabase/migrations/20261107010645_app_activation_direct_intake.sql', 'utf8')
const runtime = readFileSync('supabase/migrations/20261107111258_app_activation_runtime_boundaries.sql', 'utf8')
const id = (last: string) => `00000000-0000-4000-8000-${last.padStart(12, '0')}`

describe('local activation SQL', () => {
  it('applies both migrations and atomically rejects cross-app, email, expiry, revocation, and replay', async () => {
    const db = new PGlite()
    try {
      await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
        create schema auth; create table auth.users(id uuid primary key, email text); grant usage on schema auth to service_role;`)
      await db.exec(base)
      await db.exec(direct)
      await db.exec(runtime)
      await db.query(`insert into auth.users(id,email) values($1,'adult@example.test'),($2,'other@example.test')`, [id('1'), id('2')])
      await db.exec(`insert into public.activation_apps(app_key,display_name) values('trumpet-trainer','Trumpet Trainer'),('future-app','Future App');`)
      const token = 'fixture-invite-secret'
      await db.query(`insert into public.activation_interests(id,app_key,adult_email,status,source_type,source_ref,intake_key_hash)
        values($1,'trumpet-trainer','adult@example.test','approved','direct_form','fixture:receipt-1',$2)`, [id('3'), 'a'.repeat(64)])
      await expect(db.query(`insert into public.activation_interests(app_key,adult_email,source_type,intake_key_hash)
        values('trumpet-trainer','adult@example.test','direct_form',$1)`, ['a'.repeat(64)])).rejects.toThrow()
      await db.query(`insert into public.activation_consents(interest_id,app_key,consent_kind,document_version,decision,source_type)
        values($1,'trumpet-trainer','interest_contact','interest-v1','granted','direct_form')`, [id('3')])
      await db.query(`insert into public.activation_invitations(id,interest_id,app_key,token_hash,expires_at)
        values($1,$2,'trumpet-trainer',$3,now()+interval '7 days')`, [id('4'), id('3'), hashInvitationToken(token)])
      await db.exec('set role service_role')
      const claim = async (app: string, user: string, raw = token) => db.query<{ id: string | null }>(
        `select activation_private.redeem_invitation($1,$2,$3,now()+interval '30 days') id`, [app, hashInvitationToken(raw), user])
      expect((await claim('future-app', id('1'))).rows[0].id).toBeNull()
      expect((await claim('trumpet-trainer', id('2'))).rows[0].id).toBeNull()
      expect((await claim('trumpet-trainer', id('1'))).rows[0].id).toBeTruthy()
      expect((await claim('trumpet-trainer', id('1'))).rows[0].id).toBeNull()
      const grants = await db.query<{ app_key: string; auth_user_id: string }>('select app_key,auth_user_id from public.activation_grants')
      expect(grants.rows).toEqual([{ app_key: 'trumpet-trainer', auth_user_id: id('1') }])

      await db.query(`insert into public.activation_invitations(id,interest_id,app_key,token_hash,expires_at,status,revoked_at,revoked_by)
        values($1,$2,'trumpet-trainer',$3,now()+interval '7 days','revoked',now(),$4)`, [id('5'), id('3'), hashInvitationToken('revoked-token'), id('1')])
      expect((await claim('trumpet-trainer', id('1'), 'revoked-token')).rows[0].id).toBeNull()
      await db.query(`insert into public.activation_invitations(id,interest_id,app_key,token_hash,issued_at,expires_at)
        values($1,$2,'trumpet-trainer',$3,now()-interval '3 days',now()-interval '1 day')`, [id('6'), id('3'), hashInvitationToken('expired-token')])
      expect((await claim('trumpet-trainer', id('1'), 'expired-token')).rows[0].id).toBeNull()
    } finally { await db.close() }
  })
  it('keeps abuse and handoff records private, rejects cross-app claims and single-use replays', async () => {
    const db = new PGlite()
    try {
      await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
        create schema auth; create table auth.users(id uuid primary key, email text); grant usage on schema auth to service_role;`)
      await db.exec(base)
      await db.exec(direct)
      await db.exec(runtime)
      await db.exec(`insert into public.activation_apps(app_key,display_name) values('trumpet-trainer','Trumpet Trainer'),('future-app','Future App');`)
      await db.query(`insert into auth.users(id,email) values($1,'adult@example.test')`, [id('1')])
      await db.exec(`set role anon`)
      await expect(db.query('select * from activation_private.handoff_codes')).rejects.toThrow()
      await expect(db.query('select * from activation_private.abuse_buckets')).rejects.toThrow()
      await db.exec('reset role')
      await db.query(`insert into activation_private.handoff_codes(app_key,auth_user_id,code_hash,expires_at)
        values('trumpet-trainer',$1,$2,now()+interval '2 minutes')`, [id('1'), 'b'.repeat(64)])
      await db.exec('set role service_role')
      const claim = (app: string) => db.query(`update activation_private.handoff_codes set consumed_at=now()
        where app_key=$1 and code_hash=$2 and consumed_at is null and expires_at>now() returning auth_user_id`, [app, 'b'.repeat(64)])
      expect((await claim('future-app')).rowCount).toBe(0)
      expect((await claim('trumpet-trainer')).rowCount).toBe(1)
      expect((await claim('trumpet-trainer')).rowCount).toBe(0)
      await db.query(`insert into activation_private.handoff_codes(app_key,auth_user_id,code_hash,issued_at,expires_at)
        values('trumpet-trainer',$1,$2,now()-interval '3 minutes',now()-interval '1 minute')`, [id('1'), 'c'.repeat(64)])
      expect((await db.query(`update activation_private.handoff_codes set consumed_at=now()
        where code_hash=$1 and consumed_at is null and expires_at>now() returning id`, ['c'.repeat(64)])).rowCount).toBe(0)
      await db.query(`insert into activation_private.app_session_handles(handle_hash,app_key,auth_user_id,expires_at)
        values($1,'trumpet-trainer',$2,now()+interval '24 hours')`, ['d'.repeat(64), id('1')])
      expect((await db.query(`select 1 from activation_private.app_session_handles where app_key='future-app' and handle_hash=$1`, ['d'.repeat(64)])).rowCount).toBe(0)
    } finally { await db.close() }
  })
})
