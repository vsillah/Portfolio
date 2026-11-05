import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TrumpetInterestForm from "./TrumpetInterestForm";

function completeForm() {
  fireEvent.change(screen.getByLabelText("Your name"), {
    target: { value: "Adult Tester" },
  });
  fireEvent.change(screen.getByLabelText("Your email"), {
    target: { value: "adult@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Your role"), {
    target: { value: "Parent or guardian" },
  });
  fireEvent.change(screen.getByLabelText("Approximate student experience"), {
    target: { value: "Just starting" },
  });
  fireEvent.change(screen.getByLabelText("What interests you about testing?"), {
    target: { value: "A short routine between lessons" },
  });
}

describe("Trumpet Trainer interest review", () => {
  it("asks only for adult contact and broad student experience", () => {
    render(<TrumpetInterestForm />);
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.getByLabelText("Your email")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Approximate student experience"),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/child name|school|exact age|address|photo/i),
    ).not.toBeInTheDocument();
  });

  it("prepares a draft only after valid adult input and never claims submission", () => {
    render(<TrumpetInterestForm />);
    completeForm();
    fireEvent.click(
      screen.getByRole("button", { name: "Prepare email draft" }),
    );
    const link = screen.getByRole("link", { name: /Open email draft/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:vambah@amadutown.com"),
    );
    expect(link.getAttribute("href")).toContain("Adult%20Tester");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Nothing has been sent by this website",
    );
  });

  it("fails closed when optional notes include child identifiers", () => {
    render(<TrumpetInterestForm />);
    completeForm();
    fireEvent.change(screen.getByLabelText("Optional notes"), {
      target: { value: "Child's name: Taylor" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Prepare email draft" }),
    );
    expect(
      screen.queryByRole("link", { name: /Open email draft/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Please remove child identifiers",
    );
  });
});
