import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  admin: vi.fn(),
  full: vi.fn(),
  monthly: vi.fn(),
  customer: vi.fn(),
  stripe: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mock.from, rpc: mock.rpc },
}));
vi.mock("@/lib/auth-server", () => ({
  verifyAdmin: mock.admin,
  isAuthError: (v: any) => "error" in v,
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: { sessions: { create: mock.stripe, retrieve: mock.stripe } },
  },
  createCheckoutSession: mock.full,
  createInstallmentCheckoutSession: mock.monthly,
}));
vi.mock("@/lib/stripe-subscriptions", () => ({
  findOrCreateStripeCustomer: mock.customer,
}));
import { POST as accept } from "@/app/api/proposals/[id]/accept/route";
import { GET as link } from "@/app/api/proposals/[id]/dashboard-link/route";
import {
  POST as update,
  GET as read,
} from "@/app/api/proposals/[id]/milestones/route";
import { handleMilestoneEvent } from "./proposal-milestones";
const id = "11111111-1111-4111-8111-111111111111",
  code = "A".repeat(48),
  revision = "22222222-2222-4222-8222-222222222222";
let proposal: any, plan: any;
const req = (body?: unknown, bearer = code) =>
  new NextRequest("http://localhost:3188/api/proposals/" + id, {
    method: body ? "POST" : "GET",
    headers: { "x-proposal-access": bearer },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
const ctx = { params: Promise.resolve({ id }) };
beforeEach(() => {
  vi.resetAllMocks();
  proposal = {
    id,
    payment_schedule: "milestones",
    milestone_settlement: "manual_invoice",
    access_code: code,
    total_amount: 997,
    signed_at: "2026-09-11",
    contract_signed_at: "2026-09-11",
    document_revision: revision,
  };
  plan = null;
  mock.admin.mockResolvedValue({
    user: { id: "33333333-3333-4333-8333-333333333333" },
    isAdmin: true,
  });
  mock.rpc.mockResolvedValue({ data: null, error: null });
  mock.from.mockImplementation((table: string) => {
    const q: any = {
      select: () => q,
      eq: () => q,
      is: () => q,
      update: () => q,
      single: async () => ({ data: proposal }),
      maybeSingle: async () => ({
        data: table === "proposals" ? proposal : plan,
      }),
    };
    return q;
  });
});
it.each([
  {},
  { paymentMode: "full" },
  { paymentMode: "installments", numInstallments: 2 },
  { milestone: 1 },
  { milestone: 2 },
])("blocks every checkout entry for invoice mode %j", async (body) => {
  expect((await accept(req(body), ctx)).status).toBe(409);
  for (const fn of [
    mock.full,
    mock.monthly,
    mock.customer,
    mock.stripe,
    mock.rpc,
  ])
    expect(fn).not.toHaveBeenCalled();
});
it("does not reveal manual instructions to missing bearer", async () =>
  expect((await accept(req({}, ""), ctx)).status).toBe(404));
it("signed invoice proposal exposes truthful unpaid state, no plan creation", async () => {
  const body = await (await read(req(), ctx)).json();
  expect(body).toMatchObject({
    enabled: true,
    settlement_mode: "manual_invoice",
    signed: true,
    amount: 498.5,
    plan: null,
  });
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("withholds dashboard even if another path prematurely created project/access", async () => {
  expect(await (await link(req(), ctx)).json()).toEqual({
    dashboard_url: null,
  });
  expect(mock.from.mock.calls.map((c) => c[0])).not.toContain(
    "client_projects",
  );
});
it("requires both signatures before releasing dashboard", async () => {
  proposal.contract_signed_at = null;
  plan = { installments_paid: 1 };
  expect(await (await link(req(), ctx)).json()).toEqual({
    dashboard_url: null,
  });
});
it("denies receipt write to customer bearer", async () => {
  mock.admin.mockResolvedValue({ error: "Admin required", status: 403 });
  expect(
    (
      await update(
        req({
          action: "record_receipt",
          milestone: 1,
          amount: 498.5,
          reference: "test-receipt",
          revision,
        }),
        ctx,
      )
    ).status,
  ).toBe(404);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("records exact evidence attributed to authenticated admin", async () => {
  expect(
    (
      await update(
        req({
          action: "record_receipt",
          milestone: 1,
          amount: 498.5,
          reference: "verified-reference",
          revision,
        }),
        ctx,
      )
    ).status,
  ).toBe(200);
  expect(mock.rpc).toHaveBeenCalledWith("record_invoice_milestone_receipt", {
    p_id: id,
    p_number: 1,
    p_revision: revision,
    p_amount: 498.5,
    p_reference: "verified-reference",
    p_actor: "33333333-3333-4333-8333-333333333333",
  });
  expect(mock.stripe).not.toHaveBeenCalled();
});
it("rejects Stripe events for invoice-managed proposal before settlement", async () => {
  await expect(
    handleMilestoneEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { proposalId: id, milestone: "true" },
          payment_status: "paid",
        },
      },
    } as any),
  ).rejects.toThrow("Invoice-managed");
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("preserves legacy full checkout", async () => {
  proposal = {
    ...proposal,
    payment_schedule: "legacy",
    milestone_settlement: "stripe_checkout",
    status: "accepted",
    line_items: [{ title: "Service", price: 997 }],
  };
  mock.full.mockResolvedValue({
    id: "cs_legacy",
    url: "https://checkout.stripe.com/test",
  });
  // update chain is awaited by legacy handler.
  expect((await accept(req({}), ctx)).status).toBe(200);
  expect(mock.full).toHaveBeenCalledOnce();
  expect(mock.monthly).not.toHaveBeenCalled();
});
