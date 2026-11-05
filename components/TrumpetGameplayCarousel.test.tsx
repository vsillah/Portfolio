import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TrumpetGameplayCarousel from "./TrumpetGameplayCarousel";

describe("Trumpet gameplay carousel", () => {
  it("shows real product screens and supports buttons, dots, and arrow keys", () => {
    render(<TrumpetGameplayCarousel />);
    const carousel = screen.getByRole("region", { name: "Trumpet Trainer product screens" });
    expect(screen.getByRole("group", { name: /1 of 7: A place to begin/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next product screen" }));
    expect(screen.getByRole("group", { name: /2 of 7: See the next step/ })).toBeInTheDocument();
    fireEvent.keyDown(carousel, { key: "ArrowLeft" });
    expect(screen.getByRole("group", { name: /1 of 7: A place to begin/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show screen 7/ }));
    expect(screen.getByRole("group", { name: /7 of 7: Shape a practice tune/ })).toBeInTheDocument();
    expect(screen.getByText(/synthetic test input/i)).toBeInTheDocument();
  });
});
