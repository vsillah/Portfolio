import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TrumpetRecruitmentSocialCarousel from "./TrumpetRecruitmentSocialCarousel";

describe("approved social slide carousel", () => {
  it("shows one slide, seven precise toggles, and previous/next controls", () => {
    render(<TrumpetRecruitmentSocialCarousel />);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Social carousel slide 1 of 7" })).toBeInTheDocument();
    expect(within(screen.getByRole("tablist", { name: "Choose a social slide" })).getAllByRole("tab")).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "Next social slide" }));
    expect(screen.getByRole("status")).toHaveTextContent("Slide 2 of 7");
    expect(screen.getByRole("img", { name: "Social carousel slide 2 of 7" })).toHaveAttribute("src", expect.stringContaining("slide-02.png"));
    fireEvent.click(screen.getByRole("button", { name: "Previous social slide" }));
    expect(screen.getByRole("status")).toHaveTextContent("Slide 1 of 7");
    fireEvent.click(screen.getByRole("tab", { name: "Show social slide 7" }));
    expect(screen.getByRole("status")).toHaveTextContent("Slide 7 of 7");
  });

  it("supports arrow, Home, and End keys without a network request", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<TrumpetRecruitmentSocialCarousel />);
    const first = screen.getByRole("tab", { name: "Show social slide 1" });
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const second = screen.getByRole("tab", { name: "Show social slide 2" });
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(second, { key: "End" });
    expect(screen.getByRole("tab", { name: "Show social slide 7" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Show social slide 7" }), { key: "Home" });
    expect(first).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Slide 1 of 7");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
