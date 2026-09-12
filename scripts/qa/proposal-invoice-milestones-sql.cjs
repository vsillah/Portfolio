// Dedicated local fixture only; preserve the previous milestone container/state.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const name = "codex-proposal-invoice-01a0896e";
assert.equal(
  execFileSync(
    "docker",
    ["inspect", "--format", "{{.HostConfig.NetworkMode}}", name],
    { encoding: "utf8" },
  ).trim(),
  "none",
);
execFileSync(process.execPath, ["scripts/qa/proposal-milestones-sql.cjs"], {
  env: { ...process.env, PROPOSAL_SQL_CONTAINER: name },
  stdio: "pipe",
});
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
sql(
  fs.readFileSync(
    "supabase/migrations/20260911134522_native_proposal_invoice_milestones.sql",
    "utf8",
  ),
);
const id = "77777777-7777-4777-8777-777777777777",
  actor = "88888888-8888-4888-8888-888888888888";
sql(
  `INSERT INTO proposals(id,total_amount,payment_schedule,milestone_settlement,client_name,client_email,bundle_name,pdf_url,contract_pdf_url,access_code,status) VALUES('${id}',997,'milestones','manual_invoice','Synthetic invoice','qa@example.invalid','Synthetic invoice','p.pdf','c.pdf','${"F".repeat(48)}','sent')`,
);
const rev = () =>
  sql(`SELECT document_revision FROM proposals WHERE id='${id}'`);
const receipt = (n, reference = "invoice-" + n, amount = 498.5) =>
  `SELECT record_invoice_milestone_receipt('${id}',${n},'${rev()}',${amount},'${reference}','${actor}')`;
const reject = (s) => assert.throws(() => sql(s));
let checks = 0;
function check(label, fn) {
  fn();
  checks++;
  console.log("PASS", label);
}
check("requires both signatures before any manual receipt", () =>
  reject(receipt(1)),
);
sql(
  `UPDATE proposals SET signed_at=now(),signed_by_name='Synthetic signer',contract_signed_at=now(),contract_signed_by_name='Synthetic signer' WHERE id='${id}'`,
);
check("signed state creates no payment/project/access", () => {
  assert.equal(
    sql(`SELECT count(*) FROM installment_plans WHERE proposal_id='${id}'`),
    "0",
  );
  assert.equal(
    sql(`SELECT count(*) FROM client_projects WHERE proposal_id='${id}'`),
    "0",
  );
  assert.equal(
    sql(
      `SELECT count(*) FROM client_dashboard_access WHERE milestone_proposal_id='${id}'`,
    ),
    "0",
  );
});
check("checkout reservation and provider settlement rejected", () => {
  reject(`SELECT reserve_proposal_milestone('${id}',1,'${rev()}')`);
  reject(
    `SELECT settle_proposal_milestone('${id}','${actor}','${actor}','${rev()}','cs_bad','pi_bad',49850,'usd','paid')`,
  );
});
check("issued settlement mode cannot change or attach checkout", () => {
  reject(
    `UPDATE proposals SET milestone_settlement='stripe_checkout' WHERE id='${id}'`,
  );
  reject(
    `UPDATE proposals SET stripe_checkout_session_id='cs_bad' WHERE id='${id}'`,
  );
});
check(
  "rejects wrong amount, empty reference, stale revision and final before initial",
  () => {
    reject(receipt(1, "wrong", 997));
    reject(receipt(1, ""));
    reject(receipt(2));
    reject(
      `SELECT record_invoice_milestone_receipt('${id}',1,'${actor}',498.5,'stale','${actor}')`,
    );
  },
);
check(
  "initial receipt is exact and retry idempotent with actor attribution",
  () => {
    sql(receipt(1));
    sql(receipt(1));
    reject(receipt(1, "different-ref"));
    assert.equal(
      sql(
        `SELECT installments_paid FROM installment_plans WHERE proposal_id='${id}'`,
      ),
      "1",
    );
    assert.equal(
      sql(
        `SELECT manual_recorded_by FROM installment_payments WHERE manual_receipt_reference='invoice-1'`,
      ),
      actor,
    );
    assert.equal(
      sql(
        `SELECT payment_amount FROM client_projects WHERE proposal_id='${id}'`,
      ),
      "498.50",
    );
    assert.equal(
      sql(
        `SELECT count(*) FROM client_projects WHERE proposal_id='${id}' AND project_start_date IS NOT NULL`,
      ),
      "0",
    );
    assert.equal(
      sql(`SELECT status FROM proposals WHERE id='${id}'`),
      "accepted",
    );
    assert.equal(
      sql(
        `SELECT count(*) FROM client_dashboard_access WHERE milestone_proposal_id='${id}'`,
      ),
      "1",
    );
  },
);
check(
  "final requires current accepted delivery, including correction cycle",
  () => {
    reject(receipt(2));
    sql(
      `SELECT review_milestone_delivery('${id}','submit',NULL,'Synthetic acceptance cases')`,
    );
    const old = sql(
      `SELECT delivery_revision FROM installment_plans WHERE proposal_id='${id}'`,
    );
    sql(`SELECT review_milestone_delivery('${id}','reject','${old}','')`);
    reject(receipt(2));
    sql(
      `SELECT review_milestone_delivery('${id}','submit',NULL,'Corrected synthetic cases')`,
    );
    reject(`SELECT review_milestone_delivery('${id}','accept','${old}',NULL)`);
    sql(
      `SELECT review_milestone_delivery('${id}','accept',(SELECT delivery_revision FROM installment_plans WHERE proposal_id='${id}'),NULL)`,
    );
    sql(receipt(2));
    sql(receipt(2));
    assert.equal(sql(`SELECT status FROM proposals WHERE id='${id}'`), "paid");
    assert.equal(
      sql(
        `SELECT installments_paid FROM installment_plans WHERE proposal_id='${id}'`,
      ),
      "2",
    );
    assert.equal(
      sql(
        `SELECT payment_amount FROM client_projects WHERE proposal_id='${id}'`,
      ),
      "997.00",
    );
    assert.equal(
      sql(
        `SELECT count(*) FROM installment_payments WHERE installment_plan_id IN(SELECT id FROM installment_plans WHERE proposal_id='${id}') AND (checkout_session_id IS NOT NULL OR payment_intent_id IS NOT NULL)`,
      ),
      "0",
    );
  },
);
check("anon and authenticated cannot execute manual receipt RPC", () => {
  for (const role of ["anon", "authenticated"])
    reject(`SET ROLE ${role};${receipt(1)}`);
  assert.equal(
    sql(
      "SELECT prosecdef FROM pg_proc WHERE proname='record_invoice_milestone_receipt'",
    ),
    "f",
  );
});
console.log(
  checks + " invoice checks plus existing milestone/document regression PASS",
);
