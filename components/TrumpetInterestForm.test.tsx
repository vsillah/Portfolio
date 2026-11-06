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
  fireEvent.click(
    screen.getByRole("checkbox", { name: /I confirm I am an adult/i }),
  );
}

describe("Trumpet Trainer interest review", () => {
  it("links to the tester experience without changing the email-draft action", () => {
    render(<TrumpetInterestForm />);
    const link = screen.getByRole("link", { name: "See the tester experience" });
    expect(link).toHaveAttribute("href", "/work/trumpet-trainer/recruitment");
    expect(link.className).toContain("focus-visible:outline");
    expect(screen.getByRole("button", { name: "Prepare email draft" })).toHaveAttribute("type", "submit");
  });

  it("asks only for adult contact and broad student experience", () => {
    render(<TrumpetInterestForm />);
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.getByLabelText("Your email")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Approximate student experience"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", {
        name: /child name|school|exact age|address|photo/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /I confirm I am an adult/i }),
    ).toBeRequired();
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

  it("allows an adult educator's school email and generic school context", () => {
    render(<TrumpetInterestForm />);
    completeForm();
    fireEvent.change(screen.getByLabelText("Your email"), {
      target: { value: "teacher@schools.org" },
    });
    fireEvent.change(
      screen.getByLabelText("What interests you about testing?"),
      {
        target: {
          value:
            "I teach at a school and want to test short practice routines.",
        },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Prepare email draft" }),
    );
    expect(
      screen.getByRole("link", { name: /Open email draft/i }),
    ).toHaveAttribute("href", expect.stringContaining("teacher%40schools.org"));
  });

  it.each([
    "School: Lincoln Middle",
    "School name: Lincoln Middle",
    "My child's school is Lincoln Middle",
    "Child's name: Taylor",
    "Age: 10",
    "Aged 10",
    "Address: 10 Example Street",
    "Photo attached",
    "Recording of my child",
  ])("rejects explicit child details in notes: %s", (notes) => {
    render(<TrumpetInterestForm />);
    completeForm();
    fireEvent.change(screen.getByLabelText("Optional notes"), {
      target: { value: notes },
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

  it("checks the interest field for explicit child details too", () => {
    render(<TrumpetInterestForm />);
    completeForm();
    fireEvent.change(
      screen.getByLabelText("What interests you about testing?"),
      {
        target: { value: "My child's school is Lincoln Middle" },
      },
    );
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

  it("does not prepare a draft without adult confirmation", () => {
    render(<TrumpetInterestForm />);
    completeForm();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /I confirm I am an adult/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Prepare email draft" }),
    );
    expect(
      screen.queryByRole("link", { name: /Open email draft/i }),
    ).not.toBeInTheDocument();
  });
});
