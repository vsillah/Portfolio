// @vitest-environment node
import { beforeEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/lib/auth-server", () => ({
  verifyAdmin: m.auth,
  isAuthError: (v: unknown) => !!(v as { error?: string }).error,
}));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: m.from,
    rpc: m.rpc,
    storage: { from: () => ({ upload: m.upload, remove: m.remove }) },
  },
}));
import { POST } from "./route";
const id = "11111111-1111-4111-8111-111111111111";
const rid = "22222222-2222-4222-8222-222222222222";
let target: Record<string, unknown>, schemaError: unknown, prior: unknown;
function chain(result: unknown) {
  const q: any = {};
  for (const k of ["select", "eq", "limit"]) q[k] = () => q;
  q.maybeSingle = async () => result;
  q.then = (a: any, b: any) => Promise.resolve(result).then(a, b);
  return q;
}
beforeEach(() => {
  vi.resetAllMocks();
  target = { id, status: "draft" };
  schemaError = null;
  prior = null;
  m.auth.mockResolvedValue({ user: { id: "admin" } });
  m.from.mockImplementation((table) =>
    chain(
      table === "proposals"
        ? { data: target }
        : { data: prior, error: schemaError },
    ),
  );
  m.upload.mockResolvedValue({});
  m.remove.mockResolvedValue({});
  m.rpc.mockImplementation(async (_name, args) => ({
    data: { id: rid, file_path: args.p_path, binding_role: args.p_role },
  }));
});
async function request(overrides: Record<string, unknown> = {}) {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = await pdf.save();
  const values: Record<string, unknown> = {
    file: new File([new Uint8Array(bytes)], "test.pdf", {
      type: "application/pdf",
    }),
    title: "Synthetic",
    document_type: "other",
    binding_role: "primary",
    request_id: rid,
    document_identity: JSON.stringify({
      revision: "44444444-4444-4444-8444-444444444444",
      pdf_url: null,
      contract_pdf_url: null,
    }),
    ...overrides,
  };
  const req = new NextRequest("http://localhost/documents", { method: "POST" });
  vi.spyOn(req, "formData").mockResolvedValue({
    get: (key: string) => values[key] ?? null,
  } as FormData);
  return req;
}
const run = async (o = {}) =>
  POST(await request(o), { params: Promise.resolve({ id }) });
it("auth precedes all reads and uploads", async () => {
  m.auth.mockResolvedValue({ error: "Forbidden", status: 403 });
  expect((await run()).status).toBe(403);
  expect(m.from).not.toHaveBeenCalled();
  expect(m.upload).not.toHaveBeenCalled();
});
it.each(["supporting", "primary", "agreement"])(
  "binds %s through atomic RPC",
  async (role) => {
    expect((await run({ binding_role: role })).status).toBe(201);
    expect(m.rpc).toHaveBeenCalledWith(
      "bind_proposal_document",
      expect.objectContaining({
        p_request: rid,
        p_role: role,
        p_expected: {
          revision: "44444444-4444-4444-8444-444444444444",
          pdf_url: null,
          contract_pdf_url: null,
        },
      }),
    );
  },
);
it.each([
  { binding_role: "bad" },
  { title: " " },
  { request_id: "bad" },
  { document_identity: "{}" },
  { file: new File(["fake"], "fake.pdf", { type: "application/pdf" }) },
])("rejects malformed payload before upload %#", async (value) => {
  expect((await run(value)).status).toBe(400);
  expect(m.upload).not.toHaveBeenCalled();
});
it("locks issued state before upload, while RPC remains final race guard", async () => {
  target.access_code = "ISSUED";
  expect((await run()).status).toBe(409);
  expect(m.upload).not.toHaveBeenCalled();
});
it("fails closed before upload without migration", async () => {
  schemaError = { code: "42703" };
  expect((await run()).status).toBe(503);
  expect(m.upload).not.toHaveBeenCalled();
});
it("cleans unique attempt after definite atomic rejection", async () => {
  m.rpc.mockResolvedValue({ error: { code: "P0001" } });
  expect((await run()).status).toBe(409);
  expect(m.remove).toHaveBeenCalledOnce();
});
it("retains bytes after ambiguous outcome so committed document cannot be deleted", async () => {
  m.rpc.mockRejectedValue(new Error("Timeout"));
  expect((await run()).status).toBe(503);
  expect(m.remove).not.toHaveBeenCalled();
});
it("exact replay returns existing row and cleans only this new attempt", async () => {
  prior = { id: rid };
  target.signed_at = "now";
  m.rpc.mockResolvedValue({
    data: { id: rid, file_path: "canonical-prior.pdf" },
  });
  const response = await run();
  expect(response.status).toBe(201);
  expect(m.remove).toHaveBeenCalledWith([
    expect.not.stringContaining("canonical-prior"),
  ]);
});
it("upload failure never attempts binding", async () => {
  m.upload.mockResolvedValue({ error: { message: "no" } });
  expect((await run()).status).toBe(503);
  expect(m.rpc).not.toHaveBeenCalled();
});
