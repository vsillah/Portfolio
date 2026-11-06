import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import TrumpetRecruitmentPage, { metadata } from "./page";

vi.mock("@/components/Navigation", () => ({ default: () => <nav aria-label="Site navigation" /> }));
const require = createRequire(import.meta.url);

describe("Trumpet Trainer concept preview", () => {
  it("keeps persona media out of the unrelated admin function trace", () => {
    const config = require("../../../../next.config.js");
    const exclusions = config.experimental.outputFileTracingExcludes["/api/admin/social-content/*/bind-approved-master"];
    expect(exclusions).toContain("./public/work/trumpet-trainer/personas/*");
  });

  it("presents a closed, noindex concept without operator copy or an action form", () => {
    render(<TrumpetRecruitmentPage />);
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.title).toBe("Trumpet Trainer | The first practice step");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("first step for beginner trumpet practice");
    expect(screen.getByText(/Tester sign-ups are not open/)).toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Back to Trumpet Trainer/ })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /Back to Trumpet Trainer/ }).every((link) => link.getAttribute("href") === "/work/trumpet-trainer")).toBe(true);
    const text = screen.getByRole("main").textContent ?? "";
    expect(text).not.toMatch(/internal review|review only|approved review slides|pending approval|media source and claim limits|operating boundaries|decision before activation|review details|message drafts|contact path|pilot-fit signals|qualified conversations|full activation boundary|captain must approve/i);
    expect(screen.queryByRole("link", { name: /interest form|enroll|sign up/i })).not.toBeInTheDocument();
  });

  it("keeps the exact gameplay and seven-image flow with a plain synthetic disclosure", () => {
    render(<TrumpetRecruitmentPage />);
    const gameplay = screen.getByLabelText("Illustrative Trumpet Trainer gameplay") as HTMLVideoElement;
    expect(gameplay).toHaveAttribute("controls");
    expect(gameplay).toHaveAttribute("preload", "metadata");
    expect(gameplay.querySelector("source")).toHaveAttribute("src", "/showcases/trumpet-trainer/c19989a3/gameplay-landscape.mp4");
    expect(gameplay).toHaveTextContent("The images below show the practice flow.");
    expect(screen.getByText(/synthetic audio.*No student or customer was recorded/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Trumpet Trainer screen 1 of 7" })).toBeInTheDocument();
    expect(within(screen.getByRole("tablist", { name: "Choose a screen" })).getAllByRole("tab")).toHaveLength(7);
    expect(screen.queryByText("Carousel provenance")).not.toBeInTheDocument();
  });

  it("keeps four adult examples and a selectable six-step practice path", () => {
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    render(<TrumpetRecruitmentPage />);
    const audience = screen.getByRole("heading", { name: "The adults around a new player" }).closest("section")!;
    expect(within(audience).getAllByRole("article")).toHaveLength(1);
    for (const [name, person] of [["Parents or guardians", "Avery"], ["Private trumpet tutors", "Morgan"], ["Band educators", "Casey"], ["Community music programs", "Jordan"]]) {
      fireEvent.click(within(audience).getByRole("button", { name: `Show ${name}` }));
      expect(within(audience).getByRole("heading", { name: person })).toBeInTheDocument();
      expect(within(within(audience).getByRole("article")).getByText("Illustrative example")).toBeInTheDocument();
    }
    const path = screen.getByRole("region", { name: "Example practice path" });
    expect(within(path).getAllByRole("button", { name: /^Step \d, days/ })).toHaveLength(6);
    expect(within(path).getByRole("img", { name: "Upright brass trumpet" })).toHaveAttribute("src", "/work/trumpet-trainer/recruitment-motion/poster.png");
    expect(readFileSync(join(process.cwd(), "public/work/trumpet-trainer/recruitment-motion/poster.png")).length).toBeGreaterThan(0);
    fireEvent.click(within(path).getByRole("button", { name: /Step 4, days/ }));
    expect(path).toHaveAttribute("data-active", "4");
    expect(within(path).getByRole("heading", { name: "Listen and adjust" })).toBeInTheDocument();
    expect(within(path).getByText(/teacher's ear/)).toBeInTheDocument();
    expect(screen.getByText(/not a fixed schedule or a promise of progress/)).toBeInTheDocument();
  });
});
