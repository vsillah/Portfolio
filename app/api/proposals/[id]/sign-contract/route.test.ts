import { it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const helper = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sign-proposal-document", () => ({
  signProposalDocument: helper,
}));
import { POST } from "./route";
it("delegates to shared atomic signature handler", async () => {
  const req = new NextRequest("http://localhost/sign");
  await POST(req, { params: Promise.resolve({ id: "synthetic" }) });
  expect(helper).toHaveBeenCalledWith(req, "synthetic", true);
});
