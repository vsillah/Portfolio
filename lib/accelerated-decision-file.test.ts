import { describe, expect, it } from "vitest";
import {
  DECISION_FILE_VERSION,
  emptyDecisionFile,
  lessons,
  validateDecisionFile,
} from "./accelerated-decision-file";
import { reviewServiceCandidates, parseReviewCatalogOffer, catalogOfferHref } from "./accelerated-service-review";

describe("Accelerated decision file", () => {
  it("keeps a single version-bound worksheet for every approved lesson artifact", () => {
    expect(lessons.map((lesson) => lesson.id)).toEqual(
      Array.from(
        { length: 16 },
        (_, index) => `L${String(index + 1).padStart(2, "0")}`,
      ),
    );
    expect(new Set(lessons.map((lesson) => lesson.artifact)).size).toBe(16);
    expect(lessons.map((lesson) => lesson.act)).toEqual([
      "Signals",
      "Signals",
      "Signals",
      "Signals",
      "Alignment",
      "Alignment",
      "Alignment",
      "Alignment",
      "Alignment",
      "Alignment",
      "Momentum",
      "Momentum",
      "Momentum",
      "Momentum",
      "Synthesis",
      "Synthesis",
    ]);
    expect(DECISION_FILE_VERSION).toContain("ed73dee7");
  });
  it("rejects stale, mismatched, and oversized answers without losing valid local data", () => {
    const draft = emptyDecisionFile("12345678-1234-1234-1234-123456789abc");
    draft.answers.L01 = "A decision I can test";
    expect(validateDecisionFile(draft)).toEqual({ ok: true, draft });
    expect(validateDecisionFile({ ...draft, version: "old" }).ok).toBe(false);
    expect(
      validateDecisionFile({ ...draft, answers: { L17: "extra" } }).ok,
    ).toBe(false);
    expect(
      validateDecisionFile({ ...draft, answers: { L01: "x".repeat(4001) } }).ok,
    ).toBe(false);
  });
  it("only proposes active offers with explained matches from the current catalog", () => {
    const matches = reviewServiceCandidates(
      { L01: "Our team needs automation for intake." },
      [
        {
          id: "12345678-1234-1234-1234-123456789abc", kind: "service",
          title: "Intake automation workshop",
          description: "Map intake workflow",
          is_active: true,
        },
        {
          id: 2, kind: "product",
          title: "Executive coaching",
          description: "Leadership",
          is_active: true,
        },
        { id: 3, kind: "product", title: "Automation sprint", is_active: false },
      ],
    );
    expect(matches.map((item) => item.id)).toEqual(["12345678-1234-1234-1234-123456789abc"]);
    expect(matches[0].href).toBe("/services/12345678-1234-1234-1234-123456789abc");
    expect(matches[0].reason).toContain("intake");
  });
  it("keeps service UUID and product bigint routes distinct and rejects malformed catalog ids", () => {
    expect(catalogOfferHref({ id: 42, kind: "product", title: "Intake guide" })).toBe("/store/42");
    expect(parseReviewCatalogOffer({ id: 42, title: "Bad service" }, "service")).toBeNull();
    expect(parseReviewCatalogOffer({ id: "42", title: "Bad product" }, "product")).toBeNull();
    expect(parseReviewCatalogOffer({ id: -1, title: "Bad product" }, "product")).toBeNull();
    expect(catalogOfferHref({ id: "synthetic-service", kind: "service", title: "Example" })).toBeNull();
  });
});
