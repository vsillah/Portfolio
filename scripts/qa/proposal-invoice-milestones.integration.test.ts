/** Opt-in route-to-real-local-PostgreSQL integration; never a hosted target. */
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { execFileSync } from "node:child_process";
const db = vi.hoisted(() => {
  const literal = (value: unknown) =>
    value == null
      ? "NULL"
      : "'" +
        String(
          typeof value === "object" ? JSON.stringify(value) : value,
        ).replaceAll("'", "''") +
        "'";
  const run = (statement: string) => {
    const { execFileSync } = require("node:child_process");
    return execFileSync(
      "docker",
      [
        "exec",
        "-i",
        "codex-proposal-invoice-01a0896e",
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
      { input: statement, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
  };
  function from(table: string) {
    if (
      ![
        "proposals",
        "proposal_documents",
        "client_projects",
        "client_dashboard_access",
        "installment_plans",
        "installment_payments",
      ].includes(table)
    )
      throw Error("Unexpected table");
    let cols = "*",
      filters: string[] = [],
      updates: Record<string, unknown> | null = null;
    const execute = async (single = false) => {
      try {
        const where = filters.length ? " WHERE " + filters.join(" AND ") : "";
        const query = updates
          ? `UPDATE public.${table} SET ${Object.entries(updates)
              .map(([k, v]) => `${k}=${literal(v)}`)
              .join(",")}${where} RETURNING *`
          : `SELECT ${cols} FROM public.${table}${where}`;
        const rows = JSON.parse(
          run(
            `WITH q AS (${query}) SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]') FROM q`,
          ),
        );
        return { data: single ? (rows[0] ?? null) : rows, error: null };
      } catch {
        return { data: null, error: { code: "LOCAL_SQL_FAILURE" } };
      }
    };
    const b = {
      select: (s: string) => {
        if (!/^[a-z_, *]+$/.test(s)) throw Error("Unexpected projection");
        cols = s;
        return b;
      },
      eq: (k: string, v: unknown) => {
        filters.push(`${k}=${literal(v)}`);
        return b;
      },
      update: (v: Record<string, unknown>) => {
        updates = v;
        return b;
      },
      order: () => b,
      single: () => execute(true),
      maybeSingle: () => execute(true),
      then: (
        resolve: (x: unknown) => unknown,
        reject: (e: unknown) => unknown,
      ) => execute().then(resolve, reject),
    };
    return b;
  }
  return {
    run,
    literal,
    from,
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (
        ![
          "sign_proposal_document",
          "reserve_proposal_milestone",
          "attach_milestone_checkout",
          "settle_proposal_milestone",
          "review_milestone_delivery",
          "record_invoice_milestone_receipt",
        ].includes(name)
      )
        throw Error("Unexpected helper");
      try {
        const out = run(
          `SELECT public.${name}(${Object.entries(args)
            .map(([k, v]) => `${k} => ${literal(v)}`)
            .join(",")})`,
        );
        return { data: out ? JSON.parse(out) : null, error: null };
      } catch {
        return { data: null, error: { code: "P0001" } };
      }
    },
  };
});
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: db }));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: () => {
          throw Error("Unexpected provider");
        },
        retrieve: () => {
          throw Error("Unexpected provider");
        },
      },
    },
  },
  createCheckoutSession: () => {
    throw Error("Unexpected full checkout");
  },
  createInstallmentCheckoutSession: () => {
    throw Error("Unexpected monthly checkout");
  },
}));
vi.mock("@/lib/auth-server", () => ({
  verifyAdmin: async () => ({
    user: { id: "88888888-8888-4888-8888-888888888888" },
    isAdmin: true,
  }),
  isAuthError: () => false,
}));
import { GET as read } from "@/app/api/proposals/by-code/[code]/route";
import { signProposalDocument } from "@/lib/sign-proposal-document";
import { POST as accept } from "@/app/api/proposals/[id]/accept/route";
import { GET as link } from "@/app/api/proposals/[id]/dashboard-link/route";
import { POST as admin } from "@/app/api/proposals/[id]/milestones/route";
import { POST as review } from "@/app/api/client/dashboard/[token]/milestones/route";
describe.skipIf(process.env.QA_LOCAL_SQL !== "true")(
  "invoice native handlers with actual local SQL",
  () => {
    it("signs, remains unpaid without dashboard, records receipts through admin and accepts delivery through existing dashboard", async () => {
      expect(
        execFileSync(
          "docker",
          [
            "inspect",
            "--format",
            "{{.HostConfig.NetworkMode}}",
            "codex-proposal-invoice-01a0896e",
          ],
          { encoding: "utf8" },
        ).trim(),
      ).toBe("none");
      const id = "99999999-9999-4999-8999-999999999999",
        code = "A1".repeat(24),
        ctx = { params: Promise.resolve({ id }) };
      db.run(
        `INSERT INTO proposals(id,total_amount,payment_schedule,milestone_settlement,client_name,client_email,bundle_name,pdf_url,contract_pdf_url,access_code,status) VALUES('${id}',997,'milestones','manual_invoice','Synthetic route','qa@example.invalid','Invoice route','p.pdf','c.pdf','${code}','sent')`,
      );
      const req = (b?: unknown) =>
        new NextRequest("http://localhost:3188/proposal/" + code, {
          method: b ? "POST" : "GET",
          headers: { "x-proposal-access": code },
          ...(b ? { body: JSON.stringify(b) } : {}),
        });
      const result = await read(req(), { params: Promise.resolve({ code }) });
      expect(result.status).toBe(200);
      const identity = (await result.json()).proposal.document_identity;
      const sign = {
        signed_by_name: "Synthetic route",
        document_identity: identity,
      };
      expect((await signProposalDocument(req(sign), id, false)).status).toBe(
        200,
      );
      expect((await signProposalDocument(req(sign), id, true)).status).toBe(
        200,
      );
      for (const b of [
        { paymentMode: "full" },
        { paymentMode: "installments", numInstallments: 2 },
        { milestone: 1, document_identity: identity },
      ])
        expect((await accept(req(b), ctx)).status).toBe(409);
      expect((await (await link(req(), ctx)).json()).dashboard_url).toBeNull();
      expect(
        db.run(
          `SELECT count(*) FROM client_projects WHERE proposal_id='${id}'`,
        ),
      ).toBe("0");
      const receipt = (n: number) =>
        admin(
          req({
            action: "record_receipt",
            milestone: n,
            amount: 498.5,
            reference: "native-invoice-" + n,
            revision: identity.revision,
          }),
          ctx,
        );
      expect((await receipt(1)).status).toBe(200);
      expect((await receipt(1)).status).toBe(200);
      const dashboard = await (await link(req(), ctx)).json();
      expect(dashboard.dashboard_url).toMatch(
        /client\/dashboard\/[a-f0-9]{64}$/,
      );
      const token = db.run(
        `SELECT access_token FROM client_dashboard_access WHERE milestone_proposal_id='${id}'`,
      );
      expect((await receipt(2)).status).toBe(409);
      expect(
        (
          await admin(
            req({
              action: "submit",
              note: "Five synthetic cases accepted against criteria",
            }),
            ctx,
          )
        ).status,
      ).toBe(200);
      const revision = db.run(
        `SELECT delivery_revision FROM installment_plans WHERE proposal_id='${id}'`,
      );
      expect(
        (
          await review(req({ action: "accept", revision }), {
            params: Promise.resolve({ token }),
          })
        ).status,
      ).toBe(200);
      expect((await receipt(2)).status).toBe(200);
      expect(
        db.run(
          `SELECT payment_amount FROM client_projects WHERE proposal_id='${id}'`,
        ),
      ).toBe("997.00");
      expect(db.run(`SELECT status FROM proposals WHERE id='${id}'`)).toBe(
        "paid",
      );
    });
  },
);
