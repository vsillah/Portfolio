const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const db = new PGlite()
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE contact_submissions(id bigint primary key,email text);
CREATE TABLE proposals(id uuid primary key default gen_random_uuid(),client_name text,client_email text,client_company text,bundle_name text,line_items jsonb,subtotal numeric,discount_amount numeric,total_amount numeric,terms_text text,valid_until timestamptz,status text,created_by uuid,access_code text,paid_at timestamptz);
CREATE TABLE client_projects(id uuid primary key default gen_random_uuid(),project_name text not null,description text,client_name text not null,client_email text not null,client_company text,contact_submission_id bigint,proposal_id uuid references proposals(id),client_id uuid,project_status text,current_phase int check(current_phase between 1 and 4),project_value numeric,payment_amount numeric,currency text,project_start_date date not null,estimated_end_date date not null);
CREATE TABLE client_dashboard_access(id uuid primary key default gen_random_uuid(),client_project_id uuid references client_projects(id),client_email text,access_token text,is_active boolean);
CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text primary key,name text,public boolean); CREATE TABLE storage.objects(id uuid,bucket_id text);
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY; ALTER TABLE client_projects ENABLE ROW LEVEL SECURITY; ALTER TABLE client_dashboard_access ENABLE ROW LEVEL SECURITY; ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY legacy ON proposals FOR SELECT USING (true); GRANT SELECT ON proposals TO anon;
INSERT INTO contact_submissions VALUES (42,'synthetic@example.invalid');
`)
const migration = readFileSync(process.argv[2],'utf8')
await db.exec("INSERT INTO storage.buckets VALUES ('proposal-private','proposal-private',true); BEGIN")
await assert.rejects(db.exec(migration))
await db.exec("ROLLBACK; DELETE FROM storage.buckets WHERE id='proposal-private'")
await db.exec(migration)
const payload = { contact_id:42,client_name:'Synthetic reviewer',client_email:'synthetic@example.invalid',client_company:'Synthetic practice',title:'Workflow prototype',line_items:[{title:'Workflow prototype',price:997}],terms_text:'Fictional cases only',agreement_text:'Reviewed test agreement',valid_until:null,policy:{version:1,currency:'usd',totalCents:99700,depositCents:49850,balanceCents:49850,acceptanceCriteria:['Demonstrate fictional workflow']} }
const args=['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','digest',JSON.stringify(payload),'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']
const prepare=()=>db.query('select prepare_staged_proposal($1,$2,$3,$4) as id',args)
const id=(await prepare()).rows[0].id
assert.equal((await prepare()).rows[0].id,id)
await assert.rejects(db.query('select prepare_staged_proposal($1,$2,$3,$4)', ['cccccccc-cccc-4ccc-8ccc-cccccccccccc',...args.slice(1)]))
await db.exec("INSERT INTO contact_submissions VALUES (43,'synthetic@example.invalid')")
await assert.rejects(db.query('select prepare_staged_proposal($1,$2,$3,$4)', ['dddddddd-dddd-4ddd-8ddd-dddddddddddd','digest',JSON.stringify({...payload,contact_id:43}),args[3]]))
await assert.rejects(db.query("update proposals set client_email='changed@example.invalid' where id=$1",[id]))
await db.query("update proposal_staged_packages set ready=true where proposal_id=$1",[id])
await db.query('select release_staged_proposal($1,$2)',[id,'digest'])
await db.query('update client_dashboard_access set is_active=false')
await assert.rejects(db.query('select release_staged_proposal($1,$2)',[id,'digest']))
assert.equal((await db.query('select count(*)::int as n from proposals')).rows[0].n,1)
assert.deepEqual((await db.query('select project_status,project_start_date,estimated_end_date,payment_amount::text from client_projects')).rows[0],{project_status:'pending',project_start_date:null,estimated_end_date:null,payment_amount:'0'})
await db.exec('SET ROLE anon')
assert.equal((await db.query('select * from proposals')).rows.length,0)
await db.exec('RESET ROLE')
await assert.rejects(db.query(`select record_proposal_stage_receipt($1,'deposit','cs1','evt1',49850)`,[id]))
await db.query(`update proposal_staged_packages set proposal_signed_at=now(),agreement_signed_at=now() where proposal_id=$1`,[id])
await db.query(`update proposal_payment_stages set checkout_session_id='cs1' where proposal_id=$1 and stage='deposit'`,[id])
await db.query(`select record_proposal_stage_receipt($1,'deposit','cs1','evt1',49850)`,[id])
await db.query(`select record_proposal_stage_receipt($1,'deposit','cs1','evt1',49850)`,[id])
assert.equal((await db.query('select status from proposals')).rows[0].status,'deposit_paid')
assert.equal((await db.query('select payment_amount::text from client_projects')).rows[0].payment_amount,'498.5000000000000000')
await db.query(`update proposal_payment_stages set checkout_session_id='cs2' where proposal_id=$1 and stage='balance'`,[id])
await assert.rejects(db.query(`select record_proposal_stage_receipt($1,'balance','cs2','evt2',49850)`,[id]))
await db.query('update proposal_staged_packages set delivered_at=now(),delivery_accepted_at=now() where proposal_id=$1',[id])
await db.query(`select record_proposal_stage_receipt($1,'balance','cs2','evt2',49850)`,[id])
assert.equal((await db.query('select status from proposals')).rows[0].status,'paid')
console.log('PASS: migration, atomic preparation dedupe, pending dates/payment, anonymous isolation, receipt linkage, duplicate receipt, balance acceptance gate, full settlement')
await db.close()
