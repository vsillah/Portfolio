import { expect, it } from "vitest";
import { parseProposalTerms } from "./proposal-terms";
it("keeps ordinary legacy prose literal", () => {
  const text = "Payment is due upon acceptance. <script>alert(1)</script>";
  expect(parseProposalTerms(text)).toEqual([{ kind: "paragraph", text }]);
});
it("preserves every nonempty source line with numbered and bullet sections", () => {
  const text =
    "Deliverables\n1  First item: exact wording.\n2. Second item.\nScope\n- No live integrations.\n• No PHI.\nPayment terms\n$997 total; $498.50 before kickoff and $498.50 after acceptance.\n" +
    "Long paragraph. ".repeat(120);
  const blocks = parseProposalTerms(text);
  expect(blocks.map((b) => b.text).join("\n")).toBe(text);
  expect(blocks.map((b) => b.kind)).toContain("payment");
  expect(blocks.map((b) => b.kind)).toContain("ordered");
});
it("retains long headings as readable literal text without truncation", () => {
  const text = "Heading ".repeat(30) + "\nOrdinary terms.";
  expect(
    parseProposalTerms(text)
      .map((b) => b.text)
      .join("\n"),
  ).toBe(text);
});

it("does not promote ordinary multiline prose or list continuations to headings", () => {
  const text =
    "We will work together\nPlease provide your feedback\nCompletion means:\nNothing is inferred here";
  expect(parseProposalTerms(text).every((b) => b.kind === "paragraph")).toBe(
    true,
  );
});
