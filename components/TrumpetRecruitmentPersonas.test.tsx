import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TrumpetRecruitmentPersonas from "./TrumpetRecruitmentPersonas";

const personas = [
  { name: "Parents or guardians", headline: "Practice starts here.", support: "Home practice.", channel: "Adult opt-in." },
  { name: "Private trumpet tutors", headline: "Between lessons.", support: "One-to-one studio.", channel: "Known relationship." },
  { name: "Band educators", headline: "Between rehearsals.", support: "School program.", channel: "Official staff path." },
  { name: "Community music programs", headline: "Shared music space.", support: "Adult organizers.", channel: "Public program route." },
];

describe("adult perspective deck", () => {
  it("keeps four layered shells and one accessible active card", () => {
    render(<TrumpetRecruitmentPersonas personas={personas} />);
    expect(screen.getAllByTestId(/^persona-card-/)).toHaveLength(4);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Persona 1 of 4");
    expect(screen.getByTestId("persona-card-0")).toHaveAttribute("data-depth", "0");
    expect(screen.getByTestId("persona-card-3")).toHaveAttribute("data-depth", "3");
    expect(screen.getByTestId("persona-card-1")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("persona-card-1").querySelector("summary")).toHaveAttribute("tabindex", "-1");
    fireEvent.click(screen.getByRole("article").querySelector("summary")!);
    expect(screen.getByText("Adult opt-in.")).toBeVisible();
  });

  it("sends the active card to the back and brings named personas forward without requests", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<TrumpetRecruitmentPersonas personas={personas} />);
    fireEvent.click(screen.getByRole("button", { name: "Next adult perspective" }));
    expect(screen.getByRole("status")).toHaveTextContent("Persona 2 of 4");
    expect(screen.getByTestId("persona-card-0")).toHaveAttribute("data-depth", "3");
    expect(screen.getByRole("heading", { name: "Private trumpet tutors" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous adult perspective" }));
    expect(screen.getByRole("status")).toHaveTextContent("Persona 1 of 4");
    fireEvent.click(screen.getByRole("button", { name: "Show Community music programs" }));
    expect(screen.getByRole("heading", { name: "Community music programs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Community music programs" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("advances and reverses with a deliberate horizontal touch swipe", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<TrumpetRecruitmentPersonas personas={personas} />);
    const deck = screen.getByLabelText("Adult perspective card deck");
    fireEvent.pointerDown(deck, { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: 250, clientY: 240 });
    fireEvent.pointerMove(deck, { pointerId: 1, pointerType: "touch", clientX: 180, clientY: 244 });
    fireEvent.pointerUp(deck, { pointerId: 1, pointerType: "touch", clientX: 150, clientY: 245 });
    expect(screen.getByRole("status")).toHaveTextContent("Persona 2 of 4: Private trumpet tutors");
    expect(screen.getByTestId("persona-card-0")).toHaveAttribute("data-depth", "3");
    fireEvent.pointerDown(deck, { pointerId: 2, pointerType: "touch", isPrimary: true, clientX: 80, clientY: 240 });
    fireEvent.pointerUp(deck, { pointerId: 2, pointerType: "touch", clientX: 170, clientY: 242 });
    expect(screen.getByRole("status")).toHaveTextContent("Persona 1 of 4: Parents or guardians");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("ignores short taps, sub-threshold drags, and mostly vertical scrolling", () => {
    render(<TrumpetRecruitmentPersonas personas={personas} />);
    const deck = screen.getByLabelText("Adult perspective card deck");
    const capture = vi.fn();
    Object.defineProperty(deck, "setPointerCapture", { value: capture, configurable: true });
    fireEvent.pointerDown(deck, { pointerId: 3, pointerType: "touch", isPrimary: true, clientX: 220, clientY: 220 });
    fireEvent.pointerUp(deck, { pointerId: 3, pointerType: "touch", clientX: 220, clientY: 220 });
    expect(capture).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("article").querySelector("summary")!);
    expect(screen.getByText("Adult opt-in.")).toBeVisible();
    for (const [startX, startY, endX, endY] of [[220, 220, 220, 220], [220, 220, 185, 222], [220, 220, 160, 330]]) {
      fireEvent.pointerDown(deck, { pointerId: 3, pointerType: "touch", isPrimary: true, clientX: startX, clientY: startY });
      fireEvent.pointerMove(deck, { pointerId: 3, pointerType: "touch", clientX: endX, clientY: endY });
      fireEvent.pointerUp(deck, { pointerId: 3, pointerType: "touch", clientX: endX, clientY: endY });
      expect(screen.getByRole("status")).toHaveTextContent("Persona 1 of 4: Parents or guardians");
    }
  });
});
