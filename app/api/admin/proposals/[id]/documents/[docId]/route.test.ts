import { beforeEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/auth-server", () => ({
  verifyAdmin: m.auth,
  isAuthError: (v: any) => !!v.error,
}));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    rpc: m.rpc,
    storage: { from: () => ({ remove: m.remove }) },
  },
}));
import { DELETE } from "./route";
const run = () =>
  DELETE(new NextRequest("http://localhost/doc", { method: "DELETE" }), {
    params: Promise.resolve({
      id: "11111111-1111-4111-8111-111111111111",
      docId: "22222222-2222-4222-8222-222222222222",
    }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: {} });
  m.rpc.mockResolvedValue({
    data: { success: true, file_path: "synthetic.pdf" },
  });
  m.remove.mockResolvedValue({});
});
it("requires admin before mutation", async () => {
  m.auth.mockResolvedValue({ error: "Forbidden", status: 403 });
  expect((await run()).status).toBe(403);
  expect(m.rpc).not.toHaveBeenCalled();
});
it("cleans only after atomic permitted deletion", async () => {
  expect((await run()).status).toBe(200);
  expect(m.remove).toHaveBeenCalledWith(["synthetic.pdf"]);
});
it("retains bytes on locked or unavailable RPC", async () => {
  m.rpc.mockResolvedValue({ error: { code: "P0001" } });
  expect((await run()).status).toBe(409);
  expect(m.remove).not.toHaveBeenCalled();
});
it("reports cleanup failure rather than losing the deletion receipt", async () => {
  m.remove.mockResolvedValue({ error: {} });
  expect(await (await run()).json()).toMatchObject({
    success: true,
    cleanup_pending: true,
  });
});
