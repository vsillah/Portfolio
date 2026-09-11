/** Synthetic-only PostgreSQL regression. Existing isolated Docker container; no network/hosted DB. */
const { execFileSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const container =
  process.env.PROPOSAL_SQL_CONTAINER || "codex-proposal-sql-01a0896e";
if (container !== 'codex-proposal-sql-01a0896e') throw new Error('Refusing any container other than the dedicated synthetic fixture');
const isolation=execFileSync('docker',['inspect','--format','{{.HostConfig.NetworkMode}}',container],{encoding:'utf8'}).trim();
if(isolation !== 'none') throw new Error('Synthetic database must have networking disabled');
const args = [
  "exec",
  "-i",
  container,
  "psql",
  "-h",
  "/tmp",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-X",
  "-At",
  "-v",
  "ON_ERROR_STOP=1",
];
const sql = (s) =>
  execFileSync("docker", args, {
    input: s,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
const asyncSql = (s) =>
  new Promise((resolve, reject) => {
    const p = spawn("docker", args);
    let out = "";
    p.stdout.on("data", (b) => (out += b));
    p.stderr.on("data", (b) => (out += b));
    p.on("close", (code) => resolve({ code, out }));
    p.on("error", reject);
    p.stdin.end(s);
  });
const p = "11111111-1111-4111-8111-111111111111",
  d = "22222222-2222-4222-8222-222222222222",
  d2 = "33333333-3333-4333-8333-333333333333";
const identity = `'{"revision":"44444444-4444-4444-8444-444444444444","pdf_url":null,"contract_pdf_url":null}'::jsonb`;
const path = `proposal-docs/${p}/${d}.pdf`;
const bind = (id = d, role = "primary", expected = identity) =>
  `select bind_proposal_document('${p}','${id}','${role}','Synthetic','other','proposal-docs/${p}/${id}.pdf','${"a".repeat(64)}',${expected});`;
const sign = (expected = identity) =>
  `select sign_proposal_document('${p}',false,'Synthetic signer','local',null,${expected});`;
let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  console.log("PASS", name);
};
const rejects = (s) => assert.throws(() => sql(s));
(async () => {
  sql(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
 DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; END IF; END $$;
 CREATE TABLE proposals(id uuid primary key,status text default 'draft',pdf_url text,contract_pdf_url text,access_code text,sent_at timestamptz,viewed_at timestamptz,accepted_at timestamptz,paid_at timestamptz,signed_at timestamptz,signed_by_name text,signed_ip text,signature_data jsonb,contract_signed_at timestamptz,contract_signed_by_name text,contract_signed_ip text,stripe_checkout_session_id text,stripe_payment_intent_id text,valid_until timestamptz,terms_text text);
 CREATE TABLE proposal_documents(id uuid primary key default gen_random_uuid(),proposal_id uuid references proposals(id),document_type text,title text,file_path text,display_order integer,source text,created_at timestamptz default now());`);
  sql(
    fs.readFileSync(
      "supabase/migrations/20260910112415_native_proposal_document_consistency.sql",
      "utf8",
    ),
  );
  const reset = () =>
    sql(
      `truncate proposal_documents,proposals;insert into proposals(id,document_revision)values('${p}','44444444-4444-4444-8444-444444444444');`,
    );
  check("service-only invoker grants and empty search path", () => {
    assert.equal(
      sql(
        `select count(*) from pg_proc where proname in ('bind_proposal_document','sign_proposal_document','delete_proposal_supporting_document') and not prosecdef and proconfig @> array['search_path=""'] and not has_function_privilege('anon',oid,'EXECUTE') and not has_function_privilege('authenticated',oid,'EXECUTE') and has_function_privilege('service_role',oid,'EXECUTE');`,
      ),
      "3",
    );
  });
  reset();
  check("bind and exact retry keep one record", () => {
    sql(bind());
    sql(bind());
    assert.equal(sql("select count(*) from proposal_documents"), "1");
  });
  check("stale identity cannot sign replacement", () => rejects(sign()));
  check("bound/history deletion rejected", () =>
    rejects(`select delete_proposal_supporting_document('${p}','${d}');`),
  );
  check("fresh identity signs once, repeat cannot overwrite signer", () => {
    const current = `jsonb_build_object('revision',(select document_revision from proposals),'pdf_url','storage:documents/${path}','contract_pdf_url',null)`;
    rejects(sign(current));
    sql("update proposals set access_code='ISSUED'");
    sql(sign(current));
    sql(sign(current));
    rejects(sign(current).replace("Synthetic signer", "Other signer"));
    assert.equal(
      sql("select signed_by_name from proposals"),
      "Synthetic signer",
    );
  });
  for (const column of [
    "access_code",
    "sent_at",
    "viewed_at",
    "accepted_at",
    "paid_at",
    "signed_at",
    "contract_signed_at",
    "stripe_checkout_session_id",
    "stripe_payment_intent_id",
    "signed_ip",
    "contract_signed_ip",
  ]) {
    reset();
    check("locked " + column, () => {
      sql(
        `update proposals set ${column}=${column.endsWith("_at") ? "now()" : "'locked'"};`,
      );
      rejects(bind());
      assert.equal(sql("select count(*) from proposal_documents"), "0");
    });
  }
  reset();
  check("null status fails closed", () => {
    sql("update proposals set status=null");
    rejects(bind());
    rejects(sign());
  });
  reset();
  check(
    "terms revision rejects stale text and signatures are immutable",
    () => {
      sql("update proposals set terms_text='new synthetic terms'");
      rejects(sign());
      const current =
        "jsonb_build_object('revision',(select document_revision from proposals),'pdf_url',null,'contract_pdf_url',null)";
      sql(sign(current));
      rejects("update proposals set terms_text='changed after signing'");
      rejects("update proposals set signed_by_name='replacement'");
      sql("update proposals set status='accepted',paid_at=now()");
    },
  );
  reset();
  check("supporting and delete compatibility", () => {
    sql(bind(d, "supporting"));
    sql(`select delete_proposal_supporting_document('${p}','${d}');`);
    assert.equal(sql("select count(*) from proposal_documents"), "0");
  });
  reset();
  check("legacy public URL protected", () => {
    sql(bind(d, "supporting"));
    sql(
      `update proposals set pdf_url='https://synthetic.invalid/storage/v1/object/public/documents/${path}';`,
    );
    rejects(`select delete_proposal_supporting_document('${p}','${d}');`);
  });
  reset();
  check("request collision rolls back all changes", () => {
    sql(bind());
    rejects(bind(d, "agreement"));
    assert.equal(sql("select contract_pdf_url is null from proposals"), "t");
  });
  reset();
  const first = asyncSql(`begin;${sign()}select pg_sleep(1);commit;`);
  await new Promise((r) => setTimeout(r, 200));
  const second = await asyncSql(bind());
  assert.equal((await first).code, 0);
  assert.notEqual(second.code, 0);
  checks++;
  console.log("PASS signer-first lock ordering blocks bind");
  reset();
  const a = asyncSql(`begin;${bind()}select pg_sleep(1);commit;`);
  await new Promise((r) => setTimeout(r, 200));
  const b = await asyncSql(sign());
  assert.equal((await a).code, 0);
  assert.notEqual(b.code, 0);
  checks++;
  console.log("PASS bind-first lock ordering rejects stale signature");
  reset();
  const pair = await Promise.all([asyncSql(bind()), asyncSql(bind())]);
  assert(pair.every((r) => r.code === 0));
  assert.equal(sql("select count(*) from proposal_documents"), "1");
  checks++;
  console.log("PASS simultaneous same-request binding returns one record");
  reset();
  const sigs = await Promise.all([
    asyncSql(sign()),
    asyncSql(sign().replace("Synthetic signer", "Other signer")),
  ]);
  assert.equal(sigs.filter((r) => r.code === 0).length, 1);
  checks++;
  console.log("PASS competing signatures preserve first signer");
  reset();
  const binding = asyncSql(`begin;${bind()}select pg_sleep(1);commit;`);
  await new Promise((r) => setTimeout(r, 200));
  const removal = await asyncSql(
    `select delete_proposal_supporting_document('${p}','${d}');`,
  );
  assert.equal((await binding).code, 0);
  assert.notEqual(removal.code, 0);
  assert.equal(sql("select count(*) from proposal_documents"), "1");
  checks++;
  console.log("PASS bind/delete ordering retains bound record");
  reset();check('old upload replay remains history after replacement',()=>{sql(bind());const current="jsonb_build_object('revision',(select document_revision from proposals),'pdf_url',(select pdf_url from proposals),'contract_pdf_url',null)";sql(bind(d2,'primary',current));const old=JSON.parse(sql(bind()));assert.equal(old.is_current,false);assert.equal(sql('select count(*) from proposal_documents'),'2');});
  console.log(JSON.stringify({ checks, hostedRequests: [], synthetic: true }));
})().catch((e) => {
  console.error(e.stderr?.toString() || e);
  process.exitCode = 1;
});
