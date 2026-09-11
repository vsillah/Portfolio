import { beforeEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ single: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    rpc: m.rpc,
    from: () => ({
      select: () => ({
        eq: () => ({ single: m.single, maybeSingle: m.single }),
      }),
    }),
  },
}));
vi.mock("@/lib/stripe", () => ({ stripe: null }));
import { GET as dashboard } from "@/app/api/proposals/[id]/dashboard-link/route";
import { GET as onboarding } from "@/app/api/proposals/[id]/onboarding-plan/route";
import { signProposalDocument } from "./sign-proposal-document";
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks();
  m.single.mockResolvedValue({
    data: { payment_schedule: "milestones", access_code: "A".repeat(48) },
  });
});
it.each([dashboard, onboarding])(
  "rejects UUID-only bearer-link disclosure",
  async (handler) => {
    expect(
      (
        await handler(new NextRequest("http://localhost/test"), {
          params: Promise.resolve({ id }),
        })
      ).status,
    ).toBe(404);
  },
);
it.each([false, true])(
  "rejects signature without issued bearer, contract=%s",
  async (contract) => {
    const r = new NextRequest("http://localhost/test", {
      method: "POST",
      body: JSON.stringify({
        signed_by_name: "Synthetic",
        document_identity: {
          revision: id,
          pdf_url: null,
          contract_pdf_url: null,
        },
      }),
    });
    expect((await signProposalDocument(r, id, contract)).status).toBe(404);
    expect(m.rpc).not.toHaveBeenCalled();
  },
);
