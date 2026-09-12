// @vitest-environment node
import { createRequire } from "node:module";
const parsePDF = createRequire(import.meta.url)("pdf-parse/lib/pdf-parse.js");
import { expect, it } from "vitest";
import { generateProposalPDF } from "./proposal-pdf";
it("renders the native branded PDF with full descriptions, literal text and exact amounts", async () => {
  const description =
    "An editable fictional tracker and complete operating guide with every original sentence retained in this deliberately long description.";
  const terms =
    "Deliverables\n1  First fictional workflow.\n2  Editable tracker.\nPayment terms\nFixed fee $997; $498.50 before kickoff and $498.50 after acceptance.\nScope\n<script>literal text</script>\n" +
    "Long ordinary paragraph. ".repeat(100);
  const pdf = await generateProposalPDF({
    id: "synthetic",
    client_name: "Synthetic Reviewer",
    client_email: "reviewer@example.invalid",
    bundle_name: "Synthetic offer",
    line_items: [
      {
        content_type: "service",
        content_id: "synthetic",
        title: "Prototype",
        price: 997,
        description,
      },
    ],
    subtotal: 997,
    discount_amount: 0,
    total_amount: 997,
    terms_text: terms,
    created_at: "2026-09-10T12:00:00Z",
    valid_until: "",
  });
  const extracted = (await parsePDF(pdf)).text
    .replace(/-\s*\n\s*/g, "")
    .replace(/\s+/g, " ");
  expect(extracted).toContain(description);
  expect(extracted).toContain("$997");
  expect(extracted.match(/\$498\.50/g)).toHaveLength(2);
  expect(extracted).toContain("<script>literal text</script>");
  expect(extracted).toContain("AmaduTown Advisory Solutions, LLC");
}, 20000);
