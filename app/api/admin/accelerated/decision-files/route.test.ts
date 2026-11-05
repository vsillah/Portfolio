import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  intakes: vi.fn(),
  intake: vi.fn(),
  services: vi.fn(),
  products: vi.fn(),
  audits: vi.fn(),
  contact: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/auth-server", () => ({
  verifyAdmin: mocks.auth,
  isAuthError: (value: { error?: string }) => Boolean(value.error),
}));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: mocks.from } }));
import { GET, PATCH } from "./route";
const request = (body?: unknown) =>
  new NextRequest(
    "http://localhost/api/admin/accelerated/decision-files",
    body
      ? {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "admin-1" } });
  mocks.from.mockImplementation((table: string) => {
    if (table === "accelerated_decision_file_intakes")
      return {
        select: () => ({
          order: () => ({ limit: mocks.intakes }),
          eq: () => ({ single: mocks.intake }),
        }),
        update: mocks.update,
      };
    if (table === "services")
      return { select: () => ({ eq: () => ({ limit: mocks.services }) }) };
    if (table === "products")
      return { select: () => ({ eq: () => ({ limit: mocks.products }) }) };
    if (table === "diagnostic_audits")
      return { select: () => ({ eq: () => ({ single: mocks.audits }) }) };
    if (table === "contact_submissions")
      return { select: () => ({ eq: () => ({ single: mocks.contact }) }) };
  });
});
describe("protected review queue", () => {
  it("denies unauthorized reads and writes before accessing intake data", async () => {
    mocks.auth.mockResolvedValue({ error: "Unauthorized", status: 401 });
    expect((await GET(request())).status).toBe(401);
    expect(
      (
        await PATCH(
          request({
            id: "12345678-1234-1234-1234-123456789abc",
            status: "linked",
            auditId: 1,
            note: "",
          }),
        )
      ).status,
    ).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("uses existing active catalog rows for review-only candidates", async () => {
    mocks.intakes.mockResolvedValue({
      data: [{ id: "a", answers: { L01: "Need intake automation" } }],
    });
    mocks.services.mockResolvedValue({
      data: [{ id: 1, title: "Intake automation workshop", is_active: true }],
    });
    mocks.products.mockResolvedValue({
      data: [{ id: 2, title: "Music album", is_active: true }],
    });
    const response = await GET(request());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(
      data.items[0].candidates.map((candidate: { id: number }) => candidate.id),
    ).toEqual([1]);
  });
  it("requires an existing assessment audit before linking", async () => {
    mocks.intake.mockResolvedValue({
      data: { learner_email: "learner@example.com" },
    });
    mocks.audits.mockResolvedValue({
      data: null,
      error: { message: "missing" },
    });
    const response = await PATCH(
      request({
        id: "12345678-1234-1234-1234-123456789abc",
        status: "linked",
        auditId: 42,
        note: "Human review",
      }),
    );
    expect(response.status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects an audit attached to a different learner", async () => {
    mocks.intake.mockResolvedValue({
      data: { learner_email: "learner@example.com" },
    });
    mocks.audits.mockResolvedValue({
      data: { id: 42, contact_submission_id: 8 },
    });
    mocks.contact.mockResolvedValue({ data: { email: "other@example.com" } });
    const response = await PATCH(
      request({
        id: "12345678-1234-1234-1234-123456789abc",
        status: "linked",
        auditId: 42,
        note: "Human review",
      }),
    );
    expect(response.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("links a matching existing audit without changing its assessment or score", async () => {
    mocks.intake.mockResolvedValue({
      data: { learner_email: "learner@example.com" },
    });
    mocks.audits.mockResolvedValue({
      data: { id: 42, contact_submission_id: 8 },
    });
    mocks.contact.mockResolvedValue({ data: { email: "LEARNER@example.com" } });
    mocks.update.mockReturnValue({
      eq: () => ({
        select: () => ({
          single: async () => ({
            data: {
              id: "worksheet",
              review_status: "linked",
              linked_audit_id: 42,
            },
          }),
        }),
      }),
    });
    const response = await PATCH(
      request({
        id: "12345678-1234-1234-1234-123456789abc",
        status: "linked",
        auditId: 42,
        note: "Matched learner after review",
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.update.mock.calls[0][0]).toMatchObject({
      linked_audit_id: 42,
      review_status: "linked",
    });
    expect(mocks.from).not.toHaveBeenCalledWith("assessment_score_snapshots");
  });
});
