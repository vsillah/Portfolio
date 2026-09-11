// Local-only isolated PostgreSQL. Never accepts a URL, service credential or hosted target.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const name = process.env.PROPOSAL_SQL_CONTAINER || "codex-proposal-sql-01a0896e";
assert.ok(["codex-proposal-sql-01a0896e", "codex-proposal-invoice-01a0896e"].includes(name));
assert.equal(
  execFileSync(
    "docker",
    ["inspect", "--format", "{{.HostConfig.NetworkMode}}", name],
    { encoding: "utf8" },
  ).trim(),
  "none",
);
const sql = (s) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      name,
      "psql",
      "-h",
      "/tmp",
      "-U",
      "postgres",
      "-X",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: s, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
// Reuse actual document migration and existing dedicated fixture setup, then extend prerequisites.
execFileSync(process.execPath, ["scripts/qa/proposal-document-sql.cjs"], {
  stdio: "pipe",
});
sql(`TRUNCATE proposals,proposal_documents; ALTER TABLE proposals ADD COLUMN total_amount numeric,ADD COLUMN client_name text,ADD COLUMN client_email text,ADD COLUMN client_company text,ADD COLUMN bundle_name text;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;CREATE TABLE orders(id bigint primary key);
CREATE TABLE client_projects(id uuid primary key default gen_random_uuid(),project_name text not null,client_name text not null,client_email text not null,client_id uuid,current_phase integer default 1 CHECK(current_phase BETWEEN 1 AND 4),client_company text,proposal_id uuid references proposals(id),project_status text,payment_amount numeric,project_start_date date not null,estimated_end_date date not null);
CREATE TABLE client_dashboard_access(id uuid primary key default gen_random_uuid(),client_project_id uuid references client_projects(id),client_email text,is_active boolean default true,access_token text UNIQUE default encode(gen_random_bytes(32),'hex'));
CREATE TABLE offer_bundles(id uuid); CREATE TABLE site_settings(key text primary key,value text);`);
sql(fs.readFileSync("migrations/2026_03_18_installment_plans.sql", "utf8"));
sql(
  fs.readFileSync(
    "supabase/migrations/20260911011959_native_proposal_milestones.sql",
    "utf8",
  ),
);
const id = "11111111-1111-4111-8111-111111111111";
sql(
  `INSERT INTO proposals(id,total_amount,payment_schedule,client_name,client_email,bundle_name,pdf_url,contract_pdf_url,access_code,status) VALUES('${id}',997,'milestones','Synthetic','qa@example.invalid','Synthetic workflow','proposal.pdf','agreement.pdf','${"A".repeat(48)}','sent');`,
);
const revision = () =>
  sql(`SELECT document_revision FROM proposals WHERE id='${id}'`);
const reserve = (n) =>
  JSON.parse(
    sql(`SELECT reserve_proposal_milestone('${id}',${n},'${revision()}')`),
  );
let checks = 0;
function pass(name, fn) {
  fn();
  checks++;
  console.log("PASS", name);
}
const reject = (s) => assert.throws(() => sql(s));
pass("both signatures required", () => assert.throws(() => reserve(1)));
sql(
  `UPDATE proposals SET signed_at=now(),signed_by_name='Synthetic',contract_signed_at=now(),contract_signed_by_name='Synthetic' WHERE id='${id}'`,
);
pass(
  "existing initial reservation cannot outlive proposal expiry; final remains eligible",
  () => {
    const expired = "55555555-5555-4555-8555-555555555555";
    sql(
      `INSERT INTO proposals(id,total_amount,payment_schedule,client_name,client_email,bundle_name,pdf_url,contract_pdf_url,access_code,status,valid_until,signed_at,contract_signed_at) VALUES('${expired}',997,'milestones','Synthetic expiry','qa@example.invalid','Expiry','p.pdf','c.pdf','${"E".repeat(48)}','sent',now()+interval '0.2 seconds',now(),now());SELECT reserve_proposal_milestone('${expired}',1,(SELECT document_revision FROM proposals WHERE id='${expired}'));SELECT pg_sleep(0.3);`,
    );
    reject(
      `SELECT reserve_proposal_milestone('${expired}',1,(SELECT document_revision FROM proposals WHERE id='${expired}'))`,
    );
    sql(
      `UPDATE installment_plans SET installments_paid=1,status='active',delivery_status='accepted' WHERE proposal_id='${expired}';UPDATE installment_payments SET status='paid',paid_at=now() WHERE payment_number=1 AND installment_plan_id IN(SELECT id FROM installment_plans WHERE proposal_id='${expired}');`,
    );
    assert.equal(
      JSON.parse(
        sql(
          `SELECT reserve_proposal_milestone('${expired}',2,(SELECT document_revision FROM proposals WHERE id='${expired}'))`,
        ),
      ).amount_cents,
      49850,
    );
    sql(
      `DELETE FROM installment_payments WHERE installment_plan_id IN(SELECT id FROM installment_plans WHERE proposal_id='${expired}');DELETE FROM installment_plans WHERE proposal_id='${expired}';DELETE FROM proposals WHERE id='${expired}'`,
    );
  },
);
let initial;
pass("initial exact cents and repeated reservation identity", () => {
  initial = reserve(1);
  assert.equal(initial.amount_cents, 49850);
  assert.equal(reserve(1).attempt, initial.attempt);
});
pass("final locked", () => assert.throws(() => reserve(2)));
const settle = (
  r,
  event = "paid",
  cents = 49850,
  session = "cs_synthetic_initial",
  intent = "pi_synthetic_initial",
) =>
  `SELECT settle_proposal_milestone('${id}','${r.payment_id}','${r.attempt}','${revision()}','${session}','${intent}',${cents},'usd','${event}')`;
pass("tampered amount and revision rejected", () => {
  reject(settle(initial, "paid", 99700));
  reject(
    `SELECT reserve_proposal_milestone('${id}',1,'22222222-2222-4222-8222-222222222222')`,
  );
});
pass("initial settlement replay exact and truthful dashboard", () => {
  sql(settle(initial));
  sql(settle(initial));
  assert.equal(sql("SELECT installments_paid FROM installment_plans"), "1");
  assert.equal(sql("SELECT payment_amount FROM client_projects"), "498.50");
  assert.equal(
    sql(
      "SELECT count(*) FROM client_projects WHERE project_start_date IS NOT NULL",
    ),
    "0",
  );
  assert.equal(
    sql("SELECT count(*) FROM proposals WHERE paid_at IS NOT NULL"),
    "0",
  );
});
pass("delivery rejection and correction before final", () => {
  sql(
    `SELECT review_milestone_delivery('${id}','submit',NULL,'All five synthetic acceptance cases delivered')`,
  );
  let rev = sql("SELECT delivery_revision FROM installment_plans");
  sql(
    `SELECT review_milestone_delivery('${id}','reject','${rev}','Closed-case prompt needs correction')`,
  );
  assert.throws(() => reserve(2));
  sql(
    `SELECT review_milestone_delivery('${id}','submit',NULL,'Closed-case prompt corrected; all criteria ready for review')`,
  );
  reject(`SELECT review_milestone_delivery('${id}','accept','${rev}',NULL)`);
  rev = sql("SELECT delivery_revision FROM installment_plans");
  sql(`SELECT review_milestone_delivery('${id}','accept','${rev}',NULL)`);
});
pass("expired checkout creates a new attempt only after evidence", () => {
  const r = reserve(2);
  sql(settle(r, "expired", 49850, "cs_expired", "pi_unused"));
  assert.notEqual(reserve(2).attempt, r.attempt);
});
pass("final settlement completes without duplicate dashboard", () => {
  const r = reserve(2);
  sql(settle(r, "paid", 49850, "cs_final", "pi_final"));
  sql(settle(r, "paid", 49850, "cs_final", "pi_final"));
  assert.equal(sql("SELECT installments_paid FROM installment_plans"), "2");
  assert.equal(sql("SELECT payment_amount FROM client_projects"), "997.00");
  assert.equal(sql("SELECT count(*) FROM client_projects"), "1");
  assert.equal(sql("SELECT status FROM proposals"), "paid");
});
pass("client roles cannot execute billing RPC", () => {
  for (const role of ["anon", "authenticated"])
    reject(
      `SET ROLE ${role}; SELECT reserve_proposal_milestone('${id}',1,'${revision()}')`,
    );
});
pass(
  "restrictive RLS hides milestone rows despite permissive legacy policies",
  () => {
    sql(`ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;ALTER TABLE proposal_documents ENABLE ROW LEVEL SECURITY;ALTER TABLE client_dashboard_access ENABLE ROW LEVEL SECURITY;
 GRANT USAGE ON SCHEMA public TO anon,authenticated;GRANT SELECT ON proposals,proposal_documents,installment_plans,installment_payments,client_dashboard_access TO anon,authenticated;
 CREATE POLICY fixture_public_read ON proposals FOR SELECT USING(true);CREATE POLICY fixture_docs_read ON proposal_documents FOR SELECT USING(true);CREATE POLICY fixture_access_read ON client_dashboard_access FOR SELECT USING(true);`);
    for (const role of ["anon", "authenticated"])
      for (const table of [
        "proposals",
        "installment_plans",
        "installment_payments",
        "client_dashboard_access",
      ])
        assert.equal(
          sql(`SET ROLE ${role};SELECT count(*) FROM ${table}`)
            .split("\n")
            .pop(),
          "0",
        );
  },
);
console.log(JSON.stringify({ checks, network: "none", synthetic: true }));
// Two independent PostgreSQL sessions contend on the same proposal row.
(async () => {
  const second = "33333333-3333-4333-8333-333333333333";
  sql(
    `INSERT INTO proposals(id,total_amount,payment_schedule,client_name,client_email,bundle_name,pdf_url,contract_pdf_url,access_code,status,signed_at,contract_signed_at) VALUES('${second}',997,'milestones','Synthetic concurrent','qa@example.invalid','Concurrent workflow','p.pdf','c.pdf','${"C".repeat(48)}','sent',now(),now());`,
  );
  const rev = sql(
    `SELECT document_revision FROM proposals WHERE id='${second}'`,
  );
  const statement = `SELECT reserve_proposal_milestone('${second}',1,'${rev}')`;
  const concurrent = (s) =>
    new Promise((resolve, reject) => {
      const child = require("node:child_process").spawn("docker", [
        "exec",
        "-i",
        name,
        "psql",
        "-h",
        "/tmp",
        "-U",
        "postgres",
        "-X",
        "-At",
        "-v",
        "ON_ERROR_STOP=1",
      ]);
      let out = "";
      child.stdout.on("data", (b) => (out += b));
      child.stderr.on("data", (b) => (out += b));
      child.on("error", reject);
      child.on("close", (code) =>
        code ? reject(new Error(out)) : resolve(out),
      );
      child.stdin.end(s);
    });
  const results = await Promise.all([
    concurrent(
      `BEGIN;SELECT id FROM proposals WHERE id='${second}' FOR UPDATE;SELECT pg_sleep(0.2);${statement};COMMIT;`,
    ),
    concurrent(statement),
  ]);
  const identities = results.map((s) =>
    JSON.parse(s.split("\n").find((line) => line.startsWith("{"))),
  );
  assert.equal(identities[0].payment_id, identities[1].payment_id);
  assert.equal(identities[0].attempt, identities[1].attempt);
  console.log(
    "PASS concurrent database reservations share one payment and attempt",
  );
  const pay = identities[0];
  const evidence = `SELECT settle_proposal_milestone('${second}','${pay.payment_id}','${pay.attempt}','${rev}','cs_concurrent','pi_concurrent',49850,'usd','paid')`;
  await Promise.all([concurrent(evidence), concurrent(evidence)]);
  assert.equal(
    sql(
      `SELECT installments_paid FROM installment_plans WHERE proposal_id='${second}'`,
    ),
    "1",
  );
  console.log("PASS concurrent webhook settlement records one initial payment");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
