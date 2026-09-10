import { it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  from: vi.fn(),
  signed: vi.fn(async (_bucket: string, path: string) => "signed:" + path),
  attachment: vi.fn(async (path: string) => ({
    data: { signedUrl: "signed:" + path },
  })),
}));
vi.mock("./supabase", () => ({
  supabaseAdmin: {
    from: m.from,
    storage: { from: () => ({ createSignedUrl: m.attachment }) },
  },
}));
vi.mock("./storage", () => ({ getSignedUrl: m.signed }));
vi.mock("./client-ai-ops-roadmap-db", () => ({
  getRoadmapBundleForProject: async () => null,
}));
vi.mock("./client-build-evidence", () => ({
  getBuildEvidenceForClientProject: async () => null,
}));
import { getDashboardByToken } from "./client-dashboard";
it("existing dashboard signs storage role paths and retains historical document entries", async () => {
  m.from.mockImplementation((table: string) => {
    let fields = "";
    const result = () => ({
      data:
        table === "client_dashboard_access"
          ? { id: "access", client_project_id: "project" }
          : table === "client_projects"
            ? {
                id: "project",
                proposal_id: "proposal",
                client_email: "synthetic@example.invalid",
              }
            : table === "proposals" && fields.includes("pdf_url")
              ? {
                  id: "proposal",
                  pdf_url:
                    "storage:documents/proposal-docs/proposal/primary.pdf",
                  contract_pdf_url:
                    "storage:documents/proposal-docs/proposal/agreement.pdf",
                }
              : table === "proposal_documents"
                ? [
                    {
                      id: "history",
                      title: "Prior reviewed PDF",
                      document_type: "other",
                      file_path: "proposal-docs/proposal/history.pdf",
                    },
                  ]
                : table === "proposals" && fields.includes("value_assessment")
                  ? null
                  : [],
    });
    const q: any = {
      select: (s: string) => {
        fields = s;
        return q;
      },
    };
    for (const key of ["gte", "eq", "order", "limit", "in", "not", "update"])
      q[key] = () => q;
    q.single = async () => result();
    q.maybeSingle = async () => result();
    q.then = (resolve: any) => Promise.resolve(result()).then(resolve);
    return q;
  });
  const result = await getDashboardByToken("synthetic");
  expect(result.error).toBeUndefined();
  expect(m.signed).toHaveBeenCalledWith(
    "documents",
    "proposal-docs/proposal/primary.pdf",
    3600,
  );
  expect(m.signed).toHaveBeenCalledWith(
    "documents",
    "proposal-docs/proposal/agreement.pdf",
    3600,
  );
  expect(m.attachment).toHaveBeenCalledWith(
    "proposal-docs/proposal/history.pdf",
    3600,
  );
  expect((result.data as any).documents).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "history",
        signed_url: "signed:proposal-docs/proposal/history.pdf",
      }),
    ]),
  );
});
