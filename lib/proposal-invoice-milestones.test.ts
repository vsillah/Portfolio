import { expect, it } from "vitest";
import { invoiceMilestoneNextStep } from "./proposal-invoice-milestones";
it("distinguishes signatures from receipts and delivery acceptance", () => {
  expect(invoiceMilestoneNextStep(false, 0, false, "$498.50")).toContain(
    "sign the proposal and agreement first",
  );
  expect(invoiceMilestoneNextStep(true, 0, false, "$498.50")).toContain(
    "No deposit has been recorded",
  );
  expect(invoiceMilestoneNextStep(true, 1, false, "$498.50")).toContain(
    "due only after you accept delivery",
  );
  expect(invoiceMilestoneNextStep(true, 1, true, "$498.50")).toContain(
    "Final payment has not been recorded",
  );
  expect(invoiceMilestoneNextStep(true, 2, true, "$498.50")).toContain(
    "No further payment is due",
  );
});
