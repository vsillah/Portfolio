import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TrumpetRecruitmentPersonas from "./TrumpetRecruitmentPersonas";

const personas = [
  { name: "Parents or guardians", role: "Parent or guardian", personName: "Avery", quote: "A clear next note.", goal: "Start practice.", friction: "Too many reminders.", currentBehavior: "Uses a timer.", proof: "Show the next note.", channel: "Adult opt-in." },
  { name: "Private trumpet tutors", role: "Private trumpet tutor", personName: "Morgan", quote: "Keep lessons moving.", goal: "Continue practice.", friction: "Lost continuity.", currentBehavior: "Writes notes.", proof: "Follow independently.", channel: "Known relationship." },
  { name: "Band educators", role: "Band educator", personName: "Casey", quote: "One next step.", goal: "Help many beginners.", friction: "Limited time.", currentBehavior: "Teaches sections.", proof: "Avoid new management work.", channel: "Official staff path." },
  { name: "Community music programs", role: "Community program lead", personName: "Jordan", quote: "Time is limited.", goal: "Help more beginners.", friction: "Shared resources.", currentBehavior: "Coordinates adults.", proof: "Keep it simple.", channel: "Public program route." },
];

describe("adult perspective deck", () => {
  it("keeps four layered shells and one accessible active card", () => {
    render(<TrumpetRecruitmentPersonas personas={personas} />);
    expect(screen.getAllByTestId(/^persona-card-/)).toHaveLength(4);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Example 1 of 4");
    expect(screen.getByRole("button", { name: "Previous example" })).toHaveTextContent("◀");
    expect(screen.getByRole("button", { name: "Next example" })).toHaveTextContent("▶");
    expect(screen.getAllByRole("button", { name: /^Show / })).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Show Parents or guardians" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("persona-card-0")).toHaveAttribute("data-depth", "0");
    expect(screen.getByTestId("persona-card-3")).toHaveAttribute("data-depth", "3");
    expect(screen.getByTestId("persona-card-1")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByText("Contact path")).not.toBeInTheDocument();
  });

  it("uses one image and copy region structure for every persona", () => {
    render(<TrumpetRecruitmentPersonas personas={personas.map((persona, index) => ({ ...persona, imageSrc: `/persona-${index}.webp` }))} />);
    const imageRegions = personas.map((_, index) => screen.getByTestId(`persona-image-${index}`));
    const copyRegions = personas.map((_, index) => screen.getByTestId(`persona-copy-${index}`));
    expect(new Set(imageRegions.map((region) => region.className))).toHaveProperty("size", 1);
    expect(new Set(copyRegions.map((region) => region.className))).toHaveProperty("size", 1);
    for (const [index, region] of imageRegions.entries()) {
      expect(region.parentElement).toBe(screen.getByTestId(`persona-card-${index}`));
      expect(region.querySelector("img")).toHaveClass("object-cover", "object-center");
      expect(copyRegions[index].parentElement).toBe(region.parentElement);
    }
  });

  it("exposes one fictional profile schema without invented demographics", () => {
    render(<TrumpetRecruitmentPersonas personas={personas} />);
    expect(new Set(personas.map((persona) => persona.personName)).size).toBe(personas.length);
    for (const persona of personas) {
      fireEvent.click(screen.getByRole("button", { name: `Show ${persona.name}` }));
      const card = screen.getByRole("article");
      expect(within(card).getByText("Illustrative example")).toBeInTheDocument();
      expect(within(card).getByRole("heading", { name: persona.personName })).toBeInTheDocument();
      expect(within(card).getByText(persona.role)).toBeInTheDocument();
      expect(within(card).getByText(`“${persona.quote}”`)).toBeInTheDocument();
      expect([...card.querySelectorAll("dt")].map((field) => field.textContent)).toEqual(["Trying to", "Gets in the way", "What they do now", "What could help"]);
      expect([...card.querySelectorAll("dd")].map((field) => field.textContent)).toEqual([persona.goal, persona.friction, persona.currentBehavior, persona.proof]);
      expect(within(card).queryByText("Contact path")).not.toBeInTheDocument();
      expect(card).not.toHaveTextContent(/\b(age|income|address|ethnicity|race)\b/i);
    }
  });

  it("sends the active card to the back and brings named personas forward without requests", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<TrumpetRecruitmentPersonas personas={personas} />);
    fireEvent.click(screen.getByRole("button", { name: "Next example" }));
    expect(screen.getByRole("status")).toHaveTextContent("Example 2 of 4");
    expect(screen.getByTestId("persona-card-0")).toHaveAttribute("data-depth", "3");
    expect(screen.getByRole("heading", { name: "Morgan" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous example" }));
    expect(screen.getByRole("status")).toHaveTextContent("Example 1 of 4");
    fireEvent.click(screen.getByRole("button", { name: "Show Community music programs" }));
    expect(screen.getByRole("heading", { name: "Jordan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Community music programs" })).toHaveAttribute("aria-current", "true");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("uses opposite outgoing arcs for arrow and dot navigation, then settles at the same depths", () => {
    vi.useFakeTimers();
    try {
      render(<TrumpetRecruitmentPersonas personas={personas} />);
      fireEvent.click(screen.getByRole("button", { name: "Next example" }));
      expect(screen.getByTestId("persona-card-0")).toHaveAttribute("data-motion-direction", "forward");
      expect(screen.getByTestId("persona-card-0")).toHaveAttribute("data-depth", "3");
      expect(screen.getByRole("heading", { name: "Morgan" })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(520));
      expect(screen.getByTestId("persona-card-0")).not.toHaveAttribute("data-motion-direction");
      fireEvent.click(screen.getByRole("button", { name: "Previous example" }));
      expect(screen.getByTestId("persona-card-1")).toHaveAttribute("data-motion-direction", "reverse");
      expect(screen.getByTestId("persona-card-1")).toHaveAttribute("data-depth", "1");
      act(() => vi.advanceTimersByTime(520));
      expect(screen.getByRole("heading", { name: "Avery" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Show Community music programs" }));
      expect(screen.getByTestId("persona-card-0")).toHaveAttribute("data-motion-direction", "reverse");
      expect(screen.getByRole("button", { name: "Show Community music programs" })).toHaveAttribute("aria-current", "true");
      act(() => vi.advanceTimersByTime(520));
      expect(screen.getByTestId("persona-card-3")).toHaveAttribute("data-depth", "0");
      expect(screen.getByTestId("persona-card-0")).toHaveAttribute("data-depth", "1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("advances and reverses with a deliberate horizontal touch swipe", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<TrumpetRecruitmentPersonas personas={personas} />);
    const deck = screen.getByLabelText("Adults who support beginner players");
    fireEvent.pointerDown(deck, { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: 250, clientY: 240 });
    fireEvent.pointerMove(deck, { pointerId: 1, pointerType: "touch", clientX: 180, clientY: 244 });
    expect(screen.getByTestId("persona-card-0")).toHaveAttribute("data-dragging", "true");
    expect(deck.getAttribute("style")).toContain("--drag-rotate: -4.9deg");
    fireEvent.pointerUp(deck, { pointerId: 1, pointerType: "touch", clientX: 150, clientY: 245 });
    expect(screen.getByRole("status")).toHaveTextContent("Example 2 of 4: Private trumpet tutors");
    expect(screen.getByTestId("persona-card-0")).toHaveAttribute("data-depth", "3");
    expect(screen.getByTestId("persona-card-0")).toHaveAttribute("data-motion-direction", "forward");
    fireEvent.pointerDown(deck, { pointerId: 2, pointerType: "touch", isPrimary: true, clientX: 80, clientY: 240 });
    fireEvent.pointerUp(deck, { pointerId: 2, pointerType: "touch", clientX: 170, clientY: 242 });
    expect(screen.getByRole("status")).toHaveTextContent("Example 1 of 4: Parents or guardians");
    expect(screen.getByTestId("persona-card-1")).toHaveAttribute("data-motion-direction", "reverse");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("ignores short taps, sub-threshold drags, and mostly vertical scrolling", () => {
    render(<TrumpetRecruitmentPersonas personas={personas} />);
    const deck = screen.getByLabelText("Adults who support beginner players");
    const capture = vi.fn();
    Object.defineProperty(deck, "setPointerCapture", { value: capture, configurable: true });
    fireEvent.pointerDown(deck, { pointerId: 3, pointerType: "touch", isPrimary: true, clientX: 220, clientY: 220 });
    fireEvent.pointerUp(deck, { pointerId: 3, pointerType: "touch", clientX: 220, clientY: 220 });
    expect(capture).not.toHaveBeenCalled();
    for (const [startX, startY, endX, endY] of [[220, 220, 220, 220], [220, 220, 185, 222], [220, 220, 160, 330]]) {
      fireEvent.pointerDown(deck, { pointerId: 3, pointerType: "touch", isPrimary: true, clientX: startX, clientY: startY });
      fireEvent.pointerMove(deck, { pointerId: 3, pointerType: "touch", clientX: endX, clientY: endY });
      fireEvent.pointerUp(deck, { pointerId: 3, pointerType: "touch", clientX: endX, clientY: endY });
      expect(screen.getByRole("status")).toHaveTextContent("Example 1 of 4: Parents or guardians");
      expect(screen.getByTestId("persona-card-0")).not.toHaveAttribute("data-motion-direction");
      expect(deck.getAttribute("style")).toContain("--drag-x: 0px");
    }
  });

  it("changes selection without an arc when reduced motion is requested", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    try {
      render(<TrumpetRecruitmentPersonas personas={personas} />);
      fireEvent.click(screen.getByRole("button", { name: "Next example" }));
      expect(screen.getByRole("heading", { name: "Morgan" })).toBeInTheDocument();
      expect(screen.getByTestId("persona-card-0")).not.toHaveAttribute("data-motion-direction");
      expect(screen.getByTestId("persona-card-0")).toHaveAttribute("data-depth", "3");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
