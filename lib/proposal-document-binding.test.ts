import { it, expect, vi } from "vitest";
const signed = vi.hoisted(() =>
  vi.fn(async () => ({
    data: { signedUrl: "https://local.invalid/expiring-token" },
  })),
);
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { storage: { from: () => ({ createSignedUrl: signed }) } },
}));
import { proposalDocumentReadback } from "./proposal-document-binding";
it("keeps stable reviewed identity distinct from expiring private read URL", async () => {
  const raw =
    "storage:documents/proposal-docs/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.pdf";
  const value = await proposalDocumentReadback({
    document_revision: "44444444-4444-4444-8444-444444444444",
    id: "11111111-1111-4111-8111-111111111111",
    pdf_url: raw,
    contract_pdf_url: raw,
  });
  expect(value.document_identity).toEqual({
    revision: "44444444-4444-4444-8444-444444444444",
    pdf_url: raw,
    contract_pdf_url: raw,
  });
  expect(value.pdf_url).toBe("https://local.invalid/expiring-token");
  expect(value.contract_pdf_url).toBe(value.pdf_url);
});
it("preserves issued legacy URLs without fetching them", async () => {
  signed.mockClear();
  const p = await proposalDocumentReadback({
    document_revision: "44444444-4444-4444-8444-444444444444",
    id: "legacy",
    pdf_url: "https://legacy.invalid/reviewed.pdf",
  });
  expect(p.pdf_url).toBe("https://legacy.invalid/reviewed.pdf");
  expect(signed).not.toHaveBeenCalled();
});
it("rejects cross-proposal stored reference", async () => {
  await expect(
    proposalDocumentReadback({
      document_revision: "44444444-4444-4444-8444-444444444444",
      id: "one",
      pdf_url: "storage:documents/proposal-docs/two/file.pdf",
    }),
  ).rejects.toThrow();
});
