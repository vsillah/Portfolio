import { fireEvent, render, screen, within } from "@testing-library/react";
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
    expect(screen.getByTestId("persona-card-0")).toHaveClass("motion-reduce:transition-none");
    fireEvent.click(screen.getByText("Contact path"));
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
});
