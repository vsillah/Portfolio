import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ProposalTerms } from "./ProposalTerms";
it("renders semantic sections and lists while escaping unsafe text", () => {
  const { container } = render(
    <ProposalTerms
      text={
        "Deliverables\n1  First item.\n2  Second item.\nScope\n- Fictional only.\nPayment terms\n$997 total; deposit $498.50.\n<script>unsafe()</script>"
      }
    />,
  );
  expect(screen.getByRole("heading", { name: "Deliverables" })).toBeTruthy();
  expect(container.querySelector("ol")).toBeTruthy();
  expect(container.querySelector("ul")).toBeTruthy();
  expect(screen.getByRole("table")).toBeTruthy();
  expect(container.querySelector("script")).toBeNull();
  expect(screen.getByText("<script>unsafe()</script>")).toBeTruthy();
});
