import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import MilestonePayments from "./MilestonePayments";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it.each([0, 1, 2])(
  "renders invoice receipt count %s without a checkout action",
  async (count) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          enabled: true,
          settlement_mode: "manual_invoice",
          signed: true,
          amount: 498.5,
          document_identity: { revision: "current" },
          plan: count
            ? { installments_paid: count, delivery_status: "accepted" }
            : null,
        }),
      })),
    );
    render(<MilestonePayments token={"a".repeat(64)} />);
    await screen.findByRole("status");
    expect(
      screen.queryByRole("button", {
        name: /Pay initial|Pay final|pay.*full|monthly|installment/i,
      }),
    ).toBeNull();
    const text = screen.getByRole("region", {
      name: "Milestone payments",
    }).textContent;
    if (count === 0) expect(text).toContain("No deposit has been recorded");
    if (count === 1)
      expect(text).toContain("Final payment has not been recorded");
    if (count === 2) expect(text).toContain("No further payment is due");
    expect(text).toContain("$498.50");
  },
);
