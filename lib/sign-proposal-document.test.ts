import { beforeEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: { rpc } }));
import { signProposalDocument } from "./sign-proposal-document";
const run = (body: unknown, contract = false) =>
  signProposalDocument(
    new NextRequest("http://localhost/sign", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    "11111111-1111-4111-8111-111111111111",
    contract,
  );
const body = {
  signed_by_name: "Synthetic",
  document_identity: {
    revision: "44444444-4444-4444-8444-444444444444",
    pdf_url: "stable.pdf",
    contract_pdf_url: null,
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  rpc.mockResolvedValue({ data: { success: true } });
});
it("rejects old clients without identity with reload path and no write", async () => {
  expect((await run({ signed_by_name: "Synthetic" })).status).toBe(409);
  expect(rpc).not.toHaveBeenCalled();
});
it.each([false, true])(
  "uses atomic helper for contract=%s",
  async (contract) => {
    expect((await run(body, contract)).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "sign_proposal_document",
      expect.objectContaining({
        p_contract: contract,
        p_expected: body.document_identity,
      }),
    );
  },
);
it("returns stale conflict without fallback write", async () => {
  rpc.mockResolvedValue({ error: { code: "P0001" } });
  expect(await (await run(body)).json()).toMatchObject({
    reload_required: true,
  });
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("missing migration fails closed", async () => {
  rpc.mockResolvedValue({ error: { code: "PGRST202" } });
  expect((await run(body)).status).toBe(503);
});
