import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type Stripe from "stripe";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  single: vi.fn(),
  create: vi.fn(),
  retrieve: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.single }) }),
    }),
  },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: { sessions: { create: mocks.create, retrieve: mocks.retrieve } },
  },
}));
import {
  milestoneAccess,
  milestoneCheckout,
  handleMilestoneEvent,
} from "./proposal-milestones";
const code = "A".repeat(48);
const proposal = {
  id: "11111111-1111-4111-8111-111111111111",
  payment_schedule: "milestones",
  access_code: code,
  document_revision: "22222222-2222-4222-8222-222222222222",
  pdf_url: "p.pdf",
  contract_pdf_url: "c.pdf",
  client_email: "qa@example.invalid",
};
const identity = {
  revision: proposal.document_revision,
  pdf_url: "p.pdf",
  contract_pdf_url: "c.pdf",
};
const request = (token = code) =>
  new NextRequest("http://localhost:3187/proposal", {
    headers: { "x-proposal-access": token },
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.single.mockResolvedValue({ data: proposal });
  mocks.rpc.mockImplementation(async (name) =>
    name === "reserve_proposal_milestone"
      ? {
          data: {
            payment_id: "payment",
            attempt: "attempt",
            amount_cents: 49850,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            currency: "usd",
            revision: proposal.document_revision,
          },
        }
      : { data: null },
  );
  mocks.create.mockResolvedValue({
    id: "cs_synthetic",
    url: "https://checkout.stripe.com/synthetic",
  });
});
it("requires the full issued bearer for milestones, preserves legacy access", () => {
  expect(milestoneAccess(request(""), proposal)).toBe(false);
  expect(milestoneAccess(request(), proposal)).toBe(true);
  expect(milestoneAccess(request(""), { payment_schedule: "legacy" })).toBe(
    true,
  );
});
it.each([
  { paymentMode: "full" },
  { paymentMode: "installments", numInstallments: 2 },
  { milestone: 1, amount: 99700 },
  { milestone: 3 },
])("rejects tampered checkout %j", async (body) => {
  expect(
    (
      await milestoneCheckout(request(), proposal, {
        ...body,
        document_identity: identity,
      })
    ).status,
  ).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("rejects stale identity before reservation/provider", async () => {
  expect(
    (
      await milestoneCheckout(request(), proposal, {
        milestone: 1,
        document_identity: { ...identity, revision: "stale" },
      })
    ).status,
  ).toBe(409);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("uses exact server cents, one-time mode and stable retry key", async () => {
  await milestoneCheckout(request(), proposal, {
    milestone: 1,
    document_identity: identity,
  });
  await milestoneCheckout(request(), proposal, {
    milestone: 1,
    document_identity: identity,
  });
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({
      mode: "payment",
      line_items: [
        expect.objectContaining({
          price_data: expect.objectContaining({
            unit_amount: 49850,
            currency: "usd",
          }),
        }),
      ],
    }),
    { idempotencyKey: "milestone-payment-attempt" },
  );
});
it("returns recoverable failure without losing reservation", async () => {
  mocks.create.mockRejectedValue(new Error("synthetic network failure"));
  expect(
    (
      await milestoneCheckout(request(), proposal, {
        milestone: 1,
        document_identity: identity,
      })
    ).status,
  ).toBe(503);
});
function event(
  metadata: Record<string, string>,
  status = "paid",
  mode = "payment",
) {
  return {
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_synthetic",
        metadata,
        payment_status: status,
        mode,
        payment_intent: "pi_synthetic",
        amount_total: 49850,
        currency: "usd",
      },
    },
  } as Stripe.Event;
}
it("blocks legacy/malformed events from milestone legacy fulfillment", async () => {
  await expect(
    handleMilestoneEvent(event({ proposalId: proposal.id })),
  ).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it.each(["unpaid", "no_payment_required"])(
  "does not settle %s evidence",
  async (status) => {
    expect(
      await handleMilestoneEvent(
        event({ proposalId: proposal.id, milestone: "true" }, status),
      ),
    ).toBe(true);
    expect(mocks.rpc).not.toHaveBeenCalled();
  },
);
it("routes verified paid milestone through atomic settlement only", async () => {
  expect(
    await handleMilestoneEvent(
      event({
        proposalId: proposal.id,
        milestone: "true",
        paymentId: "payment",
        attempt: "attempt",
        revision: proposal.document_revision,
      }),
    ),
  ).toBe(true);
  expect(mocks.rpc).toHaveBeenCalledWith(
    "settle_proposal_milestone",
    expect.objectContaining({ p_cents: 49850, p_event: "paid" }),
  );
});
it("preserves legacy checkout handler routing", async () => {
  mocks.single.mockResolvedValue({ data: { payment_schedule: "legacy" } });
  expect(await handleMilestoneEvent(event({ proposalId: proposal.id }))).toBe(
    false,
  );
});
it.each(["open", "expired", "complete"])(
  "retrieves cached session and handles %s evidence without blind recreation",
  async (status) => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        payment_id: "payment",
        attempt: "attempt",
        revision: proposal.document_revision,
        amount_cents: 49850,
        currency: "usd",
        session_id: "cs_cached",
        checkout_url: "https://checkout.stripe.com/cached",
      },
    });
    mocks.retrieve.mockResolvedValue({
      id: "cs_cached",
      mode: "payment",
      amount_total: 49850,
      currency: "usd",
      status,
      payment_status: "paid",
      payment_intent: "pi_cached",
      url: "https://checkout.stripe.com/cached",
      metadata: {
        proposalId: proposal.id,
        paymentId: "payment",
        attempt: "attempt",
        revision: proposal.document_revision,
        milestone: "true",
      },
    });
    const res = await milestoneCheckout(request(), proposal, {
      milestone: 1,
      document_identity: identity,
    });
    expect(res.status).toBe(status === "expired" ? 409 : 200);
    expect(mocks.retrieve).toHaveBeenCalledWith("cs_cached");
    expect(mocks.create).not.toHaveBeenCalled();
    if (status === "expired")
      expect(mocks.rpc).toHaveBeenCalledWith(
        "settle_proposal_milestone",
        expect.objectContaining({ p_event: "expired" }),
      );
  },
);
it("does not rotate an ambiguous cached session", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: { session_id: "cs_cached" } });
  mocks.retrieve.mockRejectedValue(new Error("unavailable"));
  expect(
    (
      await milestoneCheckout(request(), proposal, {
        milestone: 1,
        document_identity: identity,
      })
    ).status,
  ).toBe(503);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
