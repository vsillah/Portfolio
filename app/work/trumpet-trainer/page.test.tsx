import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TrumpetTrainerPage, { metadata } from "./page";

vi.mock("@/components/Navigation", () => ({
  default: () => <nav aria-label="Site navigation" />,
}));

describe("Trumpet Trainer public page", () => {
  it("renders the pilot route with clear non-binding CTAs and privacy limits", () => {
    render(<TrumpetTrainerPage />);
    expect(metadata.title).toMatch(/Trumpet Trainer/);
    expect(
      screen.getByRole("heading", { level: 1, name: /first few minutes/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Explore tester interest" }),
    ).toHaveAttribute("href", "#interest");
    expect(
      screen.getByRole("link", { name: "See the practice concept" }),
    ).toHaveAttribute("href", "#how-it-works");
    expect(
      screen.getByText(
        /Please share no child name, photo, school, exact age, address, or practice recording/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/There is no checkout, paid entitlement/),
    ).toBeInTheDocument();
  });
});
