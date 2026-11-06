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

  it("presents a noindex concept without redundant hero copy or an action form", () => {
    render(<TrumpetRecruitmentPage />);
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.title).toBe("Trumpet Trainer | The first practice step");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("first step for beginner trumpet practice");
    expect(screen.queryByText(/A concept preview for the adults supporting a new player/)).not.toBeInTheDocument();
    expect(screen.queryByText("Gameplay preview")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Inside Trumpet Trainer" })).toBeInTheDocument();
    expect(screen.queryByText(/An example path, not a fixed schedule or a promise of progress/)).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to Trumpet Trainer/ })).toHaveAttribute("href", "/work/trumpet-trainer");
    const text = screen.getByRole("main").textContent ?? "";
    expect(text).not.toMatch(/internal review|review only|approved review slides|pending approval|media source and claim limits|operating boundaries|decision before activation|review details|message drafts|contact path|pilot-fit signals|qualified conversations|full activation boundary|captain must approve|tester sign-ups|tester interest|recruitment/i);
    expect(screen.queryByRole("link", { name: /interest form|enroll|sign up/i })).not.toBeInTheDocument();
  });

  it("closes with a clear product action while keeping recruitment off", () => {
    render(<TrumpetRecruitmentPage />);
    const endcap = screen.getByRole("region", { name: "Ready to hear the next note?" });
    expect(within(endcap).getByRole("heading", { name: "Ready to hear the next note?" })).toBeInTheDocument();
    expect(within(endcap).getByText("Open Trumpet Trainer and try one short practice step.")).toBeInTheDocument();
    const primary = within(endcap).getByRole("link", { name: "Try Trumpet Trainer (opens the practice app in a new tab)" });
    expect(primary).toHaveAttribute("href", "https://trumpet-trainer-zeta.vercel.app/");
    expect(primary).toHaveAttribute("target", "_blank");
    expect(primary.getAttribute("rel")?.split(" ")).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
    expect(primary.className).toContain("focus-visible:outline");
    const secondary = within(endcap).getByRole("link", { name: "See the product story" });
    expect(secondary).toHaveAttribute("href", "/work/trumpet-trainer");
    expect(secondary).not.toHaveAttribute("target");
    expect(secondary.className).toContain("focus-visible:outline");
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /interest|enroll|sign up|checkout/i })).not.toBeInTheDocument();
  });

  it("keeps the exact gameplay and seven-screen flow with a plain demonstration disclosure", () => {
    render(<TrumpetRecruitmentPage />);
    const gameplay = screen.getByLabelText("Illustrative Trumpet Trainer gameplay") as HTMLVideoElement;
    expect(gameplay).toHaveAttribute("controls");
    expect(gameplay).toHaveAttribute("preload", "metadata");
    expect(gameplay.querySelector("source")).toHaveAttribute("src", "/showcases/trumpet-trainer/c19989a3/gameplay-landscape.mp4");
    expect(gameplay).toHaveTextContent("The images below show the practice flow.");
    expect(screen.getByText(/sound in this preview was generated for the demonstration.*does not show a student's progress/)).toBeInTheDocument();
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
  });
});
