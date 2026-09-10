import { it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({
  from: vi.fn(),
  read: vi.fn(async (p: object) => ({
    ...p,
    pdf_url: "https://synthetic.invalid/read",
    contract_pdf_url: "https://synthetic.invalid/agreement",
  })),
  auth: vi.fn(async () => ({ user: {} })),
}));
vi.mock("@/lib/auth-server", () => ({
  verifyAdmin: m.auth,
  isAuthError: (v: any) => !!v.error,
}));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: m.from } }));
vi.mock("@/lib/proposal-document-binding", () => ({
  proposalDocumentReadback: m.read,
}));
import { GET } from "./route";
it("resolves private role references before returning admin links", async () => {
  m.from.mockImplementation((table: string) => {
    const q: any = {};
    for (const method of ["select", "eq", "order", "limit"])
      q[method] = () => q;
    q.single = async () => ({
      data:
        table === "client_projects"
          ? { id: "project", client_email: "synthetic@example.invalid" }
          : table === "proposals"
            ? { id: "proposal", pdf_url: "storage:documents/synthetic.pdf" }
            : null,
    });
    return q;
  });
  const res = await GET(new NextRequest("http://localhost/resolve"), {
    params: { projectId: "project" },
  });
  expect(res.status).toBe(200);
  expect((await res.json()).proposal.pdf_url).toBe(
    "https://synthetic.invalid/read",
  );
  expect(m.read).toHaveBeenCalledWith(
    expect.objectContaining({ pdf_url: "storage:documents/synthetic.pdf" }),
  );
});
