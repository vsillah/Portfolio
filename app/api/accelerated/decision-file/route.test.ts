import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DECISION_FILE_VERSION } from "@/lib/accelerated-decision-file";
const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  existing: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: mocks.from } }));
import { POST } from "./route";
const draft = {
  version: DECISION_FILE_VERSION,
  worksheetId: "12345678-1234-1234-1234-123456789abc",
  answers: { L01: "Test this decision" },
  updatedAt: "2026-11-05T12:00:00Z",
};
const request = (body: unknown) =>
  new NextRequest("http://localhost/api/accelerated/decision-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const payload = () => ({
  draft,
  worksheetId: draft.worksheetId,
  name: "Learner",
  email: "learner@example.com",
  consent: true,
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({
    insert: mocks.insert,
    select: () => ({ eq: () => ({ single: mocks.existing }) }),
  });
  mocks.insert.mockReturnValue({
    select: () => ({
      single: async () => ({ data: { id: "receipt" }, error: null }),
    }),
  });
});
describe("decision file submission", () => {
  it("requires consent and rejects stale or mismatched evidence", async () => {
    expect((await POST(request({ ...payload(), consent: false }))).status).toBe(
      400,
    );
    expect(
      (await POST(request({ ...payload(), worksheetId: "different" }))).status,
    ).toBe(400);
    expect(
      (
        await POST(
          request({ ...payload(), draft: { ...draft, version: "old" } }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("rejects malformed and oversized evidence before persistence", async () => {
    expect(
      (
        await POST(
          request({
            ...payload(),
            draft: { ...draft, answers: { L01: "x".repeat(40000) } },
          }),
        )
      ).status,
    ).toBe(413);
    expect(
      (
        await POST(
          request({
            ...payload(),
            draft: { ...draft, answers: { L17: "wrong lesson" } },
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("accepts one bounded submission, then makes exact replay idempotent", async () => {
    expect((await POST(request(payload()))).status).toBe(201);
    const inserted = mocks.insert.mock.calls[0][0];
    expect(inserted.answers).toEqual(draft.answers);
    mocks.insert.mockReturnValue({
      select: () => ({
        single: async () => ({ data: null, error: { code: "23505" } }),
      }),
    });
    mocks.existing.mockResolvedValue({
      data: { id: "receipt", payload_sha256: inserted.payload_sha256 },
    });
    expect((await POST(request(payload()))).status).toBe(200);
    mocks.existing.mockResolvedValue({
      data: { id: "receipt", payload_sha256: "different" },
    });
    expect((await POST(request(payload()))).status).toBe(409);
  });
  it("keeps the local synthetic completion fixture out of persistence", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = await POST(
      request({
        ...payload(),
        name: "QA Fixture",
        email: "qa-fixture@example.invalid",
      }),
    );
    expect(response.status).toBe(201);
    expect(mocks.insert).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
