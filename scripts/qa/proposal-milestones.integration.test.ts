/** Opt-in route-to-real-local-PostgreSQL integration; never a hosted target. */
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { execFileSync } from "node:child_process";
import type Stripe from "stripe";
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
        "codex-proposal-sql-01a0896e",
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
vi.mock("@/lib/stripe", () => {
  let calls = 0;
  return {
    stripe: {
      checkout: {
        sessions: {
          create: async () => ({
            id: ++calls === 1 ? "cs_route_local" : "cs_route_final",
            url: "https://checkout.stripe.com/synthetic",
          }),
        },
      },
    },
    createCheckoutSession: vi.fn(),
    createInstallmentCheckoutSession: vi.fn(),
  };
});
import { GET as read } from "@/app/api/proposals/by-code/[code]/route";
import { signProposalDocument } from "@/lib/sign-proposal-document";
import { POST as accept } from "@/app/api/proposals/[id]/accept/route";
import { GET as dashboardLink } from "@/app/api/proposals/[id]/dashboard-link/route";
import { POST as dashboardAction } from "@/app/api/client/dashboard/[token]/milestones/route";
import { handleMilestoneEvent } from "@/lib/proposal-milestones";
describe.skipIf(process.env.QA_LOCAL_SQL !== "true")(
  "native routes with real isolated SQL",
  () => {
    it("issued link -> both signatures -> exact checkout -> verified settlement -> existing dashboard bearer", async () => {
      expect(
        execFileSync(
          "docker",
          [
            "inspect",
            "--format",
            "{{.HostConfig.NetworkMode}}",
            "codex-proposal-sql-01a0896e",
          ],
          { encoding: "utf8" },
        ).trim(),
      ).toBe("none");
      const id = "44444444-4444-4444-8444-444444444444",
        code = "D".repeat(48),
        params = Promise.resolve({ id });
      db.run(
        `INSERT INTO public.proposals(id,total_amount,payment_schedule,client_name,client_email,bundle_name,pdf_url,contract_pdf_url,access_code,status) VALUES('${id}',997,'milestones','Synthetic route','qa@example.invalid','Local route','p.pdf','c.pdf','${code}','sent')`,
      );
      const request = (body?: unknown) =>
        new NextRequest("http://localhost:3187/proposal/" + code, {
          method: body ? "POST" : "GET",
          headers: { "x-proposal-access": code },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      const readRes = await read(request(), {
        params: Promise.resolve({ code }),
      });
      expect(readRes.status).toBe(200);
      const { proposal } = await readRes.json();
      const body = {
        signed_by_name: "Synthetic route signer",
        document_identity: proposal.document_identity,
      };
      expect(
        (await signProposalDocument(request(body), id, false)).status,
      ).toBe(200);
      expect(
        (
          await accept(
            request({
              milestone: 1,
              document_identity: proposal.document_identity,
            }),
            { params },
          )
        ).status,
      ).toBe(409);
      expect((await signProposalDocument(request(body), id, true)).status).toBe(
        200,
      );
      const result = await accept(
        request({
          milestone: 1,
          document_identity: proposal.document_identity,
        }),
        { params },
      );
      expect(result.status).toBe(200);
      const row = JSON.parse(
        db.run(
          `SELECT to_jsonb(x) FROM public.installment_payments x JOIN public.installment_plans p ON p.id=x.installment_plan_id WHERE p.proposal_id='${id}' AND x.payment_number=1`,
        ),
      );
      expect(row.amount).toBe(498.5);
      await handleMilestoneEvent({
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_route_local",
            mode: "payment",
            payment_status: "paid",
            amount_total: 49850,
            currency: "usd",
            payment_intent: "pi_route_local",
            metadata: {
              proposalId: id,
              milestone: "true",
              paymentId: row.id,
              attempt: row.checkout_attempt,
              revision: proposal.document_identity.revision,
            },
          },
        },
      } as unknown as Stripe.Event);
      const link = await dashboardLink(request(), { params });
      expect(link.status).toBe(200);
      expect((await link.json()).dashboard_url).toMatch(
        /\/client\/dashboard\/[a-f0-9]{64}$/,
      );
      expect(
        db.run(
          `SELECT payment_amount FROM public.client_projects WHERE proposal_id='${id}'`,
        ),
      ).toBe("498.50");
      expect(
        db.run(`SELECT status FROM public.proposals WHERE id='${id}'`),
      ).toBe("accepted");
      const token = db.run(
        `SELECT access_token FROM public.client_dashboard_access WHERE milestone_proposal_id='${id}'`,
      );
      const dash = (body: unknown) =>
        dashboardAction(
          new NextRequest(
            "http://localhost:3187/api/client/dashboard/" +
              token +
              "/milestones",
            { method: "POST", body: JSON.stringify(body) },
          ),
          { params: Promise.resolve({ token }) },
        );
      expect(
        (
          await dash({
            action: "pay",
            document_identity: proposal.document_identity,
          })
        ).status,
      ).toBe(409);
      db.run(
        `SELECT review_milestone_delivery('${id}','submit',NULL,'Five synthetic acceptance cases delivered')`,
      );
      const revision = db.run(
        `SELECT delivery_revision FROM public.installment_plans WHERE proposal_id='${id}'`,
      );
      expect((await dash({ action: "accept", revision })).status).toBe(200);
      expect(
        (
          await dash({
            action: "pay",
            document_identity: proposal.document_identity,
          })
        ).status,
      ).toBe(200);
      const final = JSON.parse(
        db.run(
          `SELECT to_jsonb(x) FROM public.installment_payments x JOIN public.installment_plans p ON p.id=x.installment_plan_id WHERE p.proposal_id='${id}' AND x.payment_number=2`,
        ),
      );
      await handleMilestoneEvent({
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_route_final",
            mode: "payment",
            payment_status: "paid",
            amount_total: 49850,
            currency: "usd",
            payment_intent: "pi_route_final",
            metadata: {
              proposalId: id,
              milestone: "true",
              paymentId: final.id,
              attempt: final.checkout_attempt,
              revision: proposal.document_identity.revision,
            },
          },
        },
      } as unknown as Stripe.Event);
      expect(
        db.run(`SELECT status FROM public.proposals WHERE id='${id}'`),
      ).toBe("paid");
    });
  },
);
