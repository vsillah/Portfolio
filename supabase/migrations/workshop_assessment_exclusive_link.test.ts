import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'
import { DECISION_FILE_VERSION } from '@/lib/accelerated-decision-file'
import { AGENTIFIED_VERSION } from '@/lib/agentified-workshop'

const migration = readFileSync('supabase/migrations/20261109154814_workshop_assessment_exclusive_link.sql', 'utf8')
const uuid = (last: string) => `00000000-0000-4000-8000-${last.padStart(12, '0')}`

describe('workshop intake and paid conversion SQL', () => {
  it('enforces one approved intake per order and only paid same-owner project conversion', async () => {
    const db = new PGlite()
    try {
      await db.exec(`create role anon; create role authenticated; create role service_role;
        create table public.accelerated_decision_file_intakes(id uuid primary key, content_version text not null, linked_audit_id bigint);
        create table public.accelerated_member_recommendations(id uuid primary key, intake_id uuid, user_id uuid, review_status text);
        create table public.orders(id bigint primary key, user_id uuid, status text, stripe_payment_intent_id text,
          accelerated_recommendation_ids uuid[] not null default '{}', accelerated_quote_recommendation_id uuid);
        create table public.verified_client_project_memberships(id bigint generated always as identity primary key,
          user_id uuid, client_project_id uuid, verification_source text);`)
      await db.exec(migration)
      const user = uuid('1'), otherUser = uuid('2'), accelerated = uuid('3'), agentified = uuid('4')
      const acceleratedRec = uuid('5'), agentifiedRec = uuid('6'), unapproved = uuid('7')
      await db.query('insert into public.accelerated_decision_file_intakes(id,content_version) values ($1,$2),($3,$4)',
        [accelerated, DECISION_FILE_VERSION, agentified, AGENTIFIED_VERSION])
      await db.query(`insert into public.accelerated_member_recommendations(id,intake_id,user_id,review_status)
        values ($1,$2,$3,'approved'),($4,$5,$3,'approved'),($6,$2,$3,'pending')`,
        [acceleratedRec, accelerated, user, agentifiedRec, agentified, unapproved])
      const inserted = await db.query<{ workshop_intake_id: string }>(`insert into public.orders(id,user_id,status,stripe_payment_intent_id,accelerated_recommendation_ids)
        values (1,$1,'completed','synthetic-payment',array[$2]::uuid[]) returning workshop_intake_id`, [user, agentifiedRec])
      expect(inserted.rows[0].workshop_intake_id).toBe(agentified)
      await expect(db.query(`insert into public.orders(id,user_id,status,accelerated_recommendation_ids)
        values (2,$1,'pending',array[$2,$3]::uuid[])`, [user, acceleratedRec, agentifiedRec])).rejects.toThrow()
      await expect(db.query(`insert into public.orders(id,user_id,status,accelerated_recommendation_ids)
        values (3,$1,'pending',array[$2]::uuid[])`, [otherUser, agentifiedRec])).rejects.toThrow()
      await expect(db.query(`insert into public.orders(id,user_id,status,accelerated_recommendation_ids)
        values (4,$1,'pending',array[$2]::uuid[])`, [user, unapproved])).rejects.toThrow()
      await expect(db.query(`insert into public.orders(id,user_id,status,accelerated_recommendation_ids,workshop_intake_id)
        values (5,$1,'pending',array[$2]::uuid[],$3)`, [user, agentifiedRec, accelerated])).rejects.toThrow()
      await expect(db.query(`insert into public.verified_client_project_memberships(user_id,client_project_id,verification_source,source_order_id,workshop_intake_id)
        values ($1,$2,'checkout_conversion',1,$3)`, [otherUser, uuid('8'), agentified])).rejects.toThrow()
      await expect(db.query(`insert into public.verified_client_project_memberships(user_id,client_project_id,verification_source,source_order_id,workshop_intake_id)
        values ($1,$2,'checkout_conversion',1,$3)`, [user, uuid('8'), accelerated])).rejects.toThrow()
      await db.query(`insert into public.verified_client_project_memberships(user_id,client_project_id,verification_source,source_order_id,workshop_intake_id)
        values ($1,$2,'checkout_conversion',1,$3)`, [user, uuid('8'), agentified])
      await expect(db.query(`insert into public.verified_client_project_memberships(user_id,client_project_id,verification_source,source_order_id,workshop_intake_id)
        values ($1,$2,'checkout_conversion',1,$3)`, [user, uuid('9'), agentified])).rejects.toThrow()
      const grants = await db.query<{ anon: boolean; authenticated: boolean; service_role: boolean }>(`select
        has_function_privilege('anon','public.guard_workshop_order_intake()','execute') anon,
        has_function_privilege('authenticated','public.guard_workshop_project_conversion()','execute') authenticated,
        has_function_privilege('service_role','public.guard_workshop_project_conversion()','execute') service_role`)
      expect(grants.rows[0]).toEqual({ anon: false, authenticated: false, service_role: true })
    } finally { await db.close() }
  })
})
